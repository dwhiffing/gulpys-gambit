/**
 * Maze generation configuration — edit MAZE_CONFIG to tune generation.
 */

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
  /** Number of ghosts to spawn. Each is assigned a wrap tile as its spawn/respawn point. */
  ghostCount: number
  /** Number of power pellets to place. Spread evenly around the maze perimeter. */
  powerCount: number
}

const S = 24
export const MAZE_CONFIG: MazeConfig = {
  cols: S,
  rows: Math.floor(S * 1.25),
  symmetry: 'none',
  loopFactor: 0.2,
  wraps: { x: 2, y: 1 },
  ghostCount: 1,
  powerCount: 4,
}

export const GHOST_COLORS: [number, number, number][] = [
  [0xff, 0x00, 0x00], // red
  [0xff, 0xa5, 0x00], // orange
  [0xff, 0xff, 0x00], // yellow
]
