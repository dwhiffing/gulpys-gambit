import { AUTO, Game } from 'phaser'
import { NATIVE_H, NATIVE_W } from './constants'
import { Boot as BootScene } from './scenes/Boot'
import { Game as GameScene } from './scenes/Game'
import { Menu as MenuScene } from './scenes/Menu'

const zoom = Math.max(
  1,
  Math.floor(
    Math.min(window.innerWidth / NATIVE_W, window.innerHeight / NATIVE_H),
  ),
)

new Game({
  type: AUTO,
  width: NATIVE_W,
  height: NATIVE_H,
  zoom,
  parent: 'game-container',
  backgroundColor: '#000000',
  pixelArt: true,
  scene: [BootScene, MenuScene, GameScene],
})
