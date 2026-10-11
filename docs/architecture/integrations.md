# Integrações da Rede Vizinha

Frontend PWA
  ↓ HTTPS / REST JSON
Backend Spring Boot 3
  ↓ JPA / Hibernate
PostgreSQL 15+

Integrações e responsabilidades:
- WhatsApp: Deep Link `wa.me` para contato sem expor o telefone na interface.
- Autenticação: JWT + Spring Security.
- Banco: PostgreSQL como fonte persistente.
- Multi-tenant: `condominio_id` isola os dados de cada condomínio.
- LGPD: minimização, anonimização de unidade exibida, controle de acesso e rotinas de exclusão/anonimização.

Evolução prevista:
- Painel administrativo para validação via código de convite.
- Storage de imagens separado da API.
- Observabilidade e auditoria.
