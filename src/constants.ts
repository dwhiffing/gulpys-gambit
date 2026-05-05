/** Native pixel size of one tile — sprites are 16×16 */
export const CELL = 32

export const ANGLES = [0, 180, -90, 90]

// player speed
export const PLAYER_SPEED = 5

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

export const GHOST_STATE = {
  CHASE: 0,
  SCARED: 1,
  EATEN: 2,
  EXITING: 3,
  JAILED: 4,
} as const
