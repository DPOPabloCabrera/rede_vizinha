require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/rede_vizinha',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: 'rede-vizinha-node-api'
});

pool.on('error', (error) => {
  console.error('Erro inesperado em uma conexão ociosa do PostgreSQL:', error.message);
});

module.exports = { pool };
