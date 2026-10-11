# Rede Vizinha — cadastro, catálogo e backend Node/PostgreSQL

## O que está implementado

- `frontend/src/pages/index.html`: catálogo público, pesquisa, categorias, perfil/contatos e catálogo de itens aberto sob demanda, além do acesso ao mural.
- `frontend/src/pages/mural.html`: mural público, busca por palavras-chave, pedidos de indicação, menções e respostas.
- `frontend/src/pages/cadastro.html`: cadastro e login do empreendedor.
- `frontend/src/pages/painel.html`: criação/edição de vitrines pelo empreendedor e moderação por administrador.
- `frontend/src/pages/config.js`: URL da API. Por padrão aponta para `http://127.0.0.1:8080/api`; use `''` para voltar ao modo de demonstração local.
- `backend/server.js`: API Express com PostgreSQL, senha bcrypt, JWT, CORS restrito, limitação de tentativas de autenticação e regras de acesso por papel/condomínio.
- `backend/database.js`: pool de conexão PostgreSQL.
- `backend/migrate.js`: aplica automaticamente as migrações versionadas pendentes, da `V001` à `V010`, cada uma dentro de transação.
- `database/migrations/V006__profile_only.sql`: adiciona a opção de publicação apenas de perfil.
- `database/migrations/V002__empreendedor_catalogo.sql`: usuários, empreendedores, vitrines, produtos e status de moderação.
- `database/migrations/V004__catalog_images.sql`: acrescenta a foto do empreendedor e a capa da vitrine.
- `database/migrations/V005__marketplace_contacts_reservations.sql`: contatos sociais, estoque de produtos e registros de reservas e contatos.
- `database/migrations/V008__indication_board.sql`: pedidos públicos de indicação e respostas da comunidade.
- `database/migrations/V010__indication_reply_mentions.sql`: menções relacionais de empreendedores vinculadas às respostas.
- `database/migrations/V009__product_options_availability.sql`: disponibilidade manual do produto, até duas opções com preço/estoque próprios e reserva vinculada à opção escolhida.
- `database/fixtures/V002__empreendedor_catalogo.sqlite`: fixture SQLite original preservado; não é carregado pelo migrador PostgreSQL.

## Requisitos

- Node.js 20 ou superior e npm.
- PostgreSQL 15 ou superior.
- Um banco vazio chamado `rede_vizinha` (crie pelo pgAdmin ou com `CREATE DATABASE rede_vizinha;`).

A pasta `backend` contém também o `pom.xml` inicial do esqueleto Spring. Para este fluxo Node, use os comandos npm abaixo; o serviço Node não depende do Maven/Java.

## Instalar e configurar no Windows

No PowerShell, na raiz `rede-vizinha-vscode`, execute:

```powershell
cd backend
Copy-Item .env.example .env
notepad .env
npm.cmd install
npm.cmd run db:migrate
npm.cmd run dev
```

Edite o `.env` antes de migrar. Exemplo de conexão local — troque usuário e senha pelos do seu PostgreSQL:

```dotenv
DATABASE_URL=postgres://postgres:SUA_SENHA@localhost:5432/rede_vizinha
DB_SSL=false
PORT=8080
CORS_ORIGINS=http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:8765,http://localhost:8765
CONDOMINIO_CODIGO=FLEX-OSASCO-2
FRONTEND_URL=http://127.0.0.1:8765/cadastro.html
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=Rede Vizinha <no-reply@example.com>
PASSWORD_RESET_DEV_LINKS=true
JWT_SECRET=CHAVE_ALEATORIA_COM_PELO_MENOS_32_CARACTERES
ADMIN_BOOTSTRAP_TOKEN=OUTRO_SEGREDO_ALEATORIO_COM_PELO_MENOS_32_CARACTERES
```

Gere chaves diferentes para JWT e para o provisionamento do primeiro administrador:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Não publique nem envie o `.env`; ele já está coberto pelo `.gitignore`. Se a senha do banco contiver caracteres especiais de URL, codifique-os ao compor `DATABASE_URL`. Em produção, use TLS (`DB_SSL=true` com certificados confiáveis), segredos de um cofre e um proxy HTTPS; mantenha CORS restrito às origens reais.

`npm.cmd run db:migrate` registra as versões em `rede_vizinha_schema_migration`, adquire um advisory lock e aplica as migrações pendentes, incluindo `V003` até `V010`, em transações. É seguro executá-lo novamente após a primeira aplicação.

## Recuperação de senha

O link **Esqueci minha senha** solicita um token aleatório com validade de 30 minutos. O banco armazena somente o hash do token; ele é invalidado após o uso ou quando uma nova solicitação é feita. A migração `V003__password_reset.sql` cria a tabela `password_reset_token`; aplique-a com `npm.cmd run db:migrate`.

