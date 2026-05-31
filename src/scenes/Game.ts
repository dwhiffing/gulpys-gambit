import type { Types } from 'phaser'
import * as Phaser from 'phaser'
import { Scene } from 'phaser'
import { CELL, TIMESCALE } from '../constants'
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
  private bgDisplacement!: Phaser.Filters.Displacement
  private gameState: 'playing' | 'dying' | 'won' = 'playing'

  constructor() {
    super('Game')
  }

  create(data?: { level?: number }) {
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.gameState = 'playing'

    const level = data?.level ?? 1
    this.maze = new Maze(this, getMazeConfig(level))

    const mazeW = this.maze.cols * CELL
    const mazeH = this.maze.rows * CELL

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
        d.disableBody(true, true)
        this.player.collectDot()

        if (this.maze.dotGroup.countActive() === 0) {
          this.maze.hideAllGlows()
          this.gameState = 'won'
          for (const g of this.ghosts) g.stop()
          this.time.delayedCall(1000, () =>
            this.scene.launch('Checkerboard', {
              restartScene: 'Game',
              restartData: { level: level + 1 },
            }),
          )
        }
      },
    )

    // Mine overlap — player steps on a dropped mine
    this.physics.add.overlap(
      this.player.sprite,
      this.mineGroup,
      (_player, mine) => {
        ;(mine as Phaser.Physics.Arcade.Sprite)
          .disableBody(true, true)
          .setVisible(false)
        this.stunPlayer()
      },
      () => this.gameState === 'playing',
    )

    // Ghost overlap — process callback filters out states that don't collide
    this.physics.add.overlap(
      this.player.sprite,
      [this.ghostGroup, this.mineGroup],
      (_player, _ghostSprite) => {
        this.killPlayer()
      },
      (_player, _ghostSprite) => {
        if (this.gameState !== 'playing') return false
        return true
      },
    )
    this.tweens.timeScale = TIMESCALE
    this.anims.globalTimeScale = TIMESCALE
  }

  private createBackground(mazeW: number, mazeH: number) {
    const { width, height } = this.scale.gameSize
    const offsetX = Math.floor((width - mazeW) / 2)
    const offsetY = Math.floor((height - mazeH) / 2)
    this.cameras.main.scrollX = -offsetX
    this.cameras.main.scrollY = -offsetY

    const borderDepth = 100
    const addBorder = (x: number, y: number, w: number, h: number) =>
      this.add
        .rectangle(x, y, w, h, 0x110525)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(borderDepth)
    if (offsetX > 0) {
      addBorder(0, 0, offsetX, height)
      addBorder(offsetX + mazeW, 0, offsetX + 1, height)
    }
    if (offsetY > 0) {
      addBorder(0, 0, width, offsetY)
      addBorder(0, offsetY + mazeH, width, offsetY + 1)
    }

    ;({ bg: this.bg, bgDisplacement: this.bgDisplacement } = createScrollingBg(this, mazeW, mazeH))
  }

  update(_time: number, delta: number) {
    if (this.gameState !== 'playing') return

    updateScrollingBg(this.bg, this.bgDisplacement, _time)

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

  private killPlayer() {
    this.gameState = 'dying'
    this.player.die()
    for (const g of this.ghosts) g.stop()
    this.time.delayedCall(1000, () =>
      this.scene.launch('Checkerboard', {
        stopScene: 'Game',
        nextScene: 'Menu',
      }),
    )
  }
}
