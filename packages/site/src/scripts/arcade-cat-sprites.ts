// arcade-cat-sprites.ts — hand-drawn pixel frames for the meowbench neko:
// the little mascot cat that chases your cursor around the arcade.
//
// Each frame is a 16x16 grid of palette characters, same technique as the
// favicon and nav icons. Frames are drawn to a <canvas> at 2x, so every char
// is a 2px pixel. Right-facing frames are mirrored at draw time for left.
//
//   O  outline (void)     Y  fur (yellow)     P  nose/pads (pink)
//   B  eyes (void)        M  z's (mint)       .  transparent

export const PALETTE: Record<string, string> = {
  O: '#120a26',
  Y: '#ffde59',
  P: '#ff3d81',
  B: '#120a26',
  M: '#8affc1',
}

export const SIZE = 16 // logical pixels per side

// Front-facing sit — the favicon cat, now with a body and a wrapped tail.
const SIT_A = [
  '................',
  '..O.........O...',
  '.OYO.......OYO..',
  '.OYYO.....OYYO..',
  '.OYYYOOOOOYYYO..',
  '.OYYYYYYYYYYYO..',
  'OYYYYYYYYYYYYYO.',
  'OYBBYYYYYYYBBYO.',
  'OYYYYYYPPYYYYYO.',
  'OYYYYYYYYYYYYYO.',
  '.OYYYYYYYYYYYO..',
  '..OYYYYYYYYYO...',
  '..OYYYYYYYYYO...',
  '..OYYYYYYYYYYOO.',
  '..OYOYYOYYOYYYYO',
  '...OOOOOOOOOOOO.',
]

// Blink: the eyes vanish into fur for a single 100ms tick — B and O are the
// same void color, so "lids" would be invisible; absence reads as a blink.
const SIT_BLINK = SIT_A.map((r, i) => (i === 7 ? 'OYYYYYYYYYYYYYO.' : r))

// Tail flick: the tip lifts off the ground for a beat.
const SIT_B = SIT_A.map((r, i) => {
  if (i === 12) return '..OYYYYYYYYYO..O'
  if (i === 13) return '..OYYYYYYYYYYOYO'
  if (i === 14) return '..OYOYYOYYOYYOO.'
  return r
})

// Side gallop, facing right. Tail streams behind, legs alternate.
const RUN_A = [
  '................',
  '................',
  '...........O.O..',
  '..........OYOYO.',
  '.........OYYYYO.',
  '.........OYYYYYO',
  'OY.......OYBYYYO',
  '.OY......OYYYYPO',
  '..OYO..OOYYYYYO.',
  '...OYOYYYYYYYO..',
  '...OYYYYYYYYYO..',
  '..OYYYYYYYYYO...',
  '..OYYYYYYYYYO...',
  '..OYO..OYO.OYO..',
  '..OO...OO...OO..',
  '................',
]

const RUN_B = [
  '................',
  '................',
  '...........O.O..',
  '..........OYOYO.',
  '.........OYYYYO.',
  'O........OYYYYYO',
  '.OY......OYBYYYO',
  '..OY.....OYYYYPO',
  '...OYO.OOYYYYYO.',
  '...OYOYYYYYYYO..',
  '...OYYYYYYYYYO..',
  '..OYYYYYYYYYO...',
  '..OYYYYYYYYYO...',
  '...OYO.OYO.OYO..',
  '....OO..OO..OO..',
  '................',
]

// Curled up asleep. Ears poke out of the loaf; frame B breathes.
const SLEEP_A = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '........O..O....',
  '..OOOO.OYOOYO...',
  '.OYYYYOYYYYYYO..',
  '.OYYYYYYYYYYYO..',
  'OYYYYYYYYYYYYYO.',
  'OYYYYYYYYOOYYYO.',
  'OYYYYYYYYYYYYYO.',
  '.OYYYYYYYYYYYO..',
  '..OOYYYYYYYOO...',
  '....OOOOOOO.....',
  '................',
]

const SLEEP_B = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '........O..O....',
  '.OOOO..OYOOYO...',
  'OYYYYOOYYYYYYO..',
  'OYYYYYYYYYYYYYO.',
  'OYYYYYYYYOOYYYO.',
  'OYYYYYYYYYYYYYO.',
  '.OYYYYYYYYYYYO..',
  '..OOYYYYYYYOO...',
  '....OOOOOOO.....',
  '................',
]

// Pounce: airborne sit — ears back, paws tucked.
const POUNCE = SIT_A.map((r, i) => {
  if (i === 14) return '..OYOYYOYYOYYYYO'
  if (i === 15) return '................'
  return r
})

export const FRAMES: Record<string, string[]> = {
  sit_a: SIT_A,
  sit_b: SIT_B,
  sit_blink: SIT_BLINK,
  run_a: RUN_A,
  run_b: RUN_B,
  sleep_a: SLEEP_A,
  sleep_b: SLEEP_B,
  pounce: POUNCE,
}

// Sanity: every row must be exactly SIZE chars — a typo here draws garbage.
for (const [name, rows] of Object.entries(FRAMES)) {
  if (rows.length !== SIZE || rows.some((r) => r.length !== SIZE)) {
    throw new Error(`sprite "${name}" is not ${SIZE}x${SIZE}`)
  }
}
