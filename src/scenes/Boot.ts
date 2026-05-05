import { Scene } from 'phaser'
import { CELL } from '../constants'
import { GHOST_COLORS } from '../mazeConfig'
import { createColoredGhostTexture } from '../utils'

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
    this.load.spritesheet('sprites', 'placeholders-32.png', {
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
    def('player-move', 'sprites', [0, 1, 2, 1], 10, true)
    def(
      'player-die',
      'sprites',
      [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      10,
      false,
    )

    GHOST_COLORS.forEach((color, i) => {
      const tk = `sprites-ghost-${i}`
      createColoredGhostTexture(this, 'sprites', tk, color)
      def(`ghost-${i}-right`, tk, [14, 15], 6, true)
      def(`ghost-${i}-left`, tk, [16, 17], 6, true)
      def(`ghost-${i}-up`, tk, [18, 19], 6, true)
      def(`ghost-${i}-down`, tk, [20, 21], 6, true)
      def(`ghost-${i}-scared`, tk, [22, 23], 6, true)
    })
  }
}
