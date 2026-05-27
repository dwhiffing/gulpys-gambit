import type { EnemyType } from './maze'
import { GHOST_SPEED } from './constants'

export interface EnemyConfig {
  speed: number
  aiType: 1 | 2 | 3 | 4
  frameRate?: number
  swimTrailInterval?: number
  easeIn?: boolean
  easeOut?: boolean
  roundedCorners?: boolean
  mineInterval?: number
  mineLifetime?: number
  canReverse?: boolean
}

export const ENEMY_TYPES: Record<EnemyType, EnemyConfig> = {
  teeth2: { speed: GHOST_SPEED, aiType: 1 },
  naut: { speed: GHOST_SPEED, aiType: 1, mineInterval: 3, mineLifetime: 8000 },
  angler1: { speed: GHOST_SPEED, aiType: 1 },
  roach: { speed: GHOST_SPEED, aiType: 1 },
  oct: {
    speed: GHOST_SPEED * 2.5,
    aiType: 1,
    frameRate: 2,
    easeOut: true,
    swimTrailInterval: 150,
    roundedCorners: true,
  },
  // teeth1: { speed: GHOST_SPEED, aiType: 1 },
  // teeth3: { speed: GHOST_SPEED, aiType: 1 },
  // angler2: { speed: GHOST_SPEED, aiType: 1 },
  // blob: { speed: GHOST_SPEED, aiType: 1 },
  // turtle: { speed: GHOST_SPEED, aiType: 1 },
}
