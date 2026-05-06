import { AUTO, Game } from 'phaser'
import { CELL } from './constants'
import { MAZE_CONFIG } from './mazeConfig'
import { Boot as BootScene } from './scenes/Boot'
import { Game as GameScene } from './scenes/Game'
import { Menu as MenuScene } from './scenes/Menu'
import { calcZoom, snapOdd } from './utils'

export const NATIVE_W = snapOdd(MAZE_CONFIG.cols) * CELL
export const NATIVE_H = snapOdd(MAZE_CONFIG.rows) * CELL

const game = new Game({
  type: AUTO,
  width: NATIVE_W,
  height: NATIVE_H,
  zoom: calcZoom(NATIVE_W, NATIVE_H),
  parent: 'game-container',
  backgroundColor: '#130427',
  pixelArt: true,
  scene: [BootScene, MenuScene, GameScene],
})

window.addEventListener('resize', () => {
  const { width, height } = game.scale.gameSize
  game.scale.setZoom(calcZoom(width, height))
})
