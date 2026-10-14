const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const TOKEN_KEY = 'lava24_token'

const $ = (sel) => document.querySelector(sel)
const token = () => localStorage.getItem(TOKEN_KEY) || ''

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  if (token()) headers.Authorization = `Bearer ${token()}`
  const res = await fetch(path, { ...opts, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Erro')
  return data
}

function dayChecks(boxId, selected = []) {
  const box = document.getElementById(boxId)
  box.innerHTML = ''
  DAYS.forEach((label, i) => {
    const el = document.createElement('label')
    el.innerHTML = `<input type="checkbox" value="${i}" ${selected.includes(i) ? 'checked' : ''}/> ${label}`
    box.appendChild(el)
  })
}

function windowRow(w = { start: '08:00', end: '18:00' }) {
  const row = document.createElement('div')
  row.className = 'window-row'
  row.innerHTML = `
    <input type="time" value="${w.start || '08:00'}" />
    <input type="time" value="${w.end || '18:00'}" />
    <button type="button" class="ghost">x</button>
  `
  row.querySelector('button').addEventListener('click', () => row.remove())
  return row
}

function faqRow(f = { q: '', a: '', keywords: [] }) {
  const row = document.createElement('div')
  row.className = 'faq-row'
  row.dataset.id = f.id || ''
  row.innerHTML = `
    <input placeholder="Pergunta" value="${(f.q || '').replace(/"/g, '&quot;')}" />
    <textarea rows="2" placeholder="Resposta">${f.a || ''}</textarea>
    <input placeholder="palavras-chave, separadas por vírgula" value="${(f.keywords || []).join(', ')}" />
    <button type="button" class="ghost">remover</button>
  `
  row.querySelector('button').addEventListener('click', () => row.remove())
  return row
}

function fill(settings, faqs) {
  const form = document.getElementById('settings-form')
  form.featuredWash.value = settings.featured.wash
  form.featuredDry.value = settings.featured.dry
  form.washLabel.value = settings.featured.washLabel || 'Lavagem'
  form.dryLabel.value = settings.featured.dryLabel || 'Secagem'
  form.promoEnabled.checked = !!settings.promo.enabled
  form.promoWash.value = settings.promo.wash
  form.promoDry.value = settings.promo.dry
  form.promoBadge.value = settings.promo.badge || 'PROMOÇÃO'
  form.brandName.value = settings.brand.name || ''
  form.whatsapp.value = settings.brand.whatsapp || ''
  form.whatsappMessage.value = settings.brand.whatsappMessage || ''
  form.tagline.value = settings.brand.tagline || ''
  form.address.value = settings.brand.address || ''
  const coupon = settings.coupon || {}
  form.couponEnabled.checked = !!coupon.enabled
  form.couponName.value = coupon.name || 'Cupom especial'
  form.couponCode.value = coupon.code || 'ESPECIAL12'
  form.couponWash.value = coupon.wash ?? 12.5
  form.couponDry.value = coupon.dry ?? 12.5
  dayChecks('days', settings.promo.days || [])
  dayChecks('coupon-days', coupon.days || [])
  const windows = document.getElementById('windows')
  windows.innerHTML = ''
  ;(settings.promo.windows || []).forEach((w) => windows.appendChild(windowRow(w)))
  const couponWindows = document.getElementById('coupon-windows')
  couponWindows.innerHTML = ''
  ;(coupon.windows || []).forEach((w) => couponWindows.appendChild(windowRow(w)))
  const list = document.getElementById('faq-list')
  list.innerHTML = ''
  faqs.forEach((f) => list.appendChild(faqRow(f)))
}

async function bootDash() {
  const data = await api('/api/admin/settings')
  document.getElementById('login-card').classList.add('hidden')
  document.getElementById('dash').classList.remove('hidden')
  fill(data.settings, data.faqs)
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const err = document.getElementById('login-err')
  err.classList.add('hidden')
  const fd = new FormData(e.target)
  try {
    const data = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: fd.get('username'),
        password: fd.get('password')
      })
    })
    localStorage.setItem(TOKEN_KEY, data.token)
    await bootDash()
  } catch (ex) {
    err.textContent = ex.message
    err.classList.remove('hidden')
  }
})

document.getElementById('logout').addEventListener('click', () => {
  localStorage.removeItem(TOKEN_KEY)
  location.reload()
})

document.getElementById('add-window').addEventListener('click', () => {
  document.getElementById('windows').appendChild(windowRow())
})

document.getElementById('add-coupon-window').addEventListener('click', () => {
  document.getElementById('coupon-windows').appendChild(windowRow())
})

document.getElementById('add-faq').addEventListener('click', () => {
  document.getElementById('faq-list').appendChild(faqRow())
})

document.getElementById('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const form = e.target
  const days = [...document.querySelectorAll('#days input:checked')].map((i) => Number(i.value))
  const windows = [...document.querySelectorAll('#windows .window-row')].map((row) => {
    const [start, end] = row.querySelectorAll('input')
    return { start: start.value, end: end.value }
  })
  const couponDays = [...document.querySelectorAll('#coupon-days input:checked')].map((i) => Number(i.value))
  const couponWindows = [...document.querySelectorAll('#coupon-windows .window-row')].map((row) => {
    const [start, end] = row.querySelectorAll('input')
    return { start: start.value, end: end.value }
  })
  await api('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify({
      brand: {
        name: form.brandName.value,
        tagline: form.tagline.value,
        whatsapp: form.whatsapp.value,
        whatsappMessage: form.whatsappMessage.value,
        address: form.address.value
      },
      featured: {
        wash: Number(form.featuredWash.value),
        dry: Number(form.featuredDry.value),
        washLabel: form.washLabel.value,
        dryLabel: form.dryLabel.value
      },
      promo: {
        enabled: form.promoEnabled.checked,
        wash: Number(form.promoWash.value),
        dry: Number(form.promoDry.value),
        badge: form.promoBadge.value,
        days,
        windows
      },
      coupon: {
        enabled: form.couponEnabled.checked,
        name: form.couponName.value,
        code: form.couponCode.value,
        wash: Number(form.couponWash.value),
        dry: Number(form.couponDry.value),
        days: couponDays,
        windows: couponWindows
      }
    })
  })
  const ok = document.getElementById('save-ok')
  ok.classList.remove('hidden')
  setTimeout(() => ok.classList.add('hidden'), 2500)
})

document.getElementById('save-faqs').addEventListener('click', async () => {
  const faqs = [...document.querySelectorAll('#faq-list .faq-row')].map((row) => {
    const [q, a, k] = row.querySelectorAll('input, textarea')
    return {
      id: row.dataset.id,
      q: q.value,
      a: a.value,
      keywords: String(k.value)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
  })
  await api('/api/admin/faqs', { method: 'PUT', body: JSON.stringify({ faqs }) })
  const ok = document.getElementById('faq-ok')
  ok.classList.remove('hidden')
  setTimeout(() => ok.classList.add('hidden'), 2500)
})

if (token()) {
  bootDash().catch(() => localStorage.removeItem(TOKEN_KEY))
}
