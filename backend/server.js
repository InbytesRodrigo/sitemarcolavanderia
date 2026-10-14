const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { read, write, ensure } = require('./storage')

const app = express()
const PORT = Number(process.env.PORT) || 3001

// Credenciais e segredo vêm do ambiente. Em produção (Netlify) defina
// ADMIN_PASSWORD e JWT_SECRET nas variáveis do site.
const JWT_SECRET = process.env.JWT_SECRET || 'lava24-dev-secret-nao-use-em-producao'
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'marco2026'

const DEFAULT_SETTINGS = {
  brand: {
    name: 'LAVE AGORA',
    tagline: 'Lavanderia Self Service 24 horas',
    city: 'Unidade Fátima · Canoas',
    address: 'Av. Guilherme Schell, 2504 — Bairro Fátima / Rio Branco, Canoas',
    whatsapp: '555184066339',
    whatsappMessage: 'Quero saber sobre a lavanderia.'
  },
  featured: {
    wash: 14.9,
    dry: 14.9,
    washLabel: 'Lavagem',
    dryLabel: 'Secagem'
  },
  promo: {
    enabled: true,
    wash: 12.9,
    dry: 12.9,
    days: [1],
    windows: [{ start: '08:00', end: '18:00' }],
    badge: 'PROMOÇÃO'
  },
  coupon: {
    enabled: false,
    code: 'ESPECIAL12',
    name: 'Cupom especial',
    wash: 12.5,
    dry: 12.5,
    days: [1],
    windows: [{ start: '08:00', end: '18:00' }]
  }
}

const DEFAULT_FAQS = [
  {
    id: '1',
    q: 'Qual o horário de funcionamento?',
    a: 'Funcionamos 24 horas por dia, 7 dias por semana. Pode chegar a qualquer hora!',
    keywords: ['horario', 'hora', 'aberto', 'funciona', 'abre', 'fecha', '24', 'sempre']
  },
  {
    id: '2',
    q: 'Quanto custa lavar e secar?',
    a: 'O destaque é lavagem + secagem. Os valores aparecem no topo do site e mudam automaticamente nos dias e horários promocionais.',
    keywords: ['preco', 'preço', 'valor', 'custa', 'quanto', 'barato', 'promo', 'cupom']
  },
  {
    id: '3',
    q: 'Como funciona a lavanderia?',
    a: 'É self-service 24h. Você chega, coloca as roupas na máquina, paga, lava, seca e leva embora. Simples e rápido.',
    keywords: ['como', 'funciona', 'usar', 'passo', 'fazer', 'self']
  },
  {
    id: '4',
    q: 'Preciso levar sabão?',
    a: 'Não precisa. Temos sabão e amaciante à venda no local. Se preferir, pode trazer o seu.',
    keywords: ['sabao', 'sabão', 'amaciante', 'produto', 'detergente', 'levar']
  },
  {
    id: '5',
    q: 'Quais formas de pagamento?',
    a: 'Aceitamos Pix, cartão e dinheiro. Rápido na hora de pagar.',
    keywords: ['pagamento', 'pagar', 'pix', 'cartao', 'cartão', 'dinheiro', 'debito', 'credito']
  },
  {
    id: '6',
    q: 'É seguro de madrugada?',
    a: 'O espaço é monitorado e iluminado 24h. Você lava com tranquilidade a qualquer hora.',
    keywords: ['seguro', 'seguranca', 'segurança', 'camera', 'madrugada', 'noite']
  },
  {
    id: '7',
    q: 'Quanto tempo demora?',
    a: 'Lavagem em cerca de 30 a 40 minutos. Secagem em 30 a 45 minutos, conforme o tecido.',
    keywords: ['tempo', 'demora', 'minutos', 'rapido', 'rápido', 'ciclo']
  },
  {
    id: '8',
    q: 'Posso lavar edredom e cobertor?',
    a: 'Sim. Temos máquinas de maior capacidade para peças volumosas como edredom, cobertor e toalhas grandes.',
    keywords: ['edredom', 'cobertor', 'toalha', 'grande', 'capacidade', 'volumoso']
  },
  {
    id: '9',
    q: 'Onde fica a lavanderia?',
    a: 'LAVE AGORA Unidade Fátima, em Canoas. Av. Guilherme Schell, 2504 — Bairro Fátima / Rio Branco.',
    keywords: ['onde', 'endereco', 'endereço', 'fica', 'local', 'canoas', 'fatima', 'fátima', 'schell', 'mapa']
  },
  {
    id: '10',
    q: 'Tem cupom?',
    a: 'Sim. Quando o cupom está ativo, o código aparece bem grande no topo do site. Toque nele para copiar e usar na hora.',
    keywords: ['cupom', 'codigo', 'código', 'especial12', 'desconto']
  }
]

const ADMIN_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 10)

function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (payload.user !== ADMIN_USERNAME) throw new Error('invalid')
    next()
  } catch {
    res.status(401).json({ error: 'Não autorizado' })
  }
}