Em desenvolvimento, com `PASSWORD_RESET_DEV_LINKS=true` e `NODE_ENV` diferente de `production`, o link aparece no terminal da API quando o SMTP não está configurado ou falha. Para enviar e-mails, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` e `EMAIL_FROM`. `FRONTEND_URL` deve apontar para `cadastro.html`; em produção use HTTPS, SMTP real e `PASSWORD_RESET_DEV_LINKS=false`. Não compartilhe credenciais SMTP nem o `.env`.

## Criar o primeiro administrador

Com a API em execução, use o token `ADMIN_BOOTSTRAP_TOKEN` do `.env` **uma única vez**. Exemplo no PowerShell (substitua e-mail e senha):

```powershell
$envLines = Get-Content .env
$bootstrapToken = (($envLines | Where-Object { $_ -like 'ADMIN_BOOTSTRAP_TOKEN=*' }) -split '=', 2)[1]
$body = @{
  name = 'Admin Flex Osasco 2'
  email = 'admin@example.com'
  password = 'SUBSTITUA_POR_UMA_SENHA_FORTE'
} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:8080/api/admin/bootstrap' `
  -Method Post -Headers @{ 'X-Bootstrap-Token' = $bootstrapToken } `
  -ContentType 'application/json' -Body $body
```

O endpoint permite criar apenas o primeiro administrador daquele condomínio; guarde a resposta com discrição e não compartilhe o token. Depois, o administrador entra pela tela normal de login (`cadastro.html?modo=login`). Os empreendedores se cadastram na mesma tela.

## Iniciar e conectar o frontend

Em outro terminal, na raiz do projeto:

```powershell
cd frontend/src/pages
node serve.js
```

Abra `http://127.0.0.1:5500/index.html`. O arquivo `config.js` aponta para a API Node. No cadastro, a foto de perfil é opcional. Na página pública, os cartões mostram o perfil, a categoria e os contatos; os produtos só são carregados quando a pessoa abre **Ver catálogo**. No painel, cada vitrine aceita até oito produtos, disponibilidade manual e até duas opções de venda por produto (por exemplo, individual e para dois), cada uma com preço e estoque próprios. As imagens ficam na ficha de aprovação e, depois de aprovada, aparecem no catálogo. A edição de uma vitrine publicada a envia novamente para revisão.

Para confirmar a conexão, consulte `http://127.0.0.1:8080/api/health`, que deve retornar `{"status":"ok","database":"connected"}`.

## Fluxo de aprovação no painel

1. O empreendedor cadastra ou edita sua vitrine; a API registra o status `PENDENTE` e ela não aparece no catálogo público.
2. O administrador entra pela página de login com sua conta `ADMIN` e abre `painel.html`. A aba **Pendentes** aparece selecionada por padrão.
3. Em cada cadastro, o administrador escolhe **Analisar vitrine** para conferir nome, empreendedor, unidade, categoria, descrição, preço, WhatsApp e data de envio.
4. A ficha mostra também a capa, a foto do empreendedor e as imagens dos produtos, quando disponíveis. **Aprovar e publicar** muda o status para `APROVADA`; a vitrine passa a aparecer no catálogo. **Recusar** abre um campo obrigatório para registrar uma orientação com pelo menos 8 caracteres; o motivo fica guardado e aparece no painel do empreendedor para ele corrigir e reenviar.
5. Vitrines publicadas podem ser pausadas e reativadas. Os filtros **Todas**, **Pendentes**, **Publicadas**, **Pausadas** e **Recusadas** ajudam a consultar a fila e o histórico.

A decisão é enviada a `PATCH /api/admin/vitrines/:id/status`. O servidor exige papel administrativo e valida a justificativa de recusa; a autorização não depende apenas de ocultar botões no navegador. Status, moderador, horário e motivo são gravados na tabela `vitrine`.

## Rotas principais

