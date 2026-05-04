import * as Phaser from 'phaser'
import { ANGLES, CELL, DIRS, DX, DY, PLAYER_SPEED } from '../constants'
import { canMove, wrapX } from '../utils'

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

  constructor(
    scene: Phaser.Scene,
    tileX: number,
    tileY: number,
    private grid: number[][],
  ) {
    this.tileX = tileX
    this.tileY = tileY
    this.dir = DIRS.LEFT
    this.nextDir = DIRS.LEFT
    const px = tileX * CELL + CELL / 2
    const py = tileY * CELL + CELL / 2
    this.x = px
    this.y = py
    this.sprite = scene.add
      .sprite(px, py, 'sprites', 0)
      .setDepth(2)
      .setAngle(ANGLES[DIRS.LEFT])
  }

  update(delta: number, cursors: Phaser.Types.Input.Keyboard.CursorKeys) {
    if (cursors.right.isDown) this.nextDir = DIRS.RIGHT
    else if (cursors.left.isDown) this.nextDir = DIRS.LEFT
    else if (cursors.up.isDown) this.nextDir = DIRS.UP
    else if (cursors.down.isDown) this.nextDir = DIRS.DOWN

    const wasMoving = this.moving
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
      this.progress += (PLAYER_SPEED * delta) / 1000
      if (this.progress >= 1) {
        this.progress -= 1
        this.tileX = wrapX(this.tileX + DX[this.dir])
        this.tileY += DY[this.dir]

        if (canMove(this.grid, this.tileX, this.tileY, this.nextDir, false)) {
          this.dir = this.nextDir
          this.sprite.setAngle(ANGLES[this.dir])
        } else if (
          !canMove(this.grid, this.tileX, this.tileY, this.dir, false)
        ) {
          this.moving = false
          this.progress = 0
          this.sprite.stop()
          this.sprite.setFrame(1)
        }

        return true // tile landed — caller should eat dot
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
    return false
  }

  die() {
    this.sprite.setAngle(0)
    this.sprite.play('player-die')
  }
}
