import type { Types } from 'phaser'
import * as Phaser from 'phaser'
import { Scene } from 'phaser'
import { CELL, TIMESCALE } from '../constants'
import { Maze } from '../maze'
import { MAZE_CONFIG } from '../mazeConfig'
import { GhostSprite } from '../sprites/GhostSprite'
import { PlayerSprite } from '../sprites/PlayerSprite'
import { calcZoom, wobble } from '../utils'

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

  create() {
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.gameState = 'playing'

    this.input.keyboard!.once('keydown-N', () => {
      MAZE_CONFIG.cols += 1
      MAZE_CONFIG.rows += 1
      this.scene.restart()
    })

    this.maze = new Maze(this, MAZE_CONFIG)

    const mazeW = this.maze.cols * CELL
    const mazeH = this.maze.rows * CELL
    this.scale.resize(mazeW, mazeH)
    this.scale.setZoom(calcZoom(mazeW, mazeH))

    this.textures.get('background').setFilter(Phaser.Textures.FilterMode.LINEAR)
    this.bg = this.add
      .tileSprite(0, 0, mazeW, mazeH, 'background')
      .setOrigin(0)
      .setAlpha(0.2)
      .setDepth(-1)

    this.bgDisplacement = this.bg
      .enableFilters()
      .filters!.internal.addDisplacement('distort')

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
          this.time.delayedCall(2000, () => this.scene.restart())
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
        this.killPlayer()
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

  update(_time: number, delta: number) {
    if (this.gameState !== 'playing') return

    const t = _time * 0.00004
    this.bg.tilePositionX = wobble(t, [0.6, 1.1, 1.9], [0, 0, 0], 220)
    this.bg.tilePositionY = wobble(t, [0.8, 1.4, 2.3], [0.9, 0.4, 1.8], 220)
    this.bgDisplacement.x = wobble(t, [0.7, 1.3, 2.1], [0, 0, 0], 0.1)
    this.bgDisplacement.y = wobble(t, [0.9, 1.7, 2.5], [1.2, 0.5, 2.0], 0.1)

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
    this.time.delayedCall(1000, () => this.scene.restart())
  }
}
