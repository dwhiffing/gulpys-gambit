import * as Phaser from 'phaser'
import { AUTO, Game } from 'phaser'
import { Boot as BootScene } from './scenes/Boot'
import { Fade as FadeScene } from './scenes/Fade'
import { Game as GameScene } from './scenes/Game'
import { HUD as HUDScene } from './scenes/HUD'
import { Menu as MenuScene } from './scenes/Menu'

export const NATIVE_W = 550
export const NATIVE_H = 688

const game = new Game({
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
  scene: [BootScene, MenuScene, GameScene, HUDScene, FadeScene],
})
const MUTE_KEY = 'gulpy-mute'
const states = ['all', 'sfx', 'mute'] as const
type MuteState = (typeof states)[number]

const saved = localStorage.getItem(MUTE_KEY) as MuteState | null
let stateIndex = Math.max(0, states.indexOf(saved as MuteState))
const applyState = (state: MuteState) => {
  if (state === 'all') {
    game.sound.setMute(false)
    window.setSfxMuted?.(false)
    window.music?.setMute(false)
  } else if (state === 'sfx') {
    game.sound.setMute(false)
    window.setSfxMuted?.(false)
    window.music?.setMute(true)
  } else {
    game.sound.setMute(true)
    window.setSfxMuted?.(true)
    window.music?.setMute(true)
  }
}

applyState(states[stateIndex])

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'm') return
  stateIndex = (stateIndex + 1) % states.length
  const state = states[stateIndex]
  localStorage.setItem(MUTE_KEY, state)
  applyState(state)
})
