import * as Phaser from 'phaser'
import { CELL, DX, DY, TILES } from './constants'
import type { MazeConfig } from './mazeConfig'

export interface TilePos {
  x: number
  y: number
}

export type EnemyType =
  | 'naut'
  // | 'teeth1'
  | 'angler1'
  | 'oct'
  // | 'blob'
  | 'roach'
  | 'teeth2'
// | 'teeth3'
// | 'angler2'
// | 'turtle'

export interface Spawner {
  position: TilePos
  enemyType: EnemyType
}

export class Maze {
  readonly grid: number[][]
  readonly dotGroup: Phaser.Physics.Arcade.StaticGroup
  readonly cols: number
  readonly rows: number
  readonly spawners: Spawner[]
  readonly playerSpawn: TilePos
  private glowContainer!: Phaser.GameObjects.Container
  private glowSprites: Array<{
    dot: Phaser.Physics.Arcade.Sprite
    img: Phaser.GameObjects.Image
    phase: number
  }> = []
  private walls: Phaser.GameObjects.Sprite[]

  constructor(
    private scene: Phaser.Scene,
    config: MazeConfig,
  ) {
    const result = generateMaze(config)
    this.grid = result.grid
    this.cols = result.cols
    this.rows = result.rows
    this.spawners = result.spawners
    this.playerSpawn = result.playerSpawn
    this.walls = []
    this.dotGroup = this.scene.physics.add.staticGroup()
    this.createGlowTextures(scene)
    this.glowContainer = scene.add.container(0, 0).setDepth(1)
    this.createSprites()
  }

  private createGlowTextures(scene: Phaser.Scene) {
    for (const [key, radius, color] of [
      ['dot-glow', CELL * 0.6, 0xaa7711],
      ['power-glow', CELL * 1, 0xff8800],
    ] as [string, number, number][]) {
      if (scene.textures.exists(key)) continue
      const size = Math.ceil(radius * 2)
      const g = scene.make.graphics({ x: 0, y: 0 }, false)
      const steps = 20
      for (let i = steps; i >= 1; i--) {
        const r = (i / steps) * radius
        const a = (1 - i / steps) * 0.2
        g.fillStyle(color, a).fillCircle(size / 2, size / 2, r)
      }
      g.generateTexture(key, size, size).destroy()
    }
  }

  addDotGlow(dot: Phaser.Physics.Arcade.Sprite, power: boolean) {
    const key = power ? 'power-glow' : 'dot-glow'
    const img = this.scene.add
      .image(dot.x, dot.y, key)
      .setBlendMode(Phaser.BlendModes.ADD)
    this.glowContainer.add(img)
    const phase = (dot.x + dot.y) / CELL
    this.glowSprites.push({ dot, img, phase })
  }

  hideAllGlows() {
    for (const { img } of this.glowSprites) {
      img.setVisible(false)
    }
  }

  updateGlow(time: number) {
    const speed = 0.003
    for (const { dot, img, phase } of this.glowSprites) {
      if (!dot.active) {
        if (img.visible) img.setVisible(false)
        continue
      }
      const t = Math.cos(time * speed - phase) * 0.5 + 0.5
      const lo = 0.05
      const hi = 0.9
      img.setAlpha(lo + Math.pow(t, 2) * (hi - lo))
    }
  }

