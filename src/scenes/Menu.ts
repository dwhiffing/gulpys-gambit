import * as Phaser from 'phaser'
import { Scene } from 'phaser'
import { CELL, LETTER_BITMAPS, TILES } from '../constants'
import { NATIVE_H, NATIVE_W } from '../main'
import { buildWallMask, wallFrame } from '../maze'
import { powerDotSound } from '../sounds'
import { createScrollingBg, updateScrollingBg } from '../utils'

const LETTER_H = 5
const LETTER_GAP = 1 // gap between letters

interface GlowEntry {
  img: Phaser.GameObjects.Image
  phase: number
}

export class Menu extends Scene {
  private bg!: Phaser.GameObjects.TileSprite
  private bgDisplacement!: Phaser.Filters.Displacement
  private glowSprites: GlowEntry[] = []

  constructor() {
    super('Menu')
  }

  create(data?: { lastLevel?: number }) {
    this.glowSprites = []
    this.createLetterMaze()

    const isMobile = this.sys.game.device.input.touch

    if (data?.lastLevel) {
      const prev = parseInt(localStorage.getItem('topLevel') ?? '0', 10)
      if (data.lastLevel > prev) {
        localStorage.setItem('topLevel', String(data.lastLevel))
      }
    }
    const topLevel = parseInt(localStorage.getItem('topLevel') ?? '0', 10)

    const label = topLevel
      ? `TOP LEVEL: ${topLevel}`
      : isMobile
        ? 'TAP TO START'
        : 'PRESS Z TO START'

    const startText = this.add
      .text(NATIVE_W / 2, NATIVE_H - 90, label, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#7294d6',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(2)

    if (!topLevel) {
      this.tweens.add({
        targets: startText,
        alpha: { from: 0, to: 0.7 },
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    let transitioning = true
    this.time.delayedCall(1000, () => (transitioning = false))
    const startGame = () => {
      if (transitioning) return
      transitioning = true
      powerDotSound(new AudioContext())
      this.scene.launch('Checkerboard', {
        nextScene: 'Game',
        stopScene: 'Menu',
      })
    }

    this.input.keyboard!.on('keydown-Z', startGame)
    this.input.on('pointerdown', startGame)

    ;({ bg: this.bg, bgDisplacement: this.bgDisplacement } = createScrollingBg(
      this,
      NATIVE_W,
      NATIVE_H,
      0.1,
    ))
  }

  private createLetterMaze() {
    const cols = 35
    const rows = 43

    // Start all WALL
    const grid: number[][] = Array.from({ length: rows }, () =>
      Array(cols).fill(TILES.WALL),
    )

    // Place a word into the grid at (startX, startY) by carving letter pixels as POWER
    const placeWord = (word: string, startX: number, startY: number) => {
      let ox = startX
      for (const ch of word) {
        const bitmap = LETTER_BITMAPS[ch]
        if (!bitmap) continue
        const w = bitmap[0].length
        for (let dy = 0; dy < LETTER_H; dy++) {
          for (let dx = 0; dx < w; dx++) {
            if (bitmap[dy][dx]) {
              const gx = ox + dx
              const gy = startY + dy
              if (gx > 0 && gx < cols - 1 && gy > 0 && gy < rows - 1) {
                grid[gy][gx] = TILES.POWER
              }
            }
          }
        }
        ox += w + LETTER_GAP
      }
    }

    const line1 = "GULPY'S"
    const line2 = 'GAMBIT'
    const startY1 = 15
    const startY2 = startY1 + 8

    const startX1 = Math.floor((cols - wordWidth(line1)) / 2)
    const startX2 = Math.floor((cols - wordWidth(line2)) / 2)

    const placeLine = (y: number) => {
      for (let x = 0; x < cols; x++) {
        if (y > 0 && y < rows - 1) {
          grid[y][x] = TILES.EMPTY
        }
      }
    }

    const carvePattern = (topLine: number, bottomLine: number) => {
      placeLine(topLine)
      placeLine(bottomLine)
      for (let y = topLine + 1; y < bottomLine; y++) {
        for (let x = 0; x < cols; x++) {
          grid[y][x] = TILES.EMPTY
        }
      }
    }

    carvePattern(startY1 - 16, startY1 - 5)
    placeWord(line1, startX1, startY1)
    placeWord(line2, startX2, startY2)
    carvePattern(startY2 + LETTER_H + 4, startY2 + LETTER_H + 15)

    // Render wall sprites using the same bitmask logic as the game maze
    const isWall = (tx: number, ty: number) =>
      tx < 0 ||
      tx >= cols ||
      ty < 0 ||
      ty >= rows ||
      grid[ty][tx] === TILES.WALL

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] === TILES.POWER) {
          const px = x * CELL + CELL / 2
          const py = y * CELL + CELL / 2
          this.add.sprite(px, py, 'dots', 3).setDepth(1).setAlpha(1)
          const img = this.add
            .image(px, py, 'power-glow')
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(0)
          this.glowSprites.push({ img, phase: (px + py) / CELL / 7 })
        }
        if (grid[y][x] !== TILES.WALL) continue
        const px = x * CELL + CELL / 2
        const py = y * CELL + CELL / 2
        const frame = wallFrame(buildWallMask(isWall, x, y))
        this.add.sprite(px, py, 'tiles', frame)
      }
    }
  }

  update(_time: number) {
    const speed = 0.002
    for (const { img, phase } of this.glowSprites) {
      const t = Math.cos(_time * speed - phase) * 0.5 + 0.5
      img.setAlpha(0.05 + t ** 1.5 * 0.85)
    }

    updateScrollingBg(this.bg, this.bgDisplacement, _time)
  }
}

const wordWidth = (word: string) =>
  word.split('').reduce((acc, ch, i) => {
    const w = LETTER_BITMAPS[ch]?.[0].length ?? 0
    return acc + w + (i < word.length - 1 ? LETTER_GAP : 0)
  }, 0)
