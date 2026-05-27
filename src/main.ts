import { AUTO, Game } from 'phaser'
import { CELL } from './constants'
import { MAZE_CONFIG } from './mazeConfig'
import { Boot as BootScene } from './scenes/Boot'
import { Fade as FadeScene } from './scenes/Fade'
import { Game as GameScene } from './scenes/Game'
import { Menu as MenuScene } from './scenes/Menu'
import { calcZoom } from './utils'

const snapOdd = (n: number) => (n % 2 === 0 ? n - 1 : n)
export const NATIVE_W = snapOdd(MAZE_CONFIG.cols) * CELL
export const NATIVE_H = snapOdd(MAZE_CONFIG.rows) * CELL

const game = new Game({
  type: AUTO,
  width: NATIVE_W,
  height: NATIVE_H,
  zoom: calcZoom(NATIVE_W, NATIVE_H),
  parent: 'game-container',
  backgroundColor: '#1d0a3b',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: { debug: false, gravity: { x: 0, y: 0 } },
  },
  scene: [BootScene, MenuScene, GameScene, FadeScene],
})

window.addEventListener('resize', () => {
  const { width, height } = game.scale.gameSize
  game.scale.setZoom(calcZoom(width, height))
})