  private createSprites() {
    // Walls
    const isWall = (tx: number, ty: number) =>
      tx < 0 ||
      tx >= this.cols ||
      ty < 0 ||
      ty >= this.rows ||
      this.grid[ty][tx] === TILES.WALL ||
      this.grid[ty][tx] === TILES.DOOR
    const isOob = (tx: number, ty: number) =>
      tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const t = this.grid[y][x]
        if (t === TILES.WALL || t === TILES.DOOR) {
          const px = x * CELL + CELL / 2
          const py = y * CELL + CELL / 2
          let frame: number
          if (t === TILES.DOOR) {
            frame = 1
          } else {
            // 8-bit bitmask: bits 0-3 = N/E/S/W cardinals, bits 4-7 = NE/SE/SW/NW diagonals.
            // Diagonals are zeroed when either adjacent cardinal is open (they are irrelevant then).
            const n = isWall(x, y - 1)
            const e = isWall(x + 1, y)
            const s = isWall(x, y + 1)
            const w = isWall(x - 1, y)
            const ne = n && e && !isOob(x + 1, y - 1)
            const se = s && e && !isOob(x + 1, y + 1)
            const sw = s && w && !isOob(x - 1, y + 1)
            const nw = n && w && !isOob(x - 1, y - 1)
            const mask =
              (n ? 1 : 0) |
              (e ? 2 : 0) |
              (s ? 4 : 0) |
              (w ? 8 : 0) |
              (ne ? 16 : 0) |
              (se ? 32 : 0) |
              (sw ? 64 : 0) |
              (nw ? 128 : 0)
            frame = wallFrame(mask)
          }
          this.walls.push(this.scene.add.sprite(px, py, 'tiles', frame))
        }
      }
    }

    // Dots placed at the center of each stride-3 passage unit rather than per-tile.
    // The maze uses a stride-3 layout: each logical cell (lc,lr) is a 2×2 tile block
    // at tile positions (lc*3+1..lc*3+2, lr*3+1..lr*3+2).
    const S = 3
    const fullLcols = (this.cols - 1) / S
    const fullLrows = (this.rows - 1) / S

    const hasDot = (tx: number, ty: number) => {
      if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return false
      return (
        this.grid[ty][tx] === TILES.DOT || this.grid[ty][tx] === TILES.POWER
      )
    }
    const hasPower = (tx: number, ty: number) =>
      this.grid[ty]?.[tx] === TILES.POWER

    const cellTiles = (lc: number, lr: number): [number, number][] => [
      [lc * S + 1, lr * S + 1],
      [lc * S + 2, lr * S + 1],
      [lc * S + 1, lr * S + 2],
      [lc * S + 2, lr * S + 2],
    ]

    const addDot = (px: number, py: number, power: boolean) => {
      const frame = power ? 3 : 2
      const sprite = this.dotGroup.create(
        px,
        py,
        'dots',
        frame,
      ) as Phaser.Physics.Arcade.Sprite
      const body = sprite.body as Phaser.Physics.Arcade.StaticBody
      body.setCircle(CELL / 8).setOffset(CELL - CELL / 8, CELL - CELL / 8)
      this.addDotGlow(sprite, power)
    }

    // 2×2 cell blocks
    for (let lr = 0; lr < fullLrows; lr++) {
      for (let lc = 0; lc < fullLcols; lc++) {
        const tiles = cellTiles(lc, lr)
        if (!tiles.some(([tx, ty]) => hasDot(tx, ty))) continue
        const power = tiles.some(([tx, ty]) => hasPower(tx, ty))
        addDot((lc * S + 2) * CELL, (lr * S + 2) * CELL, power)
      }
    }

    // Horizontal connectors: column lc*3+3, rows lr*3+1..lr*3+2
    for (let lr = 0; lr < fullLrows; lr++) {
      for (let lc = 0; lc < fullLcols - 1; lc++) {
        const cx = lc * S + S
        const tiles: [number, number][] = [
          [cx, lr * S + 1],
          [cx, lr * S + 2],
        ]
        if (!tiles.some(([tx, ty]) => hasDot(tx, ty))) continue
        const power = tiles.some(([tx, ty]) => hasPower(tx, ty))
        addDot(cx * CELL + CELL / 2, (lr * S + 2) * CELL, power)
      }
    }

    // Vertical connectors: row lr*3+3, cols lc*3+1..lc*3+2
    for (let lc = 0; lc < fullLcols; lc++) {
      for (let lr = 0; lr < fullLrows - 1; lr++) {
        const ry = lr * S + S
        const tiles: [number, number][] = [
          [lc * S + 1, ry],
          [lc * S + 2, ry],
        ]
        if (!tiles.some(([tx, ty]) => hasDot(tx, ty))) continue
        const power = tiles.some(([tx, ty]) => hasPower(tx, ty))
        addDot((lc * S + 2) * CELL, ry * CELL + CELL / 2, power)
      }
    }

    // Midpoint dots on each side of every H-connector
    for (let lr = 0; lr < fullLrows; lr++) {
      for (let lc = 0; lc < fullLcols - 1; lc++) {
        const hcx = lc * S + S
        const hTiles: [number, number][] = [
          [hcx, lr * S + 1],
          [hcx, lr * S + 2],
        ]
        if (!hTiles.some(([tx, ty]) => hasDot(tx, ty))) continue
        const connX = hcx * CELL + CELL / 2
        const connY = (lr * S + 2) * CELL

        // Left cell → connector
        if (cellTiles(lc, lr).some(([tx, ty]) => hasDot(tx, ty))) {
          const leftX = (lc * S + 2) * CELL
          addDot((leftX + connX) / 2, connY, false)
        }

        // Connector → right cell
        if (cellTiles(lc + 1, lr).some(([tx, ty]) => hasDot(tx, ty))) {
          const rightX = ((lc + 1) * S + 2) * CELL
          addDot((connX + rightX) / 2, connY, false)
        }
      }
    }

    // Midpoint dots on each side of every V-connector
    for (let lc = 0; lc < fullLcols; lc++) {
      for (let lr = 0; lr < fullLrows - 1; lr++) {
        const vry = lr * S + S
        const vTiles: [number, number][] = [
          [lc * S + 1, vry],
          [lc * S + 2, vry],
        ]
        if (!vTiles.some(([tx, ty]) => hasDot(tx, ty))) continue
        const connX = (lc * S + 2) * CELL
        const connY = vry * CELL + CELL / 2

        // Top cell → connector
        if (cellTiles(lc, lr).some(([tx, ty]) => hasDot(tx, ty))) {
          const topY = (lr * S + 2) * CELL
          addDot(connX, (topY + connY) / 2, false)
        }

        // Connector → bottom cell
        if (cellTiles(lc, lr + 1).some(([tx, ty]) => hasDot(tx, ty))) {
          const botY = ((lr + 1) * S + 2) * CELL
          addDot(connX, (connY + botY) / 2, false)
        }
      }
    }
  }
}

