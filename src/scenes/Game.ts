import type { Types } from 'phaser'
import { Scene } from 'phaser'
import { CELL, GHOST_STATE } from '../constants'
import { Maze } from '../maze'
import { MAZE_CONFIG } from '../mazeConfig'
import { GhostSprite } from '../sprites/GhostSprite'
import { PlayerSprite } from '../sprites/PlayerSprite'
import { calcZoom } from '../utils'

const { EATEN, JAILED, SCARED } = GHOST_STATE

export class Game extends Scene {
  maze!: Maze
  player!: PlayerSprite
  private ghosts!: GhostSprite[]
  private ghostGroup!: Phaser.Physics.Arcade.Group
  private cursors!: Types.Input.Keyboard.CursorKeys
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

        if (d.getData('power')) {
          for (const g of this.ghosts) g.scare()
        }

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
      (_player, ghostSprite) => {
        const g = (ghostSprite as Phaser.Physics.Arcade.Sprite).getData(
          'ghost',
        ) as GhostSprite
        if (g.state === SCARED) {
          g.eat()
        } else {
          this.killPlayer()
        }
      },
      (_player, ghostSprite) => {
        if (this.gameState !== 'playing') return false
        const g = (ghostSprite as Phaser.Physics.Arcade.Sprite).getData(
          'ghost',
        ) as GhostSprite
        return g.state !== EATEN && g.state !== JAILED
      },
    )
  }

  update(_time: number, delta: number) {
    if (this.gameState !== 'playing') return

    const blinkyPos = { x: this.ghosts[0].tileX, y: this.ghosts[0].tileY }
    for (const g of this.ghosts) g.update(delta, blinkyPos)
    this.player.update(delta, this.cursors)
  }

  private killPlayer() {
    this.gameState = 'dying'
    this.player.die()
    for (const g of this.ghosts) g.hide()
    this.time.delayedCall(1000, () => this.scene.restart())
  }
}
