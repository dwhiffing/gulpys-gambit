import { COLS, DX, DY, ROWS, TILES } from './constants'

export function wrapX(x: number): number {
  if (x < 0) return COLS - 1
  if (x >= COLS) return 0
  return x
}

export function canMove(
  grid: number[][],
  tx: number,
  ty: number,
  dir: number,
  canUseDoor: boolean,
): boolean {
  const ny = ty + DY[dir]
  if (ny < 0 || ny >= ROWS) return false
  const nx = wrapX(tx + DX[dir])
  const t = grid[ny][nx]
  if (t === TILES.WALL) return false
  if (t === TILES.DOOR && !canUseDoor) return false
  return true
}
