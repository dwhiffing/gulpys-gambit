import type { Types } from 'phaser'
import * as Phaser from 'phaser'
import { Scene } from 'phaser'
import {
  CELL,
  DEBUG_SKIP_LEVEL,
  TILES,
  TIMER_BASE,
  TIMER_MAX,
  TIMER_PER_DOT,
  TIMESCALE,
} from '../constants'
import { Maze } from '../maze'
import { getMazeConfig } from '../mazeConfig'
import { GhostSprite } from '../sprites/GhostSprite'
import { PlayerSprite } from '../sprites/PlayerSprite'
import { createScrollingBg, updateScrollingBg } from '../utils'

export class Game extends Scene {
  maze!: Maze
  player!: PlayerSprite
  private ghosts!: GhostSprite[]
  private ghostGroup!: Phaser.Physics.Arcade.Group
  mineGroup!: Phaser.Physics.Arcade.StaticGroup
  private cursors!: Types.Input.Keyboard.CursorKeys
  private bg!: Phaser.GameObjects.TileSprite
  private bgDisplacement!: Phaser.Filters.Displacement | null
  private gameState: 'playing' | 'dying' | 'won' = 'playing'
  private stunTimer: Phaser.Time.TimerEvent | null = null
  timeLeft = TIMER_BASE
  private level = 1
  private eatenDots: string[] = []
  private runSeed = 0
  gameScale = 1

  constructor() {
    super('Game')
  }

  create(data?: { level?: number; timeLeft?: number; eatenDots?: string[]; runSeed?: number }) {
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.keyboard!.on('keydown-N', () => {
      if (!DEBUG_SKIP_LEVEL) return
      if (this.gameState !== 'playing') return
      this.gameState = 'won'
      this.maze.hideAllGlows()
      this.player.playBeatLevelSound()
      for (const g of this.ghosts) g.stop()
      this.scene.launch('Checkerboard', {
        restartScene: 'Game',
        restartData: {
          level: this.level + 1,
          timeLeft: Math.min(TIMER_MAX, this.timeLeft + 15),
          runSeed: this.runSeed,
        },
      })
    })
    this.gameState = 'playing'
    this.timeLeft = data?.timeLeft ?? TIMER_BASE
    this.eatenDots = data?.eatenDots ?? []
    this.runSeed = data?.runSeed ?? Math.floor(Math.random() * 2147483647)

    this.level = data?.level ?? 1
    const level = this.level
    const config = getMazeConfig(level)
    config.seed = this.runSeed + level * 2654435761
    for (let attempt = 0; ; attempt++) {
      try {
        this.maze = new Maze(this, { ...config, seed: config.seed + attempt * 997 })
        break
      } catch {
        if (attempt > 50) throw new Error('Failed to generate maze')
      }
    }

    const mazeW = this.maze.cols * CELL
    const mazeH = this.maze.rows * CELL
    const { width, height } = this.scale.gameSize
    this.gameScale = Math.min(width / (mazeW + CELL), height / (mazeH + CELL))
    if (this.gameScale > 2) this.gameScale = 2
    else if (this.gameScale < 1.5) this.gameScale = 1
    else this.gameScale = 1.5

    // Remove previously eaten dots on restart
    const eatenSet = new Set(this.eatenDots)
    if (eatenSet.size > 0) {
      for (const dot of this.maze.dotGroup.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
        if (eatenSet.has(`${dot.x},${dot.y}`)) {
          dot.disableBody(true, true)
        }
      }
    }

    this.createBackground(mazeW, mazeH)

    this.player = new PlayerSprite(this)

    this.mineGroup = this.physics.add.staticGroup()

    this.ghostGroup = this.physics.add.group()
    this.ghosts = this.maze.spawners.map((spawner, i) => {
      const g = new GhostSprite(this, spawner, i)
      this.ghostGroup.add(g.sprite)
      return g
    })

    // Dot overlap — fires every frame the player body touches an active dot body
    this.physics.add.overlap(
      this.player.sprite,
      this.maze.dotGroup,
      (_player, dot) => {
        const d = dot as Phaser.Physics.Arcade.Sprite
        this.eatenDots.push(`${d.x},${d.y}`)
        d.disableBody(true, true)
        if (Number(d.frame.name) === TILES.POWER) {
          this.player.collectPowerDot(d.x, d.y)
        } else {
          this.player.collectDot()
        }
        this.timeLeft = Math.min(TIMER_MAX, this.timeLeft + TIMER_PER_DOT)

        if (this.maze.dotGroup.countActive() === 0) {
          this.maze.hideAllGlows()
          this.gameState = 'won'
          // Bonus time for unprocessed dots still in the eat trail
          this.timeLeft = Math.min(
            TIMER_MAX,
            this.timeLeft + this.player.dotQueue * 2,
          )
          this.player.dotQueue = 0
          this.player.playBeatLevelSound()
          for (const g of this.ghosts) g.stop()
          this.scene.launch('Checkerboard', {
            restartScene: 'Game',
            restartData: { level: level + 1, timeLeft: this.timeLeft, runSeed: this.runSeed },
          })
        }
      },
    )

    // Mine overlap — mark hit, stun fires on next tile cross
    this.physics.add.overlap(
      this.player.sprite,
      this.mineGroup,
      (_player, mine) => {
        ;(mine as Phaser.Physics.Arcade.Sprite)
          .disableBody(true, true)
          .setVisible(false)
        this.player.pendingStun = true
      },
      () => this.gameState === 'playing',
    )

    this.player.onTileCross = () => {
      if (this.player.pendingStun) {
        this.player.pendingStun = false
        this.stunPlayer()
      }
    }

    // Ghost overlap — process callback filters out states that don't collide
    this.physics.add.overlap(
      this.player.sprite,
      this.ghostGroup,
      (_player, _ghostSprite) => {
        this.killPlayer()
      },
      (_player, _ghostSprite) => {
        if (this.gameState !== 'playing') return false
        return true
      },
    )
    this.scene.launch('HUD')

    this.tweens.timeScale = TIMESCALE
    this.anims.globalTimeScale = TIMESCALE
    const antialias = !Number.isInteger(this.gameScale)
    this.game.events.once(Phaser.Core.Events.POST_RENDER, () =>
      this.setAntialias(antialias),
    )
  }

