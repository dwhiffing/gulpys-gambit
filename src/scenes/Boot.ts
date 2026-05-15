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
    this.load.image('background', 'background.png')
    this.load.image('distort', 'noise.png')
    this.load.spritesheet('player', 'player.png', {
      frameWidth: CELL * 2,
      frameHeight: CELL * 2,
    })
    this.load.spritesheet('sprites', 'sprites.png', {
      frameWidth: CELL * 2,
      frameHeight: CELL * 2,
    })
    this.load.spritesheet('tiles', 'tiles2.png', {
      frameWidth: CELL,
      frameHeight: CELL,
    })
    this.load.spritesheet('dots', 'tiles.png', {
      frameWidth: CELL * 2,
      frameHeight: CELL * 2,
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
      tex: string,
      frameIndicies: number[],
      rate: number,
      loop: boolean,
    ) => {
      const frames = a.generateFrameNumbers(tex, { frames: frameIndicies })
      if (!a.exists(key))
        a.create({ key, frames, frameRate: rate, repeat: loop ? -1 : 0 })
    }
    def('player-move', 'player', [0, 1], 6, true)
    def('player-spin', 'player', [6, 7, 8, 9], 11, false)
    def('player-spin-2', 'player', [9, 8, 7, 6], 11, false)
    def('player-flip', 'player', [3], 0, false)
    def('player-die', 'player', [4, 5], 6, true)
    def('fish-1', 'sprites', [0, 1], 2, true)
    def('fish-2', 'sprites', [2, 3], 2, true)
    def('fish-3', 'sprites', [4, 5], 2, true)
    def('fish-4', 'sprites', [6, 7], 2, true)
    def('fish-5', 'sprites', [8, 9], 2, true)
    def('fish-6', 'sprites', [10, 11], 2, true)
  }
}
