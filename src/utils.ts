import { Scene } from 'phaser'
import { CELL, DX, DY, TILES } from './constants'

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

export function canMove(
  grid: number[][],
  tx: number,
  ty: number,
  dir: number,
  canUseDoor: boolean,
): boolean {
  const rows = grid.length
  const cols = grid[0].length
  const ny = wrapY(ty + DY[dir], rows)
  const nx = wrapX(tx + DX[dir], cols)
  const t = grid[ny][nx]
  if (t === TILES.WALL) return false
  if (t === TILES.DOOR && !canUseDoor) return false
  return true
}

export const snapOdd = (n: number) => (n % 2 === 0 ? n - 1 : n)

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

export function createColoredGhostTexture(
  scene: Scene,
  sourceKey: string,
  destKey: string,
  color: [number, number, number],
) {
  const source = scene.textures.get(sourceKey).source[0]
  const img = source.image as HTMLImageElement | HTMLCanvasElement
  const canvas = document.createElement('canvas')
  canvas.width = (img as HTMLImageElement).naturalWidth || img.width
  canvas.height = (img as HTMLImageElement).naturalHeight || img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img as CanvasImageSource, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2]
    // Match the red ghost body: high R, low G, low B
    if (r > 180 && g < 100 && b < 100) {
      data[i] = color[0]
      data[i + 1] = color[1]
      data[i + 2] = color[2]
    }
  }
  ctx.putImageData(imageData, 0, 0)
  // addSpriteSheet types don't include HTMLCanvasElement but Phaser supports it at runtime
  scene.textures.addSpriteSheet(
    destKey,
    canvas as unknown as HTMLImageElement,
    { frameWidth: CELL, frameHeight: CELL },
  )
}

// export const buildZoomSteps = (
//   min: number,
//   max: number,
//   intermediateSteps: number,
// ) => {
//   const minExp = Math.log2(min)
//   const maxExp = Math.log2(max)
//   const powers: number[] = []
//   for (let e = minExp; e <= maxExp; e++) {
//     powers.push(2 ** e)
//   }
//   if (intermediateSteps === 0) return powers
//   const result: number[] = []
//   for (let i = 0; i < powers.length - 1; i++) {
//     result.push(powers[i])
//     for (let j = 1; j <= intermediateSteps; j++) {
//       result.push(powers[i] * 2 ** (j / (intermediateSteps + 1)))
//     }
//   }
//   result.push(powers[powers.length - 1])
//   return result
// }

// const ZOOM_STEPS = buildZoomSteps(0.125, 4, 2)
export const calcZoom = (w: number, h: number) => {
  const raw = Math.min(window.innerWidth / w, window.innerHeight / h)
  return raw
  // const filtered = ZOOM_STEPS.filter((z) => z <= raw)
  // return filtered.length ? filtered[filtered.length - 1] : ZOOM_STEPS[0]
}
