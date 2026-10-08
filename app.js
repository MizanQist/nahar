// ---------- Hero scrub. Hover devices: cursor x drives the clip (left edge = looking left, right edge = looking right).
// Touch devices: scrolling through the 200svh hero drives it instead, since there is no cursor to follow.
const video = document.getElementById('hero')
const hero = document.querySelector('.hero')
const isTouch = matchMedia('(hover: none)').matches
const SEEK_TIMEOUT = 400 // ms; a seek that never reports back must not wedge the scrub
let targetTime = 0
let seekStarted = 0
const seekTo = (t) => { seekStarted = performance.now(); video.currentTime = t }
const isSeeking = () => performance.now() - seekStarted < SEEK_TIMEOUT
video.addEventListener('seeked', () => {
  seekStarted = 0
  if (Math.abs(video.currentTime - targetTime) > 0.001) seekTo(targetTime)
})
const scrubTo = (fraction) => {
  if (!video.duration) return
  targetTime = Math.min(1, Math.max(0, fraction)) * video.duration
  if (!isSeeking() && targetTime !== video.currentTime) seekTo(targetTime)
}
const onScroll = () => { const track = hero.offsetHeight - innerHeight; if (track > 0 && scrollY <= track) scrubTo(scrollY / track) }
if (isTouch) window.addEventListener('scroll', onScroll, { passive: true })
else window.addEventListener('pointermove', (e) => { if (scrollY <= innerHeight) scrubTo(e.clientX / innerWidth) })
// iOS will not paint seeked frames until the element has played once; muted + playsinline makes this allowed without a tap.
const prime = (then) => video.play().then(() => { video.pause(); then() }).catch(then)
video.addEventListener('loadedmetadata', () => prime(() => isTouch ? onScroll() : scrubTo(0.5)))
// Download the whole clip first and scrub from memory: streaming it meant every seek into an unbuffered
// range waited on the network, and a backgrounded tab dropped the stream so seeks stopped landing.
fetch(video.dataset.src).then((r) => r.blob()).then((b) => { video.src = URL.createObjectURL(b) })
// Browsers suspend media in hidden tabs; re-prime and re-seek on return.
document.addEventListener('visibilitychange', () => { if (!document.hidden && video.duration) prime(() => seekTo(targetTime)) })

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
