// Camada de persistência das configurações.
//
// Em produção (Netlify Functions) usa Netlify Blobs, que é durável.
// Fora do Netlify (dev local, por exemplo `node server.js`) usa arquivos JSON
// em backend/data/, mantendo o comportamento anterior.

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, 'data')
const FILE_BY_KEY = {
  settings: path.join(DATA_DIR, 'settings.json'),
  faqs: path.join(DATA_DIR, 'faqs.json')
}

let storePromise = null

// Retorna o store do Netlify Blobs, ou null quando não estamos no Netlify.
function blobStore() {
  if (storePromise === null) {
    storePromise = Promise.resolve()
      .then(() => {
        const { getStore } = require('@netlify/blobs')
        return getStore('lava24')
      })
      .catch(() => null)
  }
  return storePromise
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

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

async function read(key, fallback) {
  const store = await blobStore()
  if (store) {
    try {
      const value = await store.get(key, { type: 'json' })
      if (value) return value
      return clone(fallback)
    } catch {
      // Cai para o arquivo local (ambiente sem Netlify Blobs configurado).
    }
  }
  return readFile(key, fallback)
}

async function write(key, data) {
  const store = await blobStore()
  if (store) {
    try {
      await store.setJSON(key, data)
      return 'blobs'
    } catch {
      // Cai para o arquivo local.
    }
  }
  writeFile(key, data)
  return 'file'
}

// Garante que exista um valor inicial. Só materializa em arquivo (dev local);
// no Netlify os defaults vêm do próprio código.
async function ensure(key, fallback) {
  const store = await blobStore()
  if (store) return 'blobs'
  const file = FILE_BY_KEY[key]
  if (!fs.existsSync(file)) writeFile(key, fallback)
  return 'file'
}

module.exports = { read, write, ensure }
