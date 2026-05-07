import * as Phaser from 'phaser'
import * as C from '../constants'
import { WRAP_DELAY } from '../constants'
import type { Spawner, TilePos } from '../maze'
import { GHOST_COLORS } from '../mazeConfig'
import type { Game } from '../scenes/Game'
import { canMove, isWrapping, moveFrac, wrapX, wrapY } from '../utils'

const { CHASE, SCARED, EATEN, JAILED } = C.GHOST_STATE

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
  state: number
  scaredTimer = 0
  jailTimer = 0
  exitDelay: number
  private spawning = false
  private wrapPauseTimer = 0
  private wrapPaused = false

  private colorIndex: number
  private aiType: 1 | 2 | 3 | 4
  private spawnTile!: TilePos
  private cols!: number
  private rows!: number
  private debugLine: Phaser.GameObjects.Graphics | null = null
  private wrapIndicator: Phaser.GameObjects.Graphics

  constructor(
    private scene: Game,
    spawner: Spawner,
    colorIndex: number,
  ) {
    this.spawnTile = spawner.position
    this.cols = scene.maze.grid[0].length
    this.rows = scene.maze.grid.length
    this.tileX = spawner.position.x
    this.tileY = spawner.position.y
    this.exitDelay = 1000 + colorIndex * 500
    this.colorIndex = colorIndex
    this.aiType = ((colorIndex % 4) + 1) as 1 | 2 | 3 | 4
    this.state = CHASE

    // Infer inward direction from which border the spawn tile is on
    if (this.tileX === 0) this.dir = C.DIRS.RIGHT
    else if (this.tileX === this.cols - 1) this.dir = C.DIRS.LEFT
    else if (this.tileY === 0) this.dir = C.DIRS.DOWN
    else this.dir = C.DIRS.UP

    const px = this.tileX * C.CELL + C.CELL
    const py = this.tileY * C.CELL + C.CELL
    this.x = px
    this.y = py
    const tk = `sprites-ghost-${colorIndex}`
    this.sprite = scene.physics.add
      .sprite(px, py, tk)
      .setDepth(2)
      .setVisible(false)
    ;(this.sprite.body as Phaser.Physics.Arcade.Body).setCircle(
      C.CELL * 0.6,
      C.CELL * 0.4,
      C.CELL * 0.4,
    )
    this.sprite.setData('ghost', this)
    this.sprite.play(`fish-${colorIndex + 1}`)

    if (DEBUG_GHOST_TARGETS) {
      this.debugLine = scene.add.graphics().setDepth(1)
    }

    const [r, g, b] = GHOST_COLORS[colorIndex % GHOST_COLORS.length]
    const color = (r << 16) | (g << 8) | b
    this.wrapIndicator = scene.add.graphics().setDepth(2)
    this.wrapIndicator.fillStyle(color, 1)
    this.wrapIndicator.fillCircle(0, 0, C.CELL / 8)
    this.wrapIndicator.setVisible(false)
  }

  get grid() {
    return this.scene.maze.grid
  }

  private get wrapping(): boolean {
    return isWrapping(this.tileX, this.tileY, this.dir, this.cols, this.rows)
  }

  hide() {
    this.sprite.setVisible(false)
  }

  eat() {
    this.state = EATEN
    this.sprite.setAlpha(1)
    this.playAnim()
  }

  scare() {
    if (this.state !== EATEN && this.state !== JAILED) {
      this.state = SCARED
      this.scaredTimer = C.POWER_DURATION
      this.sprite.setAlpha(1)
    }
  }

  private playAnim() {
    if (this.state === EATEN || this.state === JAILED) {
      this.sprite.stop()
    }
  }

  private getScatterCorner(): TilePos {
    // 0 = top-left, 1 = top-right, 2 = bottom-left, 3 = bottom-right
    const corner = this.colorIndex % 4
    const cx = corner === 1 || corner === 3 ? this.cols - 1 : 0
    const cy = corner === 2 || corner === 3 ? this.rows - 1 : 0

    // BFS outward from corner to find the nearest walkable tile
    type Node = { x: number; y: number }
    const visited = new Set<string>()
    const queue: Node[] = [{ x: cx, y: cy }]
    visited.add(`${cx},${cy}`)
    while (queue.length > 0) {
      const { x, y } = queue.shift()!
      if (this.grid[y][x] !== C.TILES.WALL) return { x, y }
      for (let dir = 0; dir < 4; dir++) {
        const nx = x + C.DX[dir]
        const ny = y + C.DY[dir]
        if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) continue
        const key = `${nx},${ny}`
        if (!visited.has(key)) {
          visited.add(key)
          queue.push({ x: nx, y: ny })
        }
      }
    }
    return { x: cx, y: cy }
  }

  private getTarget(
    playerTileX: number,
    playerTileY: number,
    playerDir: number,
    blinkyPos: TilePos,
  ): TilePos {
    if (this.state === EATEN) return this.spawnTile

    if (this.aiType === 4) {
      // scatter when player is within 8 tiles
      const dist =
        Math.abs(this.tileX - playerTileX) + Math.abs(this.tileY - playerTileY)
      if (dist <= 8) return this.getScatterCorner()
      return { x: playerTileX, y: playerTileY }
    }

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
    if (this.state === SCARED) {
      // Scared: greedily flee — no cycle risk since any direction is acceptable
      let bestDir = -1
      let bestDist = -Infinity
      for (let dir = 0; dir < 4; dir++) {
        if (dir === OPPOSITE[this.dir]) continue
        if (!canMove(this.grid, this.tileX, this.tileY, dir, false)) continue
        const nx = wrapX(this.tileX + C.DX[dir], this.cols)
        const ny = wrapY(this.tileY + C.DY[dir], this.rows)
        const dist = Math.hypot(nx - target.x, ny - target.y)
        if (dist > bestDist) {
          bestDist = dist
          bestDir = dir
        }
      }
      if (
        bestDir === -1 &&
        canMove(this.grid, this.tileX, this.tileY, OPPOSITE[this.dir], false)
      )
        bestDir = OPPOSITE[this.dir]
      return bestDir
    }

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

  private drawDebugLine(
    playerTileX: number,
    playerTileY: number,
    playerDir: number,
    blinkyPos: TilePos,
  ) {
    if (!this.debugLine) return
    const [r, g, b] = GHOST_COLORS[this.colorIndex]
    const color = (r << 16) | (g << 8) | b
    // Spread 4 ghosts evenly: -3, -1, +1, +3 pixels from center
    const perpOffset = this.colorIndex * 2 - 3
    const target = this.getTarget(
      playerTileX,
      playerTileY,
      playerDir,
      blinkyPos,
    )
    const path = this.tracePath(playerTileX, playerTileY, playerDir, blinkyPos)
    this.debugLine.clear()
    this.debugLine.lineStyle(2, color, 0.8)
    this.debugLine.strokeRect(
      target.x * C.CELL + 1,
      target.y * C.CELL + 1,
      C.CELL * 2 - 2,
      C.CELL * 2 - 2,
    )
    if (path.length < 2) return
    this.debugLine.lineStyle(3, color, 0.8)

    // Helper: tile → pixel center with perpendicular offset based on segment direction
    const toPx = (tile: TilePos, segDx: number, segDy: number) => {
      const ndx = segDx === 0 ? 0 : segDx > 0 ? 1 : -1
      const ndy = segDy === 0 ? 0 : segDy > 0 ? 1 : -1
      return [
        tile.x * C.CELL + C.CELL + -ndy * perpOffset,
        tile.y * C.CELL + C.CELL + ndx * perpOffset,
      ]
    }

    // Walk segments; when a wrap is detected, stroke up to the edge, then resume
    // from the matching edge on the other side.
    const startOx = C.DY[this.dir] * perpOffset
    const startOy = C.DX[this.dir] * -perpOffset
    let curX = this.x + startOx
    let curY = this.y + startOy

    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x
      const dy = path[i].y - path[i - 1].y
      const wraps = Math.abs(dx) > 1 || Math.abs(dy) > 1

      // When wrapping, the tile delta sign is inverted relative to actual movement direction
      // (e.g. moving left from x=0 lands at x=cols-1, giving dx=cols-1 which looks rightward)
      const actualNdx =
        dx === 0 ? 0 : wraps ? (dx > 0 ? -1 : 1) : dx > 0 ? 1 : -1
      const actualNdy =
        dy === 0 ? 0 : wraps ? (dy > 0 ? -1 : 1) : dy > 0 ? 1 : -1
      const [nextX, nextY] = toPx(path[i], actualNdx, actualNdy)

      if (wraps) {
        const ox = -actualNdy * perpOffset
        const oy = actualNdx * perpOffset
        // Exit pixel: on the grid boundary in the actual movement direction
        const exitX =
          dx !== 0
            ? (actualNdx < 0 ? 0 : this.cols * C.CELL) + ox
            : path[i - 1].x * C.CELL + C.CELL + ox
        const exitY =
          dy !== 0
            ? (actualNdy < 0 ? 0 : this.rows * C.CELL) + oy
            : path[i - 1].y * C.CELL + C.CELL + oy
        // Entry pixel: opposite boundary
        const entryX =
          dx !== 0 ? (actualNdx < 0 ? this.cols * C.CELL : 0) + ox : exitX
        const entryY =
          dy !== 0 ? (actualNdy < 0 ? this.rows * C.CELL : 0) + oy : exitY

        this.debugLine.beginPath()
        this.debugLine.moveTo(curX, curY)
        this.debugLine.lineTo(exitX, exitY)
        this.debugLine.strokePath()

        curX = entryX
        curY = entryY
      }

      this.debugLine.beginPath()
      this.debugLine.moveTo(curX, curY)
      this.debugLine.lineTo(nextX, nextY)
      this.debugLine.strokePath()
      curX = nextX
      curY = nextY
    }
  }

  private startEntryTween() {
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

  update(delta: number, blinkyPos: TilePos) {
    const playerTileX = this.scene.player.tileX
    const playerTileY = this.scene.player.tileY
    const playerDir = this.scene.player.dir
    if (this.state === JAILED) {
      this.jailTimer -= delta
      if (this.jailTimer <= 0) {
        this.state = CHASE
        this.playAnim()
      } else {
        this.x = this.spawnTile.x * C.CELL + C.CELL
        this.y = this.spawnTile.y * C.CELL + C.CELL
        this.sprite.setPosition(this.x, this.y)
      }
      return
    }

    if (this.spawning) return

    if (this.state === CHASE && this.exitDelay > 0) {
      if (!this.wrapIndicator.visible) {
        this.wrapIndicator.setPosition(
          this.spawnTile.x * C.CELL + C.CELL,
          this.spawnTile.y * C.CELL + C.CELL,
        )
        this.wrapIndicator.setVisible(true)
      }
      this.exitDelay -= delta
      if (this.exitDelay <= 0) {
        this.wrapIndicator.setVisible(false)
        this.startEntryTween()
      }
      return
    }

    if (this.state === SCARED) {
      this.scaredTimer -= delta
      if (this.scaredTimer <= 0) {
        this.state = CHASE
        this.sprite.setAlpha(1)
        this.playAnim()
      } else if (this.scaredTimer < C.SCARED_WARN) {
        const flash = Math.floor(this.scaredTimer / 200) % 2 === 0
        this.sprite.setAlpha(flash ? 1 : 0.4)
      }
    }

    if (this.wrapPauseTimer > 0) {
      this.wrapPauseTimer -= delta
      if (this.wrapPauseTimer <= 0) {
        this.wrapPauseTimer = 0
        this.progress = 0
        const { x: fx, y: fy } = moveFrac(
          this.tileX,
          this.tileY,
          this.dir,
          0,
          this.cols,
          this.rows,
          true,
        )
        this.x = fx * C.CELL + C.CELL
        this.y = fy * C.CELL + C.CELL
        this.sprite.setPosition(this.x, this.y)
        this.sprite.setVisible(true)
      }
      return
    }

    const speed =
      this.state === SCARED
        ? C.GHOST_SCARED_SPEED
        : this.state === EATEN
          ? C.GHOST_EATEN_SPEED
          : C.GHOST_SPEED

    this.progress += (speed * delta) / 1000

    if (this.wrapping && !this.wrapPaused && this.progress >= 1) {
      this.progress = 1
      this.wrapPaused = true
      this.wrapPauseTimer = WRAP_DELAY
      this.sprite.setVisible(false)
      return
    }

    if (this.progress >= (this.wrapPaused ? 2 : 1)) {
      const threshold = this.wrapPaused ? 2 : 1
      this.wrapPaused = false
      this.progress -= threshold
      this.tileX = wrapX(this.tileX + C.DX[this.dir], this.cols)
      this.tileY = wrapY(this.tileY + C.DY[this.dir], this.rows)

      if (
        this.state === EATEN &&
        this.tileX === this.spawnTile.x &&
        this.tileY === this.spawnTile.y
      ) {
        this.state = JAILED
        this.jailTimer = 1000
        this.progress = 0
        this.playAnim()
      }

      const newDir = this.chooseDir(
        playerTileX,
        playerTileY,
        playerDir,
        blinkyPos,
      )
      if (newDir !== -1 && newDir !== this.dir) {
        this.dir = newDir
        this.playAnim()
      }
    }

    const { x: fracX, y: fracY } = moveFrac(
      this.tileX,
      this.tileY,
      this.dir,
      this.progress,
      this.cols,
      this.rows,
      this.wrapPaused,
    )
    this.x = fracX * C.CELL + C.CELL
    this.y = fracY * C.CELL + C.CELL
    this.sprite.setPosition(this.x, this.y)
    this.sprite.setFlipX(this.dir === C.DIRS.LEFT)

    this.updateWrapIndicator(playerTileX, playerTileY, playerDir, blinkyPos)
    this.drawDebugLine(playerTileX, playerTileY, playerDir, blinkyPos)
  }

  private updateWrapIndicator(
    playerTileX: number,
    playerTileY: number,
    playerDir: number,
    blinkyPos: TilePos,
  ) {
    const destX = this.tileX + C.DX[this.dir]
    const destY = this.tileY + C.DY[this.dir]
    if (this.wrapping) {
      this.wrapIndicator.setPosition(
        wrapX(destX, this.cols) * C.CELL + C.CELL,
        wrapY(destY, this.rows) * C.CELL + C.CELL,
      )
      this.wrapIndicator.setVisible(true)
      return
    }

    const path = this.tracePath(playerTileX, playerTileY, playerDir, blinkyPos)
    for (let i = 1; i < path.length && i <= 3; i++) {
      const dx = path[i].x - path[i - 1].x
      const dy = path[i].y - path[i - 1].y
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        const entryTile = path[i]
        this.wrapIndicator.setPosition(
          entryTile.x * C.CELL + C.CELL,
          entryTile.y * C.CELL + C.CELL,
        )
        this.wrapIndicator.setVisible(true)
        return
      }
    }

    this.wrapIndicator.setVisible(false)
  }
}
