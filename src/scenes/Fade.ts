import * as Phaser from 'phaser'
import { Scene } from 'phaser'

interface FadeData {
  nextScene?: string
  nextSceneData?: object
  stopScene?: string // scene to stop once screen is covered
  restartScene?: string // scene to restart once screen is covered
  restartData?: object
}

const CELL = 40 // px per tile
const STAGGER = 30 // ms delay per step of wave
const DURATION = 300 // ms for each tile to fill in — longer = wider gradient band

export class Fade extends Scene {
  constructor() {
    super({ key: 'Checkerboard', active: false })
  }

  create(data: FadeData) {
    const { width, height } = this.scale.gameSize

    const cols = Math.ceil(width / CELL) + 1
    const rows = Math.ceil(height / CELL) + 1

    type Tile = { rect: Phaser.GameObjects.Rectangle; delay: number }
    const tiles: Tile[] = []

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const parity = (row + col) % 2
        const wave = (row + col) * STAGGER + parity * (STAGGER * 0.5)

        const rect = this.add
          .rectangle(col * CELL, row * CELL, CELL, CELL, 0x110525)
          .setOrigin(0)
          .setAlpha(0)

        tiles.push({ rect, delay: wave })
      }
    }

    const maxWave = (rows + cols) * STAGGER
    const launchAt = maxWave + DURATION

    for (const { rect, delay } of tiles) {
      this.tweens.add({
        targets: rect,
        alpha: 1,
        duration: DURATION,
        delay,
      })
    }

    this.time.delayedCall(launchAt, () => {
      if (data.stopScene) this.scene.stop(data.stopScene)
      if (data.restartScene) this.scene.get(data.restartScene)?.scene.restart(data.restartData)
      else if (data.nextScene)
        this.scene.launch(data.nextScene, data.nextSceneData ?? {})
    })

    this.time.delayedCall(launchAt, () => {
      for (const { rect, delay } of tiles) {
        this.tweens.add({
          targets: rect,
          alpha: 0,
          duration: DURATION,
          delay: (delay / STAGGER) * STAGGER,
        })
      }
    })

    const totalDuration = launchAt + (maxWave / STAGGER) * STAGGER + DURATION
    this.time.delayedCall(totalDuration, () => this.scene.stop())
  }
}
