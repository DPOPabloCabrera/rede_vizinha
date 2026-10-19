require('dotenv').config();
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs/promises');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer = require('multer');
const { pool } = require('./database');

const app = express();
const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || '127.0.0.1';
const jwtSecret = process.env.JWT_SECRET || '';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '8h';
const condominiumCode = process.env.CONDOMINIO_CODIGO || 'FLEX-OSASCO-2';
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:8765,http://localhost:8765')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
const MAX_PRODUCTS = 30;
const imageExtensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 32, fields: 32, parts: 70 },
  fileFilter(req, file, callback) {
    if (!imageExtensions[file.mimetype]) return callback(new HttpError(400, 'Use uma imagem JPG, PNG ou WebP.'));
    callback(null, true);
  }
});
const imageUploadFields = imageUpload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'listingImage', maxCount: 1 },
  ...Array.from({ length: MAX_PRODUCTS }, (_, index) => ({ name: `productImage_${index}`, maxCount: 1 }))
]);
const menuFileTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const menuUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 4, parts: 6, fieldSize: 20000 },
  fileFilter(req, file, callback) {
    if (!menuFileTypes.has(file.mimetype)) return callback(new HttpError(400, 'Envie o cardápio em PDF, JPG, PNG ou WebP.'));
    callback(null, true);
  }
}).single('menuFile');
const PAYMENT_METHODS = ['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO'];
const FLEX_OPTIONS = ['FLEX_1', 'FLEX_2'];
const categories = new Set([
  'Gastronomia', 'Beleza e bem-estar', 'Casa e manutenção', 'Aulas e atividades',
  'Pets', 'Moda e acessórios', 'Outros serviços'
]);
const statuses = new Set(['PENDENTE', 'APROVADA', 'REJEITADA', 'PAUSADA']);
const indicationCategories = new Set([
  'Gastronomia', 'Manutenção e reformas', 'Beleza e bem-estar', 'Aulas e atividades',
  'Pets', 'Moda e acessórios', 'Tecnologia e design', 'Outros serviços'
]);

if (jwtSecret.length < 32 || jwtSecret.includes('COLOQUE_AQUI')) {
  throw new Error('Configure JWT_SECRET no arquivo .env com uma chave aleatória de pelo menos 32 caracteres.');
}

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origem não autorizada pelo CORS.'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '32kb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  fallthrough: false,
  maxAge: '7d',
  immutable: true,
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }));

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const text = (value) => typeof value === 'string' ? value.trim() : '';
const normalizeEmail = (value) => text(value).toLowerCase();
const emailLooksValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
const phoneDigits = (value) => text(value).replace(/\D/g, '');
const normalizeSearch = (value) => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function isImageBufferValid(file) {
  const buffer = file?.buffer;
  if (!buffer || !imageExtensions[file.mimetype]) return false;
  if (file.mimetype === 'image/jpeg') return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (file.mimetype === 'image/png') return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (file.mimetype === 'image/webp') return buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

async function storeImage(file, directory, savedPaths) {
  if (!file) return null;
  if (!isImageBufferValid(file)) throw new HttpError(400, 'O arquivo enviado não corresponde a uma imagem JPG, PNG ou WebP válida.');
  const folder = path.join(__dirname, 'uploads', directory);
  await fs.mkdir(folder, { recursive: true });
  const filename = `${crypto.randomUUID()}.${imageExtensions[file.mimetype]}`;
  const absolutePath = path.join(folder, filename);
  await fs.writeFile(absolutePath, file.buffer, { flag: 'wx' });
  savedPaths.push(absolutePath);
  return `/uploads/${directory}/${filename}`;
}

async function removeStoredImages(pathsToRemove) {
  await Promise.all(pathsToRemove.map((filename) => fs.unlink(filename).catch(() => {})));
}

async function removeStoredImageUrls(urls) {
  const pathsToRemove = [...new Set(urls)].map((url) => {
    const match = /^\/uploads\/(profiles|listings|products)\/([a-f0-9-]{36}\.(?:jpg|png|webp))$/i.exec(url || '');
    return match ? path.join(__dirname, 'uploads', match[1], match[2]) : null;
  }).filter(Boolean);
  await removeStoredImages(pathsToRemove);
}

function passwordResetUrl(token) {
  const target = process.env.FRONTEND_URL || 'http://127.0.0.1:8765/cadastro.html';
  const url = new URL(target);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('FRONTEND_URL deve usar HTTPS em produção.');
  }
  url.searchParams.set('modo', 'redefinir');
  url.searchParams.set('token', token);
  return url.toString();
}

async function sendPasswordResetEmail(email, resetUrl) {
  const host = text(process.env.SMTP_HOST);
  const from = text(process.env.EMAIL_FROM);
  const username = text(process.env.SMTP_USER);
  const password = process.env.SMTP_PASSWORD || '';
  if (!host || !from) throw new Error('SMTP_HOST e EMAIL_FROM ainda não foram configurados.');
  if (Boolean(username) !== Boolean(password)) throw new Error('Configure SMTP_USER e SMTP_PASSWORD juntos.');

  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    ...(username ? { auth: { user: username, pass: password } } : {})
  });
  const safeUrl = resetUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  await transport.sendMail({
    from,
    to: email,
    subject: 'Redefinição de senha — Rede Vizinha',
    text: `Recebemos um pedido para redefinir a senha da sua conta. Use este link em até 30 minutos: ${resetUrl}\n\nSe você não fez este pedido, ignore esta mensagem.`,
    html: `<p>Recebemos um pedido para redefinir a senha da sua conta na Rede Vizinha.</p><p><a href="${safeUrl}">Criar uma nova senha</a></p><p>O link expira em 30 minutos e só pode ser usado uma vez. Se você não fez este pedido, ignore esta mensagem.</p>`
  });
}

const categoryEmoji = (category) => ({
  'Gastronomia': '🍰', 'Beleza e bem-estar': '🌷', 'Casa e manutenção': '🪴',
  'Aulas e atividades': '🧘', 'Pets': '🐾', 'Moda e acessórios': '🧶', 'Outros serviços': '✳'
}[category] || '✳');
const categoryCover = (category) => ({
  'Gastronomia': 'cover-food', 'Beleza e bem-estar': 'cover-beauty', 'Casa e manutenção': 'cover-home',
  'Aulas e atividades': 'cover-activity', 'Pets': 'cover-default', 'Moda e acessórios': 'cover-craft',
  'Outros serviços': 'cover-default'
}[category] || 'cover-default');

async function getCondominiumId(db = pool) {
  const { rows } = await db.query(
    'SELECT id FROM condominio WHERE codigo_convite = $1 AND ativo = TRUE',
    [condominiumCode]
  );
  if (!rows[0]) throw new HttpError(503, `Condomínio ${condominiumCode} não encontrado. Aplique as migrações do banco.`);
  return rows[0].id;
}

function issueToken(user) {
  return jwt.sign({
    role: user.papel,
    condominiumId: user.condominio_id,
    entrepreneurId: user.empreendedor_id || null
  }, jwtSecret, { subject: user.id, issuer: 'rede-vizinha-api', expiresIn: jwtExpiresIn, algorithm: 'HS256' });
}

function userDto(user) {
  return {
    id: user.id,
    entrepreneurId: user.empreendedor_id || null,
    name: user.nome,
    email: user.email,
    role: user.papel,
    unit: user.unidade || '',
    whatsapp: user.telefone || user.cliente_telefone || '',
    phone: user.cliente_telefone || '',
    photoUrl: user.foto_url || '',
    instagramUrl: user.instagram_url || '',
    websiteUrl: user.site_url || '',
    linkedinUrl: user.linkedin_url || '',
    deliveryAddress: user.endereco_entrega || '',
    deliveryComplement: user.complemento || '',
    deliveryNeighborhood: user.bairro || '',
    deliveryCity: user.cidade || '',
    deliveryPostalCode: user.cep || '',
    deliveryTower: user.torre || '',
    deliveryApartment: user.apto || '',
    deliveryFlex: user.flex || ''
  };
}

function listingDto(row) {
  return {
    id: row.id,
    ownerId: row.empreendedor_id,
    ownerName: row.owner_name,
    unit: row.unidade,
    title: row.nome,
    category: row.categoria,
    description: row.descricao,
    profileOnly: Boolean(row.perfil_apenas),
    paymentMethods: Array.isArray(row.formas_pagamento) && row.formas_pagamento.length ? row.formas_pagamento : PAYMENT_METHODS,
    price: row.preco_destaque || '',
    whatsapp: row.owner_whatsapp || row.whatsapp || '',
    imageUrl: row.imagem_url || '',
    ownerPhotoUrl: row.owner_photo_url || '',
	    contacts: {
	      whatsapp: row.owner_whatsapp || row.whatsapp || '',
	      instagram: row.instagram_url || '',
	      website: row.site_url || '',
	      linkedin: row.linkedin_url || ''
	    },
	    products: Array.isArray(row.products) ? row.products.map((product) => ({
	      id: product.id,
	      name: product.name,
	      description: product.description || '',
	      price: product.price === null || product.price === undefined ? '' : String(product.price),
	      imageUrl: product.imageUrl || '',
	      stock: Number(product.stock || 0),
	      available: Number(product.available || 0),
	      availableForSale: product.availableForSale !== false,
	      options: Array.isArray(product.options) ? product.options.map((option) => ({
	        id: option.id,
	        name: option.name,
	        price: option.price === null || option.price === undefined ? '' : String(option.price),
	        stock: Number(option.stock || 0),
	        available: Number(option.available || 0)
	      })) : []
	    })) : [],
    emoji: categoryEmoji(row.categoria),
    cover: categoryCover(row.categoria),
    status: row.status.toLowerCase(),
    createdAt: row.criado_em,
    updatedAt: row.atualizado_em,
    moderationReason: row.motivo_moderacao || '',
    moderatedAt: row.moderado_em
  };
}

