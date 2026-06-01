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

    this.load.audio('music', 'game-dream.mp3')
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
    this.createGlowTextures()
    this.createNoiseTexture()

    const MUTE_KEY = 'gulpy-mute'
    const states = ['all', 'sfx', 'mute'] as const
    type MuteState = (typeof states)[number]

    const saved = localStorage.getItem(MUTE_KEY) as MuteState | null
    let stateIndex = Math.max(0, states.indexOf(saved as MuteState))

    const soundManager = this.sound
    const music = soundManager.add('music', { loop: true })

    const applyState = (state: MuteState) => {
      if (state === 'all') {
        soundManager.mute = false
        music.setMute(false)
      } else if (state === 'sfx') {
        soundManager.mute = false
        music.setMute(true)
      } else {
        soundManager.mute = true
      }
    }

    applyState(states[stateIndex])
    music.play({ volume: 0.05 })

    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() !== 'm') return
      stateIndex = (stateIndex + 1) % states.length
      const state = states[stateIndex]
      localStorage.setItem(MUTE_KEY, state)
      applyState(state)
    })

    // this.scene.start('Game')
    this.scene.launch('Checkerboard', {
      nextScene: 'Menu',
      stopScene: 'Boot',
    })
  }

  private createNoiseTexture() {
    const size = 512
    const canvas = this.textures.createCanvas('distort', size, size)!
    const ctx = canvas.getContext()
    const imageData = ctx.createImageData(size, size)

    // Build a grid of random values for each octave
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

    const smoothNoise = (
      grid: number[][],
      gSize: number,
      x: number,
      y: number,
    ) => {
      const gx = (x / size) * gSize
      const gy = (y / size) * gSize
      const x0 = Math.floor(gx) % gSize
      const y0 = Math.floor(gy) % gSize
      const x1 = (x0 + 1) % gSize
      const y1 = (y0 + 1) % gSize
      const tx = fade(gx - Math.floor(gx))
      const ty = fade(gy - Math.floor(gy))
      return lerp(
        lerp(grid[y0][x0], grid[y0][x1], tx),
        lerp(grid[y1][x0], grid[y1][x1], tx),
        ty,
      )
    }

    const octaves = [
      { freq: 2, amp: 0.5 },
      { freq: 4, amp: 0.25 },
      { freq: 8, amp: 0.125 },
      { freq: 16, amp: 0.0625 },
      { freq: 32, amp: 0.03125 },
    ]

    const grids = octaves.map(({ freq }) => {
      return Array.from({ length: freq }, () =>
        Array.from({ length: freq }, () => Math.random()),
      )
    })

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let v = 0
        for (let i = 0; i < octaves.length; i++) {
          v += smoothNoise(grids[i], octaves[i].freq, x, y) * octaves[i].amp
        }
        const c = Math.round(v * 255)
        const idx = (y * size + x) * 4
        imageData.data[idx] = c
        imageData.data[idx + 1] = c
        imageData.data[idx + 2] = c
        imageData.data[idx + 3] = 255
      }
    }

    ctx.putImageData(imageData, 0, 0)
    canvas.refresh()
  }

  private createGlowTextures() {
    for (const [key, radius, color] of [
      ['dot-glow', CELL * 0.6, 0xaa7711],
      ['power-glow', CELL * 0.9, 0xdd8800],
    ] as [string, number, number][]) {
      const size = Math.ceil(radius * 2)
      const g = this.make.graphics({ x: 0, y: 0 }, false)
      const steps = 20
      for (let i = steps; i >= 1; i--) {
        const r = (i / steps) * radius
        const a = (1 - i / steps) * 0.2
        g.fillStyle(color, a).fillCircle(size / 2, size / 2, r)
      }
      g.generateTexture(key, size, size).destroy()
    }
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
