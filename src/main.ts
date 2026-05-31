import * as Phaser from 'phaser'
import { AUTO, Game } from 'phaser'
import { Boot as BootScene } from './scenes/Boot'
import { Fade as FadeScene } from './scenes/Fade'
import { Game as GameScene } from './scenes/Game'
import { Menu as MenuScene } from './scenes/Menu'

export const NATIVE_W = 550
export const NATIVE_H = 688

new Game({
  type: AUTO,
  width: NATIVE_W,
  height: NATIVE_H,
  zoom: 1,
  parent: 'game-container',
  backgroundColor: '#1d0a3b',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: { debug: false, gravity: { x: 0, y: 0 } },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, GameScene, FadeScene],
})