const listingSelect = `
  SELECT v.id, v.empreendedor_id, v.nome, v.categoria, v.descricao,
         v.preco_destaque, v.whatsapp, v.perfil_apenas, v.status, v.criado_em, v.atualizado_em,
         v.motivo_moderacao, v.moderado_em, v.imagem_url, v.formas_pagamento,
         e.unidade, e.foto_url AS owner_photo_url, u.nome AS owner_name,
         e.telefone AS owner_whatsapp, e.instagram_url, e.site_url, e.linkedin_url,
	         COALESCE((
	           SELECT json_agg(json_build_object(
	             'id', p.id, 'name', p.nome, 'description', p.descricao,
	             'price', p.preco, 'imageUrl', p.imagem_url, 'stock', p.estoque, 'availableForSale', p.disponivel,
	             'available', GREATEST(p.estoque - COALESCE((
	               SELECT SUM(ci.quantidade)::integer
	                 FROM contato_comercial_item ci
	                 JOIN contato_comercial c ON c.id = ci.contato_id
	                WHERE ci.produto_id = p.id AND ci.opcao_id IS NULL AND c.status = 'ABERTO' AND c.expira_em > CURRENT_TIMESTAMP
	             ), 0), 0)
	             , 'options', COALESCE((
	               SELECT json_agg(json_build_object(
	                 'id', o.id, 'name', o.nome, 'price', o.preco, 'stock', o.estoque,
	                 'available', GREATEST(o.estoque - COALESCE((
	                   SELECT SUM(ci.quantidade)::integer
	                     FROM contato_comercial_item ci
	                     JOIN contato_comercial c ON c.id = ci.contato_id
	                    WHERE ci.opcao_id = o.id AND c.status = 'ABERTO' AND c.expira_em > CURRENT_TIMESTAMP
	                 ), 0), 0)
	               ) ORDER BY o.criado_em ASC)
	                 FROM produto_opcao o WHERE o.produto_id = p.id
	             ), '[]'::json)
	           ) ORDER BY p.criado_em DESC)
             FROM produto p
            WHERE p.vitrine_id = v.id AND p.ativo = TRUE
         ), '[]'::json) AS products
    FROM vitrine v
    JOIN empreendedor e ON e.id = v.empreendedor_id
    JOIN usuario u ON u.id = e.usuario_id
`;

async function readListing(id, condominiumId) {
  const { rows } = await pool.query(
    `${listingSelect} WHERE v.id = $1 AND u.condominio_id = $2`,
    [id, condominiumId]
  );
  return rows[0] || null;
}

async function authenticate(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) throw new HttpError(401, 'Faça login para continuar.');
    const claims = jwt.verify(match[1], jwtSecret, { issuer: 'rede-vizinha-api', algorithms: ['HS256'] });
  const { rows } = await pool.query(`
      SELECT u.id, u.nome, u.email, u.papel, u.condominio_id, u.ativo,
             e.id AS empreendedor_id, e.unidade, e.telefone, e.foto_url,
             e.instagram_url, e.site_url, e.linkedin_url,
             c.telefone AS cliente_telefone, c.endereco_entrega,
             c.complemento, c.bairro, c.cidade, c.cep, c.torre, c.apto, c.flex
        FROM usuario u
        LEFT JOIN empreendedor e ON e.usuario_id = u.id
        LEFT JOIN cliente c ON c.usuario_id = u.id
       WHERE u.id = $1
    `, [claims.sub]);
    const user = rows[0];
    if (!user || !user.ativo || user.papel !== claims.role || String(user.condominio_id) !== String(claims.condominiumId)) {
      throw new HttpError(401, 'Sessão inválida ou encerrada. Entre novamente.');
    }
    if (user.papel === 'EMPREENDEDOR' && (!user.empreendedor_id || user.empreendedor_id !== claims.entrepreneurId)) {
      throw new HttpError(401, 'Perfil de empreendedor inválido.');
    }
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    return next(new HttpError(401, 'Token inválido ou expirado. Entre novamente.'));
  }
}

function requireRole(role) {
  return (req, res, next) => req.user?.papel === role
    ? next()
    : next(new HttpError(403, 'Você não tem permissão para esta operação.'));
}

async function optionalCustomerAuthentication(req, res, next) {
  const header = req.get('authorization') || '';
  if (!header) { req.user = null; return next(); }
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return next(new HttpError(401, 'Sessão de cliente inválida. Entre novamente.'));
  try {
    const claims = jwt.verify(match[1], jwtSecret, { issuer: 'rede-vizinha-api', algorithms: ['HS256'] });
    if (claims.role !== 'CLIENTE') throw new HttpError(403, 'Use uma conta de cliente para concluir o pedido.');
    const { rows } = await pool.query(`
      SELECT u.id, u.nome, u.email, u.papel, u.condominio_id, u.ativo,
             c.telefone AS cliente_telefone, c.endereco_entrega,
             c.complemento, c.bairro, c.cidade, c.cep, c.torre, c.apto, c.flex
        FROM usuario u JOIN cliente c ON c.usuario_id = u.id
       WHERE u.id = $1
    `, [claims.sub]);
    const user = rows[0];
    if (!user || !user.ativo || user.papel !== 'CLIENTE' || String(user.condominio_id) !== String(claims.condominiumId)) {
      throw new HttpError(401, 'Sessão de cliente inválida. Entre novamente.');
    }
    req.user = user;
    return next();
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return next(new HttpError(401, 'Sessão de cliente inválida. Entre novamente.'));
    }
    return next(error);
  }
}

function normalizeContactUrl(value, kind) {
  const raw = text(value);
  if (!raw) return null;
  if (raw.length > 500) throw new HttpError(400, 'Cada endereço de contato deve ter até 500 caracteres.');
  if (kind === 'instagram' && /^@?[a-z0-9._]{1,30}$/i.test(raw)) {
    return `https://www.instagram.com/${raw.replace(/^@/, '')}/`;
  }
  let url;
  try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); }
  catch (_) { throw new HttpError(400, `Informe um endereço válido para ${kind}.`); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new HttpError(400, `Informe um endereço válido para ${kind}.`);
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (kind === 'instagram' && host !== 'instagram.com') throw new HttpError(400, 'O link do Instagram deve apontar para instagram.com.');
  if (kind === 'linkedin' && host !== 'linkedin.com') throw new HttpError(400, 'O link do LinkedIn deve apontar para linkedin.com.');
  return url.toString();
}

function validateAccount(body, requireUnit = false) {
  const name = text(body?.name);
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';
  const unit = text(body?.unit);
  const phone = phoneDigits(body?.whatsapp || body?.phone);
  if (name.length < 2 || name.length > 120) throw new HttpError(400, 'Informe seu nome (2 a 120 caracteres).');
  if (!emailLooksValid(email)) throw new HttpError(400, 'Informe um e-mail válido.');
  if (password.length < 8 || password.length > 128) throw new HttpError(400, 'A senha deve ter entre 8 e 128 caracteres.');
  if (unit.length > 120 || (requireUnit && unit.length < 2)) throw new HttpError(400, 'A unidade deve ter até 120 caracteres.');
  if ((phone && (phone.length < 10 || phone.length > 13)) || (requireUnit && !phone)) throw new HttpError(400, 'Informe um WhatsApp válido com DDD.');
  return { name, email, password, unit: unit || null, ...validateContactProfile(body) };
}

function validateContactProfile(body) {
  const phone = phoneDigits(body?.whatsapp || body?.phone);
  if (phone && (phone.length < 10 || phone.length > 13)) throw new HttpError(400, 'Informe um WhatsApp válido com DDD.');
  return {
    phone: phone || null,
    instagramUrl: normalizeContactUrl(body?.instagram || body?.instagramUrl, 'instagram'),
    siteUrl: normalizeContactUrl(body?.website || body?.site || body?.websiteUrl, 'site'),
    linkedinUrl: normalizeContactUrl(body?.linkedin || body?.linkedinUrl, 'linkedin')
  };
}

const flexLabel = (value) => ({ FLEX_1: 'Flex 1', FLEX_2: 'Flex 2' }[value] || '');

function validateDeliveryInfo(body, acceptedPayments = PAYMENT_METHODS) {
  const name = text(body?.name);
  const phone = phoneDigits(body?.phone || body?.whatsapp);
  const tower = text(body?.tower);
  const apartment = text(body?.apartment);
  const flex = text(body?.flex).toUpperCase();
  const paymentMethod = text(body?.paymentMethod).toUpperCase();
  const deliveryNote = text(body?.deliveryNote);
  if (name.length < 2 || name.length > 120) throw new HttpError(400, 'Informe o nome do cliente (2 a 120 caracteres).');
  if (phone.length < 10 || phone.length > 13) throw new HttpError(400, 'Informe um WhatsApp válido com DDD.');
  if (!FLEX_OPTIONS.includes(flex)) throw new HttpError(400, 'Escolha Flex 1 ou Flex 2.');
  if (tower.length < 1 || tower.length > 20) throw new HttpError(400, 'Informe a torre (até 20 caracteres).');
  if (apartment.length < 1 || apartment.length > 10) throw new HttpError(400, 'Informe o apartamento (até 10 caracteres).');
  if (!acceptedPayments.includes(paymentMethod)) throw new HttpError(400, 'Escolha uma das formas de pagamento aceitas por este empreendedor.');
  if (deliveryNote.length > 500) throw new HttpError(400, 'A observação de entrega deve ter até 500 caracteres.');
  const address = `${flexLabel(flex)} · Torre ${tower} · Apto ${apartment}`;
  return { name, phone, tower, apartment, flex, address, complement: null, neighborhood: null, city: null, postalCode: null, paymentMethod, deliveryNote: deliveryNote || null };
}

function validatePaymentMethods(value) {
  let input = value;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch (_) { input = input.split(','); }
  }
  if (input === undefined || input === null || input === '') return [...PAYMENT_METHODS];
  if (!Array.isArray(input)) throw new HttpError(400, 'As formas de pagamento estão inválidas.');
  const methods = [...new Set(input.map((item) => text(item).toUpperCase()).filter(Boolean))];
  if (!methods.length) throw new HttpError(400, 'Marque pelo menos uma forma de pagamento aceita.');
  if (methods.some((item) => !PAYMENT_METHODS.includes(item))) throw new HttpError(400, 'Uma forma de pagamento informada é inválida.');
  return PAYMENT_METHODS.filter((item) => methods.includes(item));
}

function validateCustomerAccount(body) {
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!emailLooksValid(email)) throw new HttpError(400, 'Informe um e-mail válido para criar sua conta.');
  if (password.length < 8 || password.length > 128) throw new HttpError(400, 'A senha deve ter entre 8 e 128 caracteres.');
  return { email, password, delivery: validateDeliveryInfo(body?.order, PAYMENT_METHODS) };
}

function validateListing(body, ownerName = '') {
  const profileOnly = body?.profileOnly === true || ['true', '1'].includes(text(body?.profileOnly).toLowerCase());
  const title = text(body?.title) || (profileOnly ? text(ownerName) || 'Perfil do empreendedor' : '');
  const category = text(body?.category) || (profileOnly ? 'Outros serviços' : '');
  const description = text(body?.description) || (profileOnly ? 'Perfil público do empreendedor.' : '');
  const price = profileOnly ? '' : text(body?.price);
  const whatsapp = phoneDigits(body?.whatsapp);
  if (title.length < 2 || title.length > 140) throw new HttpError(400, 'O nome da vitrine deve ter entre 2 e 140 caracteres.');
  if (!categories.has(category)) throw new HttpError(400, 'Selecione uma categoria válida.');
  if ((!profileOnly && description.length < 10) || description.length > 700) throw new HttpError(400, 'A descrição deve ter entre 10 e 700 caracteres.');
  if (price.length > 80) throw new HttpError(400, 'O preço ou chamada deve ter até 80 caracteres.');
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 13)) throw new HttpError(400, 'Informe um WhatsApp válido com DDD.');
  const paymentMethods = validatePaymentMethods(body?.paymentMethods);
  return { title, category, description, price: price || null, whatsapp: whatsapp || null, profileOnly, paymentMethods };
}

