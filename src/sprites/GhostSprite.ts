import * as Phaser from 'phaser'
import * as C from '../constants'
import { ENEMY_TYPES } from '../enemyTypes'
import type { EnemyType, Spawner, TilePos } from '../maze'
import type { Game } from '../scenes/Game'
import {
  WrapHelper,
  canMove,
  isWrapping,
  moveFrac,
  wrapX,
  wrapY,
} from '../utils'
import { drawGhostDebugLine } from '../ghostDebug'

const OPPOSITE = [C.DIRS.LEFT, C.DIRS.RIGHT, C.DIRS.DOWN, C.DIRS.UP]

export const DEBUG_GHOST_TARGETS = false

export class GhostSprite {
  tileX: number
  tileY: number
  progress = 0
  dir: number
  x: number
  y: number
  sprite: Phaser.Physics.Arcade.Sprite
  exitDelay: number
  private spawning = false
  private wrap = new WrapHelper()

  colorIndex: number
  enemyType: EnemyType
  private aiType: 1 | 2 | 3 | 4
  cols!: number
  rows!: number
  debugLine: Phaser.GameObjects.Graphics | null = null

  constructor(
    private scene: Game,
    spawner: Spawner,
    colorIndex: number,
  ) {
    this.cols = scene.maze.grid[0].length
    this.rows = scene.maze.grid.length
    this.tileX = spawner.position.x
    this.tileY = spawner.position.y
    this.exitDelay = 1000 + colorIndex * 500
    this.colorIndex = colorIndex
    this.enemyType = spawner.enemyType
    this.aiType = ENEMY_TYPES[spawner.enemyType].aiType
    this.dir = C.DIRS.RIGHT

    this.sprite = scene.physics.add
      .sprite(0, 0, 'sprites')
      .setDepth(2)
      .setVisible(false)
      .play({
        key: `fish-${this.enemyType}`,
        frameRate: ENEMY_TYPES[spawner.enemyType].frameRate,
      })
    this.sprite.body!.setCircle(C.CELL * 0.6, C.CELL * 0.4, C.CELL * 0.4)

    if (DEBUG_GHOST_TARGETS) {
      this.debugLine = scene.add.graphics().setDepth(1)
    }
  }

  get grid() {
    return this.scene.maze.grid
  }

  get wrapping(): boolean {
    return isWrapping(this.tileX, this.tileY, this.dir, this.cols, this.rows)
  }

  update(delta: number, blinkyPos: TilePos) {
    const playerTileX = this.scene.player.tileX
    const playerTileY = this.scene.player.tileY
    const playerDir = this.scene.player.dir

    if (this.spawning) return
    if (this.tickExitDelay(delta)) return
    if (this.wrap.tick(delta, this)) return

    this.tickMovement(delta, playerTileX, playerTileY, playerDir, blinkyPos)
    this.drawDebugLine(playerTileX, playerTileY, playerDir, blinkyPos)
  }

  private tickExitDelay(delta: number): boolean {
    if (this.exitDelay <= 0) return false

    this.exitDelay -= delta
    if (this.exitDelay <= 0) {
      // Compute the off-screen start position: one tile beyond the border in entry direction
      const targetX = this.tileX * C.CELL + C.CELL
      const targetY = this.tileY * C.CELL + C.CELL
      const fromX = targetX - C.DX[this.dir] * C.CELL * 2
      const fromY = targetY - C.DY[this.dir] * C.CELL * 2

      this.sprite.setPosition(fromX, fromY)
      this.sprite.setVisible(true)
      this.spawning = true

      this.scene.tweens.add({
        targets: this.sprite,
        x: targetX,
        y: targetY,
        duration: 400,
        ease: 'Linear',
        onComplete: () => {
          this.spawning = false
        },
      })
    }
    return true
  }

  private tickMovement(
    delta: number,
    playerTileX: number,
    playerTileY: number,
    playerDir: number,
    blinkyPos: TilePos,
  ) {
    const { speed } = ENEMY_TYPES[this.enemyType]
    this.progress += (speed * delta) / 1000

    if (this.wrapping && !this.wrap.active && this.progress >= 2) {
      this.progress = 2
      this.wrap.trigger()
      this.sprite.setVisible(false)
      return
    }

    if (
      (!this.wrapping || this.wrap.active) &&
      this.progress >= this.wrap.threshold
    ) {
      this.progress -= this.wrap.threshold
      this.wrap.active = false
      this.tileX = wrapX(this.tileX + C.DX[this.dir], this.cols)
      this.tileY = wrapY(this.tileY + C.DY[this.dir], this.rows)

      const newDir = this.chooseDir(
        playerTileX,
        playerTileY,
        playerDir,
        blinkyPos,
      )
      if (newDir !== -1 && newDir !== this.dir) {
        this.dir = newDir
      }
    }

    const { x: fracX, y: fracY } = moveFrac(
      this,
      this.progress,
      this.wrap.active,
    )
    this.x = fracX * C.CELL + C.CELL
    this.y = fracY * C.CELL + C.CELL
    this.sprite.setPosition(this.x, this.y)
    this.sprite.setFlipX(this.dir === C.DIRS.LEFT)
  }

