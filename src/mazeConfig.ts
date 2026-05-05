/**
 * Maze generation configuration — edit MAZE_CONFIG to tune generation.
 */

import { generateGhostColors } from './utils'

/** How the generated half-maze is reflected to fill the full grid. */
export type MazeSymmetry =
  | 'none' // fully random, no mirroring
  | 'horizontal' // left half mirrored to right (classic Pac-Man look)
  | 'rotational' // 180° point-symmetric (top-left ↔ bottom-right)
  | 'quad' // mirrored on both axes (4-fold reflective)

export interface GhouseConfig {
  /** Tile column of the left outer wall */
  col: number
  /** Tile row of the top outer wall (this row holds the door) */
  row: number
  /** Interior width in tiles — must be ≥ 1 (odd = 1-tile door, even = 2-tile door) */
  width: number
  /** Interior height in tiles — must be ≥ 1 */
  height: number
}

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
  house: GhouseConfig
  wraps: WrapConfig
  /** Number of ghosts to spawn — each gets a unique color. Must fit inside the house interior. */
  ghostCount: number
  /** Number of power pellets to place. Spread evenly around the maze perimeter. */
  powerCount: number
}

const S = 30
export const MAZE_CONFIG: MazeConfig = {
  cols: S,
  rows: Math.floor(S * 0.75),
  symmetry: 'none',
  loopFactor: 0.2,
  house: {
    col: Math.floor(S / 2),
    row: Math.floor(S / 2),
    width: 4,
    height: 1,
  },
  wraps: { x: 2, y: 1 },
  ghostCount: 4,
  powerCount: 0,
}

export const GHOST_COLORS: [number, number, number][] = generateGhostColors(4)
