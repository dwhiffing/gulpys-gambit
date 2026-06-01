import { Scene } from 'phaser'
import { CELL, TIMER_BASE, TIMER_MAX } from '../constants'
import { NATIVE_H, NATIVE_W } from '../main'
import { Game } from './Game'

// re-exported from constants for local use
const BASE_MAX = TIMER_BASE
const BONUS_MID = 60
const BONUS_TOP = TIMER_MAX
const BAR_H = 8

const LERP = 0.05

export class HUD extends Scene {
  private track!: Phaser.GameObjects.Rectangle
  private bar!: Phaser.GameObjects.Rectangle
  private bonusBar!: Phaser.GameObjects.Rectangle
  private bonusBar2!: Phaser.GameObjects.Rectangle
  private displayTime = BASE_MAX

  constructor() {
    super({ key: 'HUD' })
  }

  create() {
    this.track = this.add.rectangle(0, 0, 0, BAR_H, 0x331155).setOrigin(0, 0)
    this.bar = this.add.rectangle(0, 0, 0, BAR_H, 0x4b0b3b).setOrigin(0, 0)
    this.bonusBar = this.add.rectangle(0, 0, 0, BAR_H, 0xff8800).setOrigin(0, 0)
    this.bonusBar2 = this.add
      .rectangle(0, 0, 0, BAR_H, 0xe4d873)
      .setOrigin(0, 0)
  }

  update() {
    const game = this.scene.get('Game') as Game
    if (!game?.maze || !this.scene.isActive('Game')) {
      this.track.setVisible(false)
      this.bar.setVisible(false)
      this.bonusBar.setVisible(false)
      this.bonusBar2.setVisible(false)
      return
    }

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

    this.track.setVisible(true)
    this.bar.setVisible(true)

    const t = this.displayTime

    // Base layer: 0–30
    const baseRatio = Math.min(t, BASE_MAX) / BASE_MAX
    this.track.setPosition(barX, barY).setSize(mazeW, BAR_H)
    this.bar
      .setPosition(barX, barY)
      .setSize(mazeW * baseRatio, BAR_H)
      .setFillStyle(0x552e78)

    // Bonus layer 1: 30–60 (red-ish)
    const bonus1 = Math.max(0, t - BASE_MAX)
    const bonus1Ratio =
      Math.min(bonus1, BONUS_MID - BASE_MAX) / (BONUS_MID - BASE_MAX)
    this.bonusBar
      .setPosition(barX, barY)
      .setSize(mazeW * bonus1Ratio, BAR_H)
      .setVisible(bonus1 > 0)

    // Bonus layer 2: 60–90 (orange)
    const bonus2 = Math.max(0, t - BONUS_MID)
    const bonus2Ratio =
      Math.min(bonus2, BONUS_TOP - BONUS_MID) / (BONUS_TOP - BONUS_MID)
    this.bonusBar2
      .setPosition(barX, barY)
      .setSize(mazeW * bonus2Ratio, BAR_H)
      .setVisible(bonus2 > 0)
  }
}
