import * as Phaser from 'phaser'
import * as C from '../constants'
import { ENEMY_TYPES } from '../enemyTypes'
import type { EnemyType, Spawner, TilePos } from '../maze'
import type { Game } from '../scenes/Game'
import { drawGhostDebugLine } from '../ghostDebug'
import { canMove, isWrapping, wrapX, wrapY } from '../utils'

const OPPOSITE = [C.DIRS.LEFT, C.DIRS.RIGHT, C.DIRS.DOWN, C.DIRS.UP]

type Stop = {
  toX: number
  toY: number
  landTileX: number
  landTileY: number
  steps: number
  isWrap: boolean
}

export const DEBUG_GHOST_TARGETS = false

export class GhostSprite {
  tileX: number
  tileY: number
  dir: number
  sprite: Phaser.Physics.Arcade.Sprite
  exitDelay: number
  private moveTween: Phaser.Tweens.Tween | null = null
  private wrapTimer = 0
  private nextStop: Stop | null = null
  private atIntersection = false

  colorIndex: number
  enemyType: EnemyType
  private aiType: 1 | 2 | 3 | 4
  private swimTrail!: Phaser.GameObjects.Particles.ParticleEmitter
  private swimTrailTimer = 0
  private intersectionCount = 0
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
    const tx = spawner.position.x
    const ty = spawner.position.y
    if (ty === 0) this.dir = C.DIRS.DOWN
    else if (ty >= this.rows - 2) this.dir = C.DIRS.UP
    else if (tx === 0) this.dir = C.DIRS.RIGHT
    else this.dir = C.DIRS.LEFT

    this.sprite = scene.physics.add
      .sprite(0, 0, 'sprites')
      .setDepth(2)
      .setVisible(false)
      .play({
        key: `fish-${this.enemyType}`,
        frameRate: ENEMY_TYPES[spawner.enemyType].frameRate,
      })
    this.sprite.body!.setCircle(C.CELL * 0.6, C.CELL * 0.4, C.CELL * 0.4)

    this.swimTrail = scene.add
      .particles(0, 0, 'dots', C.BUBBLE_EMITTER_CONFIG)
      .setDepth(1)

