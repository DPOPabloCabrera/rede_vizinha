# Rede Vizinha — Flex Osasco 2

Catálogo comunitário de empreendedores e serviços locais.

## Fluxo executável Node.js + PostgreSQL

O backend Node está em `backend/` e o frontend estático em `frontend/src/pages/`. O Spring Boot (`backend/pom.xml`) permanece como esqueleto de arquitetura, mas não é necessário para executar o fluxo Node.

Consulte [`docs/architecture/empreendedor-catalogo.md`](docs/architecture/empreendedor-catalogo.md) para instalar dependências, configurar o PostgreSQL, aplicar migrações, criar o administrador inicial, executar a API e abrir o frontend.

Resumo dos comandos (Windows/PowerShell):

```powershell
cd backend
Copy-Item .env.example .env
# Configure DATABASE_URL, JWT_SECRET e ADMIN_BOOTSTRAP_TOKEN no .env
npm.cmd install
npm.cmd run db:migrate
npm.cmd run dev
```

Em outro terminal:

```powershell
cd frontend/src/pages
node serve.js
```

Frontend: `http://127.0.0.1:5500/index.html` · API/health: `http://127.0.0.1:8080/api/health`.