  private drawDebugLine(
    playerTileX: number,
    playerTileY: number,
    playerDir: number,
    blinkyPos: TilePos,
  ) {
    if (!this.debugLine) return
    const target = this.getTarget(
      playerTileX,
      playerTileY,
      playerDir,
      blinkyPos,
    )
    const path = this.tracePath(playerTileX, playerTileY, playerDir, blinkyPos)
    drawGhostDebugLine(this, target, path)
  }

  private getTarget(
    playerTileX: number,
    playerTileY: number,
    playerDir: number,
    blinkyPos: TilePos,
  ): TilePos {
    if (this.aiType === 2) {
      // 3 tiles ahead of player
      return {
        x: wrapX(playerTileX + C.DX[playerDir] * 3, this.cols),
        y: wrapY(playerTileY + C.DY[playerDir] * 3, this.rows),
      }
    }

    if (this.aiType === 3) {
      // Inky: pivot = 2 tiles ahead of player, target = 2*pivot - blinky
      const pivotX = playerTileX + C.DX[playerDir] * 2
      const pivotY = playerTileY + C.DY[playerDir] * 2
      return {
        x: wrapX(2 * pivotX - blinkyPos.x, this.cols),
        y: wrapY(2 * pivotY - blinkyPos.y, this.rows),
      }
    }

    // aiType 1: target player exactly
    return { x: playerTileX, y: playerTileY }
  }

  private chooseDir(
    playerTileX: number,
    playerTileY: number,
    playerDir: number,
    blinkyPos: TilePos,
  ): number {
    const target = this.getTarget(
      playerTileX,
      playerTileY,
      playerDir,
      blinkyPos,
    )

    // BFS — guarantees shortest path and no cycles
    type Node = { x: number; y: number; firstDir: number }
    const visited = new Set<string>()
    const queue: Node[] = []

    for (let dir = 0; dir < 4; dir++) {
      if (dir === OPPOSITE[this.dir]) continue
      if (!canMove(this.grid, this.tileX, this.tileY, dir, false)) continue
      const nx = wrapX(this.tileX + C.DX[dir], this.cols)
      const ny = wrapY(this.tileY + C.DY[dir], this.rows)
      const key = `${nx},${ny}`
      if (!visited.has(key)) {
        visited.add(key)
        queue.push({ x: nx, y: ny, firstDir: dir })
      }
    }

    let head = 0
    while (head < queue.length) {
      const { x, y, firstDir } = queue[head++]
      if (x === target.x && y === target.y) return firstDir
      for (let dir = 0; dir < 4; dir++) {
        if (!canMove(this.grid, x, y, dir, false)) continue
        const nx = wrapX(x + C.DX[dir], this.cols)
        const ny = wrapY(y + C.DY[dir], this.rows)
        const key = `${nx},${ny}`
        if (!visited.has(key)) {
          visited.add(key)
          queue.push({ x: nx, y: ny, firstDir })
        }
      }
    }

    // Target unreachable — any valid non-reverse move
    for (let dir = 0; dir < 4; dir++) {
      if (dir === OPPOSITE[this.dir]) continue
      if (canMove(this.grid, this.tileX, this.tileY, dir, false)) return dir
    }
    if (canMove(this.grid, this.tileX, this.tileY, OPPOSITE[this.dir], false))
      return OPPOSITE[this.dir]
    return -1
  }

  private tracePath(
    playerTileX: number,
    playerTileY: number,
    playerDir: number,
    blinkyPos: TilePos,
  ): TilePos[] {
    const target = this.getTarget(
      playerTileX,
      playerTileY,
      playerDir,
      blinkyPos,
    )
    // BFS — reconstruct the full tile path to target
    type Node = { x: number; y: number; parent: Node | null }
    const visited = new Map<string, Node>()
    const queue: Node[] = []
    const startKey = `${this.tileX},${this.tileY}`
    const startNode: Node = { x: this.tileX, y: this.tileY, parent: null }
    visited.set(startKey, startNode)

    // Seed only from current direction (ghost can't reverse mid-tile)
    for (let dir = 0; dir < 4; dir++) {
      if (dir === OPPOSITE[this.dir]) continue
      if (!canMove(this.grid, this.tileX, this.tileY, dir, false)) continue
      const nx = wrapX(this.tileX + C.DX[dir], this.cols)
      const ny = wrapY(this.tileY + C.DY[dir], this.rows)
      const key = `${nx},${ny}`
      if (!visited.has(key)) {
        const node: Node = { x: nx, y: ny, parent: startNode }
        visited.set(key, node)
        queue.push(node)
      }
    }

    let found: Node | null = null
    let head = 0
    while (head < queue.length) {
      const node = queue[head++]
      if (node.x === target.x && node.y === target.y) {
        found = node
        break
      }
      for (let dir = 0; dir < 4; dir++) {
        if (!canMove(this.grid, node.x, node.y, dir, false)) continue
        const nx = wrapX(node.x + C.DX[dir], this.cols)
        const ny = wrapY(node.y + C.DY[dir], this.rows)
        const key = `${nx},${ny}`
        if (!visited.has(key)) {
          const next: Node = { x: nx, y: ny, parent: node }
          visited.set(key, next)
          queue.push(next)
        }
      }
    }

    if (!found) return [{ x: this.tileX, y: this.tileY }]

    // Walk parent chain to build path
    const reversed: TilePos[] = []
    let cur: Node | null = found
    while (cur) {
      reversed.push({ x: cur.x, y: cur.y })
      cur = cur.parent
    }
    return reversed.reverse()
  }
}
