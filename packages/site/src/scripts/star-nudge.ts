// star-nudge.ts — after ~20 interactive clicks, the neko slides up in a small
// toast and asks for a GitHub star. Polite by construction:
//   - never blocks anything (bottom toast, not a modal; Esc / ✕ / "not now")
//   - if ignored or snoozed, waits another 40 clicks; gives up for good after
//     three attempts or the moment the star button is clicked
//   - click-count and outcome live in localStorage, so it doesn't re-nag

import { FRAMES, PALETTE, SIZE } from './arcade-cat-sprites.js'

const REPO = 'https://github.com/adoistic/meowbench'
const K_COUNT = 'meow-clicks'
const K_NEXT = 'meow-star-next' // click count at which to ask (again)
const K_SHOWS = 'meow-star-shows'
const K_DONE = 'meow-star-done'

const num = (k: string, fallback: number) => {
  const v = Number(localStorage.getItem(k))
  return Number.isFinite(v) && v > 0 ? v : fallback
}

function catPortrait(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = SIZE
  c.height = SIZE
  c.className = 'sn-cat'
  const ctx = c.getContext('2d')!
  FRAMES.sit_a.forEach((row, y) => {
    for (let x = 0; x < SIZE; x++) {
      const color = PALETTE[row[x]]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(x, y, 1, 1)
    }
  })
  return c
}

function close(el: HTMLElement) {
  el.classList.remove('in')
  setTimeout(() => el.remove(), 250)
}

function show() {
  const shows = num(K_SHOWS, 0) + 1
  localStorage.setItem(K_SHOWS, String(shows))
  if (shows >= 3) localStorage.setItem(K_DONE, '1') // last call, then silence
  localStorage.setItem(K_NEXT, String(num(K_COUNT, 0) + 40))

  const el = document.createElement('aside')
  el.id = 'star-nudge'
  el.className = 'star-nudge'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-label', 'star meowbench on github')

  const done = () => {
    localStorage.setItem(K_DONE, '1')
    close(el)
  }

  el.append(catPortrait())

  const body = document.createElement('div')
  body.className = 'sn-body'
  const title = document.createElement('p')
  title.className = 'sn-title'
  title.textContent = 'enjoying the arcade?'
  const text = document.createElement('p')
  text.className = 'sn-text'
  text.textContent = 'a github star keeps the neko fed. one click, big meow.'
  const row = document.createElement('p')
  row.className = 'sn-actions'
  const star = document.createElement('a')
  star.className = 'btn sn-star'
  star.href = REPO
  star.target = '_blank'
  star.rel = 'noopener'
  star.textContent = '★ STAR ON GITHUB'
  star.addEventListener('click', done)
  const later = document.createElement('button')
  later.className = 'sn-later'
  later.type = 'button'
  later.textContent = 'not now'
  later.addEventListener('click', () => close(el))
  row.append(star, later)
  body.append(title, text, row)
  el.append(body)

  const x = document.createElement('button')
  x.className = 'sn-x'
  x.type = 'button'
  x.setAttribute('aria-label', 'close')
  x.textContent = '✕'
  x.addEventListener('click', () => close(el))
  el.append(x)

  const esc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close(el)
      removeEventListener('keydown', esc)
    }
  }
  addEventListener('keydown', esc)

  document.body.append(el)
  // timeout, not rAF: lets the initial transform commit so the slide-up
  // transition runs, and still fires in backgrounded tabs
  setTimeout(() => el.classList.add('in'), 30)
}

// One persistent listener; the document survives ClientRouter navigations.
document.addEventListener('pointerdown', (e) => {
  if (localStorage.getItem(K_DONE)) return
  const el = e.target as HTMLElement
  if (el.closest('#star-nudge')) return // the nudge doesn't count itself
  if (!el.closest('a, button, summary, .pill, .model-row, select, input, .cat-card')) return
  const n = num(K_COUNT, 0) + 1
  localStorage.setItem(K_COUNT, String(n))
  if (n >= num(K_NEXT, 20) && !document.getElementById('star-nudge')) show()
})
