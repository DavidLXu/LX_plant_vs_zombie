import Phaser from 'phaser';
import { GardenDefenseScene } from './game/GardenDefenseScene';
import './styles.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  parent: 'game',
  backgroundColor: '#102615',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  scene: [GardenDefenseScene],
};

new Phaser.Game(config);
