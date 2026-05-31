import * as Phaser from 'phaser'
import {
  ANGLES,
  BUBBLE_EMITTER_CONFIG,
  CELL,
  DASH_COOLDOWN,
  DASH_DISTANCE,
  DIRS,
  DOT_EFFECT_INTERVAL,
  DX,
  DY,
  FLIP_DURATION,
  MAX_PLAYER_SPEED,
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

const BOOST_SUSTAIN = 1250
const BOOST_INC = 0.1
const BOOST_DEC = 0.3

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
  private glowTarget = -1
  private glowSprite!: Phaser.GameObjects.Sprite
  private tintOverlay!: Phaser.GameObjects.Sprite
  spinning = false
  dead = false
  private dashCooldown = 0
  private dashing = false
  private dashDistanceLeft = 0
  private spinTimer = 0
  private cornerX = 0
  private cornerY = 0
  private cornerLerp = 1
  private cornerDir = 0
  private waitingForInput = true
  private boostAmount = 0
  private boostSustainTimer = 0
  private swimTrailTimer = 0
  private wrap = new WrapHelper()
  private zKey: Phaser.Input.Keyboard.Key
  private dotParticles!: Phaser.GameObjects.Particles.ParticleEmitter
  private swimTrail!: Phaser.GameObjects.Particles.ParticleEmitter
  private audioCtx!: AudioContext
  private muted = localStorage.getItem('muted') === 'true'
  private eatToggle = 0
  private dotQueue = 0
  private dotQueueTimer = 0
  private stunned = false
  pendingStun = false
  onTileCross?: () => void
  private swipeDir = -1
  private swipeDash = false
  private touchStartX = 0
  private touchStartY = 0

  constructor(private scene: Game) {
    this.tileX = scene.maze.playerSpawn.x
    this.tileY = scene.maze.playerSpawn.y
    this.dir = DIRS.LEFT
    this.nextDir = DIRS.LEFT
    const px = this.tileX * CELL + CELL
    const py = this.tileY * CELL + CELL
    this.x = px
    this.y = py
    this.sprite = scene.physics.add.sprite(px, py, 'player', 0).setDepth(2)
    this.audioCtx = new AudioContext()
    this.createEatEffects()

    this.zKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
    scene.input
      .keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M)
      .on('down', () => {
        this.muted = !this.muted
        localStorage.setItem('muted', String(this.muted))
      })

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.touchStartX = p.x
      this.touchStartY = p.y
    })
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const dx = p.x - this.touchStartX
      const dy = p.y - this.touchStartY
      const MIN_SWIPE = 20
      if (Math.abs(dx) < MIN_SWIPE && Math.abs(dy) < MIN_SWIPE) return
      const dir =
        Math.abs(dx) >= Math.abs(dy)
          ? dx > 0
            ? DIRS.RIGHT
            : DIRS.LEFT
          : dy > 0
            ? DIRS.DOWN
            : DIRS.UP
      if (dir === this.dir) {
        this.swipeDash = true
      } else {
        this.swipeDir = dir
      }
    })

    this.applyDir(this.dir)
    this.glowSprite
      .setAngle(this.sprite.angle)
      .setFlip(this.sprite.flipX, this.sprite.flipY)
      .setFrame(this.sprite.frame.name)
  }

  get grid() {
    return this.scene.maze.grid
  }

  collectDot() {
    this.dotQueue++
  }

  die() {
    this.dead = true
    this.spinning = false
    this.sprite.setAngle(0).setFlipX(false).play('player-die')
    this.glowSprite.setVisible(false)
    this.tintOverlay.setVisible(false)
  }

  stun() {
    this.stunned = true
    this.moving = false
    this.boostAmount = 0
    this.boostSustainTimer = 0
    this.glowSprite.setVisible(false)
    this.tintOverlay.setAlpha(0)
    this.sprite.setAlpha(0.5).stop()
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.25,
      duration: 200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  unstun() {
    if (this.dead) return
    this.stunned = false
    this.scene.tweens.killTweensOf(this.sprite)
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 1,
      duration: 300,
      onComplete: () => this.glowSprite.setVisible(true),
    })
  }

  update(delta: number, cursors: Phaser.Types.Input.Keyboard.CursorKeys) {
    if (this.stunned) return
    this.dashCooldown = Math.max(0, this.dashCooldown - delta)
    this.dotQueueTimer = Math.max(0, this.dotQueueTimer - delta)
    this.swimTrailTimer = Math.max(0, this.swimTrailTimer - delta)
    if (this.dotQueue > 0 && this.dotQueueTimer === 0) {
      this.dotQueue--
      this.dotQueueTimer = this.dashing
        ? 0
        : DOT_EFFECT_INTERVAL / this.speedRatio ** 2
      this.processDotEat()
    } else if (this.dotQueue === 0 && this.dotQueueTimer === 0) {
      this.scene.tweens.add({
        targets: this.tintOverlay,
        alpha: 0,
        duration: 300,
        ease: 'Sine.easeOut',
      })
    }
    if (this.wrap.tick(delta, this)) return false
    this.body.enable = true
    this.tintOverlay.setVisible(this.sprite.visible)

    if (this.swipeDir !== -1) {
      this.nextDir = this.swipeDir
      this.swipeDir = -1
    } else if (cursors.right.isDown) this.nextDir = DIRS.RIGHT
    else if (cursors.left.isDown) this.nextDir = DIRS.LEFT
    else if (cursors.up.isDown) this.nextDir = DIRS.UP
    else if (cursors.down.isDown) this.nextDir = DIRS.DOWN

    if (this.waitingForInput) {
      const anyDown =
        cursors.right.isDown ||
        cursors.left.isDown ||
        cursors.up.isDown ||
        cursors.down.isDown ||
        this.nextDir !== this.dir
      if (!anyDown) return
      this.waitingForInput = false
    }

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

    const dashPressed =
      Phaser.Input.Keyboard.JustDown(this.zKey) || this.swipeDash
    this.swipeDash = false
    if (dashPressed && !this.dashing && this.dashCooldown === 0) {
      const tileX = wrapX(this.tileX + DX[this.dir], this.grid[0].length)
      const tileY = wrapY(this.tileY + DY[this.dir], this.grid.length)
      const tileOpen = canMove(this.grid, tileX, tileY, this.dir, false)

      if (tileOpen) {
        this.dashing = true
        this.moving = true
        this.dashDistanceLeft = DASH_DISTANCE
        this.addBoost()
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
      if (!this.spinning)
        this.sprite.play({ key: 'player-move', frameRate: 4 * this.speedRatio })
    } else if (!this.moving && wasMoving) {
      this.sprite.stop()
    }

    if (this.spinning) {
      this.spinTimer -= delta
      if (this.spinTimer <= 0) {
        this.spinning = false
        this.applyDir(this.dir)
        this.sprite.play({ key: 'player-move', frameRate: 4 * this.speedRatio })
      }
    }

    if (this.cornerLerp < 1) {
      const CORNER_SPEED = 0.75
      const val = this.cornerLerp + (this.speed * delta * CORNER_SPEED) / 1000
      this.cornerLerp = Math.min(1, val)
    }

    if (this.boostSustainTimer > 0) {
      this.boostSustainTimer = Math.max(0, this.boostSustainTimer - delta)
    } else if (this.boostAmount > 0) {
      const dec = PLAYER_SPEED * BOOST_DEC
      this.boostAmount = Math.max(0, this.boostAmount - dec)
      this.boostSustainTimer = BOOST_SUSTAIN
    }

    this.updateGlow()

    if (this.moving) {
      const moveStep = (this.speed * delta) / 1000
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
        this.tintOverlay.setVisible(false)
        this.body.enable = false
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

        this.onTileCross?.()
        if (this.stunned) {
          this.progress = 0
          this.updatePosition()
          return true
        }

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
          this.sprite.stop()
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
    if (this.progress >= 1) return false

    const heldDir = cursors.right.isDown
      ? DIRS.RIGHT
      : cursors.left.isDown
        ? DIRS.LEFT
        : cursors.up.isDown
          ? DIRS.UP
          : cursors.down.isDown
            ? DIRS.DOWN
            : this.nextDir

    if (heldDir === this.dir) return false

    const { dx, dy } = this.mouthDir
    const REACH = 1
    const mouthX = Math.round((this.x + dx * CELL * REACH - CELL) / CELL)
    const mouthY = Math.round((this.y + dy * CELL * REACH - CELL) / CELL)
    const destX = wrapX(mouthX, this.grid[0].length)
    const destY = wrapY(mouthY, this.grid.length)
    if (!canMove(this.grid, destX, destY, heldDir, false)) return false

    const { x: fracX, y: fracY } = moveFrac(this, this.progress, false)
    this.cornerDir = this.dir
    this.cornerX = fracX * CELL + CELL - (destX * CELL + CELL)
    this.cornerY = fracY * CELL + CELL - (destY * CELL + CELL)
    this.cornerLerp = 0

    this.tileX = destX
    this.tileY = destY
    this.progress = 0
    this.turnTo(heldDir)
    this.nextDir = heldDir
    this.addBoost()

    return true
  }

  private applyDir(dir: number) {
    this.sprite
      .setAngle(dir === DIRS.LEFT ? 0 : ANGLES[dir])
      .setFlip(dir === DIRS.LEFT, false)
  }

  private updateBodyCircle() {
    const radius = this.spinning ? CELL * 0.7 : CELL * 0.4
    const { dx, dy } = this.mouthDir
    const shift = CELL * 0.55
    const offset = CELL - radius
    this.body.setCircle(radius, offset + dx * shift, offset + dy * shift)
  }

  private updateGlow() {
    const target = this.speedRatio >= 1.9 ? 1.5 : 0.5
    if (target !== this.glowTarget) {
      this.glowTarget = target
      this.scene.tweens.killTweensOf(this.glow)
      this.scene.tweens.add({
        targets: this.glow,
        outerStrength: target,
        duration: 300,
        ease: 'Sine.easeInOut',
      })
    }
  }

  private updatePosition() {
    const { x: fracX, y: fracY } = this.moving
      ? moveFrac(this, this.progress, this.wrap.active)
      : { x: this.tileX, y: this.tileY }
    const arc =
      (1 + Math.cos(this.cornerLerp * Math.PI)) / 2 -
      Math.sin(this.cornerLerp * Math.PI) * 0.2
    this.x = fracX * CELL + CELL + this.cornerX * arc
    this.y = fracY * CELL + CELL + this.cornerY * arc
    this.sprite.setPosition(this.x, this.y)
    this.updateBodyCircle()

    if (this.moving && this.swimTrailTimer === 0) {
      const { dx, dy } = this.mouthDir
      const tailX = this.x - dx * CELL * 0.7
      const tailY = this.y - dy * CELL * 0.7
      const count = this.speedRatio >= 2 ? 2 : 1
      const interval =
        this.speedRatio >= 2 ? 50 : this.speedRatio >= 1.5 ? 100 : 500
      this.swimTrail.emitParticleAt(tailX, tailY, count)
      this.swimTrailTimer = interval
    }
    // this.sprite.setAlpha(this.dashCooldown > 0 ? 0.5 : 1)
    this.glowSprite
      .setPosition(this.x, this.y)
      .setAngle(this.sprite.angle)
      .setFlip(this.sprite.flipX, this.sprite.flipY)
      .setFrame(this.sprite.frame.name)
    this.tintOverlay
      .setPosition(this.x, this.y)
      .setAngle(this.sprite.angle)
      .setFlip(this.sprite.flipX, this.sprite.flipY)
      .setFrame(this.sprite.frame.name)
  }

  private isFlip(a: number, b: number): boolean {
    return (a ^ b) === 1
  }

  private turnTo(dir: number) {
    const oldDir = this.dir
    this.dir = dir
    this.spinning = true
    if (this.isFlip(oldDir, dir)) {
      this.spinTimer = FLIP_DURATION / this.speedRatio
      this.applyDir(dir)
      this.sprite.play('player-flip')
      this.boostAmount = 0
      this.boostSustainTimer = 0
      return
    }
    this.sprite
      .setAngle(0)
      .setFlip(oldDir === 1 || dir === 1, oldDir === 3 || dir === 3)
    this.spinTimer = SPIN_DURATION / this.speedRatio
    const spinFrameRate = 15 * this.speedRatio
    if (this.dir === 0 || this.dir === 1)
      this.sprite.play({ key: 'player-spin-2', frameRate: spinFrameRate })
    else this.sprite.play({ key: 'player-spin', frameRate: spinFrameRate })
  }

  private addBoost() {
    this.boostAmount += PLAYER_SPEED * BOOST_INC
    this.boostAmount = Math.min(4, this.boostAmount)
    this.boostSustainTimer = BOOST_SUSTAIN
  }

  private get speed(): number {
    return Math.min(PLAYER_SPEED + this.boostAmount, MAX_PLAYER_SPEED)
  }

  private get speedRatio(): number {
    return this.speed / PLAYER_SPEED
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

  private get mouthDir(): { dx: number; dy: number } {
    const t = (1 - Math.cos(this.cornerLerp * Math.PI)) / 2
    const lerp = (a: number, b: number) => a + (b - a) * t
    return {
      dx: lerp(DX[this.cornerDir], DX[this.dir]),
      dy: lerp(DY[this.cornerDir], DY[this.dir]),
    }
  }

  private get body() {
    return this.sprite.body as Phaser.Physics.Arcade.Body
  }
  private get angle() {
    const { dx, dy } = this.mouthDir
    return Math.atan2(-dy, -dx)
  }

  private get mouthPosition() {
    const { dx, dy } = this.mouthDir
    const reach = CELL * 1.2
    return {
      x: this.x + dx * reach,
      y: this.y + dy * reach,
    }
  }

  private createEatEffects() {
    this.glowSprite = this.scene.add
      .sprite(this.x, this.y, 'player', 0)
      .setDepth(1)
    this.glow = this.glowSprite
      .enableFilters()
      .filters!.external.addGlow(0xff9900, 0, 0, 1, false, 30, 20)
    this.glow.outerStrength = 0.5
    this.tintOverlay = this.scene.add
      .sprite(this.x, this.y, 'player', 0)
      .setDepth(3)
      .setTint(0xff7700)
      .setTintMode(Phaser.TintModes.FILL)
      .setAlpha(0)

    this.dotParticles = this.scene.add
      .particles(0, 0, 'dots', {
        frame: 2,
        scale: { start: 0.7, end: 0 },
        lifespan: { min: 300, max: 600 },
        emitting: false,
      })
      .setDepth(-1)

    this.swimTrail = this.scene.add
      .particles(0, 0, 'dots', BUBBLE_EMITTER_CONFIG)
      .setDepth(1)
  }

  private processDotEat() {
    this.playEatSound()
    this.fireEatParticles()
    this.scene.tweens.killTweensOf(this.tintOverlay)
    this.tintOverlay.setAlpha(0.5)
  }

  private fireEatParticles() {
    const { x, y } = this.mouthPosition
    const count = Math.max(
      1,
      Math.round((2 + Math.random() * 3) / this.speedRatio),
    )
    for (let i = 0; i < count; i++) {
      const angle = this.angle + Math.PI + (Math.random() - 0.5) * (Math.PI / 2)
      const speed = (20 + Math.random() * 40) * this.speedRatio
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
    const freq =
      (this.eatToggle === 0 ? 320 : 220) *
      jitter *
      (this.speedRatio >= 2 ? 1.5 : this.speedRatio >= 1.5 ? 1.25 : 1)

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
