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
    this.scene.launch('Checkerboard', {
      nextScene: 'Menu',
      stopScene: 'Boot',
    })
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
    def('player-spin', 'player', [6, 7, 8, 9], 20, false)
    def('player-spin-2', 'player', [9, 8, 7, 6], 20, false)
    def('player-flip', 'player', [3], 0, false)
    def('player-die', 'player', [4, 5], 6, true)
    def('fish-naut', 'sprites', [0, 1], 2, true)
    def('fish-teeth1', 'sprites', [2, 3], 2, true)
    def('fish-angler1', 'sprites', [4, 5], 2, true)
    def('fish-oct', 'sprites', [6, 7], 2, true)
    def('fish-blob', 'sprites', [8, 9], 2, true)
    def('fish-roach', 'sprites', [10, 11], 2, true)
    def('fish-teeth2', 'sprites', [12, 13], 2, true)
    def('fish-teeth3', 'sprites', [14, 15], 2, true)
    def('fish-angler2', 'sprites', [16, 17], 2, true)
    def('fish-turtle', 'sprites', [18, 19], 2, true)
  }
}
