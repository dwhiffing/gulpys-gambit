import type { Types } from 'phaser'
import { Scene } from 'phaser'
import { CELL, GHOST_STATE, TILES } from '../constants'
import { Maze } from '../maze'
import { MAZE_CONFIG } from '../mazeConfig'
import { GhostSprite } from '../sprites/GhostSprite'
import { PlayerSprite } from '../sprites/PlayerSprite'
import { calcZoom } from '../utils'

const { EATEN, EXITING, JAILED, SCARED } = GHOST_STATE

export class Game extends Scene {
  maze!: Maze
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
    this.ghosts = this.maze.spawners.map(
      (spawner, i) => new GhostSprite(this, spawner, i),
    )
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
      if (g.state === EATEN || g.state === EXITING || g.state === JAILED)
        continue
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
