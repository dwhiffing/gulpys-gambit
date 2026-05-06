import { Scene } from 'phaser'
import { CELL } from '../constants'

export class Boot extends Scene {
  constructor() {
    super('Boot')
  }

  init() {
    const { width, height } = this.cameras.main
    const cx = width / 2
    const cy = height / 2
    const trackW = width * 0.9
    const trackH = 32

    const bar = this.add.rectangle(cx - trackW / 2, cy, 4, trackH - 4, 0xffffff)

    this.load.on('progress', (progress: number) => {
      bar.width = 4 + (trackW - 4) * progress
    })
  }

  preload() {
    this.load.setPath('assets')
    this.load.spritesheet('sprites', 'sprites.png', {
      frameWidth: CELL,
      frameHeight: CELL,
    })
    this.load.spritesheet('tiles', 'tiles.png', {
      frameWidth: CELL,
      frameHeight: CELL,
    })
  }

  create() {
    this.createAnimations()
    this.scene.start('Game')
  }

  private createAnimations() {
    const a = this.anims
    const def = (
      key: string,
      textureKey: string,
      frames: number[],
      rate: number,
      loop: boolean,
    ) => {
      if (!a.exists(key))
        a.create({
          key,
          frames: a.generateFrameNumbers(textureKey, { frames }),
          frameRate: rate,
          repeat: loop ? -1 : 0,
        })
    }
    def('player-move', 'sprites', [6, 7], 6, true)
    def('player-spin', 'sprites', [8], 0, false)
    def('player-flip', 'sprites', [9], 0, false)
    def('player-die', 'sprites', [10, 11], 6, true)
    def('fish-1', 'sprites', [0, 1], 2, true)
    def('fish-2', 'sprites', [2, 3], 2, true)
    def('fish-3', 'sprites', [4, 5], 2, true)
    def('fish-4', 'sprites', [12, 13], 2, true)
    def('fish-5', 'sprites', [14, 15], 2, true)
    def('fish-6', 'sprites', [16, 17], 2, true)
  }
}
