const money = (n) =>
  Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const waLink = (phone, text) =>
  `https://wa.me/${String(phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(text || '')}`

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

let state = null

function setWa(phone, message) {
  const href = waLink(phone, message)
  ;['wa-top', 'wa-hero', 'wa-fab', 'wa-foot'].forEach((id) => {
    const el = document.getElementById(id)
    if (el) el.href = href
  })
}

function renderPrices(data) {
  const { pricing, featured, promo, schedule, coupon, couponSchedule } = data
  document.getElementById('wash-price').textContent = money(pricing.wash)
  document.getElementById('dry-price').textContent = money(pricing.dry)
  document.getElementById('wash-label').textContent = pricing.washLabel
  document.getElementById('dry-label').textContent = pricing.dryLabel
  const combo = Number(pricing.wash) + Number(pricing.dry)
  document.getElementById('combo-price').textContent = money(combo)
  const comboWas = document.getElementById('combo-was')

  const ribbon = document.getElementById('promo-ribbon')
  const note = document.getElementById('promo-note')
  const washWas = document.getElementById('wash-was')
  const dryWas = document.getElementById('dry-was')
  const washTag = document.getElementById('wash-tag')
  const dryTag = document.getElementById('dry-tag')
  const couponCard = document.getElementById('coupon-card')

  ribbon.classList.remove('hidden')
  const showOld = pricing.promoActive || pricing.couponActive
  if (pricing.couponActive) {
    ribbon.textContent = 'CUPOM'
    washTag.textContent = coupon.code
    dryTag.textContent = coupon.code
  } else if (pricing.promoActive) {
    ribbon.textContent = promo.badge || 'PROMOÇÃO ATIVA'
    washTag.textContent = promo.badge || 'Promo'
    dryTag.textContent = promo.badge || 'Promo'
  } else {
    ribbon.textContent = 'DESTAQUE'
    washTag.textContent = 'Agora'
    dryTag.textContent = 'Agora'
  }

  if (showOld) {
    washWas.classList.remove('hidden')
    dryWas.classList.remove('hidden')
    washWas.textContent = `de R$ ${money(featured.wash)}`
    dryWas.textContent = `de R$ ${money(featured.dry)}`
    comboWas.classList.remove('hidden')
    comboWas.textContent = `de R$ ${money(Number(featured.wash) + Number(featured.dry))}`
  } else {
    washWas.classList.add('hidden')
    dryWas.classList.add('hidden')
    comboWas.classList.add('hidden')
  }

  if (coupon && coupon.active) {
    couponCard.classList.remove('hidden')
    document.getElementById('coupon-name').textContent = coupon.name || 'Cupom especial'
    document.getElementById('coupon-code').textContent = coupon.code
    document.getElementById('coupon-deal').textContent =
      `R$ ${money(coupon.wash)} lavar + R$ ${money(coupon.dry)} secar = R$ ${money(Number(coupon.wash) + Number(coupon.dry))}`
  } else {
    couponCard.classList.add('hidden')
  }

  const bits = []
  if (pricing.couponActive) {
    bits.push(`Cupom ${coupon.code} valendo agora.`)
  } else if (coupon && coupon.enabled && couponSchedule && couponSchedule.days.length) {
    const hours = (couponSchedule.windows || []).map((w) => `${w.start}–${w.end}`).join(' e ')
    bits.push(`Cupom ${coupon.code} em ${couponSchedule.days.join(', ')}${hours ? ` das ${hours}` : ''}.`)
  }
  if (promo.enabled && schedule.days.length) {
    const hours = (schedule.windows || []).map((w) => `${w.start}–${w.end}`).join(' e ')
    const when = hours ? ` das ${hours}` : ' o dia inteiro'
    bits.push(
      pricing.promoActive
        ? `Promo rolando agora: ${schedule.days.join(', ')}${when}.`
        : `Promo automática em ${schedule.days.join(', ')}${when}.`
    )
  }
  note.textContent = bits.join(' ')
}

function addMsg(box, text, who) {
  const div = document.createElement('div')
  div.className = `msg ${who}`
  div.textContent = text
  box.appendChild(div)
  box.scrollTop = box.scrollHeight
}

function greet(box) {
  if (box.dataset.ready) return
  box.dataset.ready = '1'
  addMsg(box, 'Oi! Sou a atendente da LAVE AGORA. Pode perguntar preço, horário, endereço...', 'bot')
}

async function ask(message, boxes) {
  boxes.forEach((b) => addMsg(b, message, 'me'))
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    })
    const data = await res.json()
    boxes.forEach((b) => addMsg(b, data.reply, 'bot'))
    if (data.suggestWhatsapp && state) {
      const href = waLink(state.brand.whatsapp, state.brand.whatsappMessage)
      boxes.forEach((b) => {
        const a = document.createElement('a')
        a.className = 'msg bot'
        a.href = href
        a.target = '_blank'
        a.rel = 'noopener'
        a.textContent = 'Abrir WhatsApp'
        a.style.textDecoration = 'underline'
        b.appendChild(a)
      })
    }
  } catch {
    boxes.forEach((b) => addMsg(b, 'Tive um soluço aqui. Tenta de novo ou fala no WhatsApp.', 'bot'))
  }
}

function bindChat() {
  const miniMsgs = document.getElementById('mini-msgs')
  const sheetMsgs = document.getElementById('sheet-msgs')
  greet(miniMsgs)

  const sendFrom = (form, input) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const text = input.value.trim()
      if (!text) return
      input.value = ''
      ask(text, [miniMsgs, sheetMsgs])
    })
  }
  sendFrom(document.getElementById('mini-form'), document.getElementById('mini-input'))
  sendFrom(document.getElementById('sheet-form'), document.getElementById('sheet-input'))

  const sheet = document.getElementById('chat-sheet')
  const open = () => {
    sheet.classList.remove('hidden')
    greet(sheetMsgs)
    document.getElementById('sheet-input').focus()
  }
  const close = () => sheet.classList.add('hidden')
  document.getElementById('open-chat').addEventListener('click', open)
  document.getElementById('fab-chat').addEventListener('click', open)
  document.getElementById('close-chat').addEventListener('click', close)
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) close()
  })
}

function renderPills(faqs) {
  const wrap = document.getElementById('faq-pills')
  wrap.innerHTML = ''
  faqs.slice(0, 6).forEach((f) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = f.q
    b.addEventListener('click', () => {
      const mini = document.getElementById('mini-msgs')
      const sheet = document.getElementById('sheet-msgs')
      greet(mini)
      ask(f.q, [mini, sheet])
    })
    wrap.appendChild(b)
  })
}

async function load() {
  const res = await fetch('/api/public')
  state = await res.json()
  setWa(state.brand.whatsapp, state.brand.whatsappMessage)
  renderPrices(state)
  renderPills(state.faqs || [])
  const addr = state.brand.address || 'Av. Guilherme Schell, 2504 — Bairro Fátima / Rio Branco, Canoas'
  const addrEl = document.getElementById('addr')
  const foot = document.getElementById('foot-addr')
  if (addrEl) addrEl.textContent = addr
  if (foot) foot.textContent = addr
}

document.getElementById('coupon-code').addEventListener('click', async () => {
  const code = document.getElementById('coupon-code').textContent.trim()
  try {
    await navigator.clipboard.writeText(code)
  } catch {}
  const ok = document.getElementById('coupon-copied')
  ok.classList.remove('hidden')
  setTimeout(() => ok.classList.add('hidden'), 1800)
})

bindChat()
load()
setInterval(load, 30000)
