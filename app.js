// ---------- Hero scrub: a frame sequence drawn to a full-screen canvas.
// Hover devices: cursor x picks the frame (left edge = looking left, right edge = looking right), from the
// 121 full-resolution frames. Touch devices: finger x does the same from 61 lighter frames. No <video>
// anywhere: iOS media policies left it blank on phones, and the extra H.264 pass made it soft on desktop.
const hero = document.querySelector('.hero')
const isTouch = matchMedia('(hover: none)').matches
const SET = isTouch ? { dir: 'frames', count: 61, pad: 2 } : { dir: 'frames-hd', count: 121, pad: 3 }
const PORTRAIT_VIEW = 0.62 // on a portrait screen this fraction of the frame width fills the screen: the figure plus space either side
const PORTRAIT_CENTRE = 0.45 // vertical centre of the figure as a fraction of the screen height
const GREY = '#b7b3b2' // the page background; the frame's own backdrop is the same grey
const canvas = document.getElementById('frames')
const ctx = canvas.getContext('2d')
ctx.imageSmoothingQuality = 'high'
const frames = []
let fraction = 0.5 // face the camera until the cursor or a finger moves
let current = -1
const draw = () => {
  const want = Math.round(fraction * (SET.count - 1))
  // Nearest frame that has finished loading, so the figure appears as soon as anything is ready.
  let i = want
  while (i >= 0 && !frames[i]?.complete) i--
  if (i < 0) { i = frames.findIndex((f) => f.complete); if (i < 0) return }
  const img = frames[i]
  if (i === current && canvas.dataset.frame) return
  current = i
  const dpr = Math.min(2, devicePixelRatio || 1)
  const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr)
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; ctx.imageSmoothingQuality = 'high' }
  const portrait = h > w
  const scale = portrait ? w / (img.naturalWidth * PORTRAIT_VIEW) : Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale
  const dx = (w - dw) / 2, dy = portrait ? h * PORTRAIT_CENTRE - dh / 2 : (h - dh) / 2
  ctx.drawImage(img, dx, dy, dw, dh)
  if (portrait) { // blend the frame's top and bottom edges into the page grey
    for (const [y0, y1] of [[dy, dy + dh * 0.08], [dy + dh, dy + dh * 0.82]]) { // short at the top so her hair stays crisp
      const g = ctx.createLinearGradient(0, y0, 0, y1)
      g.addColorStop(0, GREY); g.addColorStop(1, GREY + '00')
      ctx.fillStyle = g; ctx.fillRect(dx, Math.min(y0, y1), dw, Math.abs(y1 - y0))
    }
  }
  canvas.dataset.frame = i
}
for (let i = 0; i < SET.count; i++) frames.push(new Image())
// Fetch the camera-facing frame first so she appears at once, then the rest.
for (const i of [Math.round((SET.count - 1) / 2), ...frames.keys()]) {
  if (frames[i].src) continue
  frames[i].onload = () => { current = -1; draw() }
  frames[i].src = `${SET.dir}/f${String(i + 1).padStart(SET.pad, '0')}.webp`
}
let queued = false
const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; current = -1; draw() }) } }
const setFraction = (x) => { fraction = Math.min(1, Math.max(0, x / innerWidth)); schedule() }
if (isTouch) {
  // touch-action: pan-y on the hero leaves vertical drags to the page scroll and hands sideways ones to us.
  hero.addEventListener('touchstart', (e) => setFraction(e.touches[0].clientX), { passive: true })
  hero.addEventListener('touchmove', (e) => setFraction(e.touches[0].clientX), { passive: true })
} else {
  window.addEventListener('pointermove', (e) => { if (scrollY <= innerHeight) setFraction(e.clientX) })
}
window.addEventListener('resize', schedule)

// ---------- Questionnaire
const EMAIL = 'info@mizanqist.com'
const ENDPOINT = `https://formsubmit.co/ajax/${EMAIL}`
const KEY = 'nahar-answers'
const QUESTIONS = SECTIONS.flatMap((s, si) => s.questions.map((q) => ({ ...(typeof q === 'string' ? { text: q } : q), si })))
const STEPS = [{ type: 'intro' }]
SECTIONS.forEach((s, si) => {
  STEPS.push({ type: 'section', si })
  QUESTIONS.forEach((q, qi) => q.si === si && STEPS.push({ type: 'question', qi }))
})
STEPS.push({ type: 'review' })

