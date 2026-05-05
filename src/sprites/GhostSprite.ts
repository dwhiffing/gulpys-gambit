import * as Phaser from 'phaser'
import * as C from '../constants'
import type { Game } from '../scenes/Game'
import type { Spawner, TilePos } from '../maze'
import { canMove, wrapX, wrapY } from '../utils'
import { GHOST_COLORS } from '../mazeConfig'

const { CHASE, SCARED, EATEN, EXITING, JAILED } = C.GHOST_STATE

const OPPOSITE = [C.DIRS.LEFT, C.DIRS.RIGHT, C.DIRS.DOWN, C.DIRS.UP]

export const DEBUG_GHOST_TARGETS = true

export class GhostSprite {
  tileX: number
  tileY: number
  progress = 0
  dir: number
  x: number
  y: number
  sprite: Phaser.GameObjects.Sprite
  state: number
  scaredTimer = 0
  jailTimer = 0
  exitDelay: number

  private colorIndex: number
  private jailPos!: TilePos
  private exitTile!: TilePos
  private cols!: number
  private rows!: number
  private debugLine: Phaser.GameObjects.Graphics | null = null

  constructor(
    private scene: Game,
    spawner: Spawner,
    colorIndex: number,
  ) {
    this.jailPos = spawner.position
    this.exitTile = spawner.exit
    this.cols = scene.maze.grid[0].length
    this.rows = scene.maze.grid.length
    this.tileX = spawner.position.x
    this.tileY = spawner.position.y
    this.dir = 2
    this.exitDelay = colorIndex * 500
    this.colorIndex = colorIndex
    this.state = EXITING
    const px = this.tileX * C.CELL + C.CELL / 2
    const py = this.tileY * C.CELL + C.CELL / 2
    this.x = px
    this.y = py
    const tk = `sprites-ghost-${colorIndex}`
    this.sprite = scene.add.sprite(px, py, tk, 19).setDepth(2)
    this.sprite.play(`ghost-${colorIndex}-up`)

    if (DEBUG_GHOST_TARGETS) {
      this.debugLine = scene.add.graphics().setDepth(1)
    }
  }

  get grid() {
    return this.scene.maze.grid
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
    if (
      this.state !== EATEN &&
      this.state !== EXITING &&
      this.state !== JAILED
    ) {
      this.state = SCARED
      this.scaredTimer = C.POWER_DURATION
      this.sprite.setAlpha(1)
      this.sprite.play('ghost-scared', true)
    }
  }

  private playAnim() {
    const ci = this.colorIndex
    if (this.state === EATEN) {
      this.sprite.stop()
      this.sprite.setFrame([24, 25, 26, 27][this.dir])
    } else if (this.state === JAILED) {
      this.sprite.stop()
      this.sprite.setFrame([24, 25, 26, 27][this.dir])
    } else if (this.state === SCARED) {
      this.sprite.play(`ghost-${ci}-scared`, true)
    } else {
      this.sprite.play(
        [
          `ghost-${ci}-right`,
          `ghost-${ci}-left`,
          `ghost-${ci}-up`,
          `ghost-${ci}-down`,
        ][this.dir],
        true,
      )
    }
  }

  private getTarget(playerTileX: number, playerTileY: number): TilePos {
    return this.state === EATEN
      ? this.jailPos
      : this.state === EXITING
        ? this.exitTile
        : { x: playerTileX, y: playerTileY }
  }

