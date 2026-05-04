import * as Phaser from 'phaser'
import { TILES, COLS, ROWS, CELL } from './constants'

export class Maze {
  readonly grid: number[][]
  readonly dots: Phaser.GameObjects.Sprite[]
  private walls: Phaser.GameObjects.Sprite[]

  constructor(private scene: Phaser.Scene) {
    this.grid = this.build()
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

  private build(): number[][] {
    const charToTile: Record<string, number> = {
      '#': TILES.WALL,
      '.': TILES.DOT,
      o: TILES.POWER,
      '-': TILES.DOOR,
    }
    return MAZE_STR.map((row) =>
      Array.from(
        { length: COLS },
        (_, i) => charToTile[i < row.length ? row[i] : ' '] ?? TILES.EMPTY,
      ),
    )
  }

  private createSprites() {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = this.grid[y][x]
        const px = x * CELL + CELL / 2
        const py = y * CELL + CELL / 2
        if (t === TILES.WALL || t === TILES.DOOR) {
          const frame = t === TILES.DOOR ? 43 : 42
          this.walls.push(this.scene.add.sprite(px, py, 'sprites', frame))
        } else if (t === TILES.DOT || t === TILES.POWER) {
          const frame = t === TILES.POWER ? 37 : 36
          this.dots.push(
            this.scene.add
              .sprite(px, py, 'sprites', frame)
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

// '#' wall  '.' dot  'o' power pellet  '-' ghost door  ' ' empty/passable
const MAZE_STR = [
  '############################', // 0
  '#............##............#', // 1
  '#.####.#####.##.#####.####.#', // 2
  '#o####.#####.##.#####.####o#', // 3
  '#.####.#####.##.#####.####.#', // 4
  '#..........................#', // 5
  '#.####.##.########.##.####.#', // 6
  '#.####.##.########.##.####.#', // 7
  '#......##....##....##......#', // 8
  '######.#####.##.#####.######', // 9
  '######.#####.##.#####.######', // 10
  '     #.##          ##.#     ', // 11
  '     #.## ###--### ##.#     ', // 12
  '######.## #      # ##.######', // 13
  '          #      #          ', // 14  ← tunnel row
  '######.## #      # ##.######', // 15
  '     #.## ######## ##.#     ', // 16
  '     #.##          ##.#     ', // 17
  '     #.## ######## ##.#     ', // 18
  '######.## ######## ##.######', // 19
  '#............##............#', // 20
  '#.####.#####.##.#####.####.#', // 21
  '#o..##................##..o#', // 22
  '###.##.##.########.##.##.###', // 23
  '###.##.##.########.##.##.###', // 24
  '#......##....##....##......#', // 25
  '#.##########.##.##########.#', // 26
  '#.##########.##.##########.#', // 27
  '#..........................#', // 28
  '############################', // 29
  '############################', // 30
]