// O Express 4 não captura erros de handlers async: este wrapper evita
// requisição pendurada quando o storage falha.
const wrap = (fn) => (req, res, ...rest) =>
  Promise.resolve(fn(req, res, ...rest)).catch((err) => {
    console.error('[api]', err)
    if (res.headersSent) return
    if (err && err.code === 'STORAGE_UNAVAILABLE') {
      return res.status(503).json({ error: err.message })
    }
    res.status(500).json({ error: 'Erro interno' })
  })

const TZ = 'America/Sao_Paulo'
const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function brazilNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    day: weekdayMap[map.weekday] ?? 0,
    hour: Number(map.hour),
    minute: Number(map.minute)
  }
}

function parseTime(hhmm) {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function isScheduleNow(rule, date = new Date()) {
  if (!rule || !rule.enabled) return false
  const now = brazilNow(date)
  const days = Array.isArray(rule.days) ? rule.days.map(Number) : []
  if (days.length && !days.includes(now.day)) return false
  const windows = Array.isArray(rule.windows) ? rule.windows : []
  if (!windows.length) return true
  const minutes = now.hour * 60 + now.minute
  return windows.some((w) => {
    const start = parseTime(w.start)
    const end = parseTime(w.end)
    if (end >= start) return minutes >= start && minutes < end
    return minutes >= start || minutes < end
  })
}

function isPromoNow(promo, date = new Date()) {
  return isScheduleNow(promo, date)
}

function sanitizeSchedule(rule, fallback) {
  const base = { ...fallback, ...(rule || {}) }
  base.enabled = !!base.enabled
  base.days = Array.isArray(base.days) ? base.days.map(Number) : []
  base.windows = Array.isArray(base.windows)
    ? base.windows
        .filter((w) => w && w.start && w.end)
        .map((w) => ({ start: String(w.start), end: String(w.end) }))
    : []
  return base
}

async function publicPayload() {
  const settings = await read('settings', DEFAULT_SETTINGS)
  const faqs = await read('faqs', DEFAULT_FAQS)
  const coupon = { ...DEFAULT_SETTINGS.coupon, ...(settings.coupon || {}) }
  const couponActive = isScheduleNow(coupon)
  const promoActive = !couponActive && isPromoNow(settings.promo)
  const wash = couponActive ? Number(coupon.wash) : promoActive ? settings.promo.wash : settings.featured.wash
  const dry = couponActive ? Number(coupon.dry) : promoActive ? settings.promo.dry : settings.featured.dry
  return {
    brand: settings.brand,
    featured: settings.featured,
    promo: {
      enabled: !!settings.promo.enabled,
      wash: settings.promo.wash,
      dry: settings.promo.dry,
      days: settings.promo.days || [],
      windows: settings.promo.windows || [],
      badge: settings.promo.badge || 'PROMOÇÃO'
    },
    coupon: {
      enabled: !!coupon.enabled,
      active: couponActive,
      code: coupon.code || 'ESPECIAL12',
      name: coupon.name || 'Cupom especial',
      wash: Number(coupon.wash),
      dry: Number(coupon.dry),
      days: coupon.days || [],
      windows: coupon.windows || []
    },
    pricing: {
      promoActive,
      couponActive,
      wash,
      dry,
      washLabel: settings.featured.washLabel || 'Lavagem',
      dryLabel: settings.featured.dryLabel || 'Secagem'
    },
    schedule: {
      days: (settings.promo.days || []).map((d) => DAY_NAMES[d] || ''),
      windows: settings.promo.windows || [],
      timezone: TZ
    },
    couponSchedule: {
      days: (coupon.days || []).map((d) => DAY_NAMES[d] || ''),
      windows: coupon.windows || []
    },
    faqs: faqs.map(({ id, q, a }) => ({ id, q, a })),
    now: new Date().toISOString()
  }
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function chatReply(message) {
  const faqs = await read('faqs', DEFAULT_FAQS)
  const settings = await read('settings', DEFAULT_SETTINGS)
  const text = normalize(message)
  if (!text) {
    return {
      reply: 'Oi! Sou a atendente da LAVE AGORA. Pode perguntar preço, horário, endereço, como funciona...',
      matched: null
    }
  }

  const greetings = ['oi', 'ola', 'olá', 'bom dia', 'boa tarde', 'boa noite', 'hey', 'eai', 'e ai']
  if (greetings.some((g) => text === normalize(g) || text.startsWith(normalize(g) + ' '))) {
    return {
      reply: 'Oi, tudo bem? Estou aqui pra tirar suas dúvidas da LAVE AGORA. O que você quer saber?',
      matched: null
    }
  }

  let best = null
  let bestScore = 0
  const tokens = text.split(' ').filter((t) => t.length > 2)

  for (const faq of faqs) {
    const hay = normalize([faq.q, faq.a, ...(faq.keywords || [])].join(' '))
    let score = 0
    for (const t of tokens) {
      if (hay.includes(t)) score += t.length >= 5 ? 2 : 1
    }
    for (const k of faq.keywords || []) {
      if (text.includes(normalize(k))) score += 3
    }
    if (score > bestScore) {
      bestScore = score
      best = faq
    }
  }

  if (best && bestScore >= 2) {
    const coupon = { ...DEFAULT_SETTINGS.coupon, ...(settings.coupon || {}) }
    const couponActive = isScheduleNow(coupon)
    const promoActive = !couponActive && isPromoNow(settings.promo)
    let answer = best.a
    if ((best.keywords || []).some((k) => ['preco', 'preço', 'valor', 'custa', 'cupom'].includes(normalize(k)))) {
      const wash = couponActive ? Number(coupon.wash) : promoActive ? settings.promo.wash : settings.featured.wash
      const dry = couponActive ? Number(coupon.dry) : promoActive ? settings.promo.dry : settings.featured.dry
      const fmt = (n) =>
        Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      if (couponActive) {
        answer += ` Cupom ${coupon.code} ativo agora: ${fmt(wash)} lavagem + ${fmt(dry)} secagem (total ${fmt(wash + dry)}).`
      } else {
        answer += ` Agora: ${fmt(wash)} lavagem + ${fmt(dry)} secagem${promoActive ? ' (promoção ativa!)' : ''}.`
      }
    }
    return { reply: answer, matched: best.id }
  }

  return {
    reply:
      'Não tenho essa resposta certinha ainda. Clica em Falar no WhatsApp que o time responde na hora!',
    matched: null,
    suggestWhatsapp: true
  }
}

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', wrap((_req, res) => res.json({ ok: true })))

app.get('/api/public', wrap(async (_req, res) => {
  res.json(await publicPayload())
}))

app.post('/api/chat', wrap(async (req, res) => {
  const message = String((req.body && req.body.message) || '').slice(0, 500)
  res.json(await chatReply(message))
}))

app.post('/api/admin/login', wrap((req, res) => {
  const { username, password } = req.body || {}
  if (username !== ADMIN_USERNAME || !password || !bcrypt.compareSync(String(password), ADMIN_HASH)) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos' })
  }
  const token = jwt.sign({ user: ADMIN_USERNAME }, JWT_SECRET, { expiresIn: '12h' })
  res.json({ token })
}))

app.get('/api/admin/settings', auth, wrap(async (_req, res) => {
  res.json({
    settings: await read('settings', DEFAULT_SETTINGS),
    faqs: await read('faqs', DEFAULT_FAQS)
  })
}))

app.put('/api/admin/settings', auth, wrap(async (req, res) => {
  const incoming = req.body || {}
  const current = await read('settings', DEFAULT_SETTINGS)
  const next = {
    brand: { ...current.brand, ...(incoming.brand || {}) },
    featured: { ...current.featured, ...(incoming.featured || {}) },
    promo: sanitizeSchedule({ ...current.promo, ...(incoming.promo || {}) }, DEFAULT_SETTINGS.promo),
    coupon: sanitizeSchedule({ ...current.coupon, ...(incoming.coupon || {}) }, DEFAULT_SETTINGS.coupon)
  }
  next.featured.wash = Number(next.featured.wash)
  next.featured.dry = Number(next.featured.dry)
  next.promo.wash = Number(next.promo.wash)
  next.promo.dry = Number(next.promo.dry)
  next.promo.badge = String(next.promo.badge || 'PROMOÇÃO')
  next.coupon.wash = Number(next.coupon.wash)
  next.coupon.dry = Number(next.coupon.dry)
  next.coupon.code = String(next.coupon.code || 'ESPECIAL12')
    .toUpperCase()
    .replace(/\s+/g, '')
    .slice(0, 24)
  next.coupon.name = String(next.coupon.name || 'Cupom especial').slice(0, 60)
  await write('settings', next)
  res.json({ ok: true, settings: next, public: await publicPayload() })
}))

app.put('/api/admin/faqs', auth, wrap(async (req, res) => {
  const faqs = Array.isArray(req.body && req.body.faqs) ? req.body.faqs : []
  const cleaned = faqs
    .filter((f) => f && f.q && f.a)
    .map((f, i) => ({
      id: String(f.id || Date.now() + '-' + i),
      q: String(f.q).slice(0, 200),
      a: String(f.a).slice(0, 800),
      keywords: Array.isArray(f.keywords)
        ? f.keywords.map((k) => String(k).toLowerCase()).filter(Boolean)
        : []
    }))
  await write('faqs', cleaned)
  res.json({ ok: true, faqs: cleaned })
}))

// Materializa os defaults (modo arquivo) e exporta o app para a Function do Netlify.
ensure('settings', DEFAULT_SETTINGS).catch(() => {})
ensure('faqs', DEFAULT_FAQS).catch(() => {})

module.exports = app

// Sobe o servidor apenas quando executado diretamente (dev local).
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lava24 API on ${PORT}`)
  })
}
