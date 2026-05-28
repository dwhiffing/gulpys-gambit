import { GameObjects, Scene } from 'phaser'
import { NATIVE_H, NATIVE_W } from '../main'

export class Menu extends Scene {
  title: GameObjects.Text

  constructor() {
    super('Menu')
  }

  create() {
    this.title = this.add
      .text(NATIVE_W / 2, NATIVE_H / 2, "Gulpy's Gambit", {
        fontFamily: 'Arial Black',
        fontSize: 38,
        color: '#7294d6',
        align: 'center',
      })
      .setOrigin(0.5)

    this.input.keyboard!.once('keydown', () => {
      this.scene.launch('Checkerboard', {
        nextScene: 'Game',
        stopScene: 'Menu',
      })
    })
  }
}
