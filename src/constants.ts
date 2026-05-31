/** Native pixel size of one tile — sprites are 16×16 */
export const CELL = 16
export const TIMESCALE = 1

export const ANGLES = [0, 180, -90, 90]

// player speed
export const PLAYER_SPEED = 3
export const MAX_PLAYER_SPEED = 6
// how far through a tile (0–1) before a queued perpendicular turn snaps early
export const SPIN_DURATION = 240
export const FLIP_DURATION = 120
export const DASH_COOLDOWN = 1000 // ms between dashes
export const DASH_DISTANCE = 2 // tiles

export const DIRS = {
  RIGHT: 0,
  LEFT: 1,
  UP: 2,
  DOWN: 3,
} as const

export const TILES = {
  EMPTY: 0,
  WALL: 1,
  DOT: 2,
  POWER: 3,
  DOOR: 4,
} as const

export const DX = [1, -1, 0, 0]
export const DY = [0, 0, -1, 1]

export const WRAP_DELAY = 300 // ms sprite is hidden while crossing a wrap edge
export const DOT_EFFECT_INTERVAL = 170 // ms between dot flash/particle/glow effects

export const GHOST_SPEED = 2.5

export const BUBBLE_EMITTER_CONFIG = {
  frame: 1,
  scale: { start: 0.5, end: 1.5 },
  alpha: { start: 0.4, end: 0 },
  lifespan: { min: 300, max: 2500 },
  speed: { min: 2, max: 9 },
  emitting: false,
}

// Variable-width (3–5 cols) × 5-row pixel-art bitmaps for "GULPYS GAMBIT"
export const LETTER_BITMAPS: Record<string, number[][]> = {
  G: [
    [0, 1, 1, 1],
    [1, 0, 0, 0],
    [1, 0, 1, 1],
    [1, 0, 0, 1],
    [0, 1, 1, 1],
  ],
  U: [
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [0, 1, 1, 0],
  ],
  L: [
    [1, 0, 0],
    [1, 0, 0],
    [1, 0, 0],
    [1, 0, 0],
    [1, 1, 1],
  ],
  P: [
    [1, 1, 1, 0],
    [1, 0, 0, 1],
    [1, 1, 1, 0],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
  ],
  Y: [
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [0, 1, 1, 0],
    [0, 0, 1, 0],
    [0, 0, 1, 0],
  ],
  S: [
    [0, 1, 1, 1],
    [1, 0, 0, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 1],
    [1, 1, 1, 0],
  ],
  A: [
    [0, 1, 1, 0],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
  ],
  M: [
    [1, 0, 0, 0, 1],
    [1, 1, 0, 1, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
  ],
  B: [
    [1, 1, 1, 0],
    [1, 0, 0, 1],
    [1, 1, 1, 0],
    [1, 0, 0, 1],
    [1, 1, 1, 0],
  ],
  I: [
    [1, 1, 1],
    [0, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
    [1, 1, 1],
  ],
  T: [
    [1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
  ],
  "'": [
    [1],
    [1],
    [0],
    [0],
    [0],
  ],
}