function validateProducts(value) {
  let input = value;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch (_) { throw new HttpError(400, 'A lista de produtos está inválida.'); }
  }
  if (input === undefined || input === null || input === '') return [];
  if (!Array.isArray(input) || input.length > MAX_PRODUCTS) throw new HttpError(400, `Adicione no máximo ${MAX_PRODUCTS} produtos por vitrine.`);

  return input.map((product) => {
    const id = text(product?.id);
    const name = text(product?.name);
    const description = text(product?.description);
    const rawPrice = text(product?.price);
    const stock = Number(product?.stock ?? 0);
    const availableForSale = product?.availableForSale !== false;
    if (id && !/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, 'Uma referência de produto é inválida.');
    if (name.length < 2 || name.length > 140) throw new HttpError(400, 'Cada produto precisa de um nome entre 2 e 140 caracteres.');
    if (description.length > 700) throw new HttpError(400, 'A descrição do produto deve ter até 700 caracteres.');
    if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) throw new HttpError(400, 'A quantidade disponível deve ser um número inteiro entre 0 e 1.000.000.');
    if (rawPrice && (!/^\d{1,10}(\.\d{1,2})?$/.test(rawPrice) || Number(rawPrice) > 9999999999.99)) {
      throw new HttpError(400, 'Informe o preço do produto como valor positivo com até 2 casas decimais.');
    }
    let options = product?.options;
    if (typeof options === 'string') {
      try { options = JSON.parse(options); } catch (_) { throw new HttpError(400, 'As opções do produto estão inválidas.'); }
    }
    if (options === undefined || options === null) options = [];
    if (!Array.isArray(options) || options.length > 2) throw new HttpError(400, 'Cadastre no máximo 2 opções de venda por produto.');
    const normalizedOptions = options.map((option) => {
      const optionId = text(option?.id);
      const optionName = text(option?.name);
      const optionPrice = text(option?.price);
      const optionStock = Number(option?.stock ?? 0);
      if (optionId && !/^[0-9a-f-]{36}$/i.test(optionId)) throw new HttpError(400, 'Uma opção informada tem identificador inválido.');
      if (optionName.length < 1 || optionName.length > 80) throw new HttpError(400, 'Informe um nome de até 80 caracteres para cada opção.');
      if (!Number.isInteger(optionStock) || optionStock < 0 || optionStock > 1000000) throw new HttpError(400, `O estoque da opção ${optionName} deve ser um número inteiro entre 0 e 1.000.000.`);
      if (optionPrice && (!/^\d{1,10}(\.\d{1,2})?$/.test(optionPrice) || Number(optionPrice) > 9999999999.99)) {
        throw new HttpError(400, `Informe um preço válido para a opção ${optionName}.`);
      }
      return { id: optionId || null, name: optionName, price: optionPrice || null, stock: optionStock };
    });
    const optionNames = normalizedOptions.map((option) => option.name.toLocaleLowerCase('pt-BR'));
    if (new Set(optionNames).size !== optionNames.length) throw new HttpError(400, 'Os nomes das opções de um produto precisam ser diferentes.');
    if (normalizedOptions.length && (stock !== 0 || rawPrice)) throw new HttpError(400, 'Quando há opções, informe preço e estoque em cada opção; deixe preço e estoque gerais vazios/zerados.');
    return { id: id || null, name, description: description || null, price: rawPrice || null, stock, availableForSale, options: normalizedOptions };
  });
}

function validateContactItems(value) {
  if (value === undefined || value === null) return [];
  let input = value;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch (_) { throw new HttpError(400, 'A lista de produtos escolhidos está inválida.'); }
  }
  if (!Array.isArray(input) || input.length > MAX_PRODUCTS * 2) throw new HttpError(400, 'Há itens demais na sacolinha.');
  const combined = new Map();
  for (const item of input) {
    const productId = text(item?.productId || item?.id);
    const optionId = text(item?.optionId);
    const quantity = Number(item?.quantity);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)) {
      throw new HttpError(400, 'Uma referência de produto é inválida.');
    }
    if (optionId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(optionId)) {
      throw new HttpError(400, 'Uma referência de opção de produto é inválida.');
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new HttpError(400, 'A quantidade deve ser um número inteiro entre 1 e 999.');
    const key = `${productId}:${optionId || ''}`;
    const previous = combined.get(key)?.quantity || 0;
    combined.set(key, { productId, optionId: optionId || null, quantity: previous + quantity });
    if (previous + quantity > 999) throw new HttpError(400, 'A quantidade de uma opção não pode passar de 999 unidades.');
  }
  return [...combined.values()];
}

async function saveProducts(client, listingId, products, files, savedPaths, obsoleteImageUrls = []) {
  const { rows } = await client.query('SELECT id, imagem_url, estoque FROM produto WHERE vitrine_id = $1 FOR UPDATE', [listingId]);
  const existing = new Map(rows.map((row) => [row.id, row]));
  const keptIds = [];

  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    const oldProduct = product.id ? existing.get(product.id) : null;
    if (product.id && !oldProduct) throw new HttpError(400, 'Um produto informado não pertence a esta vitrine.');
    const newImageUrl = await storeImage(files?.[`productImage_${index}`]?.[0], 'products', savedPaths);
    const imageUrl = newImageUrl || oldProduct?.imagem_url || null;
    if (newImageUrl && oldProduct?.imagem_url && oldProduct.imagem_url !== newImageUrl) obsoleteImageUrls.push(oldProduct.imagem_url);
    const oldOptions = oldProduct ? (await client.query(
      'SELECT id, nome, preco, estoque FROM produto_opcao WHERE produto_id = $1 ORDER BY criado_em FOR UPDATE',
      [oldProduct.id]
    )).rows : [];
    const existingOptions = new Map(oldOptions.map((option) => [option.id, option]));
    const reservedBase = oldProduct ? await client.query(`
      SELECT COALESCE(SUM(ci.quantidade), 0)::integer AS quantidade
        FROM contato_comercial_item ci
        JOIN contato_comercial c ON c.id = ci.contato_id
       WHERE ci.produto_id = $1 AND ci.opcao_id IS NULL
         AND c.status = 'ABERTO' AND c.expira_em > CURRENT_TIMESTAMP
    `, [oldProduct.id]) : { rows: [{ quantidade: 0 }] };
    if (product.options.length && Number(reservedBase.rows[0].quantidade) > 0) {
      throw new HttpError(409, `Aguarde ou conclua as reservas atuais do produto ${product.name} antes de criar opções de venda.`);
    }
    if (!product.options.length && product.stock < Number(reservedBase.rows[0].quantidade)) {
      throw new HttpError(409, `Mantenha ao menos ${reservedBase.rows[0].quantidade} unidade(s) para as reservas em andamento de ${product.name}.`);
    }
    if (oldProduct) {
      await client.query(`
        UPDATE produto
           SET nome = $1, descricao = $2, preco = $3, imagem_url = $4, estoque = $5,
               disponivel = $6, ativo = TRUE, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = $7 AND vitrine_id = $8
      `, [product.name, product.description, product.price, imageUrl, product.stock, product.availableForSale, product.id, listingId]);
      keptIds.push(product.id);
    } else {
      const inserted = await client.query(`
        INSERT INTO produto (vitrine_id, nome, descricao, preco, imagem_url, estoque, disponivel)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
      `, [listingId, product.name, product.description, product.price, imageUrl, product.stock, product.availableForSale]);
      keptIds.push(inserted.rows[0].id);
    }

    const productId = oldProduct ? oldProduct.id : keptIds[keptIds.length - 1];
    const keptOptionIds = [];
    for (const option of product.options) {
      const oldOption = option.id ? existingOptions.get(option.id) : null;
      if (option.id && !oldOption) throw new HttpError(400, 'Uma opção informada não pertence a este produto.');
      if (oldOption) {
        const reserved = await client.query(`
          SELECT COALESCE(SUM(ci.quantidade), 0)::integer AS quantidade
            FROM contato_comercial_item ci
            JOIN contato_comercial c ON c.id = ci.contato_id
           WHERE ci.opcao_id = $1 AND c.status = 'ABERTO' AND c.expira_em > CURRENT_TIMESTAMP
        `, [oldOption.id]);
        if (option.stock < Number(reserved.rows[0].quantidade)) {
          throw new HttpError(409, `Mantenha ao menos ${reserved.rows[0].quantidade} unidade(s) reservadas da opção ${option.name}.`);
        }
        await client.query(`
          UPDATE produto_opcao
             SET nome = $1, preco = $2, estoque = $3, atualizado_em = CURRENT_TIMESTAMP
           WHERE id = $4 AND produto_id = $5
        `, [option.name, option.price, option.stock, oldOption.id, productId]);
        keptOptionIds.push(oldOption.id);
      } else {
        const insertedOption = await client.query(`
          INSERT INTO produto_opcao (produto_id, nome, preco, estoque)
          VALUES ($1, $2, $3, $4) RETURNING id
        `, [productId, option.name, option.price, option.stock]);
        keptOptionIds.push(insertedOption.rows[0].id);
      }
    }
    for (const oldOption of oldOptions) {
      if (keptOptionIds.includes(oldOption.id)) continue;
      const reserved = await client.query(`
        SELECT COALESCE(SUM(ci.quantidade), 0)::integer AS quantidade
          FROM contato_comercial_item ci
          JOIN contato_comercial c ON c.id = ci.contato_id
         WHERE ci.opcao_id = $1 AND c.status = 'ABERTO' AND c.expira_em > CURRENT_TIMESTAMP
      `, [oldOption.id]);
      if (Number(reserved.rows[0].quantidade) > 0) {
        throw new HttpError(409, `Não é possível remover a opção ${oldOption.nome} enquanto há reservas em andamento.`);
      }
      await client.query('DELETE FROM produto_opcao WHERE id = $1 AND produto_id = $2', [oldOption.id, productId]);
    }
  }

  for (const product of rows) {
    if (!keptIds.includes(product.id)) {
      const reserved = await client.query(`
        SELECT COALESCE(SUM(ci.quantidade), 0)::integer AS quantidade
          FROM contato_comercial_item ci
          JOIN contato_comercial c ON c.id = ci.contato_id
         WHERE ci.produto_id = $1 AND c.status = 'ABERTO' AND c.expira_em > CURRENT_TIMESTAMP
      `, [product.id]);
      if (reserved.rows[0].quantidade > 0) throw new HttpError(409, 'Não é possível remover um produto com reserva em andamento. Aguarde a reserva expirar ou registre a venda.');
      if (product.imagem_url) obsoleteImageUrls.push(product.imagem_url);
    }
  }

  if (keptIds.length) {
    await client.query('DELETE FROM produto WHERE vitrine_id = $1 AND NOT (id = ANY($2::uuid[]))', [listingId, keptIds]);
  } else {
    await client.query('DELETE FROM produto WHERE vitrine_id = $1', [listingId]);
  }
}

