import type * as Phaser from 'phaser'
import * as C from './constants'
import type { TilePos } from './maze'
import { GHOST_COLORS } from './mazeConfig'

interface GhostDebugHost {
  debugLine: Phaser.GameObjects.Graphics | null
  colorIndex: number
  dir: number
  x: number
  y: number
  cols: number
  rows: number
}

export function drawGhostDebugLine(
  ghost: GhostDebugHost,
  target: TilePos,
  path: TilePos[],
) {
  const { debugLine, colorIndex, dir, x, y, cols, rows } = ghost
  if (!debugLine) return
  const [r, g, b] = GHOST_COLORS[colorIndex]
  const color = (r << 16) | (g << 8) | b
  // Spread 4 ghosts evenly: -3, -1, +1, +3 pixels from center
  const perpOffset = colorIndex * 2 - 3

  debugLine.clear()
  debugLine.lineStyle(2, color, 0.8)
  debugLine.strokeRect(
    target.x * C.CELL + 1,
    target.y * C.CELL + 1,
    C.CELL * 2 - 2,
    C.CELL * 2 - 2,
  )
  if (path.length < 2) return
  debugLine.lineStyle(3, color, 0.8)

  // Helper: tile → pixel center with perpendicular offset based on segment direction
  const toPx = (tile: TilePos, segDx: number, segDy: number) => {
    const ndx = segDx === 0 ? 0 : segDx > 0 ? 1 : -1
    const ndy = segDy === 0 ? 0 : segDy > 0 ? 1 : -1
    return [
      tile.x * C.CELL + C.CELL + -ndy * perpOffset,
      tile.y * C.CELL + C.CELL + ndx * perpOffset,
    ]
  }

  // Walk segments; when a wrap is detected, stroke up to the edge, then resume
  // from the matching edge on the other side.
  const startOx = C.DY[dir] * perpOffset
  const startOy = C.DX[dir] * -perpOffset
  let curX = x + startOx
  let curY = y + startOy

  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x
    const dy = path[i].y - path[i - 1].y
    const wraps = Math.abs(dx) > 1 || Math.abs(dy) > 1

    // When wrapping, the tile delta sign is inverted relative to actual movement direction
    // (e.g. moving left from x=0 lands at x=cols-1, giving dx=cols-1 which looks rightward)
    const actualNdx =
      dx === 0 ? 0 : wraps ? (dx > 0 ? -1 : 1) : dx > 0 ? 1 : -1
    const actualNdy =
      dy === 0 ? 0 : wraps ? (dy > 0 ? -1 : 1) : dy > 0 ? 1 : -1
    const [nextX, nextY] = toPx(path[i], actualNdx, actualNdy)

    if (wraps) {
      const ox = -actualNdy * perpOffset
      const oy = actualNdx * perpOffset
      // Exit pixel: on the grid boundary in the actual movement direction
      const exitX =
        dx !== 0
          ? (actualNdx < 0 ? 0 : cols * C.CELL) + ox
          : path[i - 1].x * C.CELL + C.CELL + ox
      const exitY =
        dy !== 0
          ? (actualNdy < 0 ? 0 : rows * C.CELL) + oy
          : path[i - 1].y * C.CELL + C.CELL + oy
      // Entry pixel: opposite boundary
      const entryX =
        dx !== 0 ? (actualNdx < 0 ? cols * C.CELL : 0) + ox : exitX
      const entryY =
        dy !== 0 ? (actualNdy < 0 ? rows * C.CELL : 0) + oy : exitY

      debugLine.beginPath()
      debugLine.moveTo(curX, curY)
      debugLine.lineTo(exitX, exitY)
      debugLine.strokePath()

      curX = entryX
      curY = entryY
    }

    debugLine.beginPath()
    debugLine.moveTo(curX, curY)
    debugLine.lineTo(nextX, nextY)
    debugLine.strokePath()
    curX = nextX
    curY = nextY
  }
}
