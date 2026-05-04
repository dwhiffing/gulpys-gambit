import { Scene } from 'phaser'

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
    this.load.spritesheet('sprites', 'placeholders.png', {
      frameWidth: 16,
      frameHeight: 16,
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
      frames: number[],
      rate: number,
      loop: boolean,
    ) => {
      if (!a.exists(key))
        a.create({
          key,
          frames: a.generateFrameNumbers('sprites', { frames }),
          frameRate: rate,
          repeat: loop ? -1 : 0,
        })
    }
    def('player-move', [0, 1, 2, 1], 10, true)
    def('player-die', [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], 10, false)
    def('ghost-right', [14, 15], 6, true)
    def('ghost-left', [16, 17], 6, true)
    def('ghost-up', [18, 19], 6, true)
    def('ghost-down', [20, 21], 6, true)
    def('ghost-scared', [22, 23], 6, true)
  }
}