    if (DEBUG_GHOST_TARGETS) {
      this.debugLine = scene.add.graphics().setDepth(1)
    }
  }

  get grid() {
    return this.scene.maze.grid
  }

  stop() {
    this.moveTween?.stop()
    this.moveTween = null
  }

  update(delta: number) {
    if (this.exitDelay > 0) {
      this.exitDelay -= delta
      if (this.exitDelay <= 0) this.startEntryTween()
      return
    }

    if (this.wrapTimer > 0) {
      this.wrapTimer -= delta
      if (this.wrapTimer <= 0) {
        this.startEntryTween()
      }
      return
    }

    const playerTileX = this.scene.player.tileX
    const playerTileY = this.scene.player.tileY
    const playerDir = this.scene.player.dir
    this.drawDebugLine(playerTileX, playerTileY, playerDir)
    this.emitSwimTrail(delta)

    if (!this.moveTween) {
      this.startNextTween()
    }
  }

  private addTween(
    x: number,
    y: number,
    steps: number,
    ease: string,
    onComplete: () => void,
  ) {
    const { speed } = ENEMY_TYPES[this.enemyType]
    this.moveTween = this.scene.tweens.add({
      targets: this.sprite,
      x,
      y,
      duration: (steps * 1000) / speed,
      ease,
      onComplete,
    })
  }

  private maybeDropMine(tileX: number, tileY: number) {
    const { mineInterval, mineLifetime } = ENEMY_TYPES[this.enemyType]
    if (!mineInterval) return
    this.intersectionCount++
    if (this.intersectionCount % mineInterval === 0) {
      this.scene.dropMine(tileX, tileY, mineLifetime)
    }
  }

  private handleArrival(stop: Stop) {
    this.moveTween = null
    this.nextStop = null
    this.tileX = stop.landTileX
    this.tileY = stop.landTileY
    if (stop.isWrap) {
      this.sprite.setVisible(false)
      this.wrapTimer = C.WRAP_DELAY
    } else {
      this.atIntersection = true
      this.maybeDropMine(stop.landTileX, stop.landTileY)
      this.startNextTween()
    }
  }

  private startEntryTween() {
    const { easeIn, easeOut } = ENEMY_TYPES[this.enemyType]
    const stop = this.findNextStop()
    if (!stop) return

    const entryX = (this.tileX - C.DX[this.dir] * 2) * C.CELL + C.CELL
    const entryY = (this.tileY - C.DY[this.dir] * 2) * C.CELL + C.CELL
    this.sprite.setPosition(entryX, entryY).setVisible(true)

    const outSteps = stop.isWrap || !easeOut ? 0 : Math.min(2, stop.steps)
    const midSteps = stop.steps - outSteps
    const inSteps = 2

    const afterMidX = stop.toX - C.DX[this.dir] * outSteps * C.CELL
    const afterMidY = stop.toY - C.DY[this.dir] * outSteps * C.CELL

    const startOut = () =>
      this.addTween(stop.toX, stop.toY, outSteps * 2, 'Quad.easeOut', () =>
        this.handleArrival(stop),
      )
    const startMid = () =>
      midSteps > 0
        ? this.addTween(afterMidX, afterMidY, midSteps, 'Linear', () => {
            this.moveTween = null
            outSteps > 0 ? startOut() : this.handleArrival(stop)
          })
        : startOut()

    if (easeIn) {
      const afterInX = afterMidX - C.DX[this.dir] * midSteps * C.CELL
      const afterInY = afterMidY - C.DY[this.dir] * midSteps * C.CELL
      this.addTween(afterInX, afterInY, inSteps * 2, 'Quad.easeIn', () => {
        this.moveTween = null
        startMid()
      })
    } else {
      this.addTween(afterMidX, afterMidY, inSteps + midSteps, 'Linear', () => {
        this.moveTween = null
        outSteps > 0 ? startOut() : this.handleArrival(stop)
      })
    }
  }

  private startNextTween() {
    const player = this.scene.player
    const oldDir = this.dir
    const newDir = this.chooseDir(
      this.tileX,
      this.tileY,
      this.dir,
      player.tileX,
      player.tileY,
      player.dir,
    )
    if (newDir !== -1) this.dir = newDir
    this.sprite.setFlipX(this.dir === C.DIRS.LEFT)

    const { easeIn, easeOut, roundedCorners } = ENEMY_TYPES[this.enemyType]

    // When the ghost just arrived at an intersection (post-spawn/wrap/dead-end) and needs
    // to turn, do an arc from the current position using a diagonal control point.
    if (
      roundedCorners &&
      this.atIntersection &&
      newDir !== -1 &&
      newDir !== oldDir
    ) {
      this.atIntersection = false
      const cx = this.sprite.x
      const cy = this.sprite.y
      const p0 = { x: cx, y: cy }
      const p1 = {
        x: cx + (C.DX[oldDir] + C.DX[newDir]) * C.CELL * 0.5,
        y: cy + (C.DY[oldDir] + C.DY[newDir]) * C.CELL * 0.5,
      }
      const p2 = {
        x: cx + C.DX[newDir] * C.CELL,
        y: cy + C.DY[newDir] * C.CELL,
      }
      this.addBezierTween(p0, p1, p2, 2, () => {
        this.moveTween = null
        this.tileX += C.DX[newDir]
        this.tileY += C.DY[newDir]
        this.maybeDropMine(this.tileX, this.tileY)
        this.startNextTween()
      })
      return
    }
    this.atIntersection = false

    const stop = this.findNextStop()
    if (!stop) return
    this.nextStop = stop

    if (roundedCorners && !stop.isWrap) {
      const futureDir = this.chooseDir(
        stop.landTileX,
        stop.landTileY,
        this.dir,
        player.tileX,
        player.tileY,
        player.dir,
      )
      if (futureDir !== -1 && futureDir !== this.dir) {
        this.startRoundedCornerTween(stop, futureDir)
        return
      }
    }
    // Ease phases use 2× duration: for Quad.easeIn/Out, velocity at the handoff
    // point equals 2×(distance/duration), so doubling duration makes it match full speed.
    const inSteps = !easeIn ? 0 : Math.min(2, stop.steps)
    const outSteps =
      stop.isWrap || !easeOut ? 0 : Math.min(2, stop.steps - inSteps)
    const midSteps = stop.steps - inSteps - outSteps

    const afterInX = stop.toX - C.DX[this.dir] * (outSteps + midSteps) * C.CELL
    const afterInY = stop.toY - C.DY[this.dir] * (outSteps + midSteps) * C.CELL
    const afterMidX = stop.toX - C.DX[this.dir] * outSteps * C.CELL
    const afterMidY = stop.toY - C.DY[this.dir] * outSteps * C.CELL

    const startOut = () =>
      outSteps > 0
        ? this.addTween(stop.toX, stop.toY, outSteps * 2, 'Quad.easeOut', () =>
            this.handleArrival(stop),
          )
        : this.handleArrival(stop)
    const startMid = () =>
      midSteps > 0
        ? this.addTween(afterMidX, afterMidY, midSteps, 'Linear', () => {
            this.moveTween = null
            startOut()
          })
        : startOut()

    if (inSteps > 0) {
      this.addTween(afterInX, afterInY, inSteps * 2, 'Quad.easeIn', () => {
        this.moveTween = null
        startMid()
      })
    } else {
      startMid()
    }
  }

  /** Walk forward in the current direction until we hit an intersection or a wrap boundary. */
  private findNextStop(): Stop | null {
    let tx = this.tileX
    let ty = this.tileY
    let steps = 0

    while (true) {
      if (isWrapping(tx, ty, this.dir, this.cols, this.rows)) {
        // Tween off-screen to the unwrapped pixel, then hide and teleport
        const landTileX = wrapX(tx + C.DX[this.dir], this.cols)
        const landTileY = wrapY(ty + C.DY[this.dir], this.rows)
        return {
          toX:
            (tx + C.DX[this.dir]) * C.CELL + C.CELL + C.DX[this.dir] * C.CELL,
          toY:
            (ty + C.DY[this.dir]) * C.CELL + C.CELL + C.DY[this.dir] * C.CELL,
          landTileX,
          landTileY,
          steps: steps + 2,
          isWrap: true,
        }
      }

      const nx = wrapX(tx + C.DX[this.dir], this.cols)
      const ny = wrapY(ty + C.DY[this.dir], this.rows)
      steps++

      const canGoForward = canMove(this.grid, nx, ny, this.dir, false)
      if (!canGoForward) {
        return {
          toX: nx * C.CELL + C.CELL,
          toY: ny * C.CELL + C.CELL,
          landTileX: nx,
          landTileY: ny,
          steps,
          isWrap: false,
        }
      }

      let hasOtherOptions = false
      for (let d = 0; d < 4; d++) {
        if (
          d !== this.dir &&
          d !== OPPOSITE[this.dir] &&
          canMove(this.grid, nx, ny, d, false)
        ) {
          hasOtherOptions = true
          break
        }
      }

      if (hasOtherOptions) {
        return {
          toX: nx * C.CELL + C.CELL,
          toY: ny * C.CELL + C.CELL,
          landTileX: nx,
          landTileY: ny,
          steps,
          isWrap: false,
        }
      }

      tx = nx
      ty = ny
    }
  }

  private drawDebugLine(
    playerTileX: number,
    playerTileY: number,
    playerDir: number,
  ) {
    if (!this.debugLine) return
    const target = this.getTarget(playerTileX, playerTileY, playerDir)
    const fromX = this.nextStop?.landTileX ?? this.tileX
    const fromY = this.nextStop?.landTileY ?? this.tileY
    const path = this.tracePath(
      fromX,
      fromY,
      playerTileX,
      playerTileY,
      playerDir,
    )
    drawGhostDebugLine(
      { ...this, x: this.sprite.x, y: this.sprite.y },
      target,
      path,
    )
  }

  private getTarget(
    playerTileX: number,
    playerTileY: number,
    playerDir: number,
  ): TilePos {
    if (this.aiType === 2) {
      // 3 tiles ahead of player
      return {
        x: wrapX(playerTileX + C.DX[playerDir] * 3, this.cols),
        y: wrapY(playerTileY + C.DY[playerDir] * 3, this.rows),
      }
    }

    // aiType 1: target player exactly
    return { x: playerTileX, y: playerTileY }
  }

  private emitSwimTrail(delta: number) {
    this.swimTrailTimer = Math.max(0, this.swimTrailTimer - delta)
    if (this.swimTrailTimer > 0) return
    const tailX = this.sprite.x - C.DX[this.dir] * C.CELL * 0.7
    const tailY = this.sprite.y - C.DY[this.dir] * C.CELL * 0.7
    this.swimTrail.emitParticleAt(tailX, tailY, 1)
    this.swimTrailTimer = ENEMY_TYPES[this.enemyType].swimTrailInterval ?? 200
  }

  private chooseDir(
    fromTileX: number,
    fromTileY: number,
    fromDir: number,
    playerTileX: number,
    playerTileY: number,
    playerDir: number,
  ): number {
    const target = this.getTarget(playerTileX, playerTileY, playerDir)

    // BFS — guarantees shortest path and no cycles
    type Node = { x: number; y: number; firstDir: number }
    const visited = new Set<string>()
    const queue: Node[] = []

    for (let dir = 0; dir < 4; dir++) {
      if (dir === OPPOSITE[fromDir]) continue
      if (!canMove(this.grid, fromTileX, fromTileY, dir, false)) continue
      const nx = wrapX(fromTileX + C.DX[dir], this.cols)
      const ny = wrapY(fromTileY + C.DY[dir], this.rows)
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
      if (dir === OPPOSITE[fromDir]) continue
      if (canMove(this.grid, fromTileX, fromTileY, dir, false)) return dir
    }
    if (canMove(this.grid, fromTileX, fromTileY, OPPOSITE[fromDir], false))
      return OPPOSITE[fromDir]
    return -1
  }

  private startRoundedCornerTween(stop: Stop, futureDir: number) {
    const cx = stop.toX
    const cy = stop.toY

    const p0 = {
      x: cx - C.DX[this.dir] * C.CELL,
      y: cy - C.DY[this.dir] * C.CELL,
    }
    const p1 = { x: cx, y: cy }
    const p2 = {
      x: cx + C.DX[futureDir] * C.CELL,
      y: cy + C.DY[futureDir] * C.CELL,
    }

    this.addTween(p0.x, p0.y, stop.steps - 1, 'Linear', () => {
      this.moveTween = null
      this.addBezierTween(p0, p1, p2, 2, () => {
        this.moveTween = null
        this.tileX = stop.landTileX + C.DX[futureDir]
        this.tileY = stop.landTileY + C.DY[futureDir]
        this.dir = futureDir
        this.sprite.setFlipX(this.dir === C.DIRS.LEFT)
        this.maybeDropMine(stop.landTileX, stop.landTileY)
        this.startNextTween()
      })
    })
  }

  private addBezierTween(
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    steps: number,
    onComplete: () => void,
  ) {
    const { speed } = ENEMY_TYPES[this.enemyType]
    const counter = { t: 0 }
    this.moveTween = this.scene.tweens.add({
      targets: counter,
      t: 1,
      duration: (steps * 1000) / speed,
      ease: 'Linear',
      onUpdate: () => {
        const t = counter.t
        const mt = 1 - t
        this.sprite.x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x
        this.sprite.y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
      },
      onComplete,
    })
  }

  private tracePath(
    fromTileX: number,
    fromTileY: number,
    playerTileX: number,
    playerTileY: number,
    playerDir: number,
  ): TilePos[] {
    const target = this.getTarget(playerTileX, playerTileY, playerDir)
    // BFS — reconstruct the full tile path to target
    type Node = { x: number; y: number; parent: Node | null }
    const visited = new Map<string, Node>()
    const queue: Node[] = []
    const startKey = `${fromTileX},${fromTileY}`
    const startNode: Node = { x: fromTileX, y: fromTileY, parent: null }
    visited.set(startKey, startNode)

    // Seed only from current direction (ghost can't reverse mid-tile)
    for (let dir = 0; dir < 4; dir++) {
      if (dir === OPPOSITE[this.dir]) continue
      if (!canMove(this.grid, fromTileX, fromTileY, dir, false)) continue
      const nx = wrapX(fromTileX + C.DX[dir], this.cols)
      const ny = wrapY(fromTileY + C.DY[dir], this.rows)
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

    if (!found) return [{ x: fromTileX, y: fromTileY }]

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
