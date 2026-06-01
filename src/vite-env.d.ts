/// <reference types="vite/client" />

interface Window {
  music?: Phaser.Sound.WebAudioSound
  setSfxMuted?: (muted: boolean) => void
}
