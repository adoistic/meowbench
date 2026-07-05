// arcade-cat.ts — the meowbench neko: a little pixel cat that chases your
// cursor around the arcade, in the tradition of Neko (1989). Our own mascot,
// our own sprites — see arcade-cat-sprites.ts.
//
// Behavior: far from the pointer it gallops after it; close, it sits, blinks,
// and flicks its tail; ignore it long enough and it curls up asleep with mint
// z's. Click on it and it pounces (with a meow, if sound is on).
//
// Desktop only (pointer: fine), skipped entirely under prefers-reduced-motion,
// and it never intercepts input — pointer-events: none, always.

import { FRAMES, PALETTE, SIZE } from './arcade-cat-sprites.js'
import { meow } from './arcade-audio.js'

const fine = matchMedia('(pointer: fine)').matches
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

if (fine && !reduced) {
  const TICK = 100 // ms — 10fps, authentically retro
  const CSS_SIZE = 48 // rendered size on screen (16 logical px at 3x)
  const CATCH_DIST = 30 // px — closer than this, the cat sits
  const STEP = 24 // px per tick while running (240 px/s)
  const OFFSET = { x: 26, y: 30 } // rest point: down-right of the pointer
  const SLEEP_AFTER = 90 // ticks idle before curling up (~9s)

  const canvas = document.createElement('canvas')
  canvas.id = 'meow-cat'
  canvas.width = SIZE
  canvas.height = SIZE + 6 // headroom for the z's above the loaf
  canvas.setAttribute('aria-hidden', 'true')
  const ctx = canvas.getContext('2d')!

  // spawn snoozing in the bottom-right corner until the pointer first moves
  const pos = { x: innerWidth - 90, y: innerHeight - 110 }
  const pointer = { x: pos.x - OFFSET.x, y: pos.y - OFFSET.y }
  let facing = -1 // 1 right, -1 left
  let idleTicks = SLEEP_AFTER + 1 // wake on first pointer move
  let pounceTicks = 0
  let tick = 0

  function drawFrame(name: string, zs: boolean) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    if (facing === -1) {
      // run sprites are drawn facing right; mirror for leftward gallops
      ctx.translate(SIZE, 0)
      ctx.scale(-1, 1)
    }
    const rows = FRAMES[name]
    rows.forEach((row, y) => {
      for (let x = 0; x < SIZE; x++) {
        const color = PALETTE[row[x]]
        if (!color) continue
        ctx.fillStyle = color
        ctx.fillRect(x, y + 6, 1, 1)
      }
    })
    ctx.restore()
    if (zs) {
      // mint z's rising over the sleeping loaf, alternating positions
      ctx.fillStyle = PALETTE.M
      const phase = Math.floor(tick / 6) % 2
      const zx = 10 + phase
      const zy = phase ? 0 : 3
      // a 3x3 pixel "z"
      ctx.fillRect(zx, zy, 3, 1)
      ctx.fillRect(zx + 1, zy + 1, 1, 1)
      ctx.fillRect(zx, zy + 2, 3, 1)
    }
  }

  function place() {
    canvas.style.transform = `translate(${Math.round(pos.x - CSS_SIZE / 2)}px, ${Math.round(pos.y - CSS_SIZE / 2)}px)`
  }

  function step() {
    tick++
    if (document.hidden) return

    if (pounceTicks > 0) {
      pounceTicks--
      pos.y += pounceTicks >= 2 ? -7 : 7 // up, hang, back down
      drawFrame('pounce', false)
      place()
      return
    }

    const target = { x: pointer.x + OFFSET.x, y: pointer.y + OFFSET.y }
    const dx = target.x - pos.x
    const dy = target.y - pos.y
    const dist = Math.hypot(dx, dy)

    if (dist > CATCH_DIST) {
      idleTicks = 0
      const stride = Math.min(STEP, dist)
      pos.x += (dx / dist) * stride
      pos.y += (dy / dist) * stride
      if (Math.abs(dx) > 4) facing = dx > 0 ? 1 : -1
      drawFrame(tick % 2 ? 'run_a' : 'run_b', false)
      place()
      return
    }

    idleTicks++
    if (idleTicks > SLEEP_AFTER) {
      drawFrame(Math.floor(tick / 6) % 2 ? 'sleep_a' : 'sleep_b', true)
      return
    }
    // sitting: mostly still, with a blink and a tail flick on offset cycles
    const t = idleTicks % 47
    const frame = t === 24 ? 'sit_blink' : t >= 38 && t < 42 ? 'sit_b' : 'sit_a'
    drawFrame(frame, false)
  }

  document.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX
    pointer.y = e.clientY
  })

  // click on (or near) the cat → pounce + meow. pointer-events stays none, so
  // the click still lands on whatever is underneath.
  document.addEventListener('pointerdown', (e) => {
    if (pounceTicks > 0) return
    if (Math.hypot(e.clientX - pos.x, e.clientY - pos.y) < 34) {
      pounceTicks = 4
      idleTicks = 0
      meow()
    }
  })

  // The body is swapped on every ClientRouter navigation; the cat (and its
  // position, mood, and nap schedule) lives on and re-attaches to the new page.
  function attach() {
    if (!canvas.isConnected) document.body.appendChild(canvas)
  }
  document.addEventListener('astro:page-load', attach)
  attach()
  place()
  drawFrame('sleep_a', true)

  setInterval(step, TICK)
}