const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
const answers = saved.answers || {} // qi -> { c: [choices], t: text }
const resumeAt = Math.min(saved.step || 0, STEPS.length - 1)
let step = 0
let fromReview = false
const quiz = document.getElementById('quiz')
const card = document.getElementById('card')
const bar = document.getElementById('progress')

const save = () => localStorage.setItem(KEY, JSON.stringify({ answers, step }))
const pad = (n) => String(n).padStart(2, '0')
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const answerText = (qi) => { const a = answers[qi] || {}; return [(a.c || []).join(', '), (a.t || '').trim()].filter(Boolean).join(' — ') }
const firstName = () => answerText(0).split(/[\s,]+/)[0] || 'Nahar'
const questionNumber = (s) => s.type === 'question' ? s.qi + 1 : s.type === 'section' ? QUESTIONS.findIndex((q) => q.si === s.si) + 1 : 0
const nextLabel = (qi) => fromReview ? 'Back to review' : !answerText(qi) ? 'Skip' : qi === QUESTIONS.length - 1 ? 'Review answers' : 'Next'

const introHTML = () => `
  <p class="eyebrow">For Nahar</p>
  <h1 class="q">Fifty questions.</h1>
  <p class="lead">No wrong answers and no time limit. Skip anything you like. When you press send at the end, your answers come straight to me.</p>
  <div class="row end">
    ${resumeAt > 1 ? `<button type="button" class="link" data-go="restart">Start over</button><button type="button" class="btn" data-go="resume">Pick up at question ${questionNumber(STEPS[resumeAt]) || 1}</button>`
                   : `<button type="button" class="btn" data-go="next">Let’s go</button>`}
  </div>`

const sectionHTML = (si) => {
  const s = SECTIONS[si]
  return `
  <img class="still" src="${s.image}" alt="" loading="lazy">
  <p class="eyebrow">Part ${si + 1} of ${SECTIONS.length} · ${s.questions.length} questions</p>
  <h2 class="q">${esc(s.title)}</h2>
  <p class="lead">${esc(s.blurb)}</p>
  <div class="row end"><button type="button" class="link" data-go="back">Back</button><button type="button" class="btn" data-go="next">${si === 0 ? 'Start' : 'Keep going'}</button></div>`
}

const questionHTML = (qi) => {
  const q = QUESTIONS[qi]
  const a = answers[qi] || {}
  const chips = (q.choices || []).map((c) => `<button type="button" class="chip${(a.c || []).includes(c) ? ' on' : ''}" data-choice="${esc(c)}">${esc(c)}</button>`).join('')
  return `
  <p class="eyebrow">Part ${q.si + 1} · ${esc(SECTIONS[q.si].title)}</p>
  <p class="count">${pad(qi + 1)}<span> / ${QUESTIONS.length}</span></p>
  <h2 class="q">${esc(q.text)}</h2>
  ${chips ? `<div class="chips">${chips}</div>` : ''}
  <textarea id="ta" rows="1" placeholder="${q.choices ? 'Anything to add?' : 'Type here…'}" autocomplete="off">${esc(a.t || '')}</textarea>
  <div class="row">
    <button type="button" class="link" data-go="back">Back</button>
    <span class="key">Enter ↵ to continue</span>
    <button type="button" class="btn" id="next" data-go="next">${nextLabel(qi)}</button>
  </div>`
}

const reviewHTML = () => `
  <p class="eyebrow">Almost there</p>
  <h2 class="q">Have a look before you send.</h2>
  <p class="lead">Tap any answer to change it.</p>
  <ol class="review">${QUESTIONS.map((q, qi) => `
    <li><button type="button" data-edit="${qi}"><span class="n">${pad(qi + 1)}</span><span class="qt">${esc(q.text)}</span><span class="at${answerText(qi) ? '' : ' skip'}">${esc(answerText(qi) || 'Skipped')}</span></button></li>`).join('')}
  </ol>
  <div class="row end"><button type="button" class="btn" data-go="send">Send my answers</button></div>`

const sentHTML = () => `
  <p class="eyebrow">Sent</p>
  <h2 class="q">Thank you, ${esc(firstName())}.</h2>
  <p class="lead">All fifty answers are on their way. That’s it, you’re done.</p>
  <div class="row end"><button type="button" class="btn" data-go="top">Back to the top</button></div>`

