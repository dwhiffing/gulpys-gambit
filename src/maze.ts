import * as Phaser from 'phaser'
import { CELL, DX, DY, TILES } from './constants'
import type { MazeConfig } from './mazeConfig'

export interface TilePos {
  x: number
  y: number
}

export interface Spawner {
  position: TilePos
  exit: TilePos
}

export class Maze {
  readonly grid: number[][]
  readonly dots: Phaser.GameObjects.Sprite[]
  readonly cols: number
  readonly rows: number
  readonly spawners: Spawner[]
  readonly playerSpawn: TilePos
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
    this.dots = []
    this.createSprites()
  }

  eatDot(tx: number, ty: number): number | null {
    const dot = this.dots.find(
      (s) => s.getData('tileX') === tx && s.getData('tileY') === ty,
    )
    if (!dot || !dot.visible) return null
    const t = this.grid[ty][tx]
    if (t !== TILES.DOT && t !== TILES.POWER) return null
    dot.setVisible(false)
    return t
  }

  private createSprites() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const t = this.grid[y][x]
        const px = x * CELL + CELL / 2
        const py = y * CELL + CELL / 2
        if (t === TILES.WALL || t === TILES.DOOR) {
          const frame = t === TILES.DOOR ? 1 : 0
          this.walls.push(this.scene.add.sprite(px, py, 'tiles', frame))
        } else if (t === TILES.DOT || t === TILES.POWER) {
          const frame = t === TILES.POWER ? 3 : 2
          this.dots.push(
            this.scene.add
              .sprite(px, py, 'tiles', frame)
              .setData('tileX', x)
              .setData('tileY', y),
          )
        }
      }
    }

    let blinkOn = true
    const powerSprites = this.dots.filter(
      (s) => (s.frame.name as unknown as number) === 37,
    )
    this.scene.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => {
        blinkOn = !blinkOn
        for (const s of powerSprites) s.setAlpha(blinkOn ? 1 : 0)
      },
    })
  }
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
  const { symmetry, loopFactor, house, wraps } = config
  // Snap to odd so DFS cells fill exactly wall-to-wall with no buffer tiles
  const cols = config.cols % 2 === 0 ? config.cols - 1 : config.cols
  const rows = config.rows % 2 === 0 ? config.rows - 1 : config.rows

  // ── Derived ghost-house geometry ────────────────────────────────────────
  // Clamp the house so it fits within the maze (border walls at 0 and cols/rows-1,
  // plus one empty tile above the door for the exit tile).
  const hCol = Math.min(house.col, cols - 4)
  const hRow = Math.max(2, Math.min(house.row, rows - 4))
  const hRight = Math.min(hCol + house.width + 1, cols - 2)
  const hBottom = Math.min(hRow + house.height + 1, rows - 2)
  const hW = hRight - hCol - 1 // effective interior width
  // Odd width → 1-tile door; even width → 2-tile door
  const doorCol = hCol + Math.ceil(hW / 2)
  const doorWidth = hW % 2 === 0 ? 2 : 1

  const exitTile: TilePos = { x: doorCol, y: hRow - 1 }

  // Collect all interior tiles of the ghost house, then pick ghostCount of them
  const interiorTiles: TilePos[] = []
  for (let ty = hRow + 1; ty < hBottom; ty++)
    for (let tx = hCol + 1; tx < hRight; tx++)
      interiorTiles.push({ x: tx, y: ty })

  const ghostCount = Math.min(config.ghostCount, interiorTiles.length)
  // Spread evenly across interior; fallback to sequential if too few tiles
  const step = interiorTiles.length / ghostCount
  const spawners: Spawner[] = Array.from({ length: ghostCount }, (_, i) => ({
    position: interiorTiles[Math.floor(i * step + step / 2)],
    exit: exitTile,
  }))

  // ── Initialise all-wall grid ─────────────────────────────────────────────
  const grid: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(TILES.WALL),
  )

  // ── DFS logical-grid dimensions per symmetry mode ───────────────────────
  // Cell at logical (lc, lr) occupies tile (lc*2+1, lr*2+1).
  //
  //  'none'       — full grid:      lcols = floor((cols-2)/2)
  //                                 lrows = floor((rows-2)/2)
  //  'horizontal' — left half:      lcols = floor(cols/4)
  //  'rotational' — left half:      lcols = floor(cols/4)
  //  'quad'       — top-left quad:  lcols = floor(cols/4)
  //                                 lrows = ceil(rows/4)

  // With odd cols/rows: cells at 1,3,...,cols-2 → exactly (cols-1)/2 logical cells, no buffer
  const fullLcols = (cols - 1) / 2
  const fullLrows = (rows - 1) / 2
  const halfLcols = Math.ceil((cols - 1) / 4)
  const quadLrows = Math.ceil((rows - 1) / 4)

  const LCOLS = symmetry === 'none' ? fullLcols : halfLcols
  const LROWS = symmetry === 'quad' ? quadLrows : fullLrows

  // Half-point used for horizontal/rotational mirroring
  const halfCol = (cols - 1) / 2
  // Top-half boundary used for quad mirroring
  const halfRow = (rows - 1) / 2

  const visited: boolean[][] = Array.from({ length: LROWS }, () =>
    Array(LCOLS).fill(false),
  )

  function carve(lc: number, lr: number): void {
    visited[lr][lc] = true
    grid[lr * 2 + 1][lc * 2 + 1] = TILES.EMPTY

    for (const dir of shuffle([0, 1, 2, 3])) {
      const nc = lc + DX[dir]
      const nr = lr + DY[dir]
      if (nc < 0 || nc >= LCOLS || nr < 0 || nr >= LROWS) continue
      if (visited[nr][nc]) continue
      grid[lr * 2 + 1 + DY[dir]][lc * 2 + 1 + DX[dir]] = TILES.EMPTY
      carve(nc, nr)
    }
  }

  carve(Math.floor(LCOLS / 2), Math.floor(LROWS / 2))

  // ── Add loops ────────────────────────────────────────────────────────────
  for (let lr = 0; lr < LROWS; lr++) {
    for (let lc = 0; lc < LCOLS; lc++) {
      if (lc < LCOLS - 1 && Math.random() < loopFactor)
        grid[lr * 2 + 1][lc * 2 + 2] = TILES.EMPTY
      if (lr < LROWS - 1 && Math.random() < loopFactor)
        grid[lr * 2 + 2][lc * 2 + 1] = TILES.EMPTY
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

  // ── Ghost-house overlay (only when house has valid interior) ────────────
  const houseValid = hW >= 1 && hBottom > hRow + 1
  if (houseValid) {
    for (let tx = hCol; tx <= hRight; tx++) grid[hRow][tx] = TILES.WALL
    for (let i = 0; i < doorWidth; i++) grid[hRow][doorCol + i] = TILES.DOOR
    for (let tx = hCol; tx <= hRight; tx++) grid[hBottom][tx] = TILES.WALL
    for (let ty = hRow + 1; ty < hBottom; ty++) {
      grid[ty][hCol] = TILES.WALL
      grid[ty][hRight] = TILES.WALL
      for (let tx = hCol + 1; tx < hRight; tx++) grid[ty][tx] = TILES.EMPTY
    }
    for (let i = 0; i < doorWidth; i++)
      grid[hRow - 1][doorCol + i] = TILES.EMPTY
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

  // ── Wrap-around openings ─────────────────────────────────────────────────
  const passable = (tx: number, ty: number) =>
    grid[ty][tx] !== TILES.WALL && grid[ty][tx] !== TILES.DOOR

  // X-wrap: with odd cols, rightmost DFS cell is at cols-2; border walls at 0 and cols-1
  const xCandidates: number[] = []
  for (let ty = 1; ty < rows - 1; ty++) {
    const leftOk = passable(1, ty) && passable(2, ty)
    const rightOk = passable(cols - 2, ty) && passable(cols - 3, ty)
    if (leftOk && rightOk) xCandidates.push(ty)
  }
  shuffle(xCandidates)
  for (const ty of xCandidates.slice(0, wraps.x)) {
    grid[ty][0] = TILES.EMPTY
    grid[ty][cols - 1] = TILES.EMPTY
  }

  // Y-wrap: with odd rows, bottommost DFS cell is at rows-2; border walls at 0 and rows-1
  const yCandidates: number[] = []
  for (let tx = 1; tx < cols - 1; tx++) {
    const topOk = passable(tx, 1) && passable(tx, 2)
    const bottomOk = passable(tx, rows - 2) && passable(tx, rows - 3)
    if (topOk && bottomOk) yCandidates.push(tx)
  }
  shuffle(yCandidates)
  for (const tx of yCandidates.slice(0, wraps.y)) {
    grid[0][tx] = TILES.EMPTY
    grid[rows - 1][tx] = TILES.EMPTY
  }

  // ── Connect isolated passable regions ───────────────────────────────────
  connectRegions(grid, cols, rows, exitTile)

  // ── Fill passable tiles with dots ────────────────────────────────────────
  const inHouse = (tx: number, ty: number) =>
    ty >= hRow && ty <= hBottom && tx >= hCol && tx <= hRight

  for (let ty = 1; ty < rows - 1; ty++) {
    for (let tx = 1; tx < cols - 1; tx++) {
      if (grid[ty][tx] === TILES.EMPTY && !inHouse(tx, ty))
        grid[ty][tx] = TILES.DOT
    }
  }

  // ── Power pellets spread evenly around the perimeter ────────────────────
  // Anchor points are sampled at equal arc-length intervals around the inner
  // border rectangle (inset by 2 to stay away from the outer wall).
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

  // ── Random player spawn ──────────────────────────────────────────────────
  const spawnCandidates: TilePos[] = []
  for (let ty = 1; ty < rows - 1; ty++) {
    for (let tx = 1; tx < cols - 1; tx++) {
      const t = grid[ty][tx]
      if (t !== TILES.DOT && t !== TILES.EMPTY) continue
      if (
        ty >= hRow - 3 &&
        ty <= hBottom + 3 &&
        tx >= hCol - 3 &&
        tx <= hRight + 3
      )
        continue
      spawnCandidates.push({ x: tx, y: ty })
    }
  }

  // Fall back to any passable tile if the exclusion zone covers everything
  if (spawnCandidates.length === 0) {
    outer: for (let ty = 1; ty < rows - 1; ty++)
      for (let tx = 1; tx < cols - 1; tx++)
        if (grid[ty][tx] === TILES.DOT || grid[ty][tx] === TILES.EMPTY) {
          spawnCandidates.push({ x: tx, y: ty })
          break outer
        }
  }

  const playerSpawn =
    spawnCandidates[Math.floor(Math.random() * spawnCandidates.length)]

  grid[playerSpawn.y][playerSpawn.x] = TILES.EMPTY

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
