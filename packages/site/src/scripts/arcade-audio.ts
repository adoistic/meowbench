// arcade-audio.ts — 8-bit sound for the meowbench cabinet.
//
// Everything here is synthesized with the Web Audio API. No audio files, no
// network requests, nothing to download. Sound is OFF by default and only
// starts from the toggle — a user gesture, which is exactly what browser
// autoplay policy requires anyway.
//
// Voices: square-wave bass + triangle lead (an 8-bar attract-mode loop in
// A minor), filtered-noise hats, a sine-thump kick. SFX use the classic
// arcade vocabulary: pitch-drop blips, the two-note coin, a win arpeggio.

const PREF_KEY = 'meow-sound'

let ctx: AudioContext | null = null
let master: GainNode
let sfxBus: GainNode
let musicBus: GainNode
let noiseBuf: AudioBuffer
let musicTimer: ReturnType<typeof setInterval> | null = null
let nextNoteTime = 0
let step = 0

const prefOn = () => localStorage.getItem(PREF_KEY) === '1'
const running = () => !!ctx && ctx.state === 'running'
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12)

function ensureCtx(): AudioContext {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  ctx = new AC()
  // A gentle compressor glues the mix and stops stacked squares from clipping.
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -18
  comp.knee.value = 24
  comp.ratio.value = 6
  comp.connect(ctx.destination)
  master = ctx.createGain()
  master.gain.value = 0.9
  master.connect(comp)
  sfxBus = ctx.createGain()
  sfxBus.gain.value = 1
  sfxBus.connect(master)
  // Raw square waves are harsh; a lowpass rounds the music into "old cabinet
  // speaker" territory. SFX stay bright on purpose.
  const soften = ctx.createBiquadFilter()
  soften.type = 'lowpass'
  soften.frequency.value = 6000
  soften.connect(master)
  musicBus = ctx.createGain()
  musicBus.gain.value = 0.5
  musicBus.connect(soften)
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return ctx
}

/** One enveloped oscillator note. */
function voice(freq: number, t: number, dur: number, type: OscillatorType, peak: number, bus: GainNode) {
  if (!ctx) return
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.value = freq
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g)
  g.connect(bus)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function hat(t: number) {
  if (!ctx) return
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 6500
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.014, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
  src.connect(hp)
  hp.connect(g)
  g.connect(musicBus)
  src.start(t)
  src.stop(t + 0.04)
}

function kick(t: number) {
  if (!ctx) return
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(110, t)
  o.frequency.exponentialRampToValueAtTime(45, t + 0.09)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.2, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
  o.connect(g)
  g.connect(musicBus)
  o.start(t)
  o.stop(t + 0.12)
}

// ---- music: 8 bars of 8 eighth-notes, A minor, 112 BPM ----
// Progression: Am · Em · C · G · Am · F · Dm · E — resolves back to Am so the
// loop pulls itself around. Melody is deliberately sparse; rests keep it from
// wearing out its welcome. Numbers are MIDI notes, 0 = rest.
const BPM = 112
const EIGHTH = 60 / BPM / 2
const MELODY = [
  [69, 0, 72, 0, 76, 0, 74, 72], // A4  C5  E5  D5-C5
  [71, 0, 67, 0, 64, 0, 0, 0],   // B4  G4  E4  —
  [72, 0, 76, 79, 76, 0, 72, 0], // C5  E5-G5-E5  C5
  [71, 0, 74, 0, 67, 0, 0, 0],   // B4  D5  G4  —
  [69, 0, 72, 0, 76, 0, 81, 0],  // A4  C5  E5  A5
  [77, 0, 76, 0, 72, 0, 69, 0],  // F5  E5  C5  A4
  [74, 0, 77, 0, 81, 0, 77, 74], // D5  F5  A5  F5-D5
  [76, 0, 0, 0, 71, 0, 0, 0],    // E5 ——— B4 — (dominant, loops home)
]
const BASS = [45, 40, 48, 43, 45, 41, 38, 40] // A2 E2 C3 G2 A2 F2 D2 E2

function scheduleStep(s: number, t: number) {
  const bar = Math.floor(s / 8) % 8
  const sub = s % 8
  const m = MELODY[bar][sub]
  if (m) voice(midi(m), t, EIGHTH * 1.7, 'triangle', 0.085, musicBus)
  voice(midi(BASS[bar] + (sub % 2 ? 12 : 0)), t, EIGHTH * 0.85, 'square', 0.05, musicBus)
  if (sub % 2 === 1) hat(t)
  if (sub === 0 || sub === 4) kick(t)
}

function startMusic() {
  if (!ctx || musicTimer) return
  step = 0
  nextNoteTime = ctx.currentTime + 0.08
  musicTimer = setInterval(() => {
    if (!ctx) return
    while (nextNoteTime < ctx.currentTime + 0.25) {
      scheduleStep(step, nextNoteTime)
      step++
      nextNoteTime += EIGHTH
    }
  }, 90)
}

