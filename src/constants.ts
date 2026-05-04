export const COLS = 28
export const ROWS = 31
/** Native pixel size of one tile — sprites are 16×16 */
export const CELL = 16

export const ANGLES = [0, 180, -90, 90]

// player speed
export const PLAYER_SPEED = 5

/** Native canvas dimensions (no padding — maze fills it exactly) */
export const NATIVE_W = COLS * CELL // 448
export const NATIVE_H = ROWS * CELL // 496

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

export const GHOST_SPEED = 5
export const GHOST_SCARED_SPEED = 3
export const GHOST_EATEN_SPEED = 10
export const POWER_DURATION = 8000
export const SCARED_WARN = 2000
export const EXIT_TX = 13
export const EXIT_TY = 11
export const JAIL_POSITIONS = [
  { x: 12, y: 13 }, // 0: top-left
  { x: 15, y: 13 }, // 1: top-right
  { x: 12, y: 15 }, // 2: bottom-left
  { x: 15, y: 15 }, // 3: bottom-right
]

export const GHOST_STATE = {
  CHASE: 0,
  SCARED: 1,
  EATEN: 2,
  EXITING: 3,
  JAILED: 4,
} as const
