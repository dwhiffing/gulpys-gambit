import * as Phaser from 'phaser'
import {
  ANGLES,
  CELL,
  CORNER_THRESHOLD,
  DASH_COOLDOWN,
  DASH_DISTANCE,
  DIRS,
  DOT_EFFECT_INTERVAL,
  DX,
  DY,
  FLIP_DURATION,
  PLAYER_SPEED,
  SPIN_DURATION,
} from '../constants'
import type { Game } from '../scenes/Game'
import {
  canMove,
  isWrapping,
  moveFrac,
  WrapHelper,
  wrapX,
  wrapY,
} from '../utils'

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
  private glow!: Phaser.Filters.Glow
  private tintOverlay!: Phaser.GameObjects.Sprite
  spinning = false
  private dashCooldown = 0
  private dashing = false
  private dashDistanceLeft = 0
  private spinTimer = 0
  private wrap = new WrapHelper()
  private zKey: Phaser.Input.Keyboard.Key
  private dotParticles!: Phaser.GameObjects.Particles.ParticleEmitter
  private audioCtx!: AudioContext
  private muted = localStorage.getItem('muted') === 'true'
  private eatToggle = 0
  private dotQueue = 0
  private dotQueueTimer = 0

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
    this.audioCtx = new AudioContext()
    this.createEatEffects()

    this.zKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
    scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => {
      this.muted = !this.muted
      localStorage.setItem('muted', String(this.muted))
    })
    this.applyDir(this.dir)
    this.sprite.play('player-move')
  }

  get grid() {
    return this.scene.maze.grid
  }

  collectDot() {
    this.dotQueue++
  }

  die() {
    this.spinning = false
    this.sprite.setAngle(0).setFlipX(false).play('player-die')
  }

  update(delta: number, cursors: Phaser.Types.Input.Keyboard.CursorKeys) {
    this.dashCooldown = Math.max(0, this.dashCooldown - delta)
    this.dotQueueTimer = Math.max(0, this.dotQueueTimer - delta)
    if (this.dotQueue > 0 && this.dotQueueTimer === 0) {
      this.dotQueue--
      this.dotQueueTimer = DOT_EFFECT_INTERVAL
      this.processDotEat()
    }
    if (this.wrap.tick(delta, this)) return false

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

    if (
      Phaser.Input.Keyboard.JustDown(this.zKey) &&
      !this.dashing &&
      this.dashCooldown === 0
    ) {
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

      if (this.wrapping && !this.wrap.active && this.progress >= 2) {
        this.progress = 2
        this.wrap.trigger()
        this.sprite.setVisible(false)
        this.updatePosition()
        return true
      }

      if (
        (!this.wrapping || this.wrap.active) &&
        this.progress >= this.wrap.threshold
      ) {
        this.progress -= this.wrap.threshold
        this.wrap.active = false
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

  private updatePosition() {
    const { x: fracX, y: fracY } = this.moving
      ? moveFrac(this, this.progress, this.wrap.active)
      : { x: this.tileX, y: this.tileY }
    this.x = fracX * CELL + CELL
    this.y = fracY * CELL + CELL
    this.sprite.setPosition(this.x, this.y)
    this.sprite.setAlpha(this.dashCooldown > 0 ? 0.5 : 1)
    this.tintOverlay
      .setPosition(this.x, this.y)
      .setAngle(this.sprite.angle)
      .setFlip(this.sprite.flipX, this.sprite.flipY)
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

  private get wrapping(): boolean {
    return isWrapping(
      this.tileX,
      this.tileY,
      this.dir,
      this.grid[0].length,
      this.grid.length,
    )
  }

  private get angle() {
    return Math.atan2(-DY[this.dir], -DX[this.dir])
  }

  private get mouthPosition() {
    const reach = CELL * 1.2
    return {
      x: this.x + DX[this.dir] * reach,
      y: this.y + DY[this.dir] * reach,
    }
  }

  private createEatEffects() {
    this.glow = this.sprite
      .enableFilters()
      .filters!.external.addGlow(0xff9900, 0, 0, 1, false, 30, 20)
    this.tintOverlay = this.scene.add
      .sprite(this.x, this.y, 'player', 0)
      .setDepth(3)
      .setTint(0xff7700)
      .setTintMode(Phaser.TintModes.FILL)
      .setAlpha(0)

    this.dotParticles = this.scene.add
      .particles(0, 0, 'dots', {
        frame: 2,
        scale: { start: 1, end: 0 },
        lifespan: { min: 300, max: 600 },
        emitting: false,
      })
      .setDepth(-1)

    this.scene.tweens.killTweensOf(this.glow).add({
      targets: this.glow,
      outerStrength: { from: 0.5, to: 1.5 },
      duration: 800,
      yoyo: true,
      ease: 'sine.inOut',
      repeat: -1,
    })
  }

  private processDotEat() {
    this.playEatSound()
    this.fireEatParticles()
    this.scene.tweens.killTweensOf(this.tintOverlay).add({
      targets: this.tintOverlay,
      alpha: { from: 0, to: 0.5 },
      duration: DOT_EFFECT_INTERVAL,
      ease: 'Sine.easeInOut',
      yoyo: true,
    })
  }

  private fireEatParticles() {
    const { x, y } = this.mouthPosition
    const count = 5 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      const angle = this.angle + Math.PI + (Math.random() - 0.5) * (Math.PI / 2)
      const speed = 20 + Math.random() * 40
      const p = this.dotParticles.emitParticleAt(x, y, 1)
      if (p) {
        p.velocityX = Math.cos(angle) * speed
        p.velocityY = Math.sin(angle) * speed
      }
    }
  }

  private playEatSound() {
    if (this.muted) return
    const jitter = 1 + (Math.random() - 0.5) * 0.08
    const freq = (this.eatToggle === 0 ? 320 : 220) * jitter
    this.eatToggle = 1 - this.eatToggle
    eatSound(this.audioCtx, freq * 1.2, freq * 0.2, 0.1, 0.06)
  }
}

const eatSound = (
  ac: AudioContext,
  startFreq: number,
  endFreq: number,
  dur: number,
  vol: number,
) => {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  const now = ac.currentTime
  osc.type = 'sine'
  osc.frequency.setValueAtTime(startFreq, now)
  osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur)
  osc.connect(gain)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(vol, now + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  gain.gain.setValueAtTime(0, now + dur + 0.002)
  osc.start(now)
  osc.stop(now + dur + 0.003)
  gain.connect(ac.destination)
}
