require('dotenv').config();
const fs = require('node:fs/promises');
const path = require('node:path');
const { pool } = require('./database');

const migrationsDir = path.resolve(__dirname, '..', 'database', 'migrations');

async function migrate() {
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query('SELECT pg_advisory_lock($1)', [734221906]);
    locked = true;
    await client.query(`
      CREATE TABLE IF NOT EXISTS rede_vizinha_schema_migration (
        version VARCHAR(100) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const files = (await fs.readdir(migrationsDir))
      .filter((file) => /^V\d+__.*\.sql$/i.test(file))
      .sort((a, b) => Number(a.match(/^V(\d+)/i)[1]) - Number(b.match(/^V(\d+)/i)[1]));

    for (const file of files) {
      const version = file.match(/^(V\d+)/i)[1].toUpperCase();
      const { rowCount } = await client.query(
        'SELECT 1 FROM rede_vizinha_schema_migration WHERE version = $1',
        [version]
      );
      if (rowCount) {
        console.log(`${version}: já aplicada`);
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      console.log(`${version}: aplicando ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO rede_vizinha_schema_migration (version) VALUES ($1)', [version]);
        await client.query('COMMIT');
        console.log(`${version}: concluída`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Falha em ${file}: ${error.message}`, { cause: error });
      }
    }
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock($1)', [734221906]).catch(() => {});
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
