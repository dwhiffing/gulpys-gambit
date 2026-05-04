import * as Phaser from 'phaser'
import * as C from '../constants'
import { canMove, wrapX } from '../utils'

const { CHASE, SCARED, EATEN, EXITING, JAILED } = C.GHOST_STATE

const OPPOSITE = [C.DIRS.LEFT, C.DIRS.RIGHT, C.DIRS.DOWN, C.DIRS.UP]

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

  constructor(
    scene: Phaser.Scene,
    tileX: number,
    tileY: number,
    dir: number,
    exitDelay: number,
    private grid: number[][],
    private index: number,
  ) {
    this.tileX = tileX
    this.tileY = tileY
    this.dir = dir
    this.exitDelay = exitDelay
    this.state = EXITING
    const px = tileX * C.CELL + C.CELL / 2
    const py = tileY * C.CELL + C.CELL / 2
    this.x = px
    this.y = py
    this.sprite = scene.add.sprite(px, py, 'sprites', 19).setDepth(2)
    this.sprite.play('ghost-up')
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
    if (this.state !== EATEN && this.state !== EXITING && this.state !== JAILED) {
      this.state = SCARED
      this.scaredTimer = C.POWER_DURATION
      this.sprite.setAlpha(1)
      this.sprite.play('ghost-scared', true)
    }
  }

  private playAnim() {
    if (this.state === EATEN) {
      this.sprite.stop()
      this.sprite.setFrame([24, 25, 26, 27][this.dir])
    } else if (this.state === JAILED) {
      this.sprite.stop()
      this.sprite.setFrame([24, 25, 26, 27][this.dir])
    } else if (this.state === SCARED) {
      this.sprite.play('ghost-scared', true)
    } else {
      this.sprite.play(
        ['ghost-right', 'ghost-left', 'ghost-up', 'ghost-down'][this.dir],
        true,
      )
    }
  }

  private chooseDir(playerTileX: number, playerTileY: number): number {
    const target =
      this.state === EATEN
        ? C.JAIL_POSITIONS[this.index]
        : this.state === EXITING
          ? { x: C.EXIT_TX, y: C.EXIT_TY }
          : { x: playerTileX, y: playerTileY }

    let bestDir = -1
    let bestDist = this.state === SCARED ? -Infinity : Infinity

    const canUseDoor = this.state === EATEN || this.state === EXITING
    for (let dir = 0; dir < 4; dir++) {
      if (dir === OPPOSITE[this.dir]) continue
      if (!canMove(this.grid, this.tileX, this.tileY, dir, canUseDoor)) continue
      const nx = wrapX(this.tileX + C.DX[dir])
      const ny = this.tileY + C.DY[dir]
      const dist = Math.hypot(nx - target.x, ny - target.y)
      if (this.state === SCARED ? dist > bestDist : dist < bestDist) {
        bestDist = dist
        bestDir = dir
      }
    }

    if (
      bestDir === -1 &&
      canMove(this.grid, this.tileX, this.tileY, OPPOSITE[this.dir], canUseDoor)
    )
      bestDir = OPPOSITE[this.dir]

    return bestDir
  }

  update(delta: number, playerTileX: number, playerTileY: number) {
    if (this.state === JAILED) {
      this.jailTimer -= delta
      if (this.jailTimer <= 0) {
        this.state = EXITING
        this.playAnim()
      } else {
        const jail = C.JAIL_POSITIONS[this.index]
        this.x = jail.x * C.CELL + C.CELL / 2
        this.y = jail.y * C.CELL + C.CELL / 2
        this.sprite.setPosition(this.x, this.y)
      }
      return
    }

    if (this.state === EXITING) {
      if (this.exitDelay > 0) {
        this.exitDelay -= delta
        return
      }
      if (this.tileX === C.EXIT_TX && this.tileY === C.EXIT_TY) {
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
      this.tileX = wrapX(this.tileX + C.DX[this.dir])
      this.tileY += C.DY[this.dir]

      const jail = C.JAIL_POSITIONS[this.index]
      if (this.state === EATEN && this.tileX === jail.x && this.tileY === jail.y) {
        this.state = JAILED
        this.jailTimer = 1000
        this.progress = 0
        this.playAnim()
      } else if (
        this.state === EXITING &&
        this.tileX === C.EXIT_TX &&
        this.tileY === C.EXIT_TY
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
  }
}