app.get('/api/health', asyncRoute(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'connected' });
}));

app.post('/api/auth/register', imageUploadFields, asyncRoute(async (req, res) => {
  const account = validateAccount(req.body, false);
  const savedPaths = [];
  const profilePhotoUrl = await storeImage(req.files?.profilePhoto?.[0], 'profiles', savedPaths);
  const passwordHash = await bcrypt.hash(account.password, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const condominiumId = await getCondominiumId(client);
    const { rows } = await client.query(`
      INSERT INTO usuario (condominio_id, nome, email, senha_hash, papel)
      VALUES ($1, $2, $3, $4, 'EMPREENDEDOR')
      RETURNING id, nome, email, papel, condominio_id
    `, [condominiumId, account.name, account.email, passwordHash]);
    const createdUser = rows[0];
    const profile = await client.query(`
      INSERT INTO empreendedor (usuario_id, telefone, unidade, foto_url, instagram_url, site_url, linkedin_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id AS empreendedor_id, telefone, unidade, foto_url, instagram_url, site_url, linkedin_url
    `, [createdUser.id, account.phone, account.unit, profilePhotoUrl, account.instagramUrl, account.siteUrl, account.linkedinUrl]);
    await client.query(`
      INSERT INTO vitrine (empreendedor_id, nome, categoria, descricao, whatsapp, status, perfil_apenas)
      VALUES ($1, $2, 'Outros serviços', 'Perfil público do empreendedor.', $3, 'PENDENTE', TRUE)
    `, [profile.rows[0].empreendedor_id, account.name, account.phone]);
    const user = { ...createdUser, ...profile.rows[0] };
    await client.query('COMMIT');
    res.status(201).json({ token: issueToken(user), user: userDto(user) });
  } catch (error) {
    await client.query('ROLLBACK');
    await removeStoredImages(savedPaths);
    if (error.code === '23505') throw new HttpError(409, 'Este e-mail já possui conta neste condomínio.');
    throw error;
  } finally {
    client.release();
  }
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!emailLooksValid(email) || !password) throw new HttpError(400, 'Informe e-mail e senha.');
  const condominiumId = await getCondominiumId();
  const { rows } = await pool.query(`
    SELECT u.id, u.nome, u.email, u.senha_hash, u.papel, u.condominio_id, u.ativo,
           e.id AS empreendedor_id, e.unidade, e.telefone, e.foto_url,
           e.instagram_url, e.site_url, e.linkedin_url
      FROM usuario u
      LEFT JOIN empreendedor e ON e.usuario_id = u.id
     WHERE u.condominio_id = $1 AND LOWER(u.email) = $2 AND u.papel IN ('EMPREENDEDOR', 'ADMIN')
  `, [condominiumId, email]);
  const user = rows[0];
  if (!user || !user.ativo || !(await bcrypt.compare(password, user.senha_hash))) {
    throw new HttpError(401, 'E-mail ou senha incorretos.');
  }
  res.json({ token: issueToken(user), user: userDto(user) });
}));

