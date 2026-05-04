import type { Types } from 'phaser'
import { Scene } from 'phaser'
import { CELL, GHOST_STATE, TILES } from '../constants'
import { Maze } from '../maze'
import { GhostSprite } from '../sprites/GhostSprite'
import { PlayerSprite } from '../sprites/PlayerSprite'

const { EATEN, EXITING, JAILED, SCARED } = GHOST_STATE

export class Game extends Scene {
  private maze!: Maze
  private player!: PlayerSprite
  private ghosts!: GhostSprite[]
  private cursors!: Types.Input.Keyboard.CursorKeys
  private gameState: 'playing' | 'dying' | 'won' = 'playing'

  constructor() {
    super('Game')
  }

  create() {
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.gameState = 'playing'

    this.maze = new Maze(this)
    this.player = new PlayerSprite(this, 14, 28, this.maze.grid)
    this.ghosts = [
      new GhostSprite(this, 13, 14, 2, 0, this.maze.grid, 0),
      new GhostSprite(this, 14, 14, 2, 500, this.maze.grid, 1),
      new GhostSprite(this, 13, 15, 2, 1000, this.maze.grid, 2),
      new GhostSprite(this, 14, 15, 2, 1500, this.maze.grid, 3),
    ]
  }

  update(_time: number, delta: number) {
    if (this.gameState !== 'playing') return

    for (const g of this.ghosts)
      g.update(delta, this.player.tileX, this.player.tileY)

    const landed = this.player.update(delta, this.cursors)
    if (landed) this.eatDot(this.player.tileX, this.player.tileY)

    this.checkCollisions()
  }

  private eatDot(tx: number, ty: number) {
    const t = this.maze.eatDot(tx, ty)
    if (t === null) return

    if (t === TILES.POWER) {
      for (const g of this.ghosts) g.scare()
    }

    if (this.maze.dots.every((d) => !d.visible)) {
      this.gameState = 'won'
      this.time.delayedCall(2000, () => this.scene.restart())
    }
  }

  private checkCollisions() {
    for (const g of this.ghosts) {
      if (g.state === EATEN || g.state === EXITING || g.state === JAILED) continue
      if (Math.abs(g.x - this.player.x) >= CELL * 0.7) continue
      if (Math.abs(g.y - this.player.y) >= CELL * 0.7) continue

      if (g.state === SCARED) {
        g.eat()
      } else {
        this.killPlayer()
      }
    }
  }

  private killPlayer() {
    this.gameState = 'dying'
    this.player.die()
    for (const g of this.ghosts) g.hide()
    this.time.delayedCall(1400 + 2000, () => this.scene.restart())
  }
}
