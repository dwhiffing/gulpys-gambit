/**
 * Maze generation configuration — edit MAZE_CONFIG to tune generation.
 */

import { EnemyType } from './maze'

/** How the generated half-maze is reflected to fill the full grid. */
export type MazeSymmetry =
  | 'none' // fully random, no mirroring
  | 'horizontal' // left half mirrored to right (classic Pac-Man look)
  | 'rotational' // 180° point-symmetric (top-left ↔ bottom-right)
  | 'quad' // mirrored on both axes (4-fold reflective)

export interface WrapConfig {
  /** Max paired left/right wrap corridors (0 = none) */
  x: number
  /** Max paired top/bottom wrap corridors (0 = none) */
  y: number
}

export interface MazeConfig {
  /** Total tile columns — even numbers work best; divisible by 4 for non-'none' symmetry */
  cols: number
  /** Total tile rows — odd numbers work best */
  rows: number
  symmetry: MazeSymmetry
  /**
   * Probability (0–1) that any eligible internal wall is removed to create a
   * loop.  0 = perfect tree maze (lots of dead-ends), 1 = almost no walls.
   * Values around 0.15–0.25 produce playable Pac-Man corridors.
   */
  loopFactor: number
  wraps: WrapConfig
  /** Map of enemy type name to spawn count. */
  ghosts: Partial<Record<EnemyType, number>>
  /** Number of power pellets to place. Spread evenly around the maze perimeter. */
  powerCount: number
}

const MIN_SIZE = 16
const MAX_SIZE = 35
export const getMazeConfig = (level: number): MazeConfig => {
  const S = Math.min(
    MAX_SIZE,
    Math.max(MIN_SIZE, Math.floor(16 + (level - 2) * 1.5)),
  )
  const wraps = Math.floor(S / 15)
  return {
    cols: S,
    rows: Math.floor(S * 1.25),
    symmetry: 'none',
    loopFactor: 0.2,
    wraps: { x: wraps, y: wraps - 1 },
    ghosts: {
      teeth2: level <= 2 ? 1 : level <= 5 ? 2 : level <= 7 ? 2 : 3,
      naut: level <= 5 ? 0 : level <= 7 ? 1 : 2,
      oct: level <= 7 ? 0 : 1,
    },
    powerCount: 4 + level,
  }
}

export const GHOST_COLORS: [number, number, number][] = [
  [0xff, 0x00, 0x00], // red
  [0xff, 0xa5, 0x00], // orange
  [0xff, 0xff, 0x00], // yellow
]
