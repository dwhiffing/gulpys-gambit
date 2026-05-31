import { Scene } from 'phaser'
import { CELL, TIMER_BASE, TIMER_MAX } from '../constants'
import { NATIVE_H, NATIVE_W } from '../main'
import { Game } from './Game'

// re-exported from constants for local use
const BASE_MAX = TIMER_BASE
const BONUS_MAX = TIMER_MAX
const BAR_H = 8

const LERP = 0.05

export class HUD extends Scene {
  private track!: Phaser.GameObjects.Rectangle
  private bar!: Phaser.GameObjects.Rectangle
  private bonusBar!: Phaser.GameObjects.Rectangle
  private displayTime = BASE_MAX

  constructor() {
    super({ key: 'HUD' })
  }

  create() {
    this.track = this.add.rectangle(0, 0, 0, BAR_H, 0x331155).setOrigin(0, 0)
    this.bar = this.add.rectangle(0, 0, 0, BAR_H, 0x552e78).setOrigin(0, 0)
    this.bonusBar = this.add.rectangle(0, 0, 0, BAR_H, 0xff8800).setOrigin(0, 0)
  }

  update() {
    const game = this.scene.get('Game') as Game
    if (!game?.maze) return

    const actual = Math.max(0, game.timeLeft)
    // Only lerp upward (dot pickups); let countdown track directly so it doesn't lag behind
    if (actual > this.displayTime) {
      this.displayTime += (actual - this.displayTime) * LERP
    } else {
      this.displayTime = actual
    }

    const mazeW = game.maze.cols * CELL * game.gameScale
    const barX = NATIVE_W / 2 - mazeW / 2
    const barY = NATIVE_H - BAR_H

    const t = this.displayTime

    // Base layer: 0–60
    const baseRatio = Math.min(t, BASE_MAX) / BASE_MAX
    const baseColor = 0x552e78
    this.track.setPosition(barX, barY).setSize(mazeW, BAR_H)
    this.bar
      .setPosition(barX, barY)
      .setSize(mazeW * baseRatio, BAR_H)
      .setFillStyle(baseColor)

    // Bonus layer: 60–120, drawn on top
    const bonus = Math.max(0, t - BASE_MAX)
    const bonusRatio = Math.min(bonus, BONUS_MAX - BASE_MAX) / (BONUS_MAX - BASE_MAX)
    this.bonusBar
      .setPosition(barX, barY)
      .setSize(mazeW * bonusRatio, BAR_H)
      .setVisible(bonus > 0)
  }
}