function stopMusic() {
  if (musicTimer) clearInterval(musicTimer)
  musicTimer = null
}

// ---- SFX ----
function blip() {
  if (!running()) return
  const t = ctx!.currentTime
  const f = 700 + Math.random() * 160 // slight variation so rapid clicks don't machine-gun
  const o = ctx!.createOscillator()
  o.type = 'square'
  o.frequency.setValueAtTime(f * 1.6, t)
  o.frequency.exponentialRampToValueAtTime(f, t + 0.05)
  const g = ctx!.createGain()
  g.gain.setValueAtTime(0.09, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
  o.connect(g)
  g.connect(sfxBus)
  o.start(t)
  o.stop(t + 0.08)
}

function select() {
  if (!running()) return
  const t = ctx!.currentTime
  voice(659.26, t, 0.07, 'square', 0.09, sfxBus)        // E5
  voice(987.77, t + 0.06, 0.09, 'square', 0.09, sfxBus) // B5
}

function coin() {
  if (!running()) return
  const t = ctx!.currentTime
  voice(987.77, t, 0.08, 'square', 0.1, sfxBus)          // B5
  voice(1318.51, t + 0.08, 0.28, 'square', 0.1, sfxBus)  // E6 — the classic
}

function win() {
  if (!running()) return
  const t = ctx!.currentTime
  ;[69, 73, 76, 81].forEach((n, i) => voice(midi(n), t + i * 0.09, 0.12, 'square', 0.08, sfxBus)) // A major arpeggio
}

function sweep(from: number, to: number, dur: number) {
  if (!running()) return
  const t = ctx!.currentTime
  const o = ctx!.createOscillator()
  o.type = 'triangle'
  o.frequency.setValueAtTime(from, t)
  o.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = ctx!.createGain()
  g.gain.setValueAtTime(0.1, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g)
  g.connect(sfxBus)
  o.start(t)
  o.stop(t + dur + 0.02)
}

// ---- toggle + wiring ----
const btn = document.getElementById('sound-toggle') as HTMLButtonElement | null

function setUI(state: boolean) {
  if (!btn) return
  btn.setAttribute('aria-pressed', String(state))
  const s = btn.querySelector('.st-state')
  if (s) s.textContent = state ? 'ON' : 'OFF'
  btn.title = state ? '8-bit sound: on' : '8-bit sound: off'
}

async function enable(jingle: boolean) {
  const c = ensureCtx()
  if (c.state === 'suspended') await c.resume()
  localStorage.setItem(PREF_KEY, '1')
  setUI(true)
  if (jingle) sweep(220, 880, 0.18)
  startMusic()
}

function disable() {
  localStorage.setItem(PREF_KEY, '0')
  setUI(false)
  sweep(660, 110, 0.18)
  stopMusic()
  setTimeout(() => void ctx?.suspend(), 300)
}

if (btn) {
  btn.hidden = false // rendered hidden: the toggle is meaningless without JS
  let lastToggle = 0
  btn.addEventListener('click', () => {
    // debounce: synthetic double-fires (and trigger-happy double-clicks)
    // shouldn't flip the switch twice
    const now = performance.now()
    if (now - lastToggle < 250) return
    lastToggle = now
    if (prefOn() && running()) disable()
    else void enable(true)
  })
}

// tiny debug handle — also a devtools easter egg for the curious
;(window as unknown as Record<string, unknown>).__meow = {
  sound: () => (running() ? 'on' : 'off'),
  music: () => (musicTimer ? 'playing' : 'stopped'),
}

// Returning visitor with sound on: a fresh page load usually starts the
// context suspended (autoplay policy), so arm a one-time gesture to resume.
if (prefOn()) {
  setUI(true)
  const arm = () => void enable(false)
  const c = ensureCtx()
  if (c.state === 'running') startMusic()
  else {
    document.addEventListener('pointerdown', arm, { once: true })
    document.addEventListener('keydown', arm, { once: true })
  }
}

// Delegated click sounds. pointerdown feels tighter than click.
document.addEventListener('pointerdown', (e) => {
  if (!running() || !prefOn()) return
  const el = e.target as HTMLElement
  if (el.closest('#sound-toggle')) return // toggle plays its own sweep
  if (el.closest('#fighter-a, #fighter-b')) return coin()
  if (el.closest('.cat-card')) return select()
  if (el.closest('a, button, summary, .pill, .model-row, select, input')) return blip()
})

// Arena: a little fanfare when the round result appears.
const arenaResult = document.getElementById('arena-result')
if (arenaResult) {
  new MutationObserver(() => {
    if (arenaResult.style.display !== 'none') win()
  }).observe(arenaResult, { attributes: true, attributeFilter: ['style'] })
}
