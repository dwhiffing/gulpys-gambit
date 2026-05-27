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
          this.gameState = 'won'
          this.time.delayedCall(2000, () => this.scene.restart())
        }
      },
    )

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

  private killPlayer() {
    this.gameState = 'dying'
    this.player.die()
    this.time.delayedCall(1000, () => this.scene.restart())
  }
}
