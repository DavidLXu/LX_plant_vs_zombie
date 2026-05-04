export type PlantKind = 'sunflower' | 'pea' | 'walnut' | 'frostpea' | 'cherry';

export type ZombieKind = 'walker' | 'cone' | 'runner' | 'brute';

export type GamePhase = 'ready' | 'playing' | 'won' | 'lost';

export interface PlantDefinition {
  id: PlantKind;
  name: string;
  cost: number;
  cooldown: number;
  health: number;
  damage?: number;
  fireRate?: number;
  range?: number;
  sunRate?: number;
  splashRadius?: number;
  color: number;
  accent: number;
  description: string;
}

export interface ZombieDefinition {
  id: ZombieKind;
  name: string;
  health: number;
  speed: number;
  damage: number;
  biteRate: number;
  reward: number;
  color: number;
  accent: number;
}

export interface WaveEntry {
  at: number;
  lane: number | 'random';
  kind: ZombieKind;
}

export interface Cell {
  row: number;
  col: number;
  plant?: PlantRuntime;
}

export interface PlantRuntime {
  uid: string;
  kind: PlantKind;
  row: number;
  col: number;
  health: number;
  nextActionAt: number;
  sprite: Phaser.GameObjects.Container;
  hpBar: Phaser.GameObjects.Rectangle;
}

export interface ZombieRuntime {
  uid: string;
  kind: ZombieKind;
  row: number;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  speed: number;
  slowedUntil: number;
  nextBiteAt: number;
  sprite: Phaser.GameObjects.Container;
  hpBar: Phaser.GameObjects.Rectangle;
}

export interface ProjectileRuntime {
  uid: string;
  row: number;
  x: number;
  y: number;
  damage: number;
  speed: number;
  slow: boolean;
  sprite: Phaser.GameObjects.Arc;
}

export interface FloatingSun {
  uid: string;
  value: number;
  expiresAt: number;
  sprite: Phaser.GameObjects.Container;
}