app.post('/api/auth/customer/register', asyncRoute(async (req, res) => {
  const account = validateCustomerAccount(req.body);
  const passwordHash = await bcrypt.hash(account.password, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const condominiumId = await getCondominiumId(client);
    const { rows } = await client.query(`
      INSERT INTO usuario (condominio_id, nome, email, senha_hash, papel)
      VALUES ($1, $2, $3, $4, 'CLIENTE')
      RETURNING id, nome, email, papel, condominio_id
    `, [condominiumId, account.delivery.name, account.email, passwordHash]);
    const createdUser = rows[0];
    const delivery = account.delivery;
    await client.query(`
      INSERT INTO cliente (usuario_id, telefone, endereco_entrega, complemento, bairro, cidade, cep, torre, apto, flex)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [createdUser.id, delivery.phone, delivery.address, delivery.complement, delivery.neighborhood, delivery.city, delivery.postalCode, delivery.tower, delivery.apartment, delivery.flex]);
    const user = {
      ...createdUser,
      cliente_telefone: delivery.phone,
      endereco_entrega: delivery.address,
      complemento: delivery.complement,
      bairro: delivery.neighborhood,
      cidade: delivery.city,
      cep: delivery.postalCode,
      torre: delivery.tower,
      apto: delivery.apartment,
      flex: delivery.flex
    };
    await client.query('COMMIT');
    res.status(201).json({ token: issueToken(user), user: userDto(user) });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw new HttpError(409, 'Este e-mail já possui conta neste condomínio. Entre com sua conta.');
    throw error;
  } finally {
    client.release();
  }
}));

app.post('/api/auth/customer/login', asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!emailLooksValid(email) || !password) throw new HttpError(400, 'Informe e-mail e senha.');
  const condominiumId = await getCondominiumId();
  const { rows } = await pool.query(`
    SELECT u.id, u.nome, u.email, u.senha_hash, u.papel, u.condominio_id, u.ativo,
           c.telefone AS cliente_telefone, c.endereco_entrega,
           c.complemento, c.bairro, c.cidade, c.cep, c.torre, c.apto, c.flex
      FROM usuario u JOIN cliente c ON c.usuario_id = u.id
     WHERE u.condominio_id = $1 AND LOWER(u.email) = $2 AND u.papel = 'CLIENTE'
  `, [condominiumId, email]);
  const user = rows[0];
  if (!user || !user.ativo || !(await bcrypt.compare(password, user.senha_hash))) {
    throw new HttpError(401, 'E-mail ou senha incorretos.');
  }
  res.json({ token: issueToken(user), user: userDto(user) });
}));

app.post('/api/auth/forgot-password', rateLimit({
  windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false
}), asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!emailLooksValid(email)) throw new HttpError(400, 'Informe um e-mail válido.');

  const condominiumId = await getCondominiumId();
  const { rows } = await pool.query(
    'SELECT id FROM usuario WHERE condominio_id = $1 AND LOWER(email) = $2 AND ativo = TRUE',
    [condominiumId, email]
  );

  if (rows[0]) {
    const userId = rows[0].id;
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM password_reset_token WHERE usuario_id = $1 AND usado_em IS NULL', [userId]);
      await client.query(`
        INSERT INTO password_reset_token (usuario_id, token_hash, expires_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '30 minutes')
      `, [userId, tokenHash]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    let resetUrl = '';
    try {
      resetUrl = passwordResetUrl(rawToken);
      await sendPasswordResetEmail(email, resetUrl);
    } catch (error) {
      console.error('Não foi possível enviar o e-mail de redefinição:', error.message);
      if (resetUrl && process.env.NODE_ENV !== 'production' && process.env.PASSWORD_RESET_DEV_LINKS !== 'false') {
        console.info(`Link local de redefinição (válido por 30 minutos): ${resetUrl}`);
      }
    }
  }

  res.status(202).json({ message: 'Se o e-mail estiver cadastrado, enviaremos instruções para redefinir a senha.' });
}));

app.post('/api/auth/reset-password', rateLimit({
  windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false
}), asyncRoute(async (req, res) => {
  const token = text(req.body?.token);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!/^[a-f0-9]{64}$/i.test(token)) throw new HttpError(400, 'Link inválido ou expirado. Solicite uma nova recuperação.');
  if (password.length < 8 || password.length > 128) throw new HttpError(400, 'A senha deve ter entre 8 e 128 caracteres.');

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const passwordHash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT prt.usuario_id
        FROM password_reset_token prt
        JOIN usuario u ON u.id = prt.usuario_id
       WHERE prt.token_hash = $1 AND prt.usado_em IS NULL
         AND prt.expires_at > CURRENT_TIMESTAMP AND u.ativo = TRUE
       FOR UPDATE OF prt, u
    `, [tokenHash]);
    if (!rows[0]) throw new HttpError(400, 'Link inválido ou expirado. Solicite uma nova recuperação.');

    await client.query('UPDATE usuario SET senha_hash = $1 WHERE id = $2', [passwordHash, rows[0].usuario_id]);
    await client.query(`
      UPDATE password_reset_token SET usado_em = CURRENT_TIMESTAMP
       WHERE usuario_id = $1 AND usado_em IS NULL
    `, [rows[0].usuario_id]);
    await client.query('COMMIT');
    res.json({ message: 'Senha redefinida. Você já pode entrar com a nova senha.' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.get('/api/me', authenticate, (req, res) => res.json({ user: userDto(req.user) }));

app.put('/api/empreendedor/perfil', authenticate, requireRole('EMPREENDEDOR'), asyncRoute(async (req, res) => {
  const contacts = validateContactProfile(req.body);
  const { rows } = await pool.query(`
    UPDATE empreendedor
       SET telefone = $1, instagram_url = $2, site_url = $3, linkedin_url = $4
     WHERE id = $5
     RETURNING telefone, instagram_url, site_url, linkedin_url, foto_url, unidade
  `, [contacts.phone, contacts.instagramUrl, contacts.siteUrl, contacts.linkedinUrl, req.user.empreendedor_id]);
  if (!rows[0]) throw new HttpError(404, 'Perfil de empreendedor não encontrado.');
  res.json({ user: userDto({ ...req.user, ...rows[0] }) });
}));

app.post('/api/vitrines/:id/contatos', rateLimit({
  windowMs: 15 * 60 * 1000, limit: 24, standardHeaders: 'draft-8', legacyHeaders: false
}), optionalCustomerAuthentication, asyncRoute(async (req, res) => {
  const channel = text(req.body?.channel).toUpperCase();
  if (!['WHATSAPP', 'INSTAGRAM', 'SITE', 'LINKEDIN'].includes(channel)) throw new HttpError(400, 'Escolha um meio de contato válido.');
  const items = validateContactItems(req.body?.items);
  if (items.length && channel !== 'WHATSAPP') throw new HttpError(400, 'A lista de produtos pode ser enviada apenas pelo WhatsApp.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const listing = await client.query(`
      SELECT v.id, e.telefone, v.formas_pagamento
        FROM vitrine v JOIN empreendedor e ON e.id = v.empreendedor_id
       WHERE v.id = $1 AND v.status = 'APROVADA'
       FOR SHARE OF v
    `, [req.params.id]);
    if (!listing.rows[0]) throw new HttpError(404, 'Este perfil não está publicado.');
    if (channel === 'WHATSAPP' && !listing.rows[0].telefone) throw new HttpError(409, 'Este empreendedor ainda não cadastrou um WhatsApp.');
    const acceptedPayments = Array.isArray(listing.rows[0].formas_pagamento) && listing.rows[0].formas_pagamento.length ? listing.rows[0].formas_pagamento : PAYMENT_METHODS;
    const order = items.length ? validateDeliveryInfo(req.body?.order, acceptedPayments) : null;

    let productRows = [];
    const orderLines = [];
    if (items.length) {
      const ids = [...new Set(items.map((item) => item.productId))];
      const selected = await client.query(`
        SELECT id, nome, preco, estoque, disponivel FROM produto
         WHERE vitrine_id = $1 AND ativo = TRUE AND id = ANY($2::uuid[])
         ORDER BY id FOR UPDATE
      `, [req.params.id, ids]);
      if (selected.rowCount !== ids.length) throw new HttpError(409, 'Um dos produtos não está mais disponível. Atualize o catálogo.');
      productRows = selected.rows;
      for (const item of items) {
        const product = productRows.find((row) => row.id === item.productId);
        if (!product.disponivel) throw new HttpError(409, `${product.nome} está marcado como indisponível pelo empreendedor.`);
        let option = null;
        if (item.optionId) {
          const optionResult = await client.query(`
            SELECT id, nome, preco, estoque FROM produto_opcao
             WHERE id = $1 AND produto_id = $2 FOR UPDATE
          `, [item.optionId, item.productId]);
          option = optionResult.rows[0];
          if (!option) throw new HttpError(409, 'Uma opção deste produto não está mais disponível. Atualize o catálogo.');
        } else {
          const hasOptions = await client.query('SELECT EXISTS (SELECT 1 FROM produto_opcao WHERE produto_id = $1) AS value', [item.productId]);
          if (hasOptions.rows[0].value) throw new HttpError(409, `${product.nome}: escolha uma das opções disponíveis.`);
        }
        const reserved = await client.query(`
          SELECT COALESCE(SUM(ci.quantidade), 0)::integer AS quantidade
            FROM contato_comercial_item ci JOIN contato_comercial c ON c.id = ci.contato_id
           WHERE ci.produto_id = $1 AND ci.opcao_id IS NOT DISTINCT FROM $2::uuid
             AND c.status = 'ABERTO' AND c.expira_em > CURRENT_TIMESTAMP
        `, [item.productId, option?.id || null]);
        const stock = Number(option ? option.estoque : product.estoque);
        const available = Math.max(stock - Number(reserved.rows[0].quantidade), 0);
        if (item.quantity > available) throw new HttpError(409, `${product.nome}${option ? ` — ${option.nome}` : ''}: restam apenas ${available} unidade(s) disponíveis.`);
        orderLines.push({ item, product, option });
      }
    }

    if (order && req.user) {
      await client.query('UPDATE usuario SET nome = $1 WHERE id = $2', [order.name, req.user.id]);
      await client.query(`
        UPDATE cliente
           SET telefone = $1, endereco_entrega = $2, complemento = $3,
               bairro = $4, cidade = $5, cep = $6, torre = $7, apto = $8, flex = $9,
               atualizado_em = CURRENT_TIMESTAMP
         WHERE usuario_id = $10
      `, [order.phone, order.address, order.complement, order.neighborhood, order.city, order.postalCode, order.tower, order.apartment, order.flex, req.user.id]);
    }
    const contact = await client.query(`
      INSERT INTO contato_comercial (
        vitrine_id, canal, cliente_id, cliente_nome, cliente_telefone,
        endereco_entrega, complemento_entrega, bairro_entrega, cidade_entrega,
        cep_entrega, forma_pagamento, observacao_entrega, torre_entrega, apto_entrega, flex_entrega
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, expira_em
    `, [
      req.params.id, channel, order ? req.user?.id || null : null,
      order?.name || null, order?.phone || null, order?.address || null,
      order?.complement || null, order?.neighborhood || null, order?.city || null,
      order?.postalCode || null, order?.paymentMethod || null, order?.deliveryNote || null,
      order?.tower || null, order?.apartment || null, order?.flex || null
    ]);
    for (const { item, product, option } of orderLines) {
      await client.query(`
        INSERT INTO contato_comercial_item (contato_id, produto_id, opcao_id, nome_produto, opcao_nome, preco_unitario, quantidade)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [contact.rows[0].id, product.id, option?.id || null, product.nome, option?.nome || null, option ? option.preco : product.preco, item.quantity]);
    }
    const orderItems = orderLines.map(({ item, product, option }) => ({
      productId: product.id, optionId: option?.id || null, optionName: option?.nome || '',
      name: product.nome,
      price: (option ? option.preco : product.preco) === null ? null : String(option ? option.preco : product.preco),
      quantity: item.quantity
    }));
    const hasAllPrices = orderItems.length > 0 && orderItems.every((item) => item.price !== null);
    const totalCents = hasAllPrices
      ? orderItems.reduce((sum, item) => sum + Math.round(Number(item.price) * 100) * item.quantity, 0)
      : null;
    await client.query('COMMIT');
    res.status(201).json({ contact: {
      id: contact.rows[0].id,
      expiresAt: contact.rows[0].expira_em,
      order,
      items: orderItems,
      estimatedTotal: totalCents === null ? null : (totalCents / 100).toFixed(2)
    } });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.get('/api/vitrines', asyncRoute(async (req, res) => {
  const condominiumId = await getCondominiumId();
  const params = ['APROVADA', condominiumId];
  let filters = 'v.status = $1 AND u.condominio_id = $2';
  const category = text(req.query.category);
  const query = text(req.query.q).slice(0, 100);
  if (category && categories.has(category)) {
    params.push(category);
    filters += ` AND v.categoria = $${params.length}`;
  }
  if (query) {
    params.push(`%${query}%`);
    filters += ` AND (v.nome ILIKE $${params.length} OR v.descricao ILIKE $${params.length} OR u.nome ILIKE $${params.length} OR e.unidade ILIKE $${params.length} OR EXISTS (SELECT 1 FROM produto ps WHERE ps.vitrine_id = v.id AND ps.ativo = TRUE AND (ps.nome ILIKE $${params.length} OR COALESCE(ps.descricao, '') ILIKE $${params.length})))`;
  }
  const { rows } = await pool.query(`${listingSelect} WHERE ${filters} ORDER BY v.criado_em DESC LIMIT 100`, params);
  const listings = rows.map((row) => {
    const listing = listingDto(row);
    listing.hasCatalog = !listing.profileOnly && listing.products.length > 0;
    listing.products = [];
    return listing;
  });
  res.json({ listings });
}));

app.get('/api/vitrines/:id/catalogo', asyncRoute(async (req, res) => {
  const condominiumId = await getCondominiumId();
  const row = await readListing(req.params.id, condominiumId);
  if (!row || row.status !== 'APROVADA') throw new HttpError(404, 'Este catálogo não está publicado.');
  const listing = listingDto(row);
  if (listing.profileOnly) listing.products = [];
  res.json({ listing });
}));

const foldIndicationSql = (expression) => `translate(lower(${expression}), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')`;

app.get('/api/indicacoes', asyncRoute(async (req, res) => {
  const condominiumId = await getCondominiumId();
  const params = [condominiumId];
  const filters = ['p.condominio_id = $1'];
  const category = text(req.query.category);
  if (category && category !== 'Todas' && indicationCategories.has(category)) {
    params.push(category);
    filters.push(`p.categoria = $${params.length}`);
  }
  const query = normalizeSearch(text(req.query.q).slice(0, 100));
  if (query) {
    params.push(`%${query}%`);
    const searchParam = `$${params.length}`;
    filters.push(`(
      ${foldIndicationSql("concat_ws(' ', p.titulo, p.detalhes, p.categoria, p.autor_nome, p.localizacao)")} LIKE ${searchParam}
      OR EXISTS (
        SELECT 1 FROM resposta_indicacao r
         WHERE r.pedido_id = p.id
           AND (
             ${foldIndicationSql("concat_ws(' ', r.autor_nome, r.localizacao, r.texto)")} LIKE ${searchParam}
             OR EXISTS (
               SELECT 1
                 FROM resposta_indicacao_empreendedor rm
                 JOIN empreendedor e ON e.id = rm.empreendedor_id
                 JOIN usuario u ON u.id = e.usuario_id
                 JOIN LATERAL (
                   SELECT v.nome FROM vitrine v
                    WHERE v.empreendedor_id = e.id AND v.status = 'APROVADA'
                    ORDER BY v.criado_em DESC LIMIT 1
                 ) public_listing ON TRUE
                WHERE rm.resposta_id = r.id AND u.condominio_id = p.condominio_id AND u.ativo = TRUE
                  AND ${foldIndicationSql("concat_ws(' ', u.nome, public_listing.nome)")} LIKE ${searchParam}
             )
           )
      )
    )`);
  }

  const { rows } = await pool.query(`
    SELECT p.id, p.autor_nome, p.localizacao, p.categoria, p.titulo, p.detalhes,
           p.status, p.criado_em,
           COALESCE((
             SELECT json_agg(json_build_object(
               'id', r.id, 'author', r.autor_nome, 'location', r.localizacao,
               'text', r.texto, 'createdAt', r.criado_em,
               'mentions', COALESCE((
                 SELECT json_agg(json_build_object(
                   'id', e.id, 'name', u.nome, 'businessName', public_listing.nome
                 ) ORDER BY u.nome)
                   FROM resposta_indicacao_empreendedor rm
                   JOIN empreendedor e ON e.id = rm.empreendedor_id
                   JOIN usuario u ON u.id = e.usuario_id
                   JOIN LATERAL (
                     SELECT v.nome FROM vitrine v
                      WHERE v.empreendedor_id = e.id AND v.status = 'APROVADA'
                      ORDER BY v.criado_em DESC LIMIT 1
                   ) public_listing ON TRUE
                  WHERE rm.resposta_id = r.id AND u.condominio_id = p.condominio_id AND u.ativo = TRUE
               ), '[]'::json)
             ) ORDER BY r.criado_em ASC)
               FROM resposta_indicacao r WHERE r.pedido_id = p.id
           ), '[]'::json) AS replies
      FROM pedido_indicacao p
     WHERE ${filters.join(' AND ')}
     ORDER BY p.criado_em DESC
     LIMIT 200
  `, params);
  res.json({ requests: rows.map((row) => ({
    id: row.id, author: row.autor_nome, location: row.localizacao,
    category: row.categoria, title: row.titulo, details: row.detalhes,
    status: row.status.toLowerCase(), createdAt: row.criado_em,
    replies: Array.isArray(row.replies) ? row.replies : []
  })) });
}));

app.post('/api/indicacoes', rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false }), asyncRoute(async (req, res) => {
  const author = text(req.body?.author);
  const location = text(req.body?.location);
  const category = text(req.body?.category);
  const title = text(req.body?.title);
  const details = text(req.body?.details);
  if (req.body?.mentionedEntrepreneurIds !== undefined && (!Array.isArray(req.body.mentionedEntrepreneurIds) || req.body.mentionedEntrepreneurIds.length)) {
    throw new HttpError(400, 'Empreendedores cadastrados podem ser mencionados ao publicar uma indicação em resposta.');
  }
  if (author.length < 2 || author.length > 120) throw new HttpError(400, 'Informe um nome entre 2 e 120 caracteres.');
  if (location.length > 100) throw new HttpError(400, 'A torre/unidade deve ter até 100 caracteres.');
  if (!indicationCategories.has(category)) throw new HttpError(400, 'Selecione uma categoria válida.');
  if (title.length < 8 || title.length > 160) throw new HttpError(400, 'O pedido deve ter entre 8 e 160 caracteres.');
  if (details.length > 1000) throw new HttpError(400, 'Os detalhes devem ter até 1.000 caracteres.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const condominiumId = await getCondominiumId(client);
    const request = await client.query(`
      INSERT INTO pedido_indicacao (condominio_id, autor_nome, localizacao, categoria, titulo, detalhes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, criado_em
    `, [condominiumId, author, location, category, title, details]);
    await client.query('COMMIT');
    res.status(201).json({ request: { id: request.rows[0].id, createdAt: request.rows[0].criado_em } });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.post('/api/indicacoes/:id/respostas', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }), asyncRoute(async (req, res) => {
  const requestId = text(req.params.id);
  const author = text(req.body?.author);
  const location = text(req.body?.location);
  const reply = text(req.body?.text);
  const rawMentionIds = req.body?.mentionedEntrepreneurIds ?? [];
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new HttpError(400, 'Identificador de pedido inválido.');
  }
  if (author.length < 2 || author.length > 120) throw new HttpError(400, 'Informe um nome entre 2 e 120 caracteres.');
  if (location.length > 100) throw new HttpError(400, 'A torre/unidade deve ter até 100 caracteres.');
  if (reply.length < 3 || reply.length > 1000) throw new HttpError(400, 'A resposta deve ter entre 3 e 1.000 caracteres.');
  if (!Array.isArray(rawMentionIds) || rawMentionIds.length > 5) throw new HttpError(400, 'Você pode indicar até 5 empreendedores cadastrados por resposta.');
  const mentionedIds = [...new Set(rawMentionIds.map(text))];
  if (mentionedIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    throw new HttpError(400, 'Uma das menções selecionadas é inválida.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const condominiumId = await getCondominiumId(client);
    const target = await client.query(
      "SELECT id FROM pedido_indicacao WHERE id = $1 AND condominio_id = $2 AND status = 'ABERTA' FOR UPDATE",
      [requestId, condominiumId]
    );
    if (!target.rowCount) throw new HttpError(404, 'Este pedido não está disponível no mural.');

    let entrepreneurs = [];
    if (mentionedIds.length) {
      const publicEntrepreneurs = await client.query(`
        SELECT DISTINCT e.id, u.nome AS name, public_listing.nome AS business_name
          FROM empreendedor e
          JOIN usuario u ON u.id = e.usuario_id
          JOIN vitrine v ON v.empreendedor_id = e.id AND v.status = 'APROVADA'
          JOIN LATERAL (
            SELECT v2.nome FROM vitrine v2
             WHERE v2.empreendedor_id = e.id AND v2.status = 'APROVADA'
             ORDER BY v2.criado_em DESC LIMIT 1
          ) public_listing ON TRUE
         WHERE e.id = ANY($1::uuid[]) AND u.condominio_id = $2 AND u.ativo = TRUE
      `, [mentionedIds, condominiumId]);
      if (publicEntrepreneurs.rowCount !== mentionedIds.length) {
        throw new HttpError(400, 'Só é possível indicar empreendedores com vitrine pública aprovada.');
      }
      const byId = new Map(publicEntrepreneurs.rows.map((row) => [row.id, row]));
      entrepreneurs = mentionedIds.map((id) => byId.get(id));
    }

    const inserted = await client.query(`
      INSERT INTO resposta_indicacao (pedido_id, autor_nome, localizacao, texto)
      VALUES ($1, $2, $3, $4)
      RETURNING id, autor_nome, localizacao, texto, criado_em
    `, [requestId, author, location, reply]);
    const row = inserted.rows[0];
    for (const entrepreneur of entrepreneurs) {
      await client.query(
        'INSERT INTO resposta_indicacao_empreendedor (resposta_id, empreendedor_id) VALUES ($1, $2)',
        [row.id, entrepreneur.id]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ reply: {
      id: row.id, author: row.autor_nome, location: row.localizacao,
      text: row.texto, createdAt: row.criado_em,
      mentions: entrepreneurs.map((entrepreneur) => ({ id: entrepreneur.id, name: entrepreneur.name, businessName: entrepreneur.business_name }))
    } });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.get('/api/empreendedor/vitrines', authenticate, requireRole('EMPREENDEDOR'), asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `${listingSelect} WHERE v.empreendedor_id = $1 AND u.condominio_id = $2 ORDER BY v.criado_em DESC`,
    [req.user.empreendedor_id, req.user.condominio_id]
  );
  res.json({ listings: rows.map(listingDto) });
}));

app.get('/api/empreendedor/contatos', authenticate, requireRole('EMPREENDEDOR'), asyncRoute(async (req, res) => {
  await pool.query(`
    UPDATE contato_comercial c
       SET status = 'EXPIRADO', finalizado_em = COALESCE(c.finalizado_em, CURRENT_TIMESTAMP)
      FROM vitrine v
     WHERE c.vitrine_id = v.id AND v.empreendedor_id = $1
       AND c.status = 'ABERTO' AND c.expira_em <= CURRENT_TIMESTAMP
  `, [req.user.empreendedor_id]);
  const { rows } = await pool.query(`
    SELECT c.id, c.canal, c.status, c.expira_em, c.criado_em, c.finalizado_em, v.nome AS vitrine_nome,
           c.cliente_nome, c.cliente_telefone, c.endereco_entrega, c.complemento_entrega,
           c.bairro_entrega, c.cidade_entrega, c.cep_entrega, c.forma_pagamento, c.observacao_entrega,
           c.torre_entrega, c.apto_entrega, c.flex_entrega,
           COALESCE(json_agg(json_build_object(
             'productId', ci.produto_id, 'name', ci.nome_produto, 'optionName', ci.opcao_nome,
             'price', ci.preco_unitario, 'quantity', ci.quantidade
           ) ORDER BY ci.criado_em) FILTER (WHERE ci.id IS NOT NULL), '[]'::json) AS items
      FROM contato_comercial c
      JOIN vitrine v ON v.id = c.vitrine_id
      LEFT JOIN contato_comercial_item ci ON ci.contato_id = c.id
     WHERE v.empreendedor_id = $1 AND c.criado_em >= CURRENT_TIMESTAMP - INTERVAL '60 days'
     GROUP BY c.id, v.nome
     ORDER BY c.criado_em DESC
     LIMIT 100
  `, [req.user.empreendedor_id]);
  res.json({ contacts: rows.map((row) => ({
    id: row.id, channel: row.canal.toLowerCase(), status: row.status.toLowerCase(),
    expiresAt: row.expira_em, createdAt: row.criado_em, closedAt: row.finalizado_em,
    listingTitle: row.vitrine_nome, items: Array.isArray(row.items) ? row.items.map((item) => ({
      productId: item.productId, name: item.name, optionName: item.optionName || '', price: item.price === null ? '' : String(item.price), quantity: Number(item.quantity)
    })) : [],
    customer: row.cliente_nome ? {
      name: row.cliente_nome,
      phone: row.cliente_telefone || '',
      address: row.endereco_entrega || '',
      complement: row.complemento_entrega || '',
      neighborhood: row.bairro_entrega || '',
      city: row.cidade_entrega || '',
      postalCode: row.cep_entrega || '',
      tower: row.torre_entrega || '',
      apartment: row.apto_entrega || '',
      flex: row.flex_entrega || '',
      paymentMethod: row.forma_pagamento || '',
      deliveryNote: row.observacao_entrega || ''
    } : null
  })) });
}));

app.post('/api/empreendedor/contatos/:id/venda', authenticate, requireRole('EMPREENDEDOR'), asyncRoute(async (req, res) => {
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query('BEGIN');
    const contact = await client.query(`
      SELECT c.id, c.status, c.expira_em, c.expira_em <= statement_timestamp() AS expirado
        FROM contato_comercial c JOIN vitrine v ON v.id = c.vitrine_id
       WHERE c.id = $1 AND v.empreendedor_id = $2
       FOR UPDATE OF c
    `, [req.params.id, req.user.empreendedor_id]);
    if (!contact.rows[0]) throw new HttpError(404, 'Registro de contato não encontrado.');
    if (contact.rows[0].status !== 'ABERTO') throw new HttpError(409, 'Este contato já foi concluído ou expirou.');
    if (contact.rows[0].expirado) {
      await client.query("UPDATE contato_comercial SET status = 'EXPIRADO', finalizado_em = COALESCE(finalizado_em, CURRENT_TIMESTAMP) WHERE id = $1", [req.params.id]);
      await client.query('COMMIT');
      committed = true;
      return res.status(409).json({ error: 'A reserva de 30 minutos expirou; as unidades voltaram ao estoque disponível.' });
    }
    const items = await client.query(`
      SELECT ci.produto_id, ci.opcao_id, ci.quantidade, p.estoque,
             po.id AS option_id, po.estoque AS option_stock
        FROM contato_comercial_item ci
        JOIN produto p ON p.id = ci.produto_id
        LEFT JOIN produto_opcao po ON po.id = ci.opcao_id
       WHERE ci.contato_id = $1 ORDER BY p.id FOR UPDATE OF p
    `, [req.params.id]);
    const itemCount = await client.query('SELECT COUNT(*)::integer AS total FROM contato_comercial_item WHERE contato_id = $1', [req.params.id]);
    if (items.rowCount !== itemCount.rows[0].total) throw new HttpError(409, 'Um produto deste contato não está mais disponível para baixa.');
    if (!items.rowCount) throw new HttpError(400, 'Este contato não contém produtos. Use a opção de encerrar contato.');
    for (const item of items.rows) {
      if (item.opcao_id) {
        if (!item.option_id || Number(item.option_stock) < Number(item.quantidade)) throw new HttpError(409, 'O estoque da opção mudou e não permite confirmar esta venda.');
        const deducted = await client.query('UPDATE produto_opcao SET estoque = estoque - $1, atualizado_em = CURRENT_TIMESTAMP WHERE id = $2 AND estoque >= $1 RETURNING id', [item.quantidade, item.opcao_id]);
        if (!deducted.rowCount) throw new HttpError(409, 'O estoque da opção mudou e não permite confirmar esta venda.');
      } else {
        if (Number(item.estoque) < Number(item.quantidade)) throw new HttpError(409, 'O estoque mudou e não permite confirmar esta venda.');
        const deducted = await client.query('UPDATE produto SET estoque = estoque - $1, atualizado_em = CURRENT_TIMESTAMP WHERE id = $2 AND estoque >= $1 RETURNING id', [item.quantidade, item.produto_id]);
        if (!deducted.rowCount) throw new HttpError(409, 'O estoque mudou e não permite confirmar esta venda.');
      }
    }
    await client.query("UPDATE contato_comercial SET status = 'VENDIDO', finalizado_em = CURRENT_TIMESTAMP WHERE id = $1", [req.params.id]);
    await client.query('COMMIT');
    committed = true;
    res.json({ message: 'Venda registrada; o estoque foi atualizado.' });
  } catch (error) {
    if (!committed) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.post('/api/empreendedor/contatos/:id/encerrar', authenticate, requireRole('EMPREENDEDOR'), asyncRoute(async (req, res) => {
  const { rowCount } = await pool.query(`
    UPDATE contato_comercial c
       SET status = CASE WHEN c.expira_em > CURRENT_TIMESTAMP THEN 'ENCERRADO' ELSE 'EXPIRADO' END,
           finalizado_em = CURRENT_TIMESTAMP
      FROM vitrine v
     WHERE c.id = $1 AND c.vitrine_id = v.id AND v.empreendedor_id = $2 AND c.status = 'ABERTO'
  `, [req.params.id, req.user.empreendedor_id]);
  if (!rowCount) throw new HttpError(409, 'Este contato já foi concluído, expirou ou não pertence ao seu perfil.');
  res.json({ message: 'Contato encerrado.' });
}));

app.post('/api/empreendedor/vitrines', authenticate, requireRole('EMPREENDEDOR'), imageUploadFields, asyncRoute(async (req, res) => {
  const item = validateListing(req.body, req.user.nome);
  const products = validateProducts(req.body.products);
  const savedPaths = [];
  const client = await pool.connect();
  let listingId;
  try {
    await client.query('BEGIN');
    const imageUrl = await storeImage(req.files?.listingImage?.[0], 'listings', savedPaths);
    const { rows } = await client.query(`
      INSERT INTO vitrine (empreendedor_id, nome, categoria, descricao, preco_destaque, whatsapp, imagem_url, perfil_apenas, formas_pagamento)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
    `, [req.user.empreendedor_id, item.title, item.category, item.description, item.price, item.whatsapp, imageUrl, item.profileOnly, item.paymentMethods]);
    listingId = rows[0].id;
    await saveProducts(client, listingId, products, req.files, savedPaths);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    await removeStoredImages(savedPaths);
    throw error;
  } finally {
    client.release();
  }
  const created = await readListing(listingId, req.user.condominio_id);
  res.status(201).json({ listing: listingDto(created) });
}));

app.put('/api/empreendedor/vitrines/:id', authenticate, requireRole('EMPREENDEDOR'), imageUploadFields, asyncRoute(async (req, res) => {
  const item = validateListing(req.body, req.user.nome);
  const products = validateProducts(req.body.products);
  const savedPaths = [];
  const obsoleteImageUrls = [];
  let oldCoverUrl = null;
  let uploadedCoverUrl = null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(
      'SELECT imagem_url FROM vitrine WHERE id = $1 AND empreendedor_id = $2 FOR UPDATE',
      [req.params.id, req.user.empreendedor_id]
    );
    if (!current.rows[0]) throw new HttpError(404, 'Vitrine não encontrada.');
    oldCoverUrl = current.rows[0].imagem_url;
    uploadedCoverUrl = await storeImage(req.files?.listingImage?.[0], 'listings', savedPaths);
    await client.query(`
      UPDATE vitrine
         SET nome = $1, categoria = $2, descricao = $3, preco_destaque = $4, whatsapp = $5,
             imagem_url = $6, perfil_apenas = $9, formas_pagamento = $10, status = 'PENDENTE', moderado_por = NULL, moderado_em = NULL,
             motivo_moderacao = NULL, atualizado_em = CURRENT_TIMESTAMP
       WHERE id = $7 AND empreendedor_id = $8
    `, [item.title, item.category, item.description, item.price, item.whatsapp,
      uploadedCoverUrl || oldCoverUrl, req.params.id, req.user.empreendedor_id, item.profileOnly, item.paymentMethods]);
    await saveProducts(client, req.params.id, products, req.files, savedPaths, obsoleteImageUrls);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    await removeStoredImages(savedPaths);
    throw error;
  } finally {
    client.release();
  }
  if (uploadedCoverUrl && oldCoverUrl && uploadedCoverUrl !== oldCoverUrl) obsoleteImageUrls.push(oldCoverUrl);
  await removeStoredImageUrls(obsoleteImageUrls);
  const updated = await readListing(req.params.id, req.user.condominio_id);
  res.json({ listing: listingDto(updated) });
}));

// ---------- Importação de cardápio (texto, PDF ou foto) ----------
function parseBrazilianPrice(value) {
  const raw = text(String(value ?? '')).replace(/r\$\s*/i, '').replace(/\s/g, '');
  if (!raw) return '';
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 && amount < 1e9 ? amount.toFixed(2) : '';
}

function sanitizeImportedProducts(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_PRODUCTS).map((product) => {
    const options = (Array.isArray(product?.options) ? product.options : [])
      .map((option) => ({ name: text(option?.name).slice(0, 80), price: parseBrazilianPrice(option?.price) }))
      .filter((option) => option.name)
      .slice(0, 2);
    const uniqueOptions = options.filter((option, index) => options.findIndex((other) => other.name.toLowerCase() === option.name.toLowerCase()) === index);
    return {
      name: text(product?.name).slice(0, 140),
      description: text(product?.description).slice(0, 700),
      price: uniqueOptions.length ? '' : parseBrazilianPrice(product?.price),
      options: uniqueOptions.length >= 2 ? uniqueOptions : []
    };
  }).filter((product) => product.name.length >= 2);
}

// Leitura simples sem IA: uma linha por produto, com preço no fim (ex.: "Coxinha ....... R$ 6,50").
function parseMenuTextLocally(content) {
  const products = [];
  let current = null;
  for (const rawLine of String(content || '').split(/\r?\n/)) {
    const line = rawLine.replace(/[*_~•▪●◦·]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const match = /^(.*?)[\s.:\-–—=]*(?:r\$)?\s*(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:reais)?$/i.exec(line);
    if (match && match[1].replace(/[^a-zà-ú]/gi, '').length >= 2 && /r\$|[.,]\d{2}$/i.test(line)) {
      current = { name: match[1].replace(/[\s.:\-–—=]+$/, '').trim(), description: '', price: match[2], options: [] };
      products.push(current);
    } else if (current && line.length <= 300 && !/^(card[aá]pio|menu|pedidos?|whats|pix|entrega)/i.test(line)) {
      current.description = current.description ? `${current.description} ${line}` : line;
    }
  }
  return sanitizeImportedProducts(products);
}

async function readMenuWithGemini({ menuText, file }) {
  const apiKey = text(process.env.GEMINI_API_KEY);
  const model = text(process.env.GEMINI_MODEL) || 'gemini-3.5-flash-lite';
  const instructions = [
    'Você recebe o cardápio ou catálogo de um pequeno empreendedor brasileiro (texto, PDF ou foto).',
    `Extraia até ${MAX_PRODUCTS} produtos à venda. Para cada um: name (nome curto), description (detalhes, ingredientes ou tamanho; vazio se não houver),`,
    'price (somente número com ponto decimal, ex.: "12.50"; vazio se não houver preço) e options.',
    'Use options apenas quando o mesmo produto tiver 2 tamanhos/versões com preços diferentes (ex.: P e G); nesse caso deixe price vazio.',
    'Não invente produtos nem preços. Ignore telefones, endereços, horários, formas de pagamento e taxas de entrega.'
  ].join(' ');
  const parts = [{ text: instructions }];
  if (menuText) parts.push({ text: `Cardápio:\n${menuText}` });
  if (file) parts.push({ inline_data: { mime_type: file.mimetype, data: file.buffer.toString('base64') } });
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            products: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  name: { type: 'STRING' },
                  description: { type: 'STRING' },
                  price: { type: 'STRING' },
                  options: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, price: { type: 'STRING' } }, required: ['name'] } }
                },
                required: ['name']
              }
            }
          },
          required: ['products']
        }
      }
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error(`Gemini respondeu ${response.status}: ${detail.slice(0, 300)}`);
    throw new HttpError(502, response.status === 429
      ? 'O leitor de cardápio está ocupado agora. Tente novamente em 1 minuto.'
      : 'Não foi possível ler o cardápio agora. Tente novamente ou cole o texto.');
  }
  const data = await response.json();
  const output = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
  try { return sanitizeImportedProducts(JSON.parse(output).products); }
  catch (_) { throw new HttpError(502, 'A leitura do cardápio veio em formato inesperado. Tente novamente.'); }
}

app.post('/api/empreendedor/importar-cardapio', rateLimit({
  windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false
}), authenticate, requireRole('EMPREENDEDOR'), menuUpload, asyncRoute(async (req, res) => {
  const menuText = text(req.body?.text).slice(0, 15000);
  const file = req.file || null;
  if (!menuText && !file) throw new HttpError(400, 'Cole o texto do cardápio ou envie um PDF/foto.');
  if (file && file.mimetype !== 'application/pdf' && !isImageBufferValid(file)) throw new HttpError(400, 'A imagem enviada está inválida.');
  if (file && file.mimetype === 'application/pdf' && file.buffer.toString('ascii', 0, 5) !== '%PDF-') throw new HttpError(400, 'O PDF enviado está inválido.');
  let products;
  let method = 'ia';
  if (text(process.env.GEMINI_API_KEY)) {
    products = await readMenuWithGemini({ menuText, file });
  } else if (!file) {
    products = parseMenuTextLocally(menuText);
    method = 'texto';
  } else {
    throw new HttpError(503, 'A leitura de PDF e fotos ainda não foi ativada no servidor. Por enquanto, cole o texto do cardápio.');
  }
  if (!products.length) throw new HttpError(422, 'Não encontrei produtos com nome e preço. Confira o cardápio ou cadastre manualmente.');
  res.json({ products, method, limit: MAX_PRODUCTS });
}));

app.patch('/api/empreendedor/produtos/:id/disponibilidade', authenticate, requireRole('EMPREENDEDOR'), asyncRoute(async (req, res) => {
  const productId = text(req.params.id);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)) {
    throw new HttpError(400, 'Identificador de produto inválido.');
  }
  if (typeof req.body?.available !== 'boolean') throw new HttpError(400, 'Informe se o produto está disponível para pedidos.');
  const { rows } = await pool.query(`
    UPDATE produto p
       SET disponivel = $1, atualizado_em = CURRENT_TIMESTAMP
      FROM vitrine v
     WHERE p.id = $2 AND p.vitrine_id = v.id AND p.ativo = TRUE
       AND v.empreendedor_id = $3 AND v.status = 'APROVADA'
     RETURNING p.id, p.disponivel
  `, [req.body.available, productId, req.user.empreendedor_id]);
  if (!rows[0]) throw new HttpError(404, 'Produto publicado não encontrado neste perfil.');
  res.json({ product: { id: rows[0].id, availableForSale: rows[0].disponivel } });
}));