  private createBackground(mazeW: number, mazeH: number) {
    const { width, height } = this.scale.gameSize
    const z = this.gameScale
    this.cameras.main.setZoom(z).centerOn(mazeW / 2, mazeH / 2)

    const visW = width / z
    const visH = height / z
    const worldLeft = mazeW / 2 - visW / 2
    const worldTop = mazeH / 2 - visH / 2
    const borderDepth = 100
    const addBorder = (x: number, y: number, w: number, h: number) =>
      this.add
        .rectangle(x, y, w, h, 0x110525)
        .setOrigin(0)
        .setDepth(borderDepth)
    if (worldLeft < 0) {
      addBorder(worldLeft, worldTop, -worldLeft, visH)
      addBorder(mazeW, worldTop, -worldLeft, visH)
    }
    if (worldTop < 0) {
      addBorder(worldLeft, worldTop, visW, -worldTop)
      addBorder(worldLeft, mazeH, visW, -worldTop)
    }

    ;({ bg: this.bg, bgDisplacement: this.bgDisplacement } = createScrollingBg(
      this,
      mazeW,
      mazeH,
    ))
  }

  update(_time: number, delta: number) {
    if (this.gameState !== 'playing') return

    updateScrollingBg(this.bg, this.bgDisplacement, _time)

    this.timeLeft -= (delta / 1000) * TIMESCALE
    if (this.timeLeft <= 0) {
      this.timeLeft = 0
      this.killPlayer(true)
      return
    }

    this.maze.updateGlow(_time)
    const scaledDelta = delta * TIMESCALE
    for (const g of this.ghosts) g.update(scaledDelta)
    this.player.update(scaledDelta, this.cursors)
  }

  dropMine(tileX: number, tileY: number, lifetime?: number) {
    const px = tileX * CELL + CELL
    const py = tileY * CELL + CELL
    const occupied = (
      this.mineGroup.getChildren() as Phaser.Physics.Arcade.Sprite[]
    ).some((m) => m.active && m.x === px && m.y === py)
    if (occupied) return
    const mine = this.mineGroup.create(
      px,
      py,
      'dots',
      0,
    ) as Phaser.Physics.Arcade.Sprite
    mine.setDepth(1)
    mine.body!.setCircle(CELL * 0.4, CELL * 0.6, CELL * 0.6)
    this.mineGroup.refresh()

    if (lifetime) {
      const blinkDelay = Math.max(0, lifetime - 2000)
      this.time.delayedCall(blinkDelay, () => {
        if (!mine.active) return
        this.tweens.add({
          targets: mine,
          alpha: 0.2,
          duration: 400,
          yoyo: true,
          repeat: -1,
        })
      })
      this.time.delayedCall(lifetime, () => {
        if (!mine.active) return
        this.tweens.killTweensOf(mine).add({
          targets: mine,
          alpha: 0,
          duration: 400,
        })
        mine.disableBody(true)
      })
    }
  }

  setAntialias(enabled: boolean) {
    const renderer = this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer
    const gl = renderer.gl
    const glFilter = enabled ? gl.LINEAR : gl.NEAREST
    // scaleMode 0 = LINEAR, 1 = NEAREST — must update so Phaser doesn't override on rebind
    const scaleMode = enabled ? 0 : 1
    const skip = new Set(['distort', 'background'])
    let needsRetry = false
    Object.entries(this.textures.list).forEach(([key, texture]) => {
      if (skip.has(key)) return
      texture.source.forEach((source: Phaser.Textures.TextureSource) => {
        source.scaleMode = scaleMode
        const glTex = source.glTexture?.webGLTexture
        if (glTex) {
          gl.bindTexture(gl.TEXTURE_2D, glTex)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, glFilter)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, glFilter)
        } else {
          needsRetry = true
        }
      })
    })
    // Some textures may not be on the GPU yet — retry next frame until all are updated
    if (needsRetry) {
      this.game.events.once(Phaser.Core.Events.POST_RENDER, () =>
        this.setAntialias(enabled),
      )
    }
    this.cameras.main.setRoundPixels(!enabled)
    this.game.canvas.style.imageRendering = enabled ? 'auto' : 'pixelated'
  }

  private stunPlayer() {
    if (this.gameState !== 'playing') return
    this.stunTimer?.remove()
    this.player.stun()
    this.stunTimer = this.time.delayedCall(1500, () => this.player.unstun())
  }

  private killPlayer(timeout = false) {
    this.gameState = 'dying'
    if (timeout) this.player.playTimeOutSound()
    this.player.die()
    for (const g of this.ghosts) g.stop()
    this.time.delayedCall(1000, () => {
      if (timeout || this.timeLeft - 15 <= 0) {
        this.scene.launch('Checkerboard', {
          stopScene: 'Game',
          nextScene: 'Menu',
          nextSceneData: { lastLevel: this.level },
        })
      } else {
        this.scene.launch('Checkerboard', {
          restartScene: 'Game',
          restartData: {
            level: this.level,
            timeLeft: this.timeLeft - 15,
            eatenDots: this.eatenDots,
            runSeed: this.runSeed,
          },
        })
      }
    })
  }
}
