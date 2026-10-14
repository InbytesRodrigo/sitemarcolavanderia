// Camada de persistência das configurações (preços, promoção, cupom e FAQs).
//
// Em produção usa o Netlify DB (Postgres gerenciado pelo próprio Netlify),
// acessado pela NETLIFY_DB_URL. Fora do Netlify (dev local) usa arquivos JSON
// em backend/data/, mantendo o comportamento original.

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, 'data')
const FILE_BY_KEY = {
  settings: path.join(DATA_DIR, 'settings.json'),
  faqs: path.join(DATA_DIR, 'faqs.json')
}

// Rodando dentro do runtime do Netlify (Function)?
const ON_NETLIFY = Boolean(
  process.env.NETLIFY ||
    process.env.NETLIFY_DB_URL ||
    process.env.SITE_ID ||
    process.env.NETLIFY_FUNCTIONS_TOKEN
)

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function storageUnavailable(cause) {
  if (cause) console.error('[storage] falha na gravacao:', cause)
  const err = new Error(
    'Este ambiente nao tem armazenamento persistente configurado, entao a alteracao nao foi salva.'
  )
  err.code = 'STORAGE_UNAVAILABLE'
  return err
}

// ---------------------------------------------------------------------------
// Postgres (Netlify DB)
// ---------------------------------------------------------------------------

let poolPromise = null

function connectionString() {
  try {
    // getConnectionString escolhe a conexao certa para o ambiente atual
    // (producao, deploy preview, branch deploy).
    const { getConnectionString } = require('@netlify/database')
    return getConnectionString()
  } catch {
    return process.env.NETLIFY_DB_URL || process.env.DATABASE_URL || null
  }
}

let schemaReadyPromise = null

// Garante que a tabela exista (idempotente). A migração em
// netlify/database/migrations também a cria; isto cobre o caso de a migração
// ainda não ter sido aplicada no ambiente.
function ready(db) {
  if (schemaReadyPromise === null) {
    schemaReadyPromise = db
      .query(
        `CREATE TABLE IF NOT EXISTS kv (
           key TEXT PRIMARY KEY,
           value JSONB NOT NULL,
           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         )`
      )
      .catch((err) => {
        schemaReadyPromise = null
        throw err
      })
  }
  return schemaReadyPromise
}

// O pool é reaproveitado entre invocações da mesma instância da Function.
function pool() {
  if (poolPromise === null) {
    poolPromise = Promise.resolve()
      .then(() => {
        const url = connectionString()
        if (!url) return null
        const { Pool } = require('pg')
        const local = /localhost|127\.0\.0\.1/.test(url)
        return new Pool({
          connectionString: url,
          max: 1,
          idleTimeoutMillis: 10000,
          ssl: local ? false : { rejectUnauthorized: false }
        })
      })
      .catch((err) => {
        console.error('[storage] pool indisponivel:', err && err.message)
        return null
      })
  }
  return poolPromise
}

// ---------------------------------------------------------------------------
// Arquivos (dev local)
// ---------------------------------------------------------------------------

function readFile(key, fallback) {
  const file = FILE_BY_KEY[key]
  try {
    if (!fs.existsSync(file)) return clone(fallback)
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return clone(fallback)
  }
}

function writeFile(key, data) {
  const file = FILE_BY_KEY[key]
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

async function read(key, fallback) {
  const db = await pool()
  if (db) {
    try {
      await ready(db)
      const { rows } = await db.query('SELECT value FROM kv WHERE key = $1', [key])
      if (rows.length) return rows[0].value
      return clone(fallback)
    } catch (err) {
      console.error('[storage] leitura falhou:', err && err.message)
    }
  }
  return readFile(key, fallback)
}

async function write(key, data) {
  const db = await pool()
  if (db) {
    try {
      await ready(db)
      await db.query(
        `INSERT INTO kv (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, JSON.stringify(data)]
      )
      return 'db'
    } catch (err) {
      // Nunca cair para o filesystem no Netlify: seria perder a alteração.
      throw storageUnavailable(err)
    }
  }

  if (ON_NETLIFY) throw storageUnavailable()

  writeFile(key, data)
  return 'file'
}

// Garante um valor inicial. Só materializa em arquivo (dev local); no Netlify
// os defaults vêm do próprio código e a migração cria a tabela.
async function ensure(key, fallback) {
  const db = await pool()
  if (db) return 'db'
  if (ON_NETLIFY) return 'none'
  const file = FILE_BY_KEY[key]
  if (!fs.existsSync(file)) writeFile(key, fallback)
  return 'file'
}

module.exports = { read, write, ensure }