| Método | Rota | Acesso | Ação |
|---|---|---|---|
| `GET` | `/api/health` | Público | Verifica API e banco |
| `POST` | `/api/auth/register` | Público | Cria conta e perfil público pendente; aceita foto `profilePhoto` em multipart (JPG/PNG/WebP, até 4 MB) |
| `POST` | `/api/auth/login` | Público | Autentica e devolve JWT |
| `POST` | `/api/auth/customer/register` | Público | Cria conta opcional de cliente e salva dados de entrega |
| `POST` | `/api/auth/customer/login` | Público | Autentica cliente e retorna seus dados de entrega salvos |
| `GET` | `/api/me` | JWT | Consulta a conta autenticada |
| `GET` | `/api/vitrines` | Público | Lista apenas vitrines aprovadas do condomínio |
| `GET` | `/api/vitrines/:id/catalogo` | Público | Carrega os produtos e opções da vitrine aprovada aberta pelo visitante |
| `GET` | `/api/indicacoes?q=&category=` | Público | Pesquisa pedidos, respostas e empreendedores mencionados |
| `POST` | `/api/indicacoes` | Público; limite de tentativas | Publica pedido de indicação sem menções a empreendedores |
| `POST` | `/api/indicacoes/:id/respostas` | Público; limite de tentativas | Publica resposta/recomendação e até 5 menções a empreendedores aprovados |
| `POST` | `/api/vitrines/:id/contatos` | Público; JWT de CLIENTE opcional | Registra contato; com itens, valida dados de entrega/pagamento e reserva estoque por 30 minutos |
| `GET` | `/api/empreendedor/vitrines` | Empreendedor | Lista apenas vitrines próprias |
| `POST` | `/api/empreendedor/vitrines` | Empreendedor | Cria perfil simples ou vitrine pendente com capa e até 8 produtos em multipart |
| `PUT` | `/api/empreendedor/vitrines/:id` | Dono da vitrine | Atualiza perfil simples ou dados, imagens e produtos; volta à revisão |
| `PATCH` | `/api/empreendedor/produtos/:id/disponibilidade` | Dono; vitrine aprovada | Marca um produto publicado como disponível/indisponível sem reabrir a revisão |
| `GET` | `/api/admin/vitrines` | Administrador | Lista vitrines da comunidade |
| `PATCH` | `/api/admin/vitrines/:id/status` | Administrador | Publica, rejeita (com justificativa) ou pausa |
| `POST` | `/api/admin/bootstrap` | Token secreto de provisionamento | Cria o primeiro administrador |

## Modelo e segurança

`usuario` guarda e-mail, hash de senha (`bcrypt`) e papel; `empreendedor` guarda unidade, contato e `foto_url`; `cliente` guarda telefone e endereço de entrega para a conta opcional; `contato_comercial` guarda o espelho do pedido enviado. `vitrine` guarda capa (`imagem_url`) e auditoria; `produto` guarda os itens, imagens e o status manual de disponibilidade; `produto_opcao` guarda até duas apresentações por item, cada uma com preço e estoque próprios. As migrations `V007__customer_checkout.sql` e `V009__product_options_availability.sql` habilitam checkout, disponibilidade e opções. As imagens são salvas em `backend/uploads/`, servidas por `/uploads/` e ignoradas pelo Git. O limite é 4 MB por arquivo; formatos aceitos: JPG/JPEG, PNG e WebP, com verificação da assinatura do arquivo. Em produção, configure armazenamento persistente (volume durável ou serviço de objetos) e backup; o disco local não deve ser efêmero. O banco impede e-mails duplicados dentro do condomínio e limita valores de status. Consultas usam parâmetros SQL, e a API valida o papel e o vínculo ao condomínio no servidor.

O modo de demonstração local pode ser ativado em `config.js` sem URL da API. Nesse modo os dados ficam no navegador, não há envio persistente de imagens e o acesso administrativo **não é seguro nem adequado para uso real**. O catálogo operacional (`index.html`) é público e lista vitrines aprovadas sem login. Com a API configurada, cadastro, login, catálogo, capas, produtos, vitrines, moderação e checkout usam o backend e o PostgreSQL.


## Perfil público, contatos e pedidos indiretos

O cadastro do empreendedor cria automaticamente um perfil público pendente, sem exigir unidade nem WhatsApp. WhatsApp, Instagram, site e LinkedIn são opcionais e podem ser atualizados na seção **Como clientes falam com você**. No editor, a opção **Quero publicar somente meu perfil e contatos** oculta informações comerciais e produtos: o cartão público apresenta foto/nome e apenas os canais preenchidos. Quem preferir pode criar ou editar uma vitrine completa, inclusive sem produtos.

O catálogo (`index.html`) pode ser consultado sem login. O botão de perfil abre o canal publicado sem exigir conta. Para pedidos de produtos, o cliente informa nome, WhatsApp, endereço de entrega e forma de pagamento pretendida; pode prosseguir como visitante, criar uma conta para salvar endereço ou entrar numa conta de cliente existente. A plataforma não cobra nem processa pagamento: a forma escolhida é apenas incluída como preferência na mensagem. No WhatsApp, tanto o botão do perfil quanto o pedido começam com: **“Olá, te encontrei no Rede vizinha, gostaria de mais informações”**. Preço vazio aparece como **Verificar**. Ao confirmar o pedido, a API registra os dados de entrega, itens e contato, reserva as unidades por 30 minutos e devolve um espelho com valores calculados a partir do banco. A disponibilidade pública desconta reservas ainda válidas; ao expirar, elas voltam a ficar disponíveis automaticamente.