  private chooseDir(playerTileX: number, playerTileY: number): number {
    const target = this.getTarget(playerTileX, playerTileY)
    const canUseDoor = this.state === EATEN || this.state === EXITING

    if (this.state === SCARED) {
      // Scared: greedily flee — no cycle risk since any direction is acceptable
      let bestDir = -1
      let bestDist = -Infinity
      for (let dir = 0; dir < 4; dir++) {
        if (dir === OPPOSITE[this.dir]) continue
        if (!canMove(this.grid, this.tileX, this.tileY, dir, canUseDoor))
          continue
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
        canMove(
          this.grid,
          this.tileX,
          this.tileY,
          OPPOSITE[this.dir],
          canUseDoor,
        )
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
      if (!canMove(this.grid, this.tileX, this.tileY, dir, canUseDoor)) continue
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
        if (!canMove(this.grid, x, y, dir, canUseDoor)) continue
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
      if (canMove(this.grid, this.tileX, this.tileY, dir, canUseDoor))
        return dir
    }
    if (
      canMove(this.grid, this.tileX, this.tileY, OPPOSITE[this.dir], canUseDoor)
    )
      return OPPOSITE[this.dir]
    return -1
  }

  private tracePath(playerTileX: number, playerTileY: number): TilePos[] {
    const target = this.getTarget(playerTileX, playerTileY)
    const canUseDoor = this.state === EATEN || this.state === EXITING

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
      if (!canMove(this.grid, this.tileX, this.tileY, dir, canUseDoor)) continue
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
        if (!canMove(this.grid, node.x, node.y, dir, canUseDoor)) continue
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

  private drawDebugLine(playerTileX: number, playerTileY: number) {
    if (!this.debugLine) return
    const [r, g, b] = GHOST_COLORS[this.colorIndex]
    const color = (r << 16) | (g << 8) | b
    // Spread 4 ghosts evenly: -3, -1, +1, +3 pixels from center
    const perpOffset = this.colorIndex * 2 - 3
    const path = this.tracePath(playerTileX, playerTileY)
    this.debugLine.clear()
    if (path.length < 2) return
    this.debugLine.lineStyle(3, color, 0.8)
    this.debugLine.beginPath()

    // Start from the ghost's current pixel position, offset perpendicularly to current dir
    const startOx = C.DY[this.dir] * perpOffset
    const startOy = C.DX[this.dir] * -perpOffset
    this.debugLine.moveTo(this.x + startOx, this.y + startOy)

    for (let i = 1; i < path.length; i++) {
      // Determine direction of this segment from path[i-1] to path[i]
      const dx = path[i].x - path[i - 1].x
      const dy = path[i].y - path[i - 1].y
      // Normalise for wrapping (values will be -cols+1..cols-1, clamp to -1..1)
      const ndx = dx === 0 ? 0 : dx > 0 ? 1 : -1
      const ndy = dy === 0 ? 0 : dy > 0 ? 1 : -1
      // Perpendicular: rotate 90° (dx,dy) → (-dy, dx)
      const ox = -ndy * perpOffset
      const oy = ndx * perpOffset
      const px = path[i].x * C.CELL + C.CELL / 2 + ox
      const py = path[i].y * C.CELL + C.CELL / 2 + oy
      this.debugLine.lineTo(px, py)
    }
    this.debugLine.strokePath()

    const last = path[path.length - 1]
    const ldx = last.x - path[path.length - 2].x
    const ldy = last.y - path[path.length - 2].y
    const lndx = ldx === 0 ? 0 : ldx > 0 ? 1 : -1
    const lndy = ldy === 0 ? 0 : ldy > 0 ? 1 : -1
    const lox = -lndy * perpOffset
    const loy = lndx * perpOffset
    const tx = last.x * C.CELL + C.CELL / 2 + lox
    const ty = last.y * C.CELL + C.CELL / 2 + loy
    this.debugLine.fillStyle(color, 0.8)
    this.debugLine.fillRect(tx - 2, ty - 2, 4, 4)
  }

  update(delta: number, playerTileX: number, playerTileY: number) {
    if (this.state === JAILED) {
      this.jailTimer -= delta
      if (this.jailTimer <= 0) {
        this.state = EXITING
        this.playAnim()
      } else {
        this.x = this.jailPos.x * C.CELL + C.CELL / 2
        this.y = this.jailPos.y * C.CELL + C.CELL / 2
        this.sprite.setPosition(this.x, this.y)
      }
      return
    }

    if (this.state === EXITING) {
      if (this.exitDelay > 0) {
        this.exitDelay -= delta
        return
      }
      if (this.tileX === this.exitTile.x && this.tileY === this.exitTile.y) {
        this.state = CHASE
        this.playAnim()
      }
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

    const speed =
      this.state === SCARED
        ? C.GHOST_SCARED_SPEED
        : this.state === EATEN
          ? C.GHOST_EATEN_SPEED
          : C.GHOST_SPEED

    this.progress += (speed * delta) / 1000

    if (this.progress >= 1) {
      this.progress -= 1
      this.tileX = wrapX(this.tileX + C.DX[this.dir], this.cols)
      this.tileY = wrapY(this.tileY + C.DY[this.dir], this.rows)

      if (
        this.state === EATEN &&
        this.tileX === this.jailPos.x &&
        this.tileY === this.jailPos.y
      ) {
        this.state = JAILED
        this.jailTimer = 1000
        this.progress = 0
        this.playAnim()
      } else if (
        this.state === EXITING &&
        this.tileX === this.exitTile.x &&
        this.tileY === this.exitTile.y
      ) {
        this.state = CHASE
        this.sprite.setAlpha(1)
        this.playAnim()
      }

      const newDir = this.chooseDir(playerTileX, playerTileY)
      if (newDir !== -1 && newDir !== this.dir) {
        this.dir = newDir
        this.playAnim()
      }
    }

    this.x = (this.tileX + C.DX[this.dir] * this.progress) * C.CELL + C.CELL / 2
    this.y = (this.tileY + C.DY[this.dir] * this.progress) * C.CELL + C.CELL / 2
    this.sprite.setPosition(this.x, this.y)
    this.drawDebugLine(playerTileX, playerTileY)
  }
}
