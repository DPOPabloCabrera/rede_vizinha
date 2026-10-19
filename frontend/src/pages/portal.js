(() => {
  'use strict';

  const API_BASE_URL = String(window.REDE_VIZINHA_API_URL || '').replace(/\/+$/, '');
  const API_MODE = Boolean(API_BASE_URL);
  const DB_KEY = 'rede-vizinha-v1';
  const SESSION_KEY = 'rede-vizinha-session-v1';
  const CUSTOMER_SESSION_KEY = 'rede-vizinha-customer-session-v1';
  const CATEGORIES = ['Todas', 'Gastronomia', 'Beleza e bem-estar', 'Casa e manutenção', 'Aulas e atividades', 'Pets', 'Moda e acessórios', 'Outros serviços'];
  const DEMO_STORES = [
    { id: 'demo-doces', ownerId: 'demo', ownerName: 'Mariana Silva', unit: 'Torre Ipê · ap. 74', title: 'Doces da Mari', category: 'Gastronomia', description: 'Bolos artesanais, pão de mel e docinhos feitos sob encomenda, com aquele gostinho de casa.', price: 'A partir de R$ 7,50', whatsapp: '11998765432', emoji: '🍰', cover: 'cover-food', status: 'aprovada' },
    { id: 'demo-reparos', ownerId: 'demo', ownerName: 'Carlos Mendes', unit: 'Torre Jatobá · ap. 142', title: 'Reparos do Carlos', category: 'Casa e manutenção', description: 'Pequenos reparos elétricos e instalações residenciais. Atendimento cuidadoso e orçamento sem compromisso.', price: 'Orçamento grátis', whatsapp: '11987654321', emoji: '🪴', cover: 'cover-home', status: 'aprovada' },
    { id: 'demo-beleza', ownerId: 'demo', ownerName: 'Ana Oliveira', unit: 'Torre Manacá · ap. 31', title: 'Ateliê da Ana', category: 'Beleza e bem-estar', description: 'Manicure, nail art e momentos de autocuidado com horário marcado aqui no condomínio.', price: 'A partir de R$ 35', whatsapp: '11976543210', emoji: '🌷', cover: 'cover-beauty', status: 'aprovada' },
    { id: 'demo-costura', ownerId: 'demo', ownerName: 'Júlia Santos', unit: 'Torre Ipê · ap. 26', title: 'Linha & Afeto', category: 'Moda e acessórios', description: 'Ajustes, pequenos consertos e peças costuradas à mão com muito carinho.', price: 'Sob consulta', whatsapp: '11965432109', emoji: '🧶', cover: 'cover-craft', status: 'aprovada' },
    { id: 'demo-aulas', ownerId: 'demo', ownerName: 'Rafael Lima', unit: 'Torre Cedro · ap. 108', title: 'Movimento com Rafa', category: 'Aulas e atividades', description: 'Aulas particulares de alongamento e mobilidade para todos os níveis e idades.', price: 'A partir de R$ 50', whatsapp: '11954321098', emoji: '🧘', cover: 'cover-activity', status: 'aprovada' },
    { id: 'demo-pet', ownerId: 'demo', ownerName: 'Beatriz Costa', unit: 'Torre Jatobá · ap. 53', title: 'Pet da Bia', category: 'Pets', description: 'Passeios, visitas e cuidado de confiança para os seus pets sem sair do condomínio.', price: 'A partir de R$ 30', whatsapp: '11943210987', emoji: '🐾', cover: 'cover-default', status: 'aprovada' }
  ];

  const freshState = () => ({ accounts: [], listings: DEMO_STORES.map((item) => ({ ...item })) });
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(DB_KEY));
      if (saved && Array.isArray(saved.accounts) && Array.isArray(saved.listings)) return saved;
    } catch (_) { /* dados locais inválidos: reinicia apenas a demonstração */ }
    return freshState();
  }
  let state = loadState();
  const save = () => localStorage.setItem(DB_KEY, JSON.stringify(state));
  const getSession = () => { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; } catch (_) { return null; } };
  const setSession = (session) => session ? sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)) : sessionStorage.removeItem(SESSION_KEY);
  const getCustomerSession = () => { try { return JSON.parse(sessionStorage.getItem(CUSTOMER_SESSION_KEY)) || null; } catch (_) { return null; } };
  const setCustomerSession = (session) => session ? sessionStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(session)) : sessionStorage.removeItem(CUSTOMER_SESSION_KEY);
  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const normal = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
  function publicImageUrl(value) {
    const source = String(value || '').trim();
    if (!source) return '';
    if (/^data:image\/(?:jpeg|png|webp);base64,/i.test(source) || /^https:\/\//i.test(source)) return source;
    if (source.startsWith('/uploads/')) {
      try { return API_MODE ? new URL(source, API_BASE_URL).toString() : source; } catch (_) { return ''; }
    }
    return '';
  }
  function contactHref(value, channel) {
    const source = String(value || '').trim();
    if (!source) return '';
    if (channel === 'instagram' && /^@?[a-z0-9._]{1,30}$/i.test(source)) return `https://www.instagram.com/${source.replace(/^@/, '')}/`;
    try {
      const url = new URL(/^https?:\/\//i.test(source) ? source : `https://${source}`);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      if (channel === 'instagram' && host !== 'instagram.com') return '';
      if (channel === 'linkedin' && host !== 'linkedin.com') return '';
      return url.toString();
    } catch (_) { return ''; }
  }
  const PAYMENT_METHODS = ['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO'];
  const PAYMENT_LABELS = { PIX: 'Pix', DINHEIRO: 'Dinheiro', CREDITO: 'Cartão de crédito', DEBITO: 'Cartão de débito', CARTAO: 'Cartão', COMBINAR: 'Combinar diretamente' };
  const FLEX_LABELS = { FLEX_1: 'Flex 1', FLEX_2: 'Flex 2' };
  const MAX_PRODUCTS = 30;
  const whatsappNumber = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    return digits ? (digits.startsWith('55') ? digits : `55${digits}`) : '';
  };
  function toast(message) {
    const element = document.getElementById('toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('is-visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove('is-visible'), 3500);
  }

  async function apiRequest(path, options = {}, token = getSession()?.token) {
    const headers = { ...(options.headers || {}) };
    if (!(options.body instanceof FormData) && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    } catch (_) {
      throw new Error('Não foi possível conectar à API. Confira se o backend Node está rodando em http://localhost:8080.');
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `A API respondeu com erro ${response.status}.`);
    return payload;
  }

  const categoryEmoji = (category) => ({
    Gastronomia: '🍰', 'Beleza e bem-estar': '🌷', 'Casa e manutenção': '🪴',
    'Aulas e atividades': '🧘', Pets: '🐾', 'Moda e acessórios': '🧶', 'Outros serviços': '✳'
  }[category] || '✳');
  const categoryCover = (category) => ({
    Gastronomia: 'cover-food', 'Beleza e bem-estar': 'cover-beauty', 'Casa e manutenção': 'cover-home',
    'Aulas e atividades': 'cover-activity', Pets: 'cover-default', 'Moda e acessórios': 'cover-craft',
    'Outros serviços': 'cover-default'
  }[category] || 'cover-default');

  function initCatalog() {
    const grid = document.getElementById('storeGrid');
    if (!grid) return;
    const categoryList = document.getElementById('categoryList');
    let selected = 'Todas';
    let searchQuery = '';
    let sourceListings = [];
    let publicLoadError = '';
    const carts = new Map();
    const checkoutDialog = document.getElementById('checkoutDialog');
    const catalogDialog = document.getElementById('catalogDialog');
    const catalogContent = document.getElementById('catalogDialogContent');
    const catalogCache = new Map();
    const checkoutForm = document.getElementById('checkoutForm');
    const checkoutCreateAccount = document.getElementById('checkoutCreateAccount');
    const checkoutAccountFields = document.getElementById('checkoutAccountFields');
    const customerLoginDetails = document.getElementById('customerLoginDetails');
    const checkoutFeedback = document.getElementById('checkoutFeedback');
    let customerSession = getCustomerSession();
    let pendingCheckoutListingId = '';
    let activeCatalogListingId = '';
    let publicRefreshTimer = null;
    let publicRequestVersion = 0;
    let catalogOpenRequest = 0;
    categoryList.innerHTML = CATEGORIES.map((category, index) => `<button type="button" class="category-chip${index === 0 ? ' is-active' : ''}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('');
    categoryList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      selected = button.dataset.category;
      categoryList.querySelectorAll('.category-chip').forEach((chip) => chip.classList.toggle('is-active', chip === button));
      if (API_MODE) refresh(); else render();
    });
    document.getElementById('searchInput').addEventListener('input', (event) => {
      searchQuery = event.target.value.trim();
      if (API_MODE) {
        clearTimeout(publicRefreshTimer);
        publicRefreshTimer = setTimeout(refresh, 220);
      } else render();
    });

    function render() {
      const query = normal(searchQuery);
      const rows = sourceListings.filter((row) => row.status === 'aprovada'
        && (API_MODE || (selected === 'Todas' || row.category === selected))
        && (API_MODE || !query || normal([row.title, row.description, row.ownerName, row.category, row.unit, ...(row.products || []).flatMap((product) => [product.name, product.description])].join(' ')).includes(query)));
      document.getElementById('resultCount').textContent = `${rows.length} ${rows.length === 1 ? 'perfil' : 'perfis'}`;
      const emptyState = document.getElementById('emptyState');
      const emptyStateCreate = document.getElementById('emptyStateCreate');
      const retryCatalogButton = document.getElementById('retryCatalogButton');
      emptyState.hidden = rows.length > 0;
      document.getElementById('emptyStateTitle').textContent = publicLoadError ? 'Não foi possível carregar o catálogo' : 'Nenhuma vitrine por aqui ainda';
      document.getElementById('emptyStateCopy').textContent = publicLoadError || 'Tente buscar outra coisa ou seja o primeiro a divulgar seu negócio.';
      emptyStateCreate.hidden = Boolean(publicLoadError);
      retryCatalogButton.hidden = !publicLoadError;
      grid.innerHTML = rows.map((row) => {
        const profileOnly = Boolean(row.profileOnly);
        const coverUrl = profileOnly ? '' : publicImageUrl(row.imageUrl);
        const ownerPhoto = publicImageUrl(row.ownerPhotoUrl);
        const products = profileOnly ? [] : (Array.isArray(row.products) ? row.products : []);
        const hasCatalog = Boolean(row.hasCatalog || products.length);
        const contacts = row.contacts || {};
        const phone = whatsappNumber(contacts.whatsapp || row.whatsapp);
        const contactButtons = [
          phone ? `<a class="contact-button contact-whatsapp" href="https://wa.me/${phone}?text=${encodeURIComponent('Olá, te encontrei no Rede vizinha, gostaria de mais informações')}" data-contact-channel="WHATSAPP" data-listing-id="${escapeHtml(row.id)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : '',
          contactHref(contacts.instagram, 'instagram') ? `<a class="contact-button" href="${escapeHtml(contactHref(contacts.instagram, 'instagram'))}" data-contact-channel="INSTAGRAM" data-listing-id="${escapeHtml(row.id)}" target="_blank" rel="noopener noreferrer">Instagram</a>` : '',
          contactHref(contacts.website, 'site') ? `<a class="contact-button" href="${escapeHtml(contactHref(contacts.website, 'site'))}" data-contact-channel="SITE" data-listing-id="${escapeHtml(row.id)}" target="_blank" rel="noopener noreferrer">Site</a>` : '',
          contactHref(contacts.linkedin, 'linkedin') ? `<a class="contact-button" href="${escapeHtml(contactHref(contacts.linkedin, 'linkedin'))}" data-contact-channel="LINKEDIN" data-listing-id="${escapeHtml(row.id)}" target="_blank" rel="noopener noreferrer">LinkedIn</a>` : ''
        ].filter(Boolean).join('');
        const coverMarkup = profileOnly ? '' : `<div class="store-cover ${escapeHtml(row.cover || categoryCover(row.category))}">${coverUrl ? `<img class="store-cover-image" src="${escapeHtml(coverUrl)}" alt="Foto da vitrine ${escapeHtml(row.title)}" loading="lazy">` : `<span class="cover-emoji" aria-hidden="true">${escapeHtml(row.emoji || categoryEmoji(row.category))}</span>`}${row.category ? `<span class="cover-stamp">${escapeHtml(row.category)}</span>` : ''}</div>`;
        const ownerAvatar = `${escapeHtml(initials(row.ownerName))}${ownerPhoto ? `<img src="${escapeHtml(ownerPhoto)}" alt="Foto de ${escapeHtml(row.ownerName)}" loading="lazy">` : ''}`;
        const profileDescription = profileOnly ? '' : `<h3>${escapeHtml(row.title)}</h3><p>${escapeHtml(row.description)}</p>`;
        const catalogAction = hasCatalog ? `<button type="button" class="button button-dark button-wide catalog-open-button" data-open-catalog="${escapeHtml(row.id)}">Ver catálogo <span aria-hidden="true">↗</span></button>` : '';
        return `<article class="store-card${profileOnly ? ' store-card-profile-only' : ''}">${coverMarkup}<div class="store-body"><div class="store-meta"><span>${profileOnly ? 'Perfil do empreendedor' : 'Perfil público'}</span><span>${escapeHtml(row.category || 'Serviços')}</span></div>${profileDescription}<div class="store-owner"><span class="owner-avatar">${ownerAvatar}</span><span><strong>${escapeHtml(row.ownerName)}</strong>${escapeHtml(row.unit || '')}</span></div>${catalogAction}<div class="contact-buttons">${contactButtons || '<span class="no-contact">Nenhum canal de contato cadastrado.</span>'}</div></div></article>`;
      }).join('');
      grid.querySelectorAll('img').forEach((image) => image.addEventListener('error', () => image.remove(), { once: true }));
    }

    function formatCatalogPrice(value) {
      if (value === null || value === undefined || String(value).trim() === '') return 'Verificar';
      const amount = Number(value);
      return Number.isFinite(amount)
        ? `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : escapeHtml(value);
    }

    function renderCatalogContent(listing) {
      if (!listing || activeCatalogListingId !== listing.id) return;
      const products = Array.isArray(listing.products) ? listing.products : [];
      const cart = carts.get(listing.id) || new Map();
      const phone = whatsappNumber(listing.contacts?.whatsapp || listing.whatsapp);
      const productMarkup = products.length ? `<div class="catalog-detail-list">${products.map((product) => {
        const photo = publicImageUrl(product.imageUrl);
        const options = Array.isArray(product.options) && product.options.length
          ? product.options
          : [{ id: '', name: '', price: product.price, stock: product.stock, available: product.available }];
        const productAvailable = product.availableForSale !== false;
        const optionMarkup = options.map((option) => {
          const optionKey = `${product.id}:${option.id || 'base'}`;
          const available = Math.max(0, Number(option.available ?? option.stock ?? 0));
          const selectedQuantity = cart.get(optionKey)?.quantity || 0;
          const canOrder = API_MODE && Boolean(phone) && productAvailable && available > 0;
          const statusText = !productAvailable ? 'Indisponível' : available > 0 ? `${available} disponível(is)` : 'Esgotado';
          return `<div class="catalog-option-card${!productAvailable || !available ? ' is-unavailable' : ''}" data-option-card><div class="catalog-option-copy"><strong>${escapeHtml(option.name || 'Preço único')}</strong><b>${formatCatalogPrice(option.price)}</b><small>${statusText}</small></div><div class="product-pick"><label>Qtd.<input type="number" min="1" max="${available}" value="1" data-product-quantity data-option-key="${escapeHtml(optionKey)}" aria-label="Quantidade de ${escapeHtml(product.name)}${option.name ? ` — ${escapeHtml(option.name)}` : ''}"${canOrder ? '' : ' disabled'}></label><button type="button" class="button button-outline button-small" data-add-product data-listing-id="${escapeHtml(listing.id)}" data-product-id="${escapeHtml(product.id)}" data-option-id="${escapeHtml(option.id || '')}" data-option-key="${escapeHtml(optionKey)}"${canOrder ? '' : ' disabled'}>${selectedQuantity ? `Na lista: ${selectedQuantity}` : 'Adicionar'}</button></div></div>`;
        }).join('');
        return `<article class="catalog-detail-product${!productAvailable ? ' is-unavailable' : ''}"><div class="catalog-detail-product-heading">${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(product.name)}" loading="lazy">` : '<span class="catalog-product-placeholder" aria-hidden="true">✳</span>'}<div><h3>${escapeHtml(product.name)}</h3>${product.description ? `<p>${escapeHtml(product.description)}</p>` : ''}${!productAvailable ? '<span class="availability-badge is-unavailable">Indisponível</span>' : ''}</div></div><div class="catalog-options-grid">${optionMarkup}</div></article>`;
      }).join('')}</div>` : '<div class="catalog-empty-note"><strong>Este catálogo ainda não tem itens publicados.</strong><span>Você pode entrar em contato diretamente pelos canais do perfil.</span></div>';
      const catalogNotice = !API_MODE
        ? '<div class="catalog-empty-note">A visualização está disponível, mas pedidos com reserva dependem do backend PostgreSQL conectado.</div>'
        : (!phone ? '<div class="catalog-empty-note">Este empreendedor ainda não cadastrou WhatsApp para receber pedidos. Use outro canal no perfil.</div>' : '');
      const cartItems = [...cart.values()];
      const cartMarkup = cartItems.length && phone ? `<div class="cart-summary"><strong>Sua sacolinha</strong>${cartItems.map((item) => `<div class="cart-line"><span>${escapeHtml(item.name)}${item.optionName ? ` · ${escapeHtml(item.optionName)}` : ''} × ${item.quantity}</span><button type="button" data-remove-product="${escapeHtml(item.key)}" data-listing-id="${escapeHtml(listing.id)}" aria-label="Remover ${escapeHtml(item.name)}">Remover</button></div>`).join('')}<button type="button" class="button button-dark button-wide" data-send-cart="${escapeHtml(listing.id)}">Concluir pedido</button><small>Sem login. Ao confirmar o envio, cada opção fica reservada por 30 minutos para o empreendedor responder.</small></div>` : '';
      document.getElementById('catalogDialogTitle').textContent = listing.title || 'Catálogo';
      document.getElementById('catalogDialogDescription').textContent = `${listing.ownerName || ''}${listing.category ? ` · ${listing.category}` : ''}`;
      catalogContent.innerHTML = `${catalogNotice}${productMarkup}${cartMarkup}`;
      catalogContent.querySelectorAll('img').forEach((image) => image.addEventListener('error', () => image.remove(), { once: true }));
    }

    async function openCatalog(listingId) {
      const summary = sourceListings.find((item) => item.id === listingId);
      if (!summary || !(summary.hasCatalog || (Array.isArray(summary.products) && summary.products.length))) return;
      const requestVersion = ++catalogOpenRequest;
      activeCatalogListingId = listingId;
      document.getElementById('catalogDialogTitle').textContent = summary.title || 'Catálogo';
      document.getElementById('catalogDialogDescription').textContent = 'Carregando itens e disponibilidade…';
      catalogContent.innerHTML = '<div class="catalog-loading" role="status">Carregando catálogo…</div>';
      if (!catalogDialog.open) catalogDialog.showModal();
      try {
        let listing;
        if (API_MODE) {
          const response = await apiRequest(`/vitrines/${encodeURIComponent(listingId)}/catalogo`, {}, null);
          listing = response.listing;
        } else {
          state = loadState();
          listing = state.listings.find((item) => item.id === listingId);
        }
        if (!listing) throw new Error('Este catálogo não está disponível. Atualize a página e tente novamente.');
        if (requestVersion !== catalogOpenRequest || activeCatalogListingId !== listingId) return;
        catalogCache.set(listingId, listing);
        renderCatalogContent(listing);
      } catch (error) {
        if (requestVersion !== catalogOpenRequest) return;
        catalogContent.innerHTML = `<p class="catalog-empty-note" role="alert">${escapeHtml(error.message || 'Não foi possível carregar este catálogo.')}</p>`;
      }
    }

    document.getElementById('closeCatalogDialog').addEventListener('click', () => catalogDialog.close());
    catalogDialog.addEventListener('close', () => { activeCatalogListingId = ''; catalogOpenRequest += 1; });

    function customerSessionFrom(response) {
      const user = response.user || {};
      return {
        id: user.id, token: response.token, name: user.name || '', email: user.email || '',
        phone: user.phone || user.whatsapp || '', address: user.deliveryAddress || '',
        complement: user.deliveryComplement || '', neighborhood: user.deliveryNeighborhood || '',
        city: user.deliveryCity || '', postalCode: user.deliveryPostalCode || '',
        tower: user.deliveryTower || '', apartment: user.deliveryApartment || '', flex: user.deliveryFlex || ''
      };
    }

    function fillCheckoutCustomer(customer) {
      document.getElementById('checkoutName').value = customer.name || '';
      document.getElementById('checkoutPhone').value = customer.phone || '';
      document.getElementById('checkoutTower').value = customer.tower || '';
      document.getElementById('checkoutApartment').value = customer.apartment || '';
      checkoutForm.querySelectorAll('input[name="checkoutFlex"]').forEach((input) => { input.checked = input.value === customer.flex; });
    }

    function openCheckout(listingId) {
      const listing = sourceListings.find((row) => row.id === listingId);
      const cart = carts.get(listingId) || new Map();
      const items = [...cart.values()];
      if (!listing || !items.length) return;
      pendingCheckoutListingId = listingId;
      checkoutForm.reset();
      checkoutFeedback.textContent = '';
      checkoutFeedback.classList.remove('is-success');
      document.getElementById('checkoutSummary').textContent = `${listing.title} · ${items.length} ${items.length === 1 ? 'produto' : 'produtos'} na sacolinha`;
      const details = catalogCache.get(listingId) || listing;
      const accepted = Array.isArray(details.paymentMethods) && details.paymentMethods.length ? details.paymentMethods : PAYMENT_METHODS;
      const paymentSelect = document.getElementById('checkoutPayment');
      paymentSelect.innerHTML = `${accepted.length > 1 ? '<option value="">Selecione</option>' : ''}${accepted.map((method) => `<option value="${escapeHtml(method)}">${escapeHtml(PAYMENT_LABELS[method] || method)}</option>`).join('')}`;
      document.getElementById('customerLoginFeedback').textContent = '';
      customerLoginDetails.open = false;
      checkoutAccountFields.hidden = true;
      checkoutCreateAccount.disabled = Boolean(customerSession);
      document.getElementById('checkoutAccountEmail').required = false;
      document.getElementById('checkoutAccountPassword').required = false;
      document.getElementById('checkoutCustomerState').textContent = customerSession
        ? `Conta conectada: ${customerSession.email}. Seus dados foram preenchidos; revise antes de enviar.`
        : 'Você pode pedir sem criar conta. A conta é opcional e serve para salvar seus dados de entrega.';
      if (customerSession) fillCheckoutCustomer(customerSession);
      checkoutDialog.showModal();
    }

    checkoutCreateAccount.addEventListener('change', () => {
      checkoutAccountFields.hidden = !checkoutCreateAccount.checked;
      document.getElementById('checkoutAccountEmail').required = checkoutCreateAccount.checked;
      document.getElementById('checkoutAccountPassword').required = checkoutCreateAccount.checked;
    });

    document.getElementById('customerLoginButton').addEventListener('click', async () => {
      const feedback = document.getElementById('customerLoginFeedback');
      const button = document.getElementById('customerLoginButton');
      feedback.textContent = '';
      button.disabled = true;
      try {
        const result = await apiRequest('/auth/customer/login', {
          method: 'POST',
          body: JSON.stringify({
            email: document.getElementById('customerLoginEmail').value.trim(),
            password: document.getElementById('customerLoginPassword').value
          })
        }, null);
        customerSession = customerSessionFrom(result);
        setCustomerSession(customerSession);
        fillCheckoutCustomer(customerSession);
        checkoutCreateAccount.checked = false;
        checkoutCreateAccount.disabled = true;
        checkoutAccountFields.hidden = true;
        document.getElementById('checkoutCustomerState').textContent = `Conta conectada: ${customerSession.email}. Seus dados foram preenchidos; revise antes de enviar.`;
        feedback.classList.add('is-success');
        feedback.textContent = 'Dados carregados. Confira o endereço e continue com o pedido.';
      } catch (error) {
        feedback.classList.remove('is-success');
        feedback.textContent = error.message || 'Não foi possível entrar na conta de cliente.';
      } finally { button.disabled = false; }
    });

    document.getElementById('closeCheckout').addEventListener('click', () => checkoutDialog.close());
    document.getElementById('cancelCheckout').addEventListener('click', () => checkoutDialog.close());

    checkoutForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const listing = sourceListings.find((row) => row.id === pendingCheckoutListingId);
      const cart = carts.get(pendingCheckoutListingId) || new Map();
      const items = [...cart.values()].map((item) => ({ productId: item.productId, optionId: item.optionId || null, quantity: item.quantity }));
      if (!listing || !items.length) return;
      const order = {
        name: document.getElementById('checkoutName').value.trim(),
        phone: document.getElementById('checkoutPhone').value.trim(),
        flex: checkoutForm.querySelector('input[name="checkoutFlex"]:checked')?.value || '',
        tower: document.getElementById('checkoutTower').value.trim(),
        apartment: document.getElementById('checkoutApartment').value.trim(),
        paymentMethod: document.getElementById('checkoutPayment').value,
        deliveryNote: document.getElementById('checkoutDeliveryNote').value.trim()
      };
      const popup = window.open('about:blank', '_blank');
      const submit = document.getElementById('checkoutSubmit');
      submit.disabled = true;
      checkoutFeedback.textContent = '';
      checkoutFeedback.classList.remove('is-success');
      try {
        if (checkoutCreateAccount.checked) {
          const created = await apiRequest('/auth/customer/register', {
            method: 'POST',
            body: JSON.stringify({
              email: document.getElementById('checkoutAccountEmail').value.trim(),
              password: document.getElementById('checkoutAccountPassword').value,
              order
            })
          }, null);
          customerSession = customerSessionFrom(created);
          setCustomerSession(customerSession);
        }
        const result = await apiRequest(`/vitrines/${encodeURIComponent(listing.id)}/contatos`, {
          method: 'POST',
          body: JSON.stringify({ channel: 'WHATSAPP', items, order })
        }, customerSession?.token || null);
        const contact = result.contact || {};
        const confirmedOrder = contact.order || order;
        const money = (value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const itemLines = (contact.items || []).map((item) => {
          const unitPrice = item.price === null ? 'valor a confirmar' : money(item.price);
          const lineTotal = item.price === null ? '' : ` = ${money(Number(item.price) * item.quantity)}`;
          return `• ${item.quantity}x ${item.name}${item.optionName ? ` (${item.optionName})` : ''} — ${unitPrice}${lineTotal}`;
        });
        const estimatedTotal = contact.estimatedTotal === null || contact.estimatedTotal === undefined
          ? 'a confirmar (há item sem preço publicado)'
          : money(contact.estimatedTotal);
        const expiry = contact.expiresAt ? new Date(contact.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
        const message = [
          `🛍️ *Novo pedido — ${listing.title}*`,
          '_Enviado pela Rede Vizinha_',
          '',
          '*Itens:*',
          ...itemLines,
          '',
          `*Total: ${estimatedTotal}*`,
          `*Pagamento:* ${PAYMENT_LABELS[confirmedOrder.paymentMethod] || confirmedOrder.paymentMethod}`,
          '',
          '*Entrega:*',
          `${FLEX_LABELS[confirmedOrder.flex] || confirmedOrder.flex} · Torre ${confirmedOrder.tower} · Apto ${confirmedOrder.apartment}`,
          `Cliente: ${confirmedOrder.name}`,
          `WhatsApp: ${confirmedOrder.phone}`,
          confirmedOrder.deliveryNote ? `Obs.: ${confirmedOrder.deliveryNote}` : '',
          '',
          `Pedido nº ${String(contact.id || '').slice(0, 8).toUpperCase()}`,
          expiry ? `Itens reservados até ${expiry}.` : ''
        ].filter((line, index, lines) => line !== '' || (lines[index - 1] !== '' && index > 0)).join('\n').replace(/\n+$/, '');
        const phone = whatsappNumber(listing.contacts?.whatsapp || listing.whatsapp);
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        if (popup) { popup.opener = null; popup.location.href = url; } else window.location.href = url;
        const details = catalogCache.get(listing.id);
        for (const item of items) {
          const product = details?.products?.find((entry) => entry.id === item.productId);
          if (!product) continue;
          if (item.optionId) {
            const option = product.options?.find((entry) => entry.id === item.optionId);
            if (option) option.available = Math.max(0, Number(option.available ?? option.stock ?? 0) - item.quantity);
          } else product.available = Math.max(0, Number(product.available ?? product.stock ?? 0) - item.quantity);
        }
        carts.delete(listing.id);
        checkoutDialog.close();
        if (details) renderCatalogContent(details);
        render();
        toast('Pedido preparado para o WhatsApp. As unidades ficam reservadas por 30 minutos.');
      } catch (error) {
        popup?.close();
        checkoutFeedback.textContent = error.message || 'Não foi possível registrar o pedido. Confira seus dados e tente novamente.';
      } finally { submit.disabled = false; }
    });

    grid.addEventListener('click', async (event) => {
      const contactButton = event.target.closest('[data-contact-channel]');
      if (contactButton) {
        if (API_MODE) apiRequest(`/vitrines/${encodeURIComponent(contactButton.dataset.listingId)}/contatos`, {
          method: 'POST', body: JSON.stringify({ channel: contactButton.dataset.contactChannel }), keepalive: true
        }, null).catch(() => {});
        return;
      }
      const catalogButton = event.target.closest('[data-open-catalog]');
      if (catalogButton) await openCatalog(catalogButton.dataset.openCatalog);
    });

    catalogDialog.addEventListener('click', (event) => {
      const addButton = event.target.closest('[data-add-product]');
      if (addButton) {
        const listing = catalogCache.get(addButton.dataset.listingId);
        const product = listing?.products?.find((item) => item.id === addButton.dataset.productId);
        const option = product?.options?.find((item) => item.id === addButton.dataset.optionId) || null;
        const available = Math.max(0, Number(option?.available ?? option?.stock ?? product?.available ?? product?.stock ?? 0));
        const quantityInput = addButton.closest('[data-option-card]')?.querySelector('[data-product-quantity]');
        const quantity = Number(quantityInput?.value);
        const otherListingId = [...carts.keys()].find((id) => id !== addButton.dataset.listingId && carts.get(id)?.size);
        if (otherListingId) {
          const otherTitle = (catalogCache.get(otherListingId) || sourceListings.find((row) => row.id === otherListingId))?.title || 'outro empreendedor';
          if (!window.confirm(`Sua sacolinha já tem itens de ${otherTitle}. Cada pedido é de um empreendedor só. Esvaziar a sacolinha e começar com ${listing?.title || 'este catálogo'}?`)) return;
          carts.delete(otherListingId);
          render();
        }
        const cart = carts.get(addButton.dataset.listingId) || new Map();
        const key = addButton.dataset.optionKey;
        const previous = cart.get(key)?.quantity || 0;
        if (product?.availableForSale === false) { toast('Este produto está marcado como indisponível.'); return; }
        if (!Number.isInteger(quantity) || quantity < 1 || previous + quantity > available) {
          toast(`Quantidade inválida. Disponível para esta opção: ${Math.max(0, available - previous)}.`);
          return;
        }
        cart.set(key, {
          key, productId: product.id, optionId: option?.id || null,
          optionName: option?.name || '', name: product.name, quantity: previous + quantity
        });
        carts.set(addButton.dataset.listingId, cart);
        renderCatalogContent(listing);
        return;
      }
      const removeButton = event.target.closest('[data-remove-product]');
      if (removeButton) {
        const cart = carts.get(removeButton.dataset.listingId);
        cart?.delete(removeButton.dataset.removeProduct);
        const listing = catalogCache.get(removeButton.dataset.listingId);
        if (listing) renderCatalogContent(listing);
        return;
      }
      const sendButton = event.target.closest('[data-send-cart]');
      if (sendButton) {
        if (!API_MODE) { toast('Reservas de estoque exigem o backend PostgreSQL conectado.'); return; }
        openCheckout(sendButton.dataset.sendCart);
      }
    });

    async function refresh() {
      const requestVersion = ++publicRequestVersion;
      const retryButton = document.getElementById('retryCatalogButton');
      retryButton.disabled = true;
      try {
        if (API_MODE) {
          const params = new URLSearchParams();
          if (searchQuery) params.set('q', searchQuery);
          if (selected !== 'Todas') params.set('category', selected);
          const query = params.toString();
          const response = await apiRequest(`/vitrines${query ? `?${query}` : ''}`, {}, null);
          if (requestVersion !== publicRequestVersion) return;
          sourceListings = response.listings || [];
        } else {
          state = loadState();
          sourceListings = state.listings;
        }
        if (requestVersion !== publicRequestVersion) return;
        publicLoadError = '';
        render();
      } catch (error) {
        if (requestVersion !== publicRequestVersion) return;
        sourceListings = [];
        publicLoadError = error.message || 'Não foi possível carregar as vitrines.';
        render();
        toast(error.message);
      } finally {
        if (requestVersion === publicRequestVersion) retryButton.disabled = false;
      }
    }
    document.getElementById('retryCatalogButton').addEventListener('click', refresh);
    window.addEventListener('storage', refresh);
    refresh();
    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.getElementById('searchInput').focus();
      }
    });
  }

  const authCopy = {
    register: { eyebrow: 'sua vitrine começa aqui', title: 'Crie sua conta', description: 'Um cadastro simples para apresentar seu trabalho à comunidade.', button: 'Criar minha conta', autocomplete: 'new-password' },
    login: { eyebrow: 'que bom ter você de volta', title: 'Entre na sua conta', description: 'Acesse sua área para cuidar da sua vitrine.', button: 'Entrar na minha conta', autocomplete: 'current-password' }
  };

  function normalizeSession(user, token) {
    return {
      id: user.entrepreneurId || user.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      role: String(user.role || 'EMPREENDEDOR').toLowerCase(),
    unit: user.unit || '',
    whatsapp: user.whatsapp || '',
    instagramUrl: user.instagramUrl || '',
    websiteUrl: user.websiteUrl || '',
    linkedinUrl: user.linkedinUrl || '',
    token
    };
  }

  function setAuthMode(mode) {
    const copy = authCopy[mode];
    if (!copy) return;
    document.getElementById('authEyebrow').textContent = copy.eyebrow;
    document.getElementById('authTitle').textContent = copy.title;
    document.getElementById('authDescription').textContent = copy.description;
    document.getElementById('authSubmit').innerHTML = `${copy.button} <span aria-hidden="true">↗</span>`;
    document.querySelectorAll('.register-only').forEach((element) => element.classList.toggle('hidden-field', mode === 'login'));
    document.querySelectorAll('.login-only').forEach((element) => element.classList.toggle('hidden-field', mode !== 'login'));
    document.getElementById('fullName').required = mode === 'register';
    document.getElementById('unit').required = false;
    document.getElementById('whatsapp').required = false;
    document.getElementById('consent').required = mode === 'register';
    document.getElementById('password').autocomplete = copy.autocomplete;
    document.getElementById('password').minLength = mode === 'register' ? 8 : 1;
    const isLogin = mode === 'login';
    document.getElementById('loginTab').classList.toggle('is-active', isLogin);
    document.getElementById('loginTab').setAttribute('aria-selected', String(isLogin));
    document.getElementById('registerTab').classList.toggle('is-active', !isLogin);
    document.getElementById('registerTab').setAttribute('aria-selected', String(!isLogin));
    document.getElementById('authSwitchCopy').innerHTML = isLogin
      ? 'Ainda não tem cadastro? <button type="button" id="authSwitch">Criar minha conta</button>'
      : 'Já tem cadastro? <button type="button" id="authSwitch">Entrar na minha conta</button>';
    document.getElementById('authSwitch').addEventListener('click', () => setAuthMode(isLogin ? 'register' : 'login'));
    document.getElementById('formFeedback').textContent = '';
  }

  async function passwordDigest(password, salt) {
    if (!globalThis.crypto?.subtle) throw new Error('O navegador precisa oferecer Web Crypto. Abra o site por localhost ou HTTPS.');
    const bytes = new TextEncoder().encode(`${salt}:${password}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (number) => number.toString(16).padStart(2, '0')).join('');
  }

  function initAuth() {
    const form = document.getElementById('authForm');
    if (!form) return;
    const params = new URLSearchParams(location.search);
    const requestedMode = params.get('modo') || '';
    const resetToken = params.get('token') || '';
    const forgotForm = document.getElementById('forgotPasswordForm');
    const resetForm = document.getElementById('resetPasswordForm');
    const tabs = document.querySelector('.auth-tabs');
    const disclaimer = document.querySelector('.auth-disclaimer');
    const switchCopy = document.getElementById('authSwitchCopy');
    const initialMode = requestedMode === 'login' || requestedMode === 'redefinir' ? 'login' : 'register';
    setAuthMode(initialMode);
    document.getElementById('registerTab').addEventListener('click', () => setAuthMode('register'));
    document.getElementById('loginTab').addEventListener('click', () => setAuthMode('login'));
    document.getElementById('togglePassword').addEventListener('click', () => {
      const input = document.getElementById('password');
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      document.getElementById('togglePassword').setAttribute('aria-label', visible ? 'Ocultar senha' : 'Mostrar senha');
    });
    const profilePhotoInput = document.getElementById('profilePhoto');
    const profilePhotoPreview = document.getElementById('profilePhotoPreview');
    profilePhotoInput.addEventListener('change', () => {
      if (profilePhotoPreview.dataset.objectUrl) URL.revokeObjectURL(profilePhotoPreview.dataset.objectUrl);
      delete profilePhotoPreview.dataset.objectUrl;
      const file = profilePhotoInput.files?.[0];
      if (!file) { profilePhotoPreview.hidden = true; profilePhotoPreview.removeAttribute('src'); return; }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
        profilePhotoInput.value = '';
        profilePhotoPreview.hidden = true;
        document.getElementById('formFeedback').textContent = 'Escolha uma imagem JPG, PNG ou WebP de até 4 MB.';
        return;
      }
      profilePhotoPreview.dataset.objectUrl = URL.createObjectURL(file);
      profilePhotoPreview.src = profilePhotoPreview.dataset.objectUrl;
      profilePhotoPreview.hidden = false;
    });

    function showAuthView(view) {
      const mainView = view === 'login' || view === 'register';
      form.classList.toggle('hidden-field', !mainView);
      forgotForm.classList.toggle('hidden-field', view !== 'forgot');
      resetForm.classList.toggle('hidden-field', view !== 'reset');
      tabs.classList.toggle('hidden-field', !mainView);
      disclaimer.classList.toggle('hidden-field', !mainView);
      switchCopy.classList.toggle('hidden-field', !mainView);
      if (mainView) {
        setAuthMode(view);
        return;
      }

      document.getElementById('authEyebrow').textContent = view === 'forgot' ? 'recupere o acesso' : 'crie uma nova senha';
      document.getElementById('authTitle').textContent = view === 'forgot' ? 'Esqueceu sua senha?' : 'Redefina sua senha';
      document.getElementById('authDescription').textContent = view === 'forgot'
        ? 'Vamos ajudar você a voltar para sua conta.'
        : 'Escolha uma nova senha segura para continuar.';
      if (view === 'forgot') {
        document.getElementById('recoveryEmail').value = document.getElementById('email').value.trim();
        const feedback = document.getElementById('forgotFeedback');
        feedback.textContent = '';
        feedback.classList.remove('is-success');
      } else {
        const feedback = document.getElementById('resetFeedback');
        feedback.textContent = resetToken ? '' : 'Link inválido. Solicite uma nova recuperação de senha.';
        feedback.classList.remove('is-success');
        document.getElementById('resetSubmit').disabled = !resetToken;
      }
    }

    function returnToLogin() {
      history.replaceState({}, '', `${location.pathname}?modo=login`);
      showAuthView('login');
    }

    document.getElementById('forgotPasswordButton').addEventListener('click', () => showAuthView('forgot'));
    document.getElementById('forgotBack').addEventListener('click', returnToLogin);
    document.getElementById('resetBack').addEventListener('click', returnToLogin);

    forgotForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!forgotForm.reportValidity()) return;
      const feedback = document.getElementById('forgotFeedback');
      const button = document.getElementById('forgotSubmit');
      feedback.textContent = '';
      feedback.classList.remove('is-success');
      if (!API_MODE) {
        feedback.textContent = 'A recuperação segura exige a API conectada. Ative o backend para continuar.';
        return;
      }
      button.disabled = true;
      try {
        const result = await apiRequest('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email: document.getElementById('recoveryEmail').value.trim().toLowerCase() })
        }, null);
        feedback.classList.add('is-success');
        feedback.textContent = result.message || 'Se o e-mail estiver cadastrado, enviaremos instruções para redefinir a senha.';
      } catch (error) {
        feedback.textContent = error.message || 'Não foi possível solicitar a recuperação. Tente novamente.';
      } finally {
        button.disabled = false;
      }
    });

    resetForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!resetForm.reportValidity()) return;
      const feedback = document.getElementById('resetFeedback');
      const button = document.getElementById('resetSubmit');
      const password = document.getElementById('newPassword').value;
      const confirmation = document.getElementById('confirmNewPassword').value;
      feedback.textContent = '';
      feedback.classList.remove('is-success');
      if (!resetToken) {
        feedback.textContent = 'Link inválido. Solicite uma nova recuperação de senha.';
        return;
      }
      if (password.length < 8 || password.length > 128) {
        feedback.textContent = 'A senha deve ter entre 8 e 128 caracteres.';
        return;
      }
      if (password !== confirmation) {
        feedback.textContent = 'As senhas não coincidem.';
        return;
      }
      if (!API_MODE) {
        feedback.textContent = 'A recuperação segura exige a API conectada. Ative o backend para continuar.';
        return;
      }
      button.disabled = true;
      try {
        const result = await apiRequest('/auth/reset-password', {
          method: 'POST', body: JSON.stringify({ token: resetToken, password })
        }, null);
        feedback.classList.add('is-success');
        feedback.textContent = result.message || 'Senha redefinida. Você já pode entrar com a nova senha.';
        resetForm.reset();
        setTimeout(returnToLogin, 2500);
      } catch (error) {
        feedback.textContent = error.message || 'Não foi possível redefinir a senha. Solicite um novo link.';
      } finally {
        button.disabled = false;
      }
    });

    if (requestedMode === 'redefinir') showAuthView('reset');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const feedback = document.getElementById('formFeedback');
      feedback.textContent = '';
      if (!form.reportValidity()) return;
      const email = document.getElementById('email').value.trim().toLowerCase();
      const password = document.getElementById('password').value;
      const isRegister = !document.getElementById('loginTab').classList.contains('is-active');
      const submitButton = document.getElementById('authSubmit');
      submitButton.disabled = true;
      try {
        if (API_MODE) {
          let data;
          if (isRegister) {
            const registration = new FormData();
            registration.append('name', document.getElementById('fullName').value.trim());
            registration.append('email', email);
            registration.append('password', password);
            registration.append('unit', document.getElementById('unit').value.trim());
            registration.append('whatsapp', document.getElementById('whatsapp').value.trim());
            registration.append('instagram', document.getElementById('instagram').value.trim());
            registration.append('website', document.getElementById('website').value.trim());
            registration.append('linkedin', document.getElementById('linkedin').value.trim());
            if (profilePhotoInput.files?.[0]) registration.append('profilePhoto', profilePhotoInput.files[0]);
            data = await apiRequest('/auth/register', { method: 'POST', body: registration }, null);
          } else {
            data = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, null);
          }
          setSession(normalizeSession(data.user, data.token));
          location.href = 'painel.html';
          return;
        }

        if (password.length < 8) throw new Error('Escolha uma senha com pelo menos 8 caracteres.');
        if (isRegister) {
          if (state.accounts.some((account) => account.email === email)) throw new Error('Este e-mail já possui cadastro. Entre na sua conta.');
          const salt = crypto.getRandomValues(new Uint8Array(16));
          const saltText = Array.from(salt, (number) => number.toString(16).padStart(2, '0')).join('');
          const account = {
            id: crypto.randomUUID(), name: document.getElementById('fullName').value.trim(), email,
            unit: document.getElementById('unit').value.trim(), whatsapp: document.getElementById('whatsapp').value.trim(),
            instagramUrl: document.getElementById('instagram').value.trim(), websiteUrl: document.getElementById('website').value.trim(),
            linkedinUrl: document.getElementById('linkedin').value.trim(),
            salt: saltText, passwordHash: await passwordDigest(password, saltText), createdAt: new Date().toISOString()
          };
          state.accounts.push(account);
          const listing = {
            id: crypto.randomUUID(), ownerId: account.id, ownerName: account.name, unit: account.unit,
            title: account.name, category: 'Outros serviços',
            description: 'Perfil público do empreendedor.', price: '', profileOnly: true,
            whatsapp: account.whatsapp, contacts: { whatsapp: account.whatsapp, instagram: account.instagramUrl, website: account.websiteUrl, linkedin: account.linkedinUrl }, emoji: '✳', cover: 'cover-default', status: 'pendente',
            createdAt: new Date().toISOString()
          };
          state.listings.push(listing);
          save();
          setSession({ id: account.id, name: account.name, email, role: 'empreendedor', unit: account.unit, whatsapp: account.whatsapp, instagramUrl: account.instagramUrl, websiteUrl: account.websiteUrl, linkedinUrl: account.linkedinUrl });
        } else {
          const account = state.accounts.find((item) => item.email === email);
          if (!account) throw new Error('Não encontramos essa conta. Confira o e-mail ou crie seu cadastro.');
          if (await passwordDigest(password, account.salt) !== account.passwordHash) throw new Error('E-mail ou senha incorretos. Tente novamente.');
          setSession({ id: account.id, name: account.name, email: account.email, role: 'empreendedor', unit: account.unit, whatsapp: account.whatsapp, instagramUrl: account.instagramUrl, websiteUrl: account.websiteUrl, linkedinUrl: account.linkedinUrl });
        }
        location.href = 'painel.html';
      } catch (error) {
        feedback.textContent = error.message || 'Não foi possível concluir. Tente novamente.';
      } finally {
        submitButton.disabled = false;
      }
    });
  }

  function initAdmin() {
    const list = document.getElementById('adminList');
    if (!list) return;
    let filter = 'pendente';
    let records = [];
    const dialog = document.getElementById('listingDialog');
    const form = document.getElementById('listingForm');
    const reviewDialog = document.getElementById('reviewDialog');
    let currentReviewId = null;
    const productEditorList = document.getElementById('productEditorList');
    const listingImageInput = document.getElementById('listingImage');
    const listingImagePreview = document.getElementById('listingImagePreview');
    const profileContactsSection = document.getElementById('profileContactsSection');
    const profileContactsForm = document.getElementById('profileContactsForm');
    const contactLeadsPanel = document.getElementById('contactLeadsPanel');
    const profileOnlyToggle = document.getElementById('listingProfileOnly');
    const listingDetailsFields = document.getElementById('listingDetailsFields');
    const profileOnlyHint = document.getElementById('profileOnlyHint');
    const contactLeadsList = document.getElementById('contactLeadsList');
    const contactLeadsEmpty = document.getElementById('contactLeadsEmpty');
    let contactRecords = [];

    function renderContactRecords() {
      const labels = { aberto: 'Aguardando retorno', vendido: 'Venda realizada', encerrado: 'Contato encerrado', expirado: 'Reserva expirada' };
      const paymentLabels = PAYMENT_LABELS;
      contactLeadsList.innerHTML = contactRecords.map((contact) => {
        const products = Array.isArray(contact.items) ? contact.items : [];
        const itemMarkup = products.length ? `<ul>${products.map((item) => `<li>${escapeHtml(item.name)}${item.optionName ? ` · ${escapeHtml(item.optionName)}` : ''} × ${item.quantity}${item.price ? ` · R$ ${escapeHtml(Number(item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}` : ' · valor a verificar'}</li>`).join('')}</ul>` : '<p class="contact-lead-service">Contato de perfil / serviço, sem itens de estoque.</p>';
        const customer = contact.customer;
        const address = customer ? [customer.address, customer.complement, customer.neighborhood, customer.city, customer.postalCode ? `CEP ${customer.postalCode}` : ''].filter(Boolean).join(', ') : '';
        const customerMarkup = customer ? `<div class="contact-lead-order"><p><strong>Cliente:</strong> ${escapeHtml(customer.name)}</p><p><strong>WhatsApp:</strong> ${escapeHtml(customer.phone || 'Não informado')}</p><p><strong>Entrega:</strong> ${escapeHtml(address || 'Não informado')}</p><p><strong>Pagamento pretendido:</strong> ${escapeHtml(paymentLabels[customer.paymentMethod] || customer.paymentMethod || 'Não informado')}</p>${customer.deliveryNote ? `<p><strong>Observação:</strong> ${escapeHtml(customer.deliveryNote)}</p>` : ''}</div>` : '';
        const expiry = contact.expiresAt ? `Reserva até ${new Date(contact.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '';
        const actions = contact.status === 'aberto' ? `<div class="contact-lead-actions">${products.length ? `<button class="button button-dark button-small" type="button" data-contact-action="sale" data-id="${escapeHtml(contact.id)}">Marcar venda realizada</button>` : ''}<button class="button button-outline button-small" type="button" data-contact-action="close" data-id="${escapeHtml(contact.id)}">Encerrar contato</button></div>` : '';
        return `<article class="contact-lead-card"><div class="contact-lead-heading"><div><strong>${escapeHtml(contact.listingTitle)}</strong><small>${({ whatsapp: 'WhatsApp', instagram: 'Instagram', site: 'Site', linkedin: 'LinkedIn' }[contact.channel] || 'Contato')} · ${new Date(contact.createdAt).toLocaleString('pt-BR')}</small></div><span class="lead-status lead-${escapeHtml(contact.status)}">${labels[contact.status] || escapeHtml(contact.status)}</span></div>${itemMarkup}${customerMarkup}<div class="contact-lead-footer"><small>${contact.status === 'aberto' ? expiry : 'Registro encerrado'}</small>${actions}</div></article>`;
      }).join('');
      contactLeadsEmpty.hidden = contactRecords.length > 0;
    }

    async function refreshContactRecords() {
      if (!API_MODE || adminMode() || !getSession()?.token) return;
      try {
        const result = await apiRequest('/empreendedor/contatos');
        contactRecords = result.contacts || [];
        renderContactRecords();
      } catch (error) {
        contactLeadsList.innerHTML = `<p class="owner-note">${escapeHtml(error.message)}</p>`;
      }
    }

    function productOptionEditorMarkup(option = {}, index = 0) {
      return `<div class="product-option-editor" data-product-option-row><input type="hidden" data-product-option-id value="${escapeHtml(option.id || '')}"><div class="form-row"><label>Nome da opção</label><input data-product-option-name required maxlength="80" value="${escapeHtml(option.name || '')}" placeholder="Ex.: Individual ou Para dois"></div><div class="form-row"><label>Preço (R$) <span>· opcional</span></label><input data-product-option-price inputmode="decimal" maxlength="14" value="${escapeHtml(option.price || '')}" placeholder="Deixe vazio para mostrar ‘Verificar’"></div><div class="form-row"><label>Estoque desta opção</label><input data-product-option-stock type="number" min="0" max="1000000" step="1" required value="${escapeHtml(option.stock ?? 0)}"></div><button type="button" class="row-action is-danger product-option-remove" data-remove-product-option aria-label="Remover opção ${index + 1}">Remover opção</button></div>`;
    }

    function productEditorMarkup(product = {}, index = 0, quickAvailability = false) {
      const photo = publicImageUrl(product.imageUrl);
      const options = Array.isArray(product.options) ? product.options : [];
      const hasOptions = options.length > 0;
      const availabilityAction = quickAvailability && product.id
        ? '<button type="button" class="button button-outline button-small product-availability-save" data-save-product-availability>Aplicar agora sem nova revisão</button>'
        : '';
      const availabilityHelp = quickAvailability
        ? 'O botão abaixo atualiza este controle sem retirar a vitrine do catálogo.'
        : 'Este controle será salvo junto com as informações do formulário.';
      return `<article class="product-editor-card" data-product-row data-saved-availability="${product.availableForSale === false ? 'false' : 'true'}"><input type="hidden" data-product-id value="${escapeHtml(product.id || '')}"><div class="product-editor-heading"><strong>Produto ${index + 1}</strong><button type="button" class="row-action is-danger" data-remove-product>Remover</button></div><label class="product-availability-toggle"><input type="checkbox" data-product-available${product.availableForSale === false ? '' : ' checked'}><span><strong>Disponível para pedidos</strong><small>Indisponível continua visível, esmaecido, mas não pode ser pedido. ${availabilityHelp}</small></span></label>${availabilityAction}<div class="form-row"><label>Nome do produto</label><input data-product-name maxlength="140" required value="${escapeHtml(product.name || '')}" placeholder="Ex.: Marmita da casa"></div><div class="form-row"><label>Descrição <span>· opcional</span></label><textarea data-product-description rows="2" maxlength="700" placeholder="Detalhes do produto">${escapeHtml(product.description || '')}</textarea></div><div data-product-base-fields${hasOptions ? ' hidden' : ''}><div class="form-row"><label>Quantidade disponível</label><input data-product-stock type="number" min="0" max="1000000" step="1" required value="${escapeHtml(product.stock ?? 0)}"><small class="image-help">Unidades que você tem para vender. As reservas em andamento ficam indisponíveis por 30 minutos.</small></div><div class="form-row"><label>Preço (R$) <span>· opcional</span></label><input data-product-price inputmode="decimal" maxlength="14" value="${escapeHtml(product.price || '')}" placeholder="Deixe vazio para mostrar ‘Verificar’"></div></div><fieldset class="product-options-fieldset"><legend>Opções de tamanho ou preço <span>· opcional</span></legend><label class="product-options-toggle"><input type="checkbox" data-product-use-options${hasOptions ? ' checked' : ''}><span>Este produto tem versões diferentes, como individual e para dois</span></label><div data-product-options${hasOptions ? '' : ' hidden'}><p class="image-help">Quando ativadas, cada opção terá preço e estoque próprios. Você pode cadastrar somente uma ou até duas.</p><div class="product-options-list" data-product-options-list>${options.map((option, optionIndex) => productOptionEditorMarkup(option, optionIndex)).join('')}</div><button type="button" class="button button-outline button-small" data-add-product-option>+ Adicionar opção</button></div></fieldset><div class="form-row"><label>Foto do produto <span>· opcional</span></label><input data-product-image type="file" accept="image/jpeg,image/png,image/webp"><small class="image-help">JPG, PNG ou WebP · até 4 MB.</small><img class="image-preview product-preview" alt="Prévia do produto ${index + 1}"${photo ? ` src="${escapeHtml(photo)}"` : ''}${photo ? '' : ' hidden'}></div></article>`;
    }

    function syncProductOptionMode(row, createFirstOption = false) {
      const useOptions = row.querySelector('[data-product-use-options]').checked;
      const baseFields = row.querySelector('[data-product-base-fields]');
      const optionsPanel = row.querySelector('[data-product-options]');
      baseFields.hidden = useOptions;
      baseFields.querySelectorAll('input').forEach((input) => { input.disabled = useOptions; input.required = !useOptions && input.hasAttribute('required'); });
      optionsPanel.hidden = !useOptions;
      optionsPanel.querySelectorAll('input').forEach((input) => { input.disabled = !useOptions; });
      const optionsList = row.querySelector('[data-product-options-list]');
      if (useOptions && createFirstOption && !optionsList.querySelector('[data-product-option-row]')) {
        optionsList.insertAdjacentHTML('beforeend', productOptionEditorMarkup({}, 0));
      }
      const optionRows = optionsList.querySelectorAll('[data-product-option-row]');
      row.querySelector('[data-add-product-option]').hidden = optionRows.length >= 2;
      optionRows.forEach((optionRow, optionIndex) => {
        optionRow.querySelector('[data-remove-product-option]').setAttribute('aria-label', `Remover opção ${optionIndex + 1}`);
      });
    }

    function renderProductEditor(products = [], quickAvailability = false) {
      productEditorList.querySelectorAll('[data-object-url]').forEach((image) => URL.revokeObjectURL(image.dataset.objectUrl));
      productEditorList.innerHTML = products.map((product, index) => productEditorMarkup(product, index, quickAvailability)).join('');
      productEditorList.querySelectorAll('[data-product-row]').forEach((row) => syncProductOptionMode(row));
    }

    function appendProductEditor(product = {}) {
      const index = productEditorList.querySelectorAll('[data-product-row]').length;
      productEditorList.insertAdjacentHTML('beforeend', productEditorMarkup(product, index));
      syncProductOptionMode(productEditorList.lastElementChild);
    }

    function previewSelectedImage(input, preview) {
      const file = input.files?.[0];
      if (!file) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
        input.value = '';
        toast('Escolha uma imagem JPG, PNG ou WebP de até 4 MB.');
        return;
      }
      if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
      preview.dataset.objectUrl = URL.createObjectURL(file);
      preview.src = preview.dataset.objectUrl;
      preview.hidden = false;
    }

    function adminMode() { return getSession()?.role === 'admin'; }

    async function loadListings() {
      const session = getSession();
      if (API_MODE) {
        if (!session?.token) return [];
        const response = await apiRequest(adminMode() ? '/admin/vitrines' : '/empreendedor/vitrines');
        return response.listings || [];
      }
      state = loadState();
      return state.listings.filter((item) => !item.id.startsWith('demo-') && (adminMode() || item.ownerId === session?.id));
    }

    function ownerActions(item) {
      return `<button type="button" class="row-action" data-action="edit" data-id="${escapeHtml(item.id)}">${item.profileOnly ? 'Editar perfil' : 'Editar vitrine'}</button>`;
    }
    function adminActions(item) {
      return `<button type="button" class="row-action" data-action="review" data-id="${escapeHtml(item.id)}">${item.profileOnly ? 'Analisar perfil' : 'Analisar vitrine'}</button>`;
    }

    function openReview(item) {
      currentReviewId = item.id;
      document.getElementById('reviewTitle').textContent = item.title;
      const statusLabels = { pendente: 'Aguardando revisão', aprovada: 'Publicada', pausada: 'Pausada', rejeitada: 'Recusada' };
      const badge = document.getElementById('reviewStatus');
      badge.textContent = statusLabels[item.status] || item.status;
      badge.className = `status-badge status-${item.status}`;
      const submitted = item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : '';
      document.getElementById('reviewSubmitted').textContent = submitted ? `Enviada em ${submitted}` : '';
      document.getElementById('reviewTitle').textContent = item.profileOnly ? 'Analisar perfil público' : 'Analisar vitrine';
      document.getElementById('reviewOwner').textContent = item.ownerName || '—';
      document.getElementById('reviewUnit').textContent = item.unit || '—';
      document.getElementById('reviewCategory').textContent = item.profileOnly ? 'Perfil e contatos' : item.category || '—';
      document.getElementById('reviewPrice').textContent = item.price || 'Não informado';
      document.querySelector('.review-price').hidden = Boolean(item.profileOnly);
      document.getElementById('reviewDescription').textContent = item.profileOnly ? 'Este cadastro publicará somente o nome, a foto de perfil e os canais de contato do empreendedor.' : item.description || 'Sem descrição.';
      const reviewMedia = document.getElementById('reviewMedia');
      const mediaItems = [
        { label: 'Capa da vitrine', url: publicImageUrl(item.imageUrl) },
        { label: 'Foto do empreendedor', url: publicImageUrl(item.ownerPhotoUrl) },
        ...(Array.isArray(item.products) ? item.products.map((product) => ({ label: `Produto: ${product.name}`, url: publicImageUrl(product.imageUrl) })) : [])
      ].filter((media) => media.url);
      reviewMedia.hidden = mediaItems.length === 0;
      reviewMedia.innerHTML = mediaItems.map((media) => `<figure><img src="${escapeHtml(media.url)}" alt="${escapeHtml(media.label)}" loading="lazy"><figcaption>${escapeHtml(media.label)}</figcaption></figure>`).join('');
      reviewMedia.querySelectorAll('img').forEach((image) => image.addEventListener('error', () => image.closest('figure').remove(), { once: true }));
      const phone = String(item.whatsapp || '').replace(/\D/g, '');
      const whatsapp = document.getElementById('reviewWhatsapp');
      whatsapp.textContent = item.whatsapp || 'Não informado';
      whatsapp.href = phone ? `https://wa.me/${whatsappNumber(phone)}` : '#';
      whatsapp.hidden = !phone;
      const note = document.getElementById('reviewModerationNote');
      note.hidden = !item.moderationReason;
      note.textContent = item.moderationReason ? `Observação da última revisão: ${item.moderationReason}` : '';
      document.getElementById('reviewRejectReason').value = '';
      document.getElementById('reviewFeedback').textContent = '';
      document.getElementById('reviewRejectBox').hidden = true;
      document.getElementById('reviewReject').hidden = item.status !== 'pendente';
      document.getElementById('reviewRejectConfirm').hidden = true;
      document.getElementById('reviewRejectCancel').hidden = true;
      document.getElementById('reviewApprove').hidden = item.status === 'aprovada';
      document.getElementById('reviewApprove').textContent = item.status === 'pausada' ? 'Reativar publicação' : 'Aprovar e publicar';
      document.getElementById('reviewPause').hidden = item.status !== 'aprovada';
      reviewDialog.showModal();
    }

    async function render() {
      const session = getSession();
      const isAdmin = adminMode();
      const firstName = session?.name?.split(' ')[0] || 'vizinho';
      document.getElementById('dashboardEyebrow').textContent = isAdmin ? 'administração da comunidade' : 'área do empreendedor';
      document.getElementById('dashboardTitle').textContent = isAdmin ? 'A vizinhança, bem cuidada.' : session ? `Olá, ${firstName}!` : 'Entre para acessar sua área.';
      document.getElementById('dashboardSubtitle').textContent = isAdmin
        ? 'Revise os cadastros e mantenha o catálogo da comunidade atualizado.'
        : session ? 'Acompanhe sua vitrine e mantenha as informações sempre atualizadas.' : 'Entre na sua conta ou cadastre seu negócio para gerenciar sua vitrine.';
      document.getElementById('userChip').textContent = isAdmin ? 'Administração' : session?.name || 'Visitante';
      document.getElementById('listingsHeading').textContent = isAdmin
        ? (filter === 'pendente' ? 'Fila de aprovação' : 'Vitrines da comunidade')
        : 'Suas vitrines';
      const createButton = document.getElementById('newListingButton');
      createButton.hidden = Boolean(session && isAdmin);
      createButton.textContent = session ? '+ Nova vitrine' : 'Entrar / criar conta';
      document.getElementById('adminDemo').hidden = API_MODE || isAdmin;
      document.getElementById('demoAdminButton').hidden = API_MODE;
      document.getElementById('adminFilters').hidden = !isAdmin;
      document.getElementById('statGrid').hidden = API_MODE && !session;
      const canManageProfile = Boolean(session && !isAdmin);
      profileContactsSection.hidden = !canManageProfile;
      contactLeadsPanel.hidden = !canManageProfile || !API_MODE;
      if (canManageProfile && !profileContactsForm.contains(document.activeElement)) {
        document.getElementById('profileWhatsapp').value = session.whatsapp || '';
        document.getElementById('profileInstagram').value = session.instagramUrl || '';
        document.getElementById('profileWebsite').value = session.websiteUrl || '';
        document.getElementById('profileLinkedin').value = session.linkedinUrl || '';
      }

      let loadError = false;
      try {
        records = await loadListings();
      } catch (error) {
        loadError = true;
        records = [];
        list.innerHTML = `<p class="owner-note">${escapeHtml(error.message)}</p>`;
      }
      const visible = records.filter((item) => !isAdmin || filter === 'todos' || item.status === filter);
      const pendingCount = records.filter((item) => item.status === 'pendente').length;
      const activeCount = records.filter((item) => item.status === 'aprovada').length;
      document.getElementById('statListings').textContent = records.length;
      document.getElementById('statPending').textContent = pendingCount;
      document.getElementById('statActive').textContent = activeCount;
      document.getElementById('adminEmpty').hidden = Boolean(!session || records.length || (isAdmin && filter !== 'todos'));
      if (!session && API_MODE) {
        document.getElementById('adminEmpty').hidden = true;
        list.innerHTML = '<p class="owner-note">Para entrar, <a href="cadastro.html?modo=login"><strong>acesse sua conta</strong></a> ou <a href="cadastro.html"><strong>crie um cadastro</strong></a>.</p>';
        return;
      }
      if (!loadError) {
        list.innerHTML = visible.map((item) => `<article class="admin-row"><div class="admin-store"><span class="admin-store-icon">${escapeHtml(item.emoji || categoryEmoji(item.category))}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.ownerName)} · ${escapeHtml(item.unit)}</small></span></div><span class="admin-category">${escapeHtml(item.category)}</span><span class="status-badge status-${escapeHtml(item.status)}">${({ pendente: 'Aguardando revisão', aprovada: 'Publicada', pausada: 'Pausada', rejeitada: 'Recusada' }[item.status] || item.status)}</span><div class="row-actions">${isAdmin ? adminActions(item) : ownerActions(item)}</div>${!isAdmin && item.status === 'pendente' ? '<p class="owner-note">Sua vitrine ficará visível no catálogo após a revisão da administração da comunidade.</p>' : ''}${!isAdmin && item.status === 'rejeitada' && item.moderationReason ? `<p class="owner-note">Orientação da administração: ${escapeHtml(item.moderationReason)}</p>` : ''}</article>`).join('');
      }
      const empty = document.getElementById('adminEmpty');
      empty.hidden = loadError || visible.length !== 0;
      document.getElementById('adminEmptyTitle').textContent = isAdmin
        ? (filter === 'pendente' ? 'Fila limpa' : 'Nenhuma vitrine nesta lista')
        : 'Ainda não há vitrines';
      document.getElementById('adminEmptyCopy').textContent = isAdmin
        ? (filter === 'pendente' ? 'Não há vitrines aguardando revisão. Novos cadastros aparecerão aqui.' : 'Altere o filtro para consultar outros status.')
        : 'Crie sua primeira vitrine e apresente seu negócio aos vizinhos.';
      document.getElementById('emptyCreateButton').hidden = isAdmin;
      list.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => handleAction(button.dataset.action, button.dataset.id)));
      await refreshContactRecords();
    }

    profileContactsForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const feedback = document.getElementById('profileContactsFeedback');
      const button = document.getElementById('saveProfileContacts');
      feedback.textContent = '';
      const values = {
        whatsapp: document.getElementById('profileWhatsapp').value.trim(),
        instagram: document.getElementById('profileInstagram').value.trim(),
        website: document.getElementById('profileWebsite').value.trim(),
        linkedin: document.getElementById('profileLinkedin').value.trim()
      };
      button.disabled = true;
      try {
        let profile;
        const session = getSession();
        if (API_MODE) {
          const result = await apiRequest('/empreendedor/perfil', { method: 'PUT', body: JSON.stringify(values) });
          profile = result.user;
        } else {
          state = loadState();
          const account = state.accounts.find((item) => item.id === session.id);
          if (!account) throw new Error('Perfil local não encontrado. Entre novamente.');
          account.whatsapp = values.whatsapp;
          account.instagramUrl = values.instagram;
          account.websiteUrl = values.website;
          account.linkedinUrl = values.linkedin;
          for (const listing of state.listings.filter((item) => item.ownerId === session.id)) {
            listing.contacts = { whatsapp: values.whatsapp, instagram: values.instagram, website: values.website, linkedin: values.linkedin };
            listing.whatsapp = values.whatsapp;
          }
          save();
          profile = { whatsapp: account.whatsapp, instagramUrl: account.instagramUrl, websiteUrl: account.websiteUrl, linkedinUrl: account.linkedinUrl };
        }
        setSession({ ...session, whatsapp: profile.whatsapp || '', instagramUrl: profile.instagramUrl || '', websiteUrl: profile.websiteUrl || '', linkedinUrl: profile.linkedinUrl || '' });
        feedback.classList.add('is-success');
        feedback.textContent = 'Seus canais foram atualizados e aparecerão no perfil público.';
        await render();
        toast('Contatos do perfil atualizados.');
      } catch (error) {
        feedback.classList.remove('is-success');
        feedback.textContent = error.message || 'Não foi possível salvar seus contatos.';
      } finally { button.disabled = false; }
    });

    contactLeadsList.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-contact-action]');
      if (!button || !API_MODE) return;
      const action = button.dataset.contactAction === 'sale' ? 'venda' : 'encerrar';
      button.disabled = true;
      try {
        const result = await apiRequest(`/empreendedor/contatos/${encodeURIComponent(button.dataset.id)}/${action}`, { method: 'POST' });
        await render();
        toast(result.message || (action === 'venda' ? 'Venda registrada e estoque atualizado.' : 'Contato encerrado.'));
      } catch (error) {
        toast(error.message || 'Não foi possível atualizar este contato.');
        await refreshContactRecords();
      } finally { button.disabled = false; }
    });
    document.getElementById('refreshContactsButton').addEventListener('click', refreshContactRecords);

    async function handleAction(action, id) {
      const item = records.find((row) => row.id === id);
      if (!item) return;
      if (action === 'edit') { openForm(item); return; }
      if (action === 'review') openReview(item);
    }

    async function setModerationStatus(id, status, reason = '') {
      const actionBar = document.querySelector('.review-actions');
      actionBar.setAttribute('aria-busy', 'true');
      actionBar.querySelectorAll('button').forEach((button) => { button.disabled = true; });
      try {
        if (API_MODE) {
          await apiRequest(`/admin/vitrines/${encodeURIComponent(id)}/status`, {
            method: 'PATCH', body: JSON.stringify({ status: status.toUpperCase(), reason })
          });
        } else {
          const item = records.find((row) => row.id === id);
          if (!item) throw new Error('Esta vitrine não está mais disponível. Atualize o painel.');
          item.status = status;
          item.moderationReason = reason;
          item.moderatedAt = new Date().toISOString();
          item.updatedAt = new Date().toISOString();
          save();
        }
        reviewDialog.close();
        currentReviewId = null;
        await render();
        toast(({ aprovada: 'Vitrine aprovada e publicada.', rejeitada: 'Recusa registrada com a justificativa.', pausada: 'Vitrine pausada.' })[status] || 'Status atualizado.');
      } catch (error) {
        document.getElementById('reviewFeedback').textContent = error.message;
      } finally {
        actionBar.removeAttribute('aria-busy');
        actionBar.querySelectorAll('button').forEach((button) => { button.disabled = false; });
      }
    }

    function updateListingMode() {
      const profileOnly = profileOnlyToggle.checked;
      const descriptionInput = document.getElementById('listingDescription');
      if (!profileOnly && descriptionInput.value === 'Perfil público do empreendedor.') {
        descriptionInput.value = '';
        document.getElementById('descriptionCount').textContent = '0';
      }
      listingDetailsFields.hidden = profileOnly;
      profileOnlyHint.hidden = !profileOnly;
      listingDetailsFields.querySelectorAll('input, select, textarea, button').forEach((control) => { control.disabled = profileOnly; });
      document.getElementById('listingTitle').required = !profileOnly;
      document.getElementById('listingCategory').required = !profileOnly;
      document.getElementById('listingDescription').required = !profileOnly;
      document.querySelector('#listingForm button[type="submit"]').textContent = profileOnly ? 'Salvar perfil' : 'Salvar vitrine';
    }

    profileOnlyToggle.addEventListener('change', updateListingMode);

    function openForm(item = null) {
      const session = getSession();
      if (!session) { location.href = 'cadastro.html?modo=login'; return; }
      if (session.role === 'admin') { toast('A administração não cria vitrines em nome de empreendedores.'); return; }
      if (listingImagePreview.dataset.objectUrl) URL.revokeObjectURL(listingImagePreview.dataset.objectUrl);
      delete listingImagePreview.dataset.objectUrl;
      form.reset();
      document.getElementById('listingId').value = item?.id || '';
      profileOnlyToggle.checked = Boolean(item?.profileOnly);
      document.getElementById('listingDialogTitle').textContent = item ? 'Editar vitrine' : 'Nova vitrine';
      document.getElementById('listingTitle').value = item?.title || session.name || '';
      document.getElementById('listingCategory').value = item?.category || '';
      document.getElementById('listingDescription').value = item?.description || '';
      document.getElementById('listingPrice').value = item?.price || '';
      document.getElementById('descriptionCount').textContent = String((item?.description || '').length);
      document.getElementById('listingFeedback').textContent = '';
      const imageUrl = publicImageUrl(item?.imageUrl);
      listingImagePreview.hidden = !imageUrl;
      if (imageUrl) listingImagePreview.src = imageUrl; else listingImagePreview.removeAttribute('src');
      renderProductEditor(item?.products || [], Boolean(API_MODE && item?.status === 'aprovada'));
      const acceptedPayments = Array.isArray(item?.paymentMethods) && item.paymentMethods.length ? item.paymentMethods : PAYMENT_METHODS;
      document.querySelectorAll('#listingPaymentMethods input').forEach((input) => { input.checked = acceptedPayments.includes(input.value); });
      document.getElementById('menuImportFeedback').textContent = '';
      updateListingMode();
      dialog.showModal();
    }

    document.getElementById('newListingButton').addEventListener('click', () => {
      if (!getSession()) { location.href = 'cadastro.html?modo=login'; return; }
      openForm();
    });
    document.getElementById('emptyCreateButton').addEventListener('click', () => openForm());
    document.getElementById('demoAdminButton').addEventListener('click', () => {
      if (API_MODE) { toast('O acesso administrativo é validado pela API.'); return; }
      if (!confirm('Abrir o modo de administração de demonstração? Este modo usa dados locais e não valida permissões no servidor.')) return;
      setSession({ id: 'demo-admin', name: 'Administração Flex Osasco 2', role: 'admin' });
      render();
      toast('Painel de demonstração aberto.');
    });
    document.getElementById('logoutButton').addEventListener('click', () => { setSession(null); location.href = 'index.html'; });
    document.querySelectorAll('[data-status]').forEach((button) => button.addEventListener('click', () => {
      filter = button.dataset.status;
      document.querySelectorAll('[data-status]').forEach((chip) => chip.classList.toggle('is-active', chip === button));
      render();
    }));
    document.getElementById('closeDialog').addEventListener('click', () => dialog.close());
    document.getElementById('cancelDialog').addEventListener('click', () => dialog.close());
    document.getElementById('reviewClose').addEventListener('click', () => reviewDialog.close());
    document.getElementById('reviewBack').addEventListener('click', () => reviewDialog.close());
    document.getElementById('reviewReject').addEventListener('click', () => {
      document.getElementById('reviewRejectBox').hidden = false;
      document.getElementById('reviewReject').hidden = true;
      document.getElementById('reviewApprove').hidden = true;
      document.getElementById('reviewPause').hidden = true;
      document.getElementById('reviewRejectConfirm').hidden = false;
      document.getElementById('reviewRejectCancel').hidden = false;
      document.getElementById('reviewFeedback').textContent = '';
      document.getElementById('reviewRejectReason').focus();
    });
    document.getElementById('reviewRejectCancel').addEventListener('click', () => {
      const item = records.find((row) => row.id === currentReviewId);
      document.getElementById('reviewRejectBox').hidden = true;
      document.getElementById('reviewRejectReason').value = '';
      document.getElementById('reviewFeedback').textContent = '';
      document.getElementById('reviewRejectConfirm').hidden = true;
      document.getElementById('reviewRejectCancel').hidden = true;
      document.getElementById('reviewReject').hidden = item?.status !== 'pendente';
      document.getElementById('reviewApprove').hidden = item?.status === 'aprovada';
      document.getElementById('reviewPause').hidden = item?.status !== 'aprovada';
    });
    document.getElementById('reviewRejectConfirm').addEventListener('click', () => {
      const reason = document.getElementById('reviewRejectReason').value.trim();
      if (reason.length < 8) {
        document.getElementById('reviewFeedback').textContent = 'Escreva um motivo com pelo menos 8 caracteres.';
        document.getElementById('reviewRejectReason').focus();
        return;
      }
      if (currentReviewId) setModerationStatus(currentReviewId, 'rejeitada', reason);
    });
    document.getElementById('reviewApprove').addEventListener('click', () => {
      if (currentReviewId) setModerationStatus(currentReviewId, 'aprovada');
    });
    document.getElementById('reviewPause').addEventListener('click', () => {
      if (currentReviewId) setModerationStatus(currentReviewId, 'pausada');
    });
    reviewDialog.addEventListener('close', () => {
      currentReviewId = null;
      document.getElementById('reviewRejectReason').value = '';
      document.getElementById('reviewRejectBox').hidden = true;
      document.getElementById('reviewFeedback').textContent = '';
    });
    listingImageInput.addEventListener('change', () => previewSelectedImage(listingImageInput, listingImagePreview));
    productEditorList.addEventListener('change', (event) => {
      const availabilityInput = event.target.closest('[data-product-available]');
      if (availabilityInput) {
        const action = availabilityInput.closest('[data-product-row]').querySelector('[data-save-product-availability]');
        if (action) action.textContent = 'Aplicar agora sem nova revisão';
        return;
      }
      const optionToggle = event.target.closest('[data-product-use-options]');
      if (optionToggle) {
        syncProductOptionMode(optionToggle.closest('[data-product-row]'), optionToggle.checked);
        return;
      }
      const input = event.target.closest('[data-product-image]');
      if (input) previewSelectedImage(input, input.closest('[data-product-row]').querySelector('.image-preview'));
    });
    productEditorList.addEventListener('click', async (event) => {
      const availabilityButton = event.target.closest('[data-save-product-availability]');
      if (availabilityButton) {
        const row = availabilityButton.closest('[data-product-row]');
        const checkbox = row.querySelector('[data-product-available]');
        const previous = row.dataset.savedAvailability === 'true';
        availabilityButton.disabled = true;
        try {
          const productId = row.querySelector('[data-product-id]').value;
          const result = await apiRequest(`/empreendedor/produtos/${encodeURIComponent(productId)}/disponibilidade`, {
            method: 'PATCH', body: JSON.stringify({ available: checkbox.checked })
          });
          const savedValue = result.product?.availableForSale ?? checkbox.checked;
          row.dataset.savedAvailability = String(savedValue);
          checkbox.checked = savedValue;
          const listingId = document.getElementById('listingId').value;
          const currentListing = records.find((item) => item.id === listingId);
          const currentProduct = currentListing?.products?.find((item) => item.id === productId);
          if (currentProduct) currentProduct.availableForSale = savedValue;
          availabilityButton.textContent = savedValue ? 'Disponível atualizado' : 'Indisponível atualizado';
          toast(savedValue ? 'Produto disponível para pedidos.' : 'Produto mantido no catálogo como indisponível.');
        } catch (error) {
          checkbox.checked = previous;
          availabilityButton.textContent = 'Aplicar agora sem nova revisão';
          toast(error.message || 'Não foi possível atualizar a disponibilidade.');
        } finally { availabilityButton.disabled = false; }
        return;
      }
      const addOptionButton = event.target.closest('[data-add-product-option]');
      if (addOptionButton) {
        const row = addOptionButton.closest('[data-product-row]');
        const optionsList = row.querySelector('[data-product-options-list]');
        if (optionsList.querySelectorAll('[data-product-option-row]').length >= 2) {
          toast('Cada produto pode ter até duas opções de venda.');
          return;
        }
        optionsList.insertAdjacentHTML('beforeend', productOptionEditorMarkup({}, optionsList.children.length));
        syncProductOptionMode(row);
        optionsList.lastElementChild.querySelector('[data-product-option-name]').focus();
        return;
      }
      const removeOptionButton = event.target.closest('[data-remove-product-option]');
      if (removeOptionButton) {
        const row = removeOptionButton.closest('[data-product-row]');
        const optionsList = row.querySelector('[data-product-options-list]');
        if (optionsList.querySelectorAll('[data-product-option-row]').length <= 1) {
          toast('Mantenha pelo menos uma opção ou desative o modo de opções.');
          return;
        }
        removeOptionButton.closest('[data-product-option-row]').remove();
        syncProductOptionMode(row);
        return;
      }
      const removeButton = event.target.closest('[data-remove-product]');
      if (!removeButton) return;
      const row = removeButton.closest('[data-product-row]');
      const preview = row.querySelector('[data-object-url]');
      if (preview) URL.revokeObjectURL(preview.dataset.objectUrl);
      row.remove();
      productEditorList.querySelectorAll('[data-product-row]').forEach((productRow, index) => {
        productRow.querySelector('.product-editor-heading strong').textContent = `Produto ${index + 1}`;
        productRow.querySelector('.image-preview').alt = `Prévia do produto ${index + 1}`;
      });
    });
    document.getElementById('menuImportButton').addEventListener('click', async () => {
      const button = document.getElementById('menuImportButton');
      const feedback = document.getElementById('menuImportFeedback');
      const menuText = document.getElementById('menuImportText').value.trim();
      const menuFile = document.getElementById('menuImportFile').files?.[0];
      feedback.classList.remove('is-success');
      if (!API_MODE) { feedback.textContent = 'A importação precisa do servidor conectado.'; return; }
      if (!menuText && !menuFile) { feedback.textContent = 'Cole o texto ou escolha um PDF/foto do cardápio.'; return; }
      if (menuFile && menuFile.size > 8 * 1024 * 1024) { feedback.textContent = 'O arquivo deve ter até 8 MB.'; return; }
      button.disabled = true;
      feedback.textContent = 'Lendo seu cardápio… pode levar até 1 minuto.';
      try {
        const body = new FormData();
        if (menuText) body.append('text', menuText);
        if (menuFile) body.append('menuFile', menuFile);
        const result = await apiRequest('/empreendedor/importar-cardapio', { method: 'POST', body });
        const current = productEditorList.querySelectorAll('[data-product-row]').length;
        const room = Math.max(0, MAX_PRODUCTS - current);
        const imported = (result.products || []).slice(0, room);
        if (!imported.length) { feedback.textContent = `Você já tem ${MAX_PRODUCTS} produtos; remova alguns para importar mais.`; return; }
        imported.forEach((product) => appendProductEditor({
          name: product.name, description: product.description, price: product.price ? Number(product.price).toFixed(2).replace('.', ',') : '',
          stock: 10, availableForSale: true,
          options: (product.options || []).map((option) => ({ name: option.name, price: option.price ? Number(option.price).toFixed(2).replace('.', ',') : '', stock: 10 }))
        }));
        const skipped = (result.products || []).length - imported.length;
        feedback.classList.add('is-success');
        feedback.textContent = `${imported.length} produto(s) preenchido(s) com estoque 10. Revise nomes, preços e quantidades antes de salvar.${skipped > 0 ? ` ${skipped} ficaram de fora pelo limite de ${MAX_PRODUCTS}.` : ''}`;
        productEditorList.querySelectorAll('[data-product-row]')[current]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (error) {
        feedback.textContent = error.message || 'Não foi possível ler o cardápio.';
      } finally { button.disabled = false; }
    });
    document.getElementById('addProductButton').addEventListener('click', () => {
      if (productEditorList.querySelectorAll('[data-product-row]').length >= MAX_PRODUCTS) {
        toast(`Você pode incluir até ${MAX_PRODUCTS} produtos em cada vitrine.`);
        return;
      }
      appendProductEditor();
      productEditorList.lastElementChild.querySelector('[data-product-name]').focus();
    });
    document.getElementById('listingDescription').addEventListener('input', (event) => { document.getElementById('descriptionCount').textContent = event.target.value.length; });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const activeSession = getSession();
      const feedback = document.getElementById('listingFeedback');
      feedback.textContent = '';
      if (!activeSession || activeSession.role !== 'empreendedor') {
        feedback.textContent = 'Entre em uma conta de empreendedor para salvar sua vitrine.';
        return;
      }
      const id = document.getElementById('listingId').value;
      const existing = records.find((row) => row.id === id);
      const profileOnly = profileOnlyToggle.checked;
      const payload = {
        title: document.getElementById('listingTitle').value.trim() || activeSession.name,
        category: document.getElementById('listingCategory').value || 'Outros serviços',
        description: document.getElementById('listingDescription').value.trim() || (profileOnly ? 'Perfil público do empreendedor.' : ''),
        price: profileOnly ? '' : document.getElementById('listingPrice').value.trim(),
        whatsapp: '', profileOnly
      };
      const paymentMethods = Array.from(document.querySelectorAll('#listingPaymentMethods input:checked')).map((input) => input.value);
      if (!profileOnly && !paymentMethods.length) { feedback.textContent = 'Marque pelo menos uma forma de pagamento aceita.'; return; }
      payload.paymentMethods = paymentMethods.length ? paymentMethods : PAYMENT_METHODS;
      const productRows = Array.from(productEditorList.querySelectorAll('[data-product-row]'));
      const products = profileOnly ? [] : productRows.map((row) => {
        const useOptions = row.querySelector('[data-product-use-options]').checked;
        const normalizePrice = (input) => {
          const raw = input.value.trim();
          return raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
        };
        const options = useOptions ? Array.from(row.querySelectorAll('[data-product-option-row]')).map((optionRow) => ({
          id: optionRow.querySelector('[data-product-option-id]').value.trim(),
          name: optionRow.querySelector('[data-product-option-name]').value.trim(),
          price: normalizePrice(optionRow.querySelector('[data-product-option-price]')),
          stock: Number(optionRow.querySelector('[data-product-option-stock]').value)
        })) : [];
        return {
          id: row.querySelector('[data-product-id]').value.trim(),
          name: row.querySelector('[data-product-name]').value.trim(),
          description: row.querySelector('[data-product-description]').value.trim(),
          price: useOptions ? '' : normalizePrice(row.querySelector('[data-product-price]')),
          stock: useOptions ? 0 : Number(row.querySelector('[data-product-stock]').value),
          availableForSale: row.querySelector('[data-product-available]').checked,
          options
        };
      });
      const hasImages = !profileOnly && Boolean(listingImageInput.files?.length || productRows.some((row) => row.querySelector('[data-product-image]').files?.length));
      try {
        if (API_MODE) {
          const multipart = new FormData();
          Object.entries(payload).forEach(([key, value]) => multipart.append(key, Array.isArray(value) ? JSON.stringify(value) : value));
          multipart.append('products', JSON.stringify(products));
          if (!profileOnly && listingImageInput.files?.[0]) multipart.append('listingImage', listingImageInput.files[0]);
          if (!profileOnly) productRows.forEach((row, index) => {
            const image = row.querySelector('[data-product-image]').files?.[0];
            if (image) multipart.append(`productImage_${index}`, image);
          });
          await apiRequest(id ? `/empreendedor/vitrines/${encodeURIComponent(id)}` : '/empreendedor/vitrines', {
            method: id ? 'PUT' : 'POST', body: multipart
          });
        } else {
          if (hasImages) throw new Error('O envio de fotos precisa do backend PostgreSQL ativo.');
          const account = state.accounts.find((row) => row.id === activeSession.id);
          const listing = {
            id: id || crypto.randomUUID(), ownerId: activeSession.id,
            ownerName: account?.name || activeSession.name, unit: account?.unit || activeSession.unit || '',
            ...payload, price: payload.price || 'Consulte valores',
            profileOnly,
            emoji: categoryEmoji(payload.category), cover: categoryCover(payload.category),
            imageUrl: existing?.imageUrl || '', ownerPhotoUrl: account?.photoUrl || '',
            whatsapp: account?.whatsapp || '',
            contacts: { whatsapp: account?.whatsapp || '', instagram: account?.instagramUrl || '', website: account?.websiteUrl || '', linkedin: account?.linkedinUrl || '' },
            products: products.map((product) => ({ ...product, id: product.id || crypto.randomUUID(), imageUrl: existing?.products?.find((row) => row.id === product.id)?.imageUrl || '' })),
            status: existing?.status === 'aprovada' ? 'pendente' : (existing?.status || 'pendente'),
            createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()
          };
          if (existing) Object.assign(existing, listing); else state.listings.push(listing);
          save();
        }
        dialog.close();
        await render();
        toast(existing
          ? (profileOnly ? 'Perfil atualizado e enviado para revisão.' : 'Alterações salvas; a vitrine foi enviada para revisão.')
          : (profileOnly ? 'Perfil enviado para revisão.' : 'Vitrine criada e enviada para revisão.'));
      } catch (error) { feedback.textContent = error.message; }
    });

    window.addEventListener('storage', render);
    render();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initCatalog();
    initAuth();
    initAdmin();
  });
})();
