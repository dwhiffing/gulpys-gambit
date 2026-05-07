import { DX, DY, TILES } from './constants'

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

export function moveFrac(
  tileX: number,
  tileY: number,
  dir: number,
  progress: number,
  cols: number,
  rows: number,
  useEntry = false,
): { x: number; y: number } {
  if ((isWrapping(tileX, tileY, dir, cols, rows) && progress >= 1) || useEntry) {
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

export function stepTile(
  grid: number[][],
  x: number,
  y: number,
  dir: number,
): { x: number; y: number } {
  return {
    x: wrapX(x + DX[dir], grid[0].length),
    y: wrapY(y + DY[dir], grid.length),
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

/** Generate N visually distinct colors by spacing hues evenly around the HSL wheel. */
export function generateGhostColors(n: number): [number, number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const h = (i / n) * 360
    // HSL(h, 100%, 60%) → RGB via CSS
    const ch = `hsl(${h},100%,60%)`
    const ctx = document.createElement('canvas').getContext('2d')!
    ctx.fillStyle = ch
    const hex = ctx.fillStyle as string // browser normalises to #rrggbb
    const v = parseInt(hex.slice(1), 16)
    return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]
  })
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
