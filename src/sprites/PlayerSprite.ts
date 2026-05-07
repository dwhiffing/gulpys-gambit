import * as Phaser from 'phaser'
import {
  ANGLES,
  CELL,
  CORNER_THRESHOLD,
  DASH_COOLDOWN,
  DASH_DISTANCE,
  DIRS,
  DX,
  DY,
  FLIP_DURATION,
  PLAYER_SPEED,
  SPIN_DURATION,
  WRAP_DELAY,
} from '../constants'
import type { Game } from '../scenes/Game'
import { canMove, isWrapping, moveFrac, wrapX, wrapY } from '../utils'

export class PlayerSprite {
  tileX: number
  tileY: number
  progress = 0
  dir: number
  nextDir: number
  moving = false
  x: number
  y: number
  sprite: Phaser.Physics.Arcade.Sprite
  private dashCooldown = 0
  private dashing = false
  private dashDistanceLeft = 0
  private spinning = false
  private spinTimer = 0
  private wrapPauseTimer = 0
  private wrapPaused = false
  private zKey: Phaser.Input.Keyboard.Key
  constructor(private scene: Game) {
    this.tileX = scene.maze.playerSpawn.x
    this.tileY = scene.maze.playerSpawn.y
    this.dir = DIRS.LEFT
    this.nextDir = DIRS.LEFT
    const px = this.tileX * CELL + CELL
    const py = this.tileY * CELL + CELL
    this.x = px
    this.y = py
    this.sprite = scene.physics.add.sprite(px, py, 'sprites', 0).setDepth(2)
    this.zKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
    this.applyDir(this.dir)
    this.sprite.play('player-move')
  }

  private applyDir(dir: number) {
    this.sprite
      .setAngle(dir === DIRS.LEFT ? 0 : ANGLES[dir])
      .setFlip(dir === DIRS.LEFT, false)
    const shift = CELL * 0.4
    const ox = dir === DIRS.RIGHT ? shift : dir === DIRS.LEFT ? -shift : 0
    const oy = dir === DIRS.DOWN ? shift : dir === DIRS.UP ? -shift : 0
    ;(this.sprite.body as Phaser.Physics.Arcade.Body).setCircle(
      CELL * 0.4,
      CELL * 0.6 + ox,
      CELL * 0.6 + oy,
    )
  }

  private get wrapping(): boolean {
    return isWrapping(
      this.tileX,
      this.tileY,
      this.dir,
      this.grid[0].length,
      this.grid.length,
    )
  }

  private updatePosition() {
    const cols = this.grid[0].length
    const rows = this.grid.length
    const { x: fracX, y: fracY } = this.moving
      ? moveFrac(this.tileX, this.tileY, this.dir, this.progress, cols, rows, this.wrapPaused)
      : { x: this.tileX, y: this.tileY }
    this.x = fracX * CELL + CELL
    this.y = fracY * CELL + CELL
    this.sprite.setPosition(this.x, this.y)
    this.sprite.setAlpha(this.dashCooldown > 0 ? 0.5 : 1)
  }

  private isFlip(a: number, b: number): boolean {
    return (a ^ b) === 1
  }

  private turnTo(dir: number) {
    const oldDir = this.dir
    this.dir = dir
    this.spinning = true
    if (this.isFlip(oldDir, dir)) {
      this.spinTimer = FLIP_DURATION
      this.applyDir(dir)
      this.sprite.play('player-flip')
      return
    }
    this.sprite
      .setAngle(0)
      .setFlip(oldDir === 1 || dir === 1, oldDir === 3 || dir === 3)
    this.spinTimer = SPIN_DURATION
    this.sprite.play('player-spin')
  }

  get grid() {
    return this.scene.maze.grid
  }