Na seção **Contatos e pedidos** do painel, cada contato mostra canal, data, itens e, em pedidos, os dados de entrega e forma de pagamento pretendida. O empreendedor usa **Marcar venda realizada** após concretizar um pedido de produtos; essa ação baixa as quantidades do estoque uma vez. Para serviços ou contatos sem produtos, use **Encerrar contato**. Uma reserva expirada não pode ser baixada; o contato continua no histórico como expirado. O registro representa o pedido iniciado na Rede Vizinha, não confirma por si só uma conversa ou venda — a confirmação de venda é manual pelo empreendedor.

A migração `V005__marketplace_contacts_reservations.sql` configura contatos sociais, estoque e reservas; `V006__profile_only.sql` permite perfis sem itens; `V007__customer_checkout.sql` habilita contas opcionais de clientes e dados de entrega. Aplique as migrations pendentes com `npm.cmd run db:migrate`; o migrador não deve ser substituído por SQL copiado manualmente. Os endpoints principais são `POST /api/auth/customer/register`, `POST /api/auth/customer/login`, `PUT /api/empreendedor/perfil`, `POST /api/vitrines/:id/contatos`, `GET /api/empreendedor/contatos`, `POST /api/empreendedor/contatos/:id/venda` e `POST /api/empreendedor/contatos/:id/encerrar`.

O modo demonstração local serve para visualizar o perfil e os contatos, mas não oferece reserva transacional nem baixa confiável de estoque. Para pedidos, estoque e reservas reais, rode a API Node conectada ao PostgreSQL e deixe `frontend/src/pages/config.js` apontando para a API.

## Mural público de indicações

`frontend/src/pages/mural.html` é acessível sem login e reúne as ações **Buscar indicações** e **Pedir indicação**. A busca inclui título, detalhes, categoria, autor, respostas e empreendedores mencionados; também pode filtrar por categoria. Moradores podem responder publicamente com uma recomendação e, nesse fluxo de resposta, mencionar até cinco empreendedores cadastrados com vitrine aprovada. Pedidos de indicação não têm campo de menção. O nome informado fica visível e a torre/unidade é opcional. Antes de publicar, a tela mostra uma confirmação com o conteúdo que ficará público.

Na resposta, a menção é escolhida em uma lista de empreendedores com vitrine aprovada no catálogo público; texto livre não cria menções e o servidor valida novamente cada identificador no mesmo condomínio. As menções aparecem junto da resposta que recomendou o profissional, mas não enviam notificação direta. As rotas públicas têm limite de tentativas e validam o tamanho/categoria dos campos. O mural grava os pedidos, respostas e menções em PostgreSQL; não usa `localStorage` nem publica dados de demonstração. A antiga `mural_indicação.html` redireciona para a nova página.

Antes de usar o mural, entre na pasta `backend` e execute `npm.cmd run db:migrate` para aplicar as tabelas das migrations `V008__indication_board.sql` e `V010__indication_reply_mentions.sql`; em seguida, mantenha a API Node ativa. A página estática é servida junto do catálogo em `http://127.0.0.1:5500/mural.html`.


## Catálogo público sob demanda e opções de produto

Os cartões públicos mostram o perfil do empreendedor, sua categoria e seus canais de contato. Itens e imagens de produto não são listados nessa grade: quando existir catálogo, a pessoa abre **Ver catálogo** e o navegador então consulta `GET /api/vitrines/:id/catalogo`. Isso mantém a descoberta leve e separa claramente o perfil da lista de itens.

No painel, o empreendedor pode marcar cada produto como **Disponível para pedidos**. Ao desmarcar, o item continua aparecendo no catálogo em estado esmaecido com indicação de indisponibilidade; a API também recusa pedidos diretos para esse produto. Opcionalmente, pode ativar até duas opções, como **Individual** e **Para dois**, informando para cada uma seu preço e estoque. O preço pode ficar vazio (exibido como **Verificar**), e o estoque reservado/baixado é específico à opção selecionada. O resumo enviado ao WhatsApp e o histórico no painel identificam o nome da opção.

Aplique a migration aditiva `V009__product_options_availability.sql` antes de reiniciar a API com a versão atualizada: `cd backend; npm.cmd run db:migrate`. Em seguida, reinicie o Node e recarregue a página pública para ativar o novo contrato entre frontend e backend.


Para uma vitrine já aprovada, o editor apresenta **Aplicar agora sem nova revisão** ao lado da disponibilidade de cada produto existente. Esse botão chama `PATCH /api/empreendedor/produtos/:id/disponibilidade` e altera somente o indicador do produto; editar nome, descrição, preço, foto, opções ou outros dados continua seguindo o fluxo normal de nova revisão.