app.get('/api/admin/vitrines', authenticate, requireRole('ADMIN'), asyncRoute(async (req, res) => {
  const requestedStatus = text(req.query.status).toUpperCase();
  const params = [req.user.condominio_id];
  let filter = 'u.condominio_id = $1';
  if (requestedStatus && requestedStatus !== 'TODOS') {
    if (!statuses.has(requestedStatus)) throw new HttpError(400, 'Filtro de status inválido.');
    params.push(requestedStatus);
    filter += ` AND v.status = $${params.length}`;
  }
  const { rows } = await pool.query(`${listingSelect} WHERE ${filter} ORDER BY v.criado_em DESC`, params);
  res.json({ listings: rows.map(listingDto) });
}));

app.patch('/api/admin/vitrines/:id/status', authenticate, requireRole('ADMIN'), asyncRoute(async (req, res) => {
  const status = text(req.body?.status).toUpperCase();
  const reason = text(req.body?.reason);
  if (!['APROVADA', 'REJEITADA', 'PAUSADA'].includes(status)) throw new HttpError(400, 'Status de moderação inválido.');
  if (reason.length > 500) throw new HttpError(400, 'O motivo deve ter até 500 caracteres.');
  if (status === 'REJEITADA' && reason.length < 8) throw new HttpError(400, 'Informe um motivo de recusa com pelo menos 8 caracteres.');
  const { rowCount } = await pool.query(`
    UPDATE vitrine v
       SET status = $1, moderado_por = $2, moderado_em = CURRENT_TIMESTAMP,
           motivo_moderacao = NULLIF($3, ''), atualizado_em = CURRENT_TIMESTAMP
      FROM empreendedor e, usuario owner
     WHERE v.id = $4 AND e.id = v.empreendedor_id AND owner.id = e.usuario_id
       AND owner.condominio_id = $5
  `, [status, req.user.id, reason, req.params.id, req.user.condominio_id]);
  if (!rowCount) throw new HttpError(404, 'Vitrine não encontrada neste condomínio.');
  const updated = await readListing(req.params.id, req.user.condominio_id);
  res.json({ listing: listingDto(updated) });
}));

