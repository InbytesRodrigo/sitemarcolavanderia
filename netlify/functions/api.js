// Function do Netlify que expõe a API Express em /api/* (ver netlify.toml).
const serverless = require('serverless-http')
const app = require('../../backend/server')

const handler = serverless(app)

// Dependendo do redirect, o Netlify pode entregar o caminho interno
// (/.netlify/functions/api/...) em vez de /api/.... Normalizamos para que as
// rotas do Express sempre casem.
const INTERNAL_PREFIXES = ['/.netlify/functions/api', '/.netlify/functions']

function normalizePath(value) {
  if (!value) return value
  for (const prefix of INTERNAL_PREFIXES) {
    if (value === prefix || value.startsWith(prefix + '/')) {
      return '/api' + value.slice(prefix.length)
    }
  }
  return value
}

exports.handler = async (event, context) => {
  const normalized = normalizePath(event.path)
  const normalizedRaw = normalizePath(event.rawPath)
  const patched =
    normalized === event.path && normalizedRaw === event.rawPath
      ? event
      : { ...event, path: normalized, rawPath: normalizedRaw }
  return handler(patched, context)
}