  update(delta: number, cursors: Phaser.Types.Input.Keyboard.CursorKeys) {
    this.dashCooldown = Math.max(0, this.dashCooldown - delta)

    if (this.wrapPauseTimer > 0) {
      this.wrapPauseTimer -= delta
      if (this.wrapPauseTimer <= 0) {
        this.wrapPauseTimer = 0
        this.progress = 0
        const cols = this.grid[0].length
        const rows = this.grid.length
        const { x: fx, y: fy } = moveFrac(
          this.tileX,
          this.tileY,
          this.dir,
          0,
          cols,
          rows,
          true,
        )
        this.x = fx * CELL + CELL
        this.y = fy * CELL + CELL
        this.sprite.setPosition(this.x, this.y)
        this.sprite.setVisible(true)
      }
      return false
    }

    if (cursors.right.isDown) this.nextDir = DIRS.RIGHT
    else if (cursors.left.isDown) this.nextDir = DIRS.LEFT
    else if (cursors.up.isDown) this.nextDir = DIRS.UP
    else if (cursors.down.isDown) this.nextDir = DIRS.DOWN

    if (this.moving && !this.wrapping && this.isFlip(this.dir, this.nextDir)) {
      const prevDir = this.dir
      this.turnTo(this.nextDir)
      this.tileX = wrapX(this.tileX + DX[prevDir], this.grid[0].length)
      this.tileY = wrapY(this.tileY + DY[prevDir], this.grid.length)
      this.progress = 1 - this.progress
    }

    if (!this.moving && this.nextDir !== this.dir) {
      this.turnTo(this.nextDir)
    }

    const wasMoving = this.moving

    if (Phaser.Input.Keyboard.JustDown(this.zKey) && this.dashCooldown === 0) {
      const tileX = wrapX(this.tileX + DX[this.dir], this.grid[0].length)
      const tileY = wrapY(this.tileY + DY[this.dir], this.grid.length)
      const tileOpen = canMove(this.grid, tileX, tileY, this.dir, false)

      if (tileOpen) {
        this.dashing = true
        this.moving = true
        this.dashDistanceLeft = DASH_DISTANCE
      }
    }
    if (!this.moving) {
      if (canMove(this.grid, this.tileX, this.tileY, this.nextDir, false)) {
        if (this.nextDir !== this.dir) {
          this.turnTo(this.nextDir)
        }
        this.moving = true
      } else if (canMove(this.grid, this.tileX, this.tileY, this.dir, false)) {
        this.moving = true
      }
    }

    if (this.moving && !wasMoving) {
      if (!this.spinning) this.sprite.play('player-move')
    } else if (!this.moving && wasMoving) {
      this.sprite.stop()
    }

    if (this.spinning) {
      this.spinTimer -= delta
      if (this.spinTimer <= 0) {
        this.spinning = false
        this.applyDir(this.dir)
        this.sprite.play('player-move')
      }
    }

    if (this.moving) {
      const moveStep = (PLAYER_SPEED * delta) / 1000
      if (this.dashing) {
        this.dashDistanceLeft -= moveStep * 2
        if (this.dashDistanceLeft <= 0) {
          this.dashing = false
          this.dashCooldown = DASH_COOLDOWN
        }
      }
      this.progress += moveStep * (this.dashing ? 3 : 1)

      if (!this.wrapping && this.tryCornering(cursors)) return true

      if (this.wrapping && !this.wrapPaused && this.progress >= 1) {
        this.progress = 1
        this.wrapPaused = true
        this.wrapPauseTimer = WRAP_DELAY
        this.sprite.setVisible(false)
        this.updatePosition()
        return true
      }

      if (this.progress >= (this.wrapPaused ? 2 : 1)) {
        const threshold = this.wrapPaused ? 2 : 1
        this.wrapPaused = false
        this.progress -= threshold
        this.tileX = wrapX(this.tileX + DX[this.dir], this.grid[0].length)
        this.tileY = wrapY(this.tileY + DY[this.dir], this.grid.length)

        if (canMove(this.grid, this.tileX, this.tileY, this.nextDir, false)) {
          if (this.nextDir !== this.dir) {
            this.turnTo(this.nextDir)
          }
        } else if (
          !this.dashing &&
          !canMove(this.grid, this.tileX, this.tileY, this.dir, false)
        ) {
          this.moving = false
          this.progress = 0
        }

        this.updatePosition()
        return true
      }
    }

    this.updatePosition()
    return false
  }

  private tryCornering(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
  ): boolean {
    if (this.progress < CORNER_THRESHOLD || this.progress >= 1) return false

    const heldDir = cursors.right.isDown
      ? DIRS.RIGHT
      : cursors.left.isDown
        ? DIRS.LEFT
        : cursors.up.isDown
          ? DIRS.UP
          : cursors.down.isDown
            ? DIRS.DOWN
            : -1

    if (heldDir === -1 || heldDir === this.dir) return false

    const destX = wrapX(this.tileX + DX[this.dir], this.grid[0].length)
    const destY = wrapY(this.tileY + DY[this.dir], this.grid.length)
    if (!canMove(this.grid, destX, destY, heldDir, false)) return false

    this.tileX = destX
    this.tileY = destY
    this.progress = 0
    this.turnTo(heldDir)
    this.nextDir = heldDir
    return true
  }

  die() {
    this.spinning = false
    this.sprite.setAngle(0).setFlipX(false).play('player-die')
  }
}