app.get('/api/admin/administradores', authenticate, requireRole('ADMIN'), asyncRoute(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT id, nome, email, ativo, created_at
      FROM usuario
     WHERE condominio_id = $1 AND papel = 'ADMIN'
     ORDER BY created_at ASC, nome ASC
  `, [req.user.condominio_id]);
  res.json({ administrators: rows.map((row) => ({
    id: row.id, name: row.nome, email: row.email, active: row.ativo,
    createdAt: row.created_at, isCurrent: String(row.id) === String(req.user.id)
  })) });
}));

app.post('/api/admin/administradores', authenticate, requireRole('ADMIN'), asyncRoute(async (req, res) => {
  const account = validateAccount({ ...req.body, unit: 'Administração' }, false);
  const passwordHash = await bcrypt.hash(account.password, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [734221907]);
    const { rows } = await client.query(`
      INSERT INTO usuario (condominio_id, nome, email, senha_hash, papel)
      VALUES ($1, $2, $3, $4, 'ADMIN')
      RETURNING id, nome, email, ativo, created_at
    `, [req.user.condominio_id, account.name, account.email, passwordHash]);
    await client.query('COMMIT');
    const row = rows[0];
    res.status(201).json({ administrator: {
      id: row.id, name: row.nome, email: row.email, active: row.ativo,
      createdAt: row.created_at, isCurrent: false
    } });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw new HttpError(409, 'Este e-mail já possui uma conta neste condomínio.');
    throw error;
  } finally {
    client.release();
  }
}));

app.patch('/api/admin/administradores/:id/ativo', authenticate, requireRole('ADMIN'), asyncRoute(async (req, res) => {
  const targetId = text(req.params.id);
  const active = req.body?.active;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
    throw new HttpError(400, 'Identificador de administrador inválido.');
  }
  if (typeof active !== 'boolean') throw new HttpError(400, 'Informe se a conta deve ficar ativa ou inativa.');
  if (!active && String(targetId) === String(req.user.id)) {
    throw new HttpError(409, 'Você não pode desativar a própria conta.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [734221907]);
    const target = await client.query(`
      SELECT id, nome, email, ativo, created_at
        FROM usuario
       WHERE id = $1 AND condominio_id = $2 AND papel = 'ADMIN'
       FOR UPDATE
    `, [targetId, req.user.condominio_id]);
    if (!target.rows[0]) throw new HttpError(404, 'Administrador não encontrado nesta comunidade.');
    if (!active && target.rows[0].ativo) {
      const count = await client.query(
        "SELECT COUNT(*)::integer AS total FROM usuario WHERE condominio_id = $1 AND papel = 'ADMIN' AND ativo = TRUE",
        [req.user.condominio_id]
      );
      if (Number(count.rows[0].total) <= 1) throw new HttpError(409, 'A comunidade precisa manter pelo menos um administrador ativo.');
    }
    const { rows } = await client.query(`
      UPDATE usuario SET ativo = $1
       WHERE id = $2 AND condominio_id = $3 AND papel = 'ADMIN'
       RETURNING id, nome, email, ativo, created_at
    `, [active, targetId, req.user.condominio_id]);
    await client.query('COMMIT');
    const row = rows[0];
    res.json({ administrator: {
      id: row.id, name: row.nome, email: row.email, active: row.ativo,
      createdAt: row.created_at, isCurrent: String(row.id) === String(req.user.id)
    } });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.post('/api/admin/bootstrap', rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false }), asyncRoute(async (req, res) => {
  const configuredSecret = process.env.ADMIN_BOOTSTRAP_TOKEN || '';
  if (configuredSecret.length < 32 || configuredSecret.includes('SUBSTITUA_')) {
    throw new HttpError(503, 'Configure ADMIN_BOOTSTRAP_TOKEN e reinicie a API para criar o primeiro administrador.');
  }
  const supplied = text(req.get('x-bootstrap-token'));
  const expectedBuffer = Buffer.from(configuredSecret);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    throw new HttpError(401, 'Token de provisionamento inválido.');
  }

  const account = validateAccount({ ...req.body, unit: 'Administração' }, false);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [734221907]);
    const condominiumId = await getCondominiumId(client);
    const existing = await client.query(
      "SELECT 1 FROM usuario WHERE condominio_id = $1 AND papel = 'ADMIN' LIMIT 1",
      [condominiumId]
    );
    if (existing.rowCount) throw new HttpError(409, 'Já existe um administrador neste condomínio.');
    const passwordHash = await bcrypt.hash(account.password, 12);
    const { rows } = await client.query(`
      INSERT INTO usuario (condominio_id, nome, email, senha_hash, papel)
      VALUES ($1, $2, $3, $4, 'ADMIN')
      RETURNING id, nome, email, papel, condominio_id
    `, [condominiumId, account.name, account.email, passwordHash]);
    const user = rows[0];
    await client.query('COMMIT');
    res.status(201).json({ token: issueToken(user), user: userDto(user) });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw new HttpError(409, 'Este e-mail já está cadastrado.');
    throw error;
  } finally {
    client.release();
  }
}));

app.use((req, res, next) => next(new HttpError(404, 'Rota não encontrada.')));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const uploadError = error instanceof multer.MulterError;
  const status = Number.isInteger(error.status) ? error.status : (uploadError || error.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error('Erro na API:', error.message);
  const message = uploadError
    ? (error.code === 'LIMIT_FILE_SIZE' ? (error.field === 'menuFile' ? 'O cardápio deve ter até 8 MB.' : 'Cada imagem deve ter até 4 MB.') : 'Os arquivos enviados excedem os limites permitidos.')
    : error.message;
  res.status(status).json({ error: status >= 500 && !(error instanceof HttpError) ? 'Erro interno do servidor.' : message });
});

async function expireReservations() {
  const { rowCount } = await pool.query(`
    UPDATE contato_comercial
       SET status = 'EXPIRADO',
           finalizado_em = COALESCE(finalizado_em, CURRENT_TIMESTAMP)
     WHERE status = 'ABERTO' AND expira_em <= CURRENT_TIMESTAMP
  `);
  return rowCount;
}

let reservationExpiryRunning = false;
async function runReservationExpiry() {
  if (reservationExpiryRunning) return;
  reservationExpiryRunning = true;
  try {
    const expiredCount = await expireReservations();
    if (expiredCount) console.info(`Reservas expiradas automaticamente: ${expiredCount}`);
  } catch (error) {
    console.error('Falha na limpeza automática das reservas:', error.message);
  } finally {
    reservationExpiryRunning = false;
  }
}

// A disponibilidade também é calculada pelo horário da reserva; esta limpeza mantém o histórico atualizado.
const reservationExpiryTimer = setInterval(runReservationExpiry, 30_000);
reservationExpiryTimer.unref();
runReservationExpiry();

async function shutdown(signal) {
  console.log(`\n${signal}: encerrando API...`);
  clearInterval(reservationExpiryTimer);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
// Origem de prévia local :8765 já é incluída acima, junto das portas :5500.

const server = app.listen(port, host, () => {
  console.log(`Rede Vizinha API ouvindo em http://${host}:${port}`);
});