const errorHTML = (msg) => `
  <p class="eyebrow">Hmm</p>
  <h2 class="q">That didn’t send.</h2>
  <p class="lead">${esc(msg)}<br>Your answers are safe on this device. Try again, or copy them and paste into an email to <a href="mailto:${EMAIL}?subject=Nahar%27s%20answers">${EMAIL}</a>.</p>
  <div class="row end"><button type="button" class="link" data-go="copy">Copy answers</button><button type="button" class="btn" data-go="send">Try again</button></div>`

const grow = (ta) => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px' }

function render(html) {
  card.classList.remove('enter')
  void card.offsetWidth // restart the entrance animation
  card.classList.add('enter')
  card.innerHTML = html
  const ta = card.querySelector('textarea')
  if (ta) { grow(ta); ta.focus({ preventScroll: true }) }
}

function show() {
  const s = STEPS[step]
  bar.style.width = (s.type === 'review' ? 100 : questionNumber(s) / QUESTIONS.length * 100) + '%'
  render(s.type === 'intro' ? introHTML() : s.type === 'section' ? sectionHTML(s.si) : s.type === 'question' ? questionHTML(s.qi) : reviewHTML())
}

function go(n) {
  step = Math.max(0, Math.min(STEPS.length - 1, n))
  save()
  show()
  if (Math.abs(quiz.getBoundingClientRect().top) > 2) quiz.scrollIntoView({ block: 'start' })
}

const plainText = () => QUESTIONS.map((q, qi) => `${qi + 1}. ${q.text}\n${answerText(qi) || '(skipped)'}`).join('\n\n')

async function send() {
  render('<p class="eyebrow">Sending</p><h2 class="q">One second…</h2>')
  const body = { _subject: `${firstName()} answered your fifty questions`, _template: 'table', _captcha: 'false', name: firstName() }
  QUESTIONS.forEach((q, qi) => { body[`${pad(qi + 1)}. ${q.text}`] = answerText(qi) || '(skipped)' })
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || String(data.success) !== 'true') throw new Error(data.message || `${res.status} ${res.statusText}`)
    localStorage.removeItem(KEY)
    render(sentHTML())
    window.confetti?.({ particleCount: 160, spread: 75, origin: { y: 0.7 }, colors: ['#5c3f30', '#8a6a58', '#d9c7b8', '#f2ece5'] })
  } catch (err) {
    render(errorHTML(err.message || 'No connection.'))
  }
}

card.addEventListener('click', (e) => {
  const el = e.target.closest('[data-go],[data-choice],[data-edit]')
  if (!el) return
  const s = STEPS[step]
  if (el.dataset.choice !== undefined) {
    const q = QUESTIONS[s.qi]
    const a = answers[s.qi] = answers[s.qi] || {}
    const on = (a.c || []).includes(el.dataset.choice)
    a.c = q.multi ? (on ? a.c.filter((c) => c !== el.dataset.choice) : [...(a.c || []), el.dataset.choice]) : on ? [] : [el.dataset.choice]
    el.classList.toggle('on')
    if (!q.multi) card.querySelectorAll('.chip').forEach((c) => c !== el && c.classList.remove('on'))
    document.getElementById('next').textContent = nextLabel(s.qi)
    save()
    return
  }
  if (el.dataset.edit !== undefined) { fromReview = true; go(STEPS.findIndex((x) => x.type === 'question' && x.qi === +el.dataset.edit)); return }
  const action = el.dataset.go
  if (action === 'next') { if (fromReview) { fromReview = false; go(STEPS.length - 1) } else go(step + 1) }
  else if (action === 'back') { if (fromReview) { fromReview = false; go(STEPS.length - 1) } else go(step - 1) }
  else if (action === 'resume') go(resumeAt)
  else if (action === 'restart') { Object.keys(answers).forEach((k) => delete answers[k]); go(1) }
  else if (action === 'send') send()
  else if (action === 'copy') navigator.clipboard.writeText(plainText()).then(() => { el.textContent = 'Copied' })
  else if (action === 'top') scrollTo({ top: 0, behavior: 'smooth' })
})

card.addEventListener('input', (e) => {
  if (e.target.tagName !== 'TEXTAREA') return
  const s = STEPS[step]
  ;(answers[s.qi] = answers[s.qi] || {}).t = e.target.value
  grow(e.target)
  document.getElementById('next').textContent = nextLabel(s.qi)
  save()
})

card.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && e.target.tagName === 'TEXTAREA' && matchMedia('(hover: hover)').matches) {
    e.preventDefault()
    document.getElementById('next').click()
  }
})

show()
