import { CELL, DX, DY, TILES, WRAP_DELAY } from './constants'

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

export const buildZoomSteps = (
  min: number,
  max: number,
  intermediateSteps: number,
) => {
  const minExp = Math.log2(min)
  const maxExp = Math.log2(max)
  const powers: number[] = []
  for (let e = minExp; e <= maxExp; e++) {
    powers.push(2 ** e)
  }
  if (intermediateSteps === 0) return powers
  const result: number[] = []
  for (let i = 0; i < powers.length - 1; i++) {
    result.push(powers[i])
    for (let j = 1; j <= intermediateSteps; j++) {
      result.push(powers[i] * 2 ** (j / (intermediateSteps + 1)))
    }
  }
  result.push(powers[powers.length - 1])
  return result
}

const ZOOM_STEPS = buildZoomSteps(1, 4, 1)
export const calcZoom = (w: number, h: number) => {
  const raw = Math.min(window.innerWidth / w, window.innerHeight / h)
  // return raw
  const filtered = ZOOM_STEPS.filter((z) => z <= raw)
  return filtered.length ? filtered[filtered.length - 1] : ZOOM_STEPS[0]
}