// Maps an 8-bit wall mask to a tile frame index.
// Bits 0-3: cardinals N(1) E(2) S(4) W(8).
// Bits 4-7: diagonals NE(16) SE(32) SW(64) NW(128) — only set when the diagonal is in-bounds (OOB = open inner corner).
// Frames 0-15:  all 4-bit cardinal combinations (no inner corners).
// Frames 16-27: inner-corner variants for 3-way (T) junctions.
//   cardinals=7  (N+E+S): NE-open→16, SE-open→17, both-open→18
//   cardinals=11 (N+E+W): NE-open→19, NW-open→20, both-open→21
//   cardinals=13 (N+S+W): NW-open→22, SW-open→23, both-open→24
//   cardinals=14 (E+S+W): SE-open→25, SW-open→26, both-open→27
// Frames 28-42: inner-corner variants for 4-way junctions (cardinals=15).
//   single open:   NE→28, SE→29, SW→30, NW→31
//   two adj open:  NE+SE→32, SE+SW→33, SW+NW→34, NW+NE→35
//   two opp open:  NE+SW→36, SE+NW→37
//   three open:    NE+SE+SW→38, SE+SW+NW→39, SW+NW+NE→40, NW+NE+SE→41
//   all open:      42
// Frames 43-46: inner-corner variants for 2-way L-corners.
//   cardinals=3  (N+E): NE-open→43
//   cardinals=6  (E+S): SE-open→44
//   cardinals=9  (N+W): NW-open→45
//   cardinals=12 (S+W): SW-open→46
function wallFrame(mask: number): number {
  const cardinals = mask & 0xf
  const ne = (mask >> 4) & 1 // 1 = diagonal wall present (corner filled), 0 = open inner corner
  const se = (mask >> 5) & 1
  const sw = (mask >> 6) & 1
  const nw = (mask >> 7) & 1

  switch (cardinals) {
    case 3: // N+E — potential inner corner: NE
      if (!ne) return 43
      break
    case 6: // E+S — potential inner corner: SE
      if (!se) return 44
      break
    case 9: // N+W — potential inner corner: NW
      if (!nw) return 45
      break
    case 12: // S+W — potential inner corner: SW
      if (!sw) return 46
      break
    case 7: // N+E+S, W open — potential inner corners: NE, SE
      if (!ne && se) return 16
      if (ne && !se) return 17
      if (!ne && !se) return 18
      break
    case 11: // N+E+W, S open — potential inner corners: NE, NW
      if (!ne && nw) return 19
      if (ne && !nw) return 20
      if (!ne && !nw) return 21
      break
    case 13: // N+S+W, E open — potential inner corners: NW, SW
      if (!nw && sw) return 22
      if (nw && !sw) return 23
      if (!nw && !sw) return 24
      break
    case 14: // E+S+W, N open — potential inner corners: SE, SW
      if (!se && sw) return 25
      if (se && !sw) return 26
      if (!se && !sw) return 27
      break
    case 15: // N+E+S+W — potential inner corners: NE, SE, SW, NW
      if (!ne && se && sw && nw) return 28
      if (ne && !se && sw && nw) return 29
      if (ne && se && !sw && nw) return 30
      if (ne && se && sw && !nw) return 31
      if (!ne && !se && sw && nw) return 32
      if (ne && !se && !sw && nw) return 33
      if (ne && se && !sw && !nw) return 34
      if (!ne && se && sw && !nw) return 35
      if (!ne && se && !sw && nw) return 36
      if (ne && !se && sw && !nw) return 37
      if (!ne && !se && !sw && nw) return 38
      if (ne && !se && !sw && !nw) return 39
      if (!ne && se && !sw && !nw) return 40
      if (!ne && !se && sw && !nw) return 41
      if (!ne && !se && !sw && !nw) return 42
      break
  }
  return cardinals
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

interface GenerateResult {
  grid: number[][]
  cols: number
  rows: number
  spawners: Spawner[]
  playerSpawn: TilePos
}

function generateMaze(config: MazeConfig): GenerateResult {
  const { symmetry, loopFactor, wraps } = config

  // Stride-3 mapping for 2-tile-wide passages:
  //   Cell (lc,lr) → 2×2 block at [lc*3+1..lc*3+2, lr*3+1..lr*3+2]
  //   Wall between cells at col lc*3+3 (horiz) / row lr*3+3 (vert)
  //   Grid dimensions: cols = 3*LCOLS + 1, rows = 3*LROWS + 1
  let fullLcols = Math.floor((config.cols - 1) / 3)
  let fullLrows = Math.floor((config.rows - 1) / 3)
  if (fullLcols < 1) fullLcols = 1
  if (fullLrows < 1) fullLrows = 1

  // For symmetry modes, ensure even logical dims so the centre falls on a pillar (×3)
  if (symmetry !== 'none') {
    if (fullLcols % 2 !== 0) fullLcols = Math.max(fullLcols - 1, 2)
    if (symmetry === 'quad' && fullLrows % 2 !== 0)
      fullLrows = Math.max(fullLrows - 1, 2)
  }

  const cols = 3 * fullLcols + 1
  const rows = 3 * fullLrows + 1

  // ── Initialise all-wall grid ─────────────────────────────────────────────
  const grid: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(TILES.WALL),
  )

  // ── DFS logical-grid dimensions per symmetry mode ───────────────────────
  const halfLcols = Math.ceil(fullLcols / 2)
  const quadLrows = Math.ceil(fullLrows / 2)

  const LCOLS = symmetry === 'none' ? fullLcols : halfLcols
  const LROWS = symmetry === 'quad' ? quadLrows : fullLrows

  const halfCol = Math.floor((cols - 1) / 2)
  const halfRow = Math.floor((rows - 1) / 2)

  const visited: boolean[][] = Array.from({ length: LROWS }, () =>
    Array(LCOLS).fill(false),
  )

  function carve(lc: number, lr: number): void {
    visited[lr][lc] = true
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++)
        grid[lr * 3 + 1 + dy][lc * 3 + 1 + dx] = TILES.EMPTY

    for (const dir of shuffle([0, 1, 2, 3])) {
      const nc = lc + DX[dir]
      const nr = lr + DY[dir]
      if (nc < 0 || nc >= LCOLS || nr < 0 || nr >= LROWS) continue
      if (visited[nr][nc]) continue
      if (DX[dir] !== 0) {
        const wx = DX[dir] > 0 ? lc * 3 + 3 : lc * 3
        for (let dy = 0; dy < 2; dy++) grid[lr * 3 + 1 + dy][wx] = TILES.EMPTY
      } else {
        const wy = DY[dir] > 0 ? lr * 3 + 3 : lr * 3
        for (let dx = 0; dx < 2; dx++) grid[wy][lc * 3 + 1 + dx] = TILES.EMPTY
      }
      carve(nc, nr)
    }
  }

  carve(Math.floor(LCOLS / 2), Math.floor(LROWS / 2))

  // ── Add loops ────────────────────────────────────────────────────────────
  for (let lr = 0; lr < LROWS; lr++) {
    for (let lc = 0; lc < LCOLS; lc++) {
      if (lc < LCOLS - 1 && Math.random() < loopFactor) {
        const wx = lc * 3 + 3
        for (let dy = 0; dy < 2; dy++) grid[lr * 3 + 1 + dy][wx] = TILES.EMPTY
      }
      if (lr < LROWS - 1 && Math.random() < loopFactor) {
        const wy = lr * 3 + 3
        for (let dx = 0; dx < 2; dx++) grid[wy][lc * 3 + 1 + dx] = TILES.EMPTY
      }
    }
  }

  // ── Apply symmetry ───────────────────────────────────────────────────────
  if (symmetry === 'horizontal') {
    for (let ty = 0; ty < rows; ty++)
      for (let tx = 0; tx < halfCol; tx++)
        grid[ty][cols - 1 - tx] = grid[ty][tx]
  } else if (symmetry === 'rotational') {
    for (let ty = 0; ty < rows; ty++)
      for (let tx = 0; tx < halfCol; tx++)
        grid[rows - 1 - ty][cols - 1 - tx] = grid[ty][tx]
  } else if (symmetry === 'quad') {
    for (let ty = 0; ty <= halfRow; ty++)
      for (let tx = 0; tx < halfCol; tx++)
        grid[ty][cols - 1 - tx] = grid[ty][tx]
    for (let ty = 0; ty <= halfRow; ty++)
      for (let tx = 0; tx < cols; tx++) grid[rows - 1 - ty][tx] = grid[ty][tx]
  }

  // ── Outer border ─────────────────────────────────────────────────────────
  for (let tx = 0; tx < cols; tx++) {
    grid[0][tx] = TILES.WALL
    grid[rows - 1][tx] = TILES.WALL
  }
  for (let ty = 0; ty < rows; ty++) {
    grid[ty][0] = TILES.WALL
    grid[ty][cols - 1] = TILES.WALL
  }

  // ── Wrap-around openings (2 tiles wide to match passages) ────────────────
  const passable = (tx: number, ty: number) => grid[ty][tx] !== TILES.WALL

  // Collect wrap spawn positions: one per opening side (left+right for x-wraps, top+bottom for y-wraps)
  const wrapSpawns: TilePos[] = []

  const xCandidates: number[] = []
  for (let lr = 0; lr < fullLrows; lr++) {
    const ty = lr * 3 + 1
    const leftOk =
      passable(1, ty) &&
      passable(2, ty) &&
      passable(1, ty + 1) &&
      passable(2, ty + 1)
    const rightOk =
      passable(cols - 2, ty) &&
      passable(cols - 3, ty) &&
      passable(cols - 2, ty + 1) &&
      passable(cols - 3, ty + 1)
    if (leftOk && rightOk) xCandidates.push(lr)
  }
  shuffle(xCandidates)
  for (const lr of xCandidates.slice(0, wraps.x)) {
    const ty = lr * 3 + 1
    grid[ty][0] = TILES.EMPTY
    grid[ty + 1][0] = TILES.EMPTY
    grid[ty][cols - 1] = TILES.EMPTY
    grid[ty + 1][cols - 1] = TILES.EMPTY
    wrapSpawns.push({ x: 0, y: ty }) // left border tile
    wrapSpawns.push({ x: cols - 1, y: ty }) // right border tile
  }

  const yCandidates: number[] = []
  for (let lc = 0; lc < fullLcols; lc++) {
    const tx = lc * 3 + 1
    const topOk =
      passable(tx, 1) &&
      passable(tx, 2) &&
      passable(tx + 1, 1) &&
      passable(tx + 1, 2)
    const bottomOk =
      passable(tx, rows - 2) &&
      passable(tx, rows - 3) &&
      passable(tx + 1, rows - 2) &&
      passable(tx + 1, rows - 3)
    if (topOk && bottomOk) yCandidates.push(lc)
  }
  shuffle(yCandidates)
  for (const lc of yCandidates.slice(0, wraps.y)) {
    const tx = lc * 3 + 1
    grid[0][tx] = TILES.EMPTY
    grid[0][tx + 1] = TILES.EMPTY
    grid[rows - 1][tx] = TILES.EMPTY
    grid[rows - 1][tx + 1] = TILES.EMPTY
    wrapSpawns.push({ x: tx, y: 0 }) // top border tile
    wrapSpawns.push({ x: tx, y: rows - 1 }) // bottom border tile
  }

  // ── Connect isolated passable regions ───────────────────────────────────
  // Find any passable interior tile as seed
  let seed: TilePos = { x: 1, y: 1 }
  outer: for (let ty = 1; ty < rows - 1; ty++)
    for (let tx = 1; tx < cols - 1; tx++)
      if (grid[ty][tx] === TILES.EMPTY) {
        seed = { x: tx, y: ty }
        break outer
      }
  connectRegions(grid, cols, rows, seed)

  // ── Ensure all corridors are at least 2×2 ───────────────────────────────
  widenCorridors(grid, cols, rows)

  // ── Fill passable tiles with dots ────────────────────────────────────────
  for (let ty = 1; ty < rows - 1; ty++)
    for (let tx = 1; tx < cols - 1; tx++)
      if (grid[ty][tx] === TILES.EMPTY) grid[ty][tx] = TILES.DOT

  // ── Power pellets spread evenly around the perimeter ────────────────────
  if (config.powerCount > 0) {
    const px1 = 2,
      py1 = 2
    const px2 = Math.max(px1, cols - 3),
      py2 = Math.max(py1, rows - 3)
    const perimW = px2 - px1,
      perimH = py2 - py1
    const perim = 2 * (perimW + perimH)
    if (perim > 0) {
      for (let p = 0; p < config.powerCount; p++) {
        const t = (p / config.powerCount) * perim
        let ax: number, ay: number
        if (t < perimW) {
          ax = px1 + t
          ay = py1
        } else if (t < perimW + perimH) {
          ax = px2
          ay = py1 + (t - perimW)
        } else if (t < 2 * perimW + perimH) {
          ax = px2 - (t - perimW - perimH)
          ay = py2
        } else {
          ax = px1
          ay = py2 - (t - 2 * perimW - perimH)
        }
        placePower(grid, Math.round(ax), Math.round(ay), cols, rows)
      }
    }
  }

  // ── Assign ghost spawners from wrap tiles ────────────────────────────────
  const ghostEntries: EnemyType[] = Object.entries(config.ghosts).flatMap(
    ([type, count]) => Array(count).fill(type as EnemyType),
  )
  const spawners: Spawner[] = ghostEntries.map((enemyType, i) =>
    wrapSpawns.length > 0
      ? { position: wrapSpawns[i % wrapSpawns.length], enemyType }
      : { position: seed, enemyType },
  )

  // ── Player spawn: logical dead-end cell closest to center ────────────────
  // Stride-3 layout: cell (lc,lr) is the 2×2 block at [lc*3+1..+2, lr*3+1..+2].
  // The connector between (lc,lr) and a neighbor (lc+dlc, lr+dlr) is the 2-tile
  // passage at: x = lc*3 + (dlc>0 ? 3 : dlc<0 ? 0 : 1), y = lr*3 + (dlr>0 ? 3 : dlr<0 ? 0 : 1)
  // A dead-end cell has exactly one open connector.
  const S = 3
  const isPassable = (tx: number, ty: number) =>
    grid[ty]?.[tx] === TILES.DOT || grid[ty]?.[tx] === TILES.POWER

  const ghostPositions = new Set(
    spawners.map((s) => `${s.position.x},${s.position.y}`),
  )
  const cx = cols / 2
  const cy = rows / 2

  const CELL_DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const

  const countConnectors = (lc: number, lr: number) =>
    CELL_DIRS.filter(([dlc, dlr]) => {
      const nlc = lc + dlc,
        nlr = lr + dlr
      if (nlc < 0 || nlc >= fullLcols || nlr < 0 || nlr >= fullLrows)
        return false
      const tx = lc * S + (dlc > 0 ? S : dlc < 0 ? 0 : 1)
      const ty = lr * S + (dlr > 0 ? S : dlr < 0 ? 0 : 1)
      return (
        isPassable(tx, ty) ||
        isPassable(tx + (dlc === 0 ? 1 : 0), ty + (dlr === 0 ? 1 : 0))
      )
    }).length

  const deadEnds: TilePos[] = []
  for (let lr = 0; lr < fullLrows; lr++) {
    for (let lc = 0; lc < fullLcols; lc++) {
      const cellTx = lc * S + 1
      const cellTy = lr * S + 1
      if (!isPassable(cellTx, cellTy)) continue
      if (ghostPositions.has(`${cellTx},${cellTy}`)) continue
      if (countConnectors(lc, lr) === 1) deadEnds.push({ x: cellTx, y: cellTy })
    }
  }

  deadEnds.sort(
    (a, b) =>
      (a.x - cx) ** 2 + (a.y - cy) ** 2 - ((b.x - cx) ** 2 + (b.y - cy) ** 2),
  )
  const playerSpawn = deadEnds[0]
  for (let dy = 0; dy < 2; dy++)
    for (let dx = 0; dx < 2; dx++)
      grid[playerSpawn.y + dy][playerSpawn.x + dx] = TILES.EMPTY

  return { grid, cols, rows, spawners, playerSpawn }
}

