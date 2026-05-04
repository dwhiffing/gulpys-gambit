import { GameObjects, Scene } from 'phaser'

export class Menu extends Scene {
  title: GameObjects.Text

  constructor() {
    super('Menu')
  }

  create() {
    this.title = this.add
      .text(512, 460, 'Main Menu', {
        fontFamily: 'Arial Black',
        fontSize: 38,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 8,
        align: 'center',
      })
      .setOrigin(0.5)

    this.input.once('pointerdown', () => {
      this.scene.start('Game')
    })
  }
}
