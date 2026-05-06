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
  PLAYER_SPEED,
} from '../constants'
import type { Game } from '../scenes/Game'
import { canMove, wrapX, wrapY } from '../utils'

export class PlayerSprite {
  tileX: number
  tileY: number
  progress = 0
  dir: number
  nextDir: number
  moving = false
  x: number
  y: number
  sprite: Phaser.GameObjects.Sprite
  private dashCooldown = 0
  private dashing = false
  private dashDistanceLeft = 0
  private zKey: Phaser.Input.Keyboard.Key
  constructor(private scene: Game) {
    this.tileX = scene.maze.playerSpawn.x
    this.tileY = scene.maze.playerSpawn.y
    this.dir = DIRS.LEFT
    this.nextDir = DIRS.LEFT
    const px = this.tileX * CELL + CELL / 2
    const py = this.tileY * CELL + CELL / 2
    this.x = px
    this.y = py
    this.sprite = scene.add
      .sprite(px, py, 'sprites', 0)
      .setDepth(2)
      .setAngle(ANGLES[DIRS.LEFT])
    this.zKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
  }

  get grid() {
    return this.scene.maze.grid
  }

  update(delta: number, cursors: Phaser.Types.Input.Keyboard.CursorKeys) {
    this.dashCooldown = Math.max(0, this.dashCooldown - delta)

    if (cursors.right.isDown) this.nextDir = DIRS.RIGHT
    else if (cursors.left.isDown) this.nextDir = DIRS.LEFT
    else if (cursors.up.isDown) this.nextDir = DIRS.UP
    else if (cursors.down.isDown) this.nextDir = DIRS.DOWN

    if (!this.moving && this.nextDir !== this.dir) {
      this.dir = this.nextDir
      this.sprite.setAngle(ANGLES[this.dir])
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
        this.dir = this.nextDir
        this.sprite.setAngle(ANGLES[this.dir])
        this.moving = true
      } else if (canMove(this.grid, this.tileX, this.tileY, this.dir, false)) {
        this.moving = true
      }
    }

    if (this.moving && !wasMoving) {
      this.sprite.play('player-move')
    } else if (!this.moving && wasMoving) {
      this.sprite.stop()
      if (this.sprite.frame.name === '0') this.sprite.setFrame(1)
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

      if (this.tryCornering(cursors)) return true

      if (this.progress >= 1) {
        this.progress -= 1
        this.tileX = wrapX(this.tileX + DX[this.dir], this.grid[0].length)
        this.tileY = wrapY(this.tileY + DY[this.dir], this.grid.length)

        if (canMove(this.grid, this.tileX, this.tileY, this.nextDir, false)) {
          this.dir = this.nextDir
          this.sprite.setAngle(ANGLES[this.dir])
        } else if (
          !this.dashing &&
          !canMove(this.grid, this.tileX, this.tileY, this.dir, false)
        ) {
          this.moving = false
          this.progress = 0
          this.sprite.stop().setFrame(1)
        }

        return true
      }
    }

    const fracX = this.moving
      ? this.tileX + DX[this.dir] * this.progress
      : this.tileX
    const fracY = this.moving
      ? this.tileY + DY[this.dir] * this.progress
      : this.tileY
    this.x = fracX * CELL + CELL / 2
    this.y = fracY * CELL + CELL / 2
    this.sprite.setPosition(this.x, this.y)
    this.sprite.setAlpha(this.dashCooldown > 0 ? 0.5 : 1)
    return false
  }

  // Cornering: if the player is actively holding a perpendicular direction,
  // that turn is valid at the destination tile, and we're past the threshold,
  // snap to the corner early (saves the remaining progress).
  // Does NOT trigger for buffered/queued inputs — key must be held right now.
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
    this.dir = heldDir
    this.nextDir = heldDir
    this.sprite.setAngle(ANGLES[this.dir])
    return true
  }

  die() {
    this.sprite.setAngle(0)
    this.sprite.play('player-die')
  }
}
