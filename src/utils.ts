import * as Phaser from 'phaser'
import { CELL, DX, DY, EFFECTS_ENABLED, TILES, WRAP_DELAY } from './constants'

export function wrapX(x: number, cols: number): number {
  if (x < 0) return cols - 1
  if (x >= cols) return 0
  return x
}

export function wrapY(y: number, rows: number): number {
  if (y < 0) return rows - 1
  if (y >= rows) return 0
  return y
}

export function isWrapping(
  tileX: number,
  tileY: number,
  dir: number,
  cols: number,
  rows: number,
): boolean {
  const nx = tileX + DX[dir]
  const ny = tileY + DY[dir]
  return nx < 0 || nx >= cols || ny < 0 || ny >= rows
}

interface Entity {
  tileX: number
  tileY: number
  dir: number
  grid: number[][]
  progress: number
  sprite: {
    setPosition(x: number, y: number): void
    setVisible(v: boolean): void
  }
}
export function moveFrac(
  host: Entity,
  progress: number,
  useEntry = false,
): { x: number; y: number } {
  const { tileX, tileY, dir, grid } = host
  const cols = grid[0].length
  const rows = grid.length
  if (useEntry) {
    const entryX = wrapX(tileX + DX[dir], cols)
    const entryY = wrapY(tileY + DY[dir], rows)
    return {
      x: entryX + DX[dir] * (progress - 2),
      y: entryY + DY[dir] * (progress - 2),
    }
  }
  return {
    x: tileX + DX[dir] * progress,
    y: tileY + DY[dir] * progress,
  }
}

export function canMove(
  grid: number[][],
  tx: number,
  ty: number,
  dir: number,
  canUseDoor: boolean,
): boolean {
  const cols = grid[0].length
  const rows = grid.length

  // The two leading-edge tiles that the 2×2 block would enter
  let tiles: [number, number][]
  if (dir === 0) {
    // RIGHT → check column tx+2, rows ty and ty+1
    tiles = [
      [wrapX(tx + 2, cols), wrapY(ty, rows)],
      [wrapX(tx + 2, cols), wrapY(ty + 1, rows)],
    ]
  } else if (dir === 1) {
    // LEFT → check column tx-1, rows ty and ty+1
    tiles = [
      [wrapX(tx - 1, cols), wrapY(ty, rows)],
      [wrapX(tx - 1, cols), wrapY(ty + 1, rows)],
    ]
  } else if (dir === 2) {
    // UP → check row ty-1, cols tx and tx+1
    tiles = [
      [wrapX(tx, cols), wrapY(ty - 1, rows)],
      [wrapX(tx + 1, cols), wrapY(ty - 1, rows)],
    ]
  } else {
    // DOWN → check row ty+2, cols tx and tx+1
    tiles = [
      [wrapX(tx, cols), wrapY(ty + 2, rows)],
      [wrapX(tx + 1, cols), wrapY(ty + 2, rows)],
    ]
  }

  for (const [cx, cy] of tiles) {
    const t = grid[cy][cx]
    if (t === TILES.WALL) return false
    if (t === TILES.DOOR && !canUseDoor) return false
  }
  return true
}

export class WrapHelper {
  private timer = 0
  active = false

  get threshold() {
    return this.active ? 2 : 1
  }

  trigger() {
    this.active = true
    this.timer = WRAP_DELAY
  }

  /** Returns true while the pause is still ticking (caller should return early). */
  tick(delta: number, host: Entity): boolean {
    if (this.timer <= 0) return false
    this.timer -= delta
    if (this.timer <= 0) {
      this.timer = 0
      host.progress = 0
      const { x: fx, y: fy } = moveFrac(host, 0, true)
      host.sprite.setPosition(fx * CELL + CELL, fy * CELL + CELL)
      host.sprite.setVisible(true)
    }
    return true
  }
}

export function wobble(
  t: number,
  f: [number, number, number],
  p: [number, number, number],
  scale: number,
): number {
  return (
    (Math.sin(t * f[0] + p[0]) * 0.8 +
      Math.sin(t * f[1] + p[1]) * 0.5 +
      Math.sin(t * f[2] + p[2]) * 0.2) *
    scale
  )
}

export function createScrollingBg(
  scene: Phaser.Scene,
  w: number,
  h: number,
  alpha = 0.2,
): {
  bg: Phaser.GameObjects.TileSprite
  bgDisplacement: Phaser.Filters.Displacement | null
} {
  scene.textures.get('background').setFilter(Phaser.Textures.FilterMode.LINEAR)
  const bg = scene.add
    .tileSprite(0, 0, w, h, 'background')
    .setOrigin(0)
    .setAlpha(alpha)
    .setDepth(-1)
  if (!EFFECTS_ENABLED) return { bg, bgDisplacement: null }
  const bgDisplacement = bg
    .enableFilters()
    .filters!.internal.addDisplacement('distort')
  return { bg, bgDisplacement }
}

export function updateScrollingBg(
  bg: Phaser.GameObjects.TileSprite,
  bgDisplacement: Phaser.Filters.Displacement | null,
  time: number,
): void {
  const t = time * 0.00004
  bg.tilePositionX = wobble(t, [0.6, 1.1, 1.9], [0, 0, 0], 220)
  bg.tilePositionY = wobble(t, [0.8, 1.4, 2.3], [0.9, 0.4, 1.8], 220)
  if (bgDisplacement) {
    bgDisplacement.x = wobble(t, [0.7, 1.3, 2.1], [0, 0, 0], 0.15)
    bgDisplacement.y = wobble(t, [0.9, 1.7, 2.5], [1.2, 0.5, 2.0], 0.15)
  }
}