function connectRegions(
  grid: number[][],
  cols: number,
  rows: number,
  seed: TilePos,
): void {
  const isPassable = (tx: number, ty: number) =>
    grid[ty][tx] === TILES.EMPTY || grid[ty][tx] === TILES.DOOR

  // BFS to find the main reachable region from seed
  const inMain = new Set<string>()
  const bfsQueue: TilePos[] = [seed]
  inMain.add(`${seed.x},${seed.y}`)
  let head = 0

  const expand = () => {
    while (head < bfsQueue.length) {
      const { x, y } = bfsQueue[head++]
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d]
        const ny = y + DY[d]
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue
        const key = `${nx},${ny}`
        if (!inMain.has(key) && isPassable(nx, ny)) {
          inMain.add(key)
          bfsQueue.push({ x: nx, y: ny })
        }
      }
    }
  }
  expand()

  // Repeatedly find isolated passable tiles and carve the shortest wall-path to main
  let madeProgress = true
  while (madeProgress) {
    madeProgress = false
    for (let ty = 1; ty < rows - 1; ty++) {
      for (let tx = 1; tx < cols - 1; tx++) {
        if (!isPassable(tx, ty) || inMain.has(`${tx},${ty}`)) continue

        // BFS through all tiles (walls included) from this isolated tile to any main tile
        type WNode = { x: number; y: number; parent: WNode | null }
        const wVisited = new Map<string, WNode>()
        const wQueue: WNode[] = []
        const wStart: WNode = { x: tx, y: ty, parent: null }
        wVisited.set(`${tx},${ty}`, wStart)
        wQueue.push(wStart)
        let wHead = 0
        let found: WNode | null = null

        outer: while (wHead < wQueue.length) {
          const node = wQueue[wHead++]
          for (let d = 0; d < 4; d++) {
            const nx = node.x + DX[d]
            const ny = node.y + DY[d]
            if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue
            if (grid[ny][nx] === TILES.DOOR) continue // don't carve through door
            const key = `${nx},${ny}`
            if (wVisited.has(key)) continue
            const next: WNode = { x: nx, y: ny, parent: node }
            wVisited.set(key, next)
            if (inMain.has(key)) {
              found = next
              break outer
            }
            if (grid[ny][nx] === TILES.WALL) wQueue.push(next)
            else wQueue.push(next) // passable but isolated — continue through it
          }
        }

        if (!found) continue

        // Carve all WALL tiles along the path back to the isolated tile
        let cur: WNode | null = found
        while (cur) {
          if (grid[cur.y][cur.x] === TILES.WALL) {
            grid[cur.y][cur.x] = TILES.EMPTY
            inMain.add(`${cur.x},${cur.y}`)
            bfsQueue.push({ x: cur.x, y: cur.y })
          }
          cur = cur.parent
        }
        expand()
        madeProgress = true
      }
    }
  }
}

/**
 * Widen any corridor that is only 1 tile wide so all passages are at least 2×2.
 * A passable tile pinched between walls on opposite sides is widened by carving
 * an adjacent wall tile. Repeats until no more 1-wide corridors remain.
 */
function widenCorridors(grid: number[][], cols: number, rows: number): void {
  const isBlocking = (tx: number, ty: number) =>
    tx < 0 || tx >= cols || ty < 0 || ty >= rows || grid[ty][tx] === TILES.WALL

  let changed = true
  while (changed) {
    changed = false
    for (let ty = 1; ty < rows - 1; ty++) {
      for (let tx = 1; tx < cols - 1; tx++) {
        const t = grid[ty][tx]
        if (t === TILES.WALL) continue

        // Horizontally pinched (walls above and below → 1-tile-high corridor)
        if (isBlocking(tx, ty - 1) && isBlocking(tx, ty + 1)) {
          if (ty + 1 < rows - 1 && grid[ty + 1][tx] === TILES.WALL) {
            grid[ty + 1][tx] = TILES.EMPTY
            changed = true
          } else if (ty - 1 > 0 && grid[ty - 1][tx] === TILES.WALL) {
            grid[ty - 1][tx] = TILES.EMPTY
            changed = true
          }
        }

        // Vertically pinched (walls left and right → 1-tile-wide corridor)
        if (isBlocking(tx - 1, ty) && isBlocking(tx + 1, ty)) {
          if (tx + 1 < cols - 1 && grid[ty][tx + 1] === TILES.WALL) {
            grid[ty][tx + 1] = TILES.EMPTY
            changed = true
          } else if (tx - 1 > 0 && grid[ty][tx - 1] === TILES.WALL) {
            grid[ty][tx - 1] = TILES.EMPTY
            changed = true
          }
        }
      }
    }
  }
}

function placePower(
  grid: number[][],
  cx: number,
  cy: number,
  cols: number,
  rows: number,
): void {
  for (let r = 0; r <= 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
        const nx = cx + dx
        const ny = cy + dy
        if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) continue
        if (grid[ny][nx] === TILES.DOT) {
          grid[ny][nx] = TILES.POWER
          return
        }
      }
    }
  }
}
