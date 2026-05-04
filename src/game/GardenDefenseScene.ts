import Phaser from 'phaser';
import { PLANT_ORDER, PLANTS, WAVES, ZOMBIES } from './content';
import type {
  Cell,
  FloatingSun,
  GamePhase,
  PlantDefinition,
  PlantKind,
  PlantRuntime,
  ProjectileRuntime,
  ZombieRuntime,
} from './types';

interface LawnMower {
  row: number;
  used: boolean;
  sprite: Phaser.GameObjects.Container;
}

const BOARD = {
  x: 258,
  y: 170,
  cols: 9,
  rows: 5,
  cellW: 96,
  cellH: 92,
};

const HUD = {
  trayX: 20,
  trayY: 18,
  cardW: 118,
  cardH: 92,
};

export class GardenDefenseScene extends Phaser.Scene {
  private phase: GamePhase = 'ready';
  private cells: Cell[][] = [];
  private plants: PlantRuntime[] = [];
  private zombies: ZombieRuntime[] = [];
  private projectiles: ProjectileRuntime[] = [];
  private suns: FloatingSun[] = [];
  private mowers: LawnMower[] = [];
  private selectedPlant: PlantKind | null = null;
  private shovelMode = false;
  private sun = 150;
  private startedAt = 0;
  private waveIndex = 0;
  private nextSkySunAt = 6000;
  private uid = 0;
  private cooldownReady = new Map<PlantKind, number>();
  private cardNodes = new Map<PlantKind, Phaser.GameObjects.Container>();
  private sunText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private shovelButton!: Phaser.GameObjects.Container;
  private pauseButton!: Phaser.GameObjects.Container;
  private isPaused = false;

  constructor() {
    super('garden-defense');
  }

  create() {
    this.resetState();
    this.drawWorld();
    this.drawHud();
    this.showIntro();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handlePointer(pointer));
    this.input.keyboard?.on('keydown-SPACE', () => this.togglePause());
    this.input.keyboard?.on('keydown-R', () => this.restart());
    this.input.keyboard?.on('keydown-ESC', () => this.clearSelection());
  }

  update(time: number, delta: number) {
    if (this.phase !== 'playing' || this.isPaused) {
      return;
    }

    const elapsed = time - this.startedAt;
    this.spawnDueWaves(elapsed);
    this.spawnSkySun(time);
    this.updatePlants(time);
    this.updateProjectiles(delta);
    this.updateZombies(time, delta);
    this.cleanupExpiredSun(time);
    this.updateHud(time, elapsed);
    this.checkWin();
  }

  private resetState() {
    this.phase = 'ready';
    this.isPaused = false;
    this.cells = Array.from({ length: BOARD.rows }, (_, row) =>
      Array.from({ length: BOARD.cols }, (_, col) => ({ row, col })),
    );
    this.plants = [];
    this.zombies = [];
    this.projectiles = [];
    this.suns = [];
    this.mowers = [];
    this.selectedPlant = null;
    this.shovelMode = false;
    this.sun = 150;
    this.startedAt = 0;
    this.waveIndex = 0;
    this.nextSkySunAt = 6000;
    this.uid = 0;
    this.cooldownReady.clear();
    for (const id of PLANT_ORDER) {
      this.cooldownReady.set(id, 0);
    }
  }

  private drawWorld() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x193b22, 0x193b22, 0x0f2717, 0x0f2717, 1);
    bg.fillRect(0, 0, 1280, 720);

    const sky = this.add.graphics();
    sky.fillStyle(0x8bc6d9, 1);
    sky.fillRect(0, 0, 1280, 130);
    sky.fillStyle(0xf2d17b, 1);
    sky.fillCircle(1130, 72, 34);
    sky.fillStyle(0x6f8f43, 1);
    sky.fillRect(0, 112, 1280, 58);

    this.add
      .text(1038, 28, 'GARDEN DEFENSE', {
        fontFamily: 'Trebuchet MS, Arial',
        fontSize: '24px',
        color: '#f4f2d2',
        stroke: '#233018',
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0);

    const house = this.add.graphics();
    house.fillStyle(0x69442e, 1);
    house.fillRoundedRect(34, 198, 164, 390, 16);
    house.fillStyle(0x4b2b1d, 1);
    house.fillTriangle(20, 210, 116, 126, 214, 210);
    house.fillStyle(0xf3d192, 1);
    house.fillRect(78, 288, 76, 92);
    house.fillStyle(0x29221c, 1);
    house.fillCircle(140, 336, 5);
    house.fillStyle(0x4a6f91, 1);
    house.fillRect(60, 410, 50, 54);
    house.fillRect(130, 410, 50, 54);

    this.drawBoard();
    this.drawMowers();
  }

  private drawBoard() {
    const board = this.add.graphics();
    board.lineStyle(2, 0x325126, 0.75);

    for (let row = 0; row < BOARD.rows; row += 1) {
      for (let col = 0; col < BOARD.cols; col += 1) {
        const x = BOARD.x + col * BOARD.cellW;
        const y = BOARD.y + row * BOARD.cellH;
        const base = (row + col) % 2 === 0 ? 0x66a842 : 0x5b9b3b;
        board.fillStyle(base, 1);
        board.fillRoundedRect(x, y, BOARD.cellW - 4, BOARD.cellH - 4, 12);
        board.strokeRoundedRect(x, y, BOARD.cellW - 4, BOARD.cellH - 4, 12);
      }
    }

    const lane = this.add.graphics();
    lane.fillStyle(0x355f2c, 0.35);
    for (let row = 0; row < BOARD.rows; row += 1) {
      lane.fillRect(BOARD.x - 16, BOARD.y + row * BOARD.cellH + BOARD.cellH - 14, BOARD.cols * BOARD.cellW + 110, 10);
    }
  }

  private drawMowers() {
    for (let row = 0; row < BOARD.rows; row += 1) {
      const x = BOARD.x - 62;
      const y = BOARD.y + row * BOARD.cellH + BOARD.cellH / 2 + 22;
      const mower = this.add.container(x, y);
      const base = this.add.rectangle(0, 0, 48, 24, 0xc94034);
      base.setStrokeStyle(3, 0x64251f, 1);
      const handle = this.add.line(7, -14, 0, 0, 20, -30, 0xddd0ac).setLineWidth(4);
      const wheelL = this.add.circle(-16, 15, 7, 0x2b2b2b);
      const wheelR = this.add.circle(16, 15, 7, 0x2b2b2b);
      const shine = this.add.rectangle(-4, -6, 28, 5, 0xffd2c4, 0.75);
      mower.add([handle, base, shine, wheelL, wheelR]);
      this.mowers.push({ row, used: false, sprite: mower });
    }
  }

  private drawHud() {
    const panel = this.add.graphics();
    panel.fillStyle(0x3d2b1b, 0.94);
    panel.fillRoundedRect(14, 12, 776, 118, 12);
    panel.lineStyle(3, 0xd7b56d, 1);
    panel.strokeRoundedRect(14, 12, 776, 118, 12);

    const sunPanel = this.add.container(32, 34);
    const coin = this.add.graphics();
    coin.fillStyle(0xf7cc3f, 1);
    coin.fillCircle(26, 28, 22);
    coin.lineStyle(4, 0xffef93, 0.85);
    coin.strokeCircle(26, 28, 15);
    this.sunText = this.add.text(58, 14, `${this.sun}`, {
      fontFamily: 'Trebuchet MS, Arial',
      fontSize: '28px',
      color: '#fff7bf',
      stroke: '#2d2015',
      strokeThickness: 4,
    });
    sunPanel.add([coin, this.sunText]);

    PLANT_ORDER.forEach((plant, index) => {
      const card = this.createPlantCard(plant, HUD.trayX + 126 + index * (HUD.cardW + 8), HUD.trayY);
      this.cardNodes.set(plant, card);
    });

    this.shovelButton = this.createToolButton(20, 642, '铲', '移除植物', () => {
      this.shovelMode = !this.shovelMode;
      this.selectedPlant = null;
      this.updateToolStates();
    });

    this.pauseButton = this.createToolButton(88, 642, 'Ⅱ', '暂停', () => this.togglePause());

    const barBg = this.add.graphics();
    barBg.fillStyle(0x26301e, 0.88);
    barBg.fillRoundedRect(824, 82, 330, 26, 10);
    this.progressFill = this.add.rectangle(832, 95, 0, 14, 0xf4c74a).setOrigin(0, 0.5);
    this.add.text(824, 114, '进攻波次', {
      fontFamily: 'Trebuchet MS, Arial',
      fontSize: '15px',
      color: '#e8e0bd',
    });

    this.bannerText = this.add
      .text(640, 146, '', {
        fontFamily: 'Trebuchet MS, Arial',
        fontSize: '32px',
        color: '#fff9d7',
        stroke: '#2f2115',
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5);
  }

  private createPlantCard(plantId: PlantKind, x: number, y: number) {
    const def = PLANTS[plantId];
    const left = -HUD.cardW / 2;
    const top = -HUD.cardH / 2;
    const card = this.add
      .container(x + HUD.cardW / 2, y + HUD.cardH / 2)
      .setSize(HUD.cardW, HUD.cardH)
      .setInteractive({ useHandCursor: true });
    const bg = this.add.graphics();
    bg.fillStyle(0xf4df9c, 1);
    bg.fillRoundedRect(left, top, HUD.cardW, HUD.cardH, 10);
    bg.lineStyle(3, 0x7b4d24, 1);
    bg.strokeRoundedRect(left, top, HUD.cardW, HUD.cardH, 10);
    const icon = this.createPlantIcon(left + 30, top + 44, def, 0.58);
    const name = this.add.text(left + 58, top + 10, def.name, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#2f2418',
      fontStyle: 'bold',
    });
    const cost = this.add.text(left + 58, top + 34, `${def.cost}`, {
      fontFamily: 'Trebuchet MS, Arial',
      fontSize: '23px',
      color: '#573716',
      fontStyle: 'bold',
    });
    const desc = this.add.text(left + 10, top + 68, def.description, {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: '#584730',
      wordWrap: { width: 98 },
    });
    const overlay = this.add.rectangle(left, top, HUD.cardW, HUD.cardH, 0x111111, 0.0).setOrigin(0);
    overlay.name = 'overlay';
    card.add([bg, icon, name, cost, desc, overlay]);
    card.on('pointerdown', () => this.selectPlant(plantId));
    return card;
  }

  private createToolButton(x: number, y: number, label: string, hint: string, onClick: () => void) {
    const size = 54;
    const left = -size / 2;
    const top = -size / 2;
    const box = this.add.container(x + size / 2, y + size / 2).setSize(size, size).setInteractive({ useHandCursor: true });
    const bg = this.add.graphics();
    bg.fillStyle(0xead090, 1);
    bg.fillRoundedRect(left, top, size, size, 9);
    bg.lineStyle(3, 0x6b421d, 1);
    bg.strokeRoundedRect(left, top, size, size, 9);
    const text = this.add.text(0, -10, label, {
      fontFamily: 'Trebuchet MS, Arial',
      fontSize: '26px',
      color: '#3a2918',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const hintText = this.add.text(0, 15, hint, {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: '#4a3825',
    }).setOrigin(0.5);
    box.add([bg, text, hintText]);
    box.on('pointerdown', onClick);
    return box;
  }

  private showIntro() {
    this.bannerText.setText('准备防守');
    const start = this.add
      .text(640, 612, '阳光正在聚集，第一波脚步声越来越近。', {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#fff4c9',
        stroke: '#2b1e15',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: start, alpha: 0.45, duration: 760, yoyo: true, repeat: -1 });
    this.time.delayedCall(4500, () => {
      if (start.active) {
        start.destroy();
      }
    });
  }

  private startGame(time: number) {
    if (this.phase !== 'ready') {
      return;
    }
    this.phase = 'playing';
    this.startedAt = time;
    this.bannerText.setText('第一波靠近中');
    this.tweens.add({ targets: this.bannerText, alpha: 0, delay: 1600, duration: 700 });
  }

  private handlePointer(pointer: Phaser.Input.Pointer) {
    if (this.phase === 'ready') {
      this.startGame(pointer.downTime);
    }
    if (this.phase !== 'playing' || this.isPaused) {
      return;
    }

    const row = Math.floor((pointer.y - BOARD.y) / BOARD.cellH);
    const col = Math.floor((pointer.x - BOARD.x) / BOARD.cellW);
    if (row < 0 || row >= BOARD.rows || col < 0 || col >= BOARD.cols) {
      return;
    }

    const cell = this.cells[row][col];
    if (this.shovelMode) {
      if (cell.plant) {
        this.removePlant(cell.plant);
      }
      this.shovelMode = false;
      this.updateToolStates();
      return;
    }
    if (this.selectedPlant) {
      this.placePlant(this.selectedPlant, row, col);
    }
  }

  private selectPlant(plantId: PlantKind) {
    if (this.phase === 'won' || this.phase === 'lost') {
      return;
    }
    const readyAt = this.cooldownReady.get(plantId) ?? 0;
    const now = this.time.now;
    if (now < readyAt || this.sun < PLANTS[plantId].cost) {
      this.flashCard(plantId);
      return;
    }
    this.selectedPlant = this.selectedPlant === plantId ? null : plantId;
    this.shovelMode = false;
    this.updateToolStates();
  }

  private placePlant(plantId: PlantKind, row: number, col: number) {
    const cell = this.cells[row][col];
    const def = PLANTS[plantId];
    if (cell.plant || this.sun < def.cost || this.time.now < (this.cooldownReady.get(plantId) ?? 0)) {
      return;
    }
    this.sun -= def.cost;
    this.cooldownReady.set(plantId, this.time.now + def.cooldown);

    const x = BOARD.x + col * BOARD.cellW + BOARD.cellW / 2 - 2;
    const y = BOARD.y + row * BOARD.cellH + BOARD.cellH / 2 + 6;
    const sprite = this.createPlantSprite(x, y, def);
    const hpBar = this.add.rectangle(x, y + 38, 44, 5, 0x4ced68).setOrigin(0.5);
    const plant: PlantRuntime = {
      uid: this.nextId('plant'),
      kind: plantId,
      row,
      col,
      health: def.health,
      nextActionAt: this.time.now + 900,
      sprite,
      hpBar,
    };
    cell.plant = plant;
    this.plants.push(plant);
    this.selectedPlant = null;
    this.updateToolStates();

    if (plantId === 'cherry') {
      this.time.delayedCall(850, () => this.detonateCherry(plant));
    }
  }

  private createPlantSprite(x: number, y: number, def: PlantDefinition) {
    const c = this.add.container(x, y);
    const createEyes = (eyeY: number) => [
      this.add.circle(-8, eyeY, 4, 0x1b1b14),
      this.add.circle(8, eyeY, 4, 0x1b1b14),
    ];
    const stem = this.add.rectangle(0, 18, 12, 36, def.accent).setOrigin(0.5);
    const leafL = this.add.ellipse(-16, 20, 34, 16, 0x4a973b).setAngle(-24);
    const leafR = this.add.ellipse(16, 24, 34, 16, 0x4a973b).setAngle(22);
    const head = this.add.circle(0, -12, 25, def.color);
    const outline = this.add.circle(0, -12, 27, 0x1b2a18, 0.15);
    const [eyeL, eyeR] = createEyes(-18);
    const smile = this.add.graphics();
    smile.lineStyle(2, 0x28401f, 0.7);
    smile.beginPath();
    smile.arc(0, -10, 10, Phaser.Math.DegToRad(15), Phaser.Math.DegToRad(165), false);
    smile.strokePath();
    c.add([outline, stem, leafL, leafR, head, eyeL, eyeR, smile]);

    if (def.id === 'walnut') {
      c.removeAll(true);
      const shell = this.add.ellipse(0, -2, 56, 70, def.color);
      const shellLine = this.add.ellipse(0, -2, 58, 72, 0x000000, 0);
      shellLine.setStrokeStyle(4, def.accent, 0.65);
      const [nutEyeL, nutEyeR] = createEyes(-12);
      c.add([shell, shellLine, nutEyeL, nutEyeR]);
    }

    if (def.id === 'cherry') {
      c.removeAll(true);
      const left = this.add.circle(-14, -6, 22, def.color);
      const right = this.add.circle(14, -6, 22, def.color);
      const fuse = this.add.line(0, -26, -8, 0, 8, -22, def.accent).setLineWidth(5);
      const [berryEyeL, berryEyeR] = createEyes(-12);
      c.add([left, right, fuse, berryEyeL, berryEyeR]);
      this.tweens.add({ targets: c, scale: 1.08, duration: 160, yoyo: true, repeat: 4 });
    }

    this.tweens.add({
      targets: c,
      y: y - 4,
      duration: 1100 + Math.random() * 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    return c;
  }

  private createPlantIcon(x: number, y: number, def: PlantDefinition, scale: number) {
    const c = this.createPlantSprite(x, y, def);
    c.setScale(scale);
    this.tweens.killTweensOf(c);
    return c;
  }

  private updatePlants(time: number) {
    for (const plant of [...this.plants]) {
      const def = PLANTS[plant.kind];
      if (plant.kind === 'cherry') {
        continue;
      }
      if (plant.health <= 0) {
        this.removePlant(plant);
        continue;
      }
      if (time < plant.nextActionAt) {
        continue;
      }
      if (def.sunRate) {
        const x = BOARD.x + plant.col * BOARD.cellW + 48;
        const y = BOARD.y + plant.row * BOARD.cellH + 20;
        this.createSun(x, y, 25);
        plant.nextActionAt = time + def.sunRate;
      }
      if (def.fireRate && def.damage) {
        const target = this.zombies.find((z) => z.row === plant.row && z.x > BOARD.x + plant.col * BOARD.cellW);
        if (target) {
          this.createProjectile(plant, def);
          plant.nextActionAt = time + def.fireRate;
        }
      }
    }
  }

  private createProjectile(plant: PlantRuntime, def: PlantDefinition) {
    const x = BOARD.x + plant.col * BOARD.cellW + 64;
    const y = BOARD.y + plant.row * BOARD.cellH + 28;
    const orb = this.add.circle(x, y, 10, def.id === 'frostpea' ? 0x9fe8ff : 0x6fea63);
    orb.setStrokeStyle(3, def.accent);
    this.projectiles.push({
      uid: this.nextId('shot'),
      row: plant.row,
      x,
      y,
      damage: def.damage ?? 20,
      speed: 450,
      slow: def.id === 'frostpea',
      sprite: orb,
    });
  }

  private updateProjectiles(delta: number) {
    const step = delta / 1000;
    for (const shot of [...this.projectiles]) {
      shot.x += shot.speed * step;
      shot.sprite.x = shot.x;
      const hit = this.zombies.find((zombie) => zombie.row === shot.row && Math.abs(zombie.x - shot.x) < 28);
      if (hit) {
        this.damageZombie(hit, shot.damage, shot.slow);
        this.removeProjectile(shot);
      } else if (shot.x > 1240) {
        this.removeProjectile(shot);
      }
    }
  }

  private spawnDueWaves(elapsed: number) {
    while (this.waveIndex < WAVES.length && elapsed >= WAVES[this.waveIndex].at) {
      const entry = WAVES[this.waveIndex];
      const row = entry.lane === 'random' ? Phaser.Math.Between(0, BOARD.rows - 1) : entry.lane;
      this.createZombie(entry.kind, row);
      this.waveIndex += 1;
      if (this.waveIndex === 14) {
        this.flashBanner('大波敌人接近');
      }
    }
  }

  private createZombie(kind: keyof typeof ZOMBIES, row: number) {
    const def = ZOMBIES[kind];
    const x = 1232;
    const y = BOARD.y + row * BOARD.cellH + BOARD.cellH / 2 + 10;
    const sprite = this.add.container(x, y);
    const shadow = this.add.ellipse(0, 36, 58, 14, 0x12210f, 0.28);
    const body = this.add.ellipse(0, 0, 46, 72, def.color);
    body.setStrokeStyle(4, 0x3e4c3d, 0.8);
    const head = this.add.circle(-4, -46, 23, def.color);
    head.setStrokeStyle(4, 0x3e4c3d, 0.8);
    const eye = this.add.circle(4, -50, 4, 0xf5f0d4);
    const pupil = this.add.circle(6, -50, 2, 0x1a1b17);
    const arm = this.add.rectangle(-24, -6, 12, 48, def.accent).setAngle(-28);
    const tie = this.add.rectangle(5, 6, 10, 42, 0xa7393a).setAngle(4);
    sprite.add([shadow, arm, body, tie, head, eye, pupil]);

    if (kind === 'cone') {
      const cone = this.add.triangle(-4, -74, 0, -30, 21, 18, -21, 18, def.accent);
      cone.setStrokeStyle(3, 0x7e3e13, 0.8);
      sprite.add(cone);
    }
    if (kind === 'brute') {
      const bucket = this.add.rectangle(-5, -72, 42, 28, def.accent).setAngle(-6);
      bucket.setStrokeStyle(3, 0x5c646b, 0.9);
      sprite.add(bucket);
    }
    if (kind === 'runner') {
      const band = this.add.rectangle(-4, -62, 46, 8, def.accent).setAngle(-5);
      sprite.add(band);
    }

    const hpBar = this.add.rectangle(x, y - 82, 44, 5, 0x5df06a).setOrigin(0.5);
    this.zombies.push({
      uid: this.nextId('zombie'),
      kind,
      row,
      x,
      y,
      health: def.health,
      maxHealth: def.health,
      speed: def.speed,
      slowedUntil: 0,
      nextBiteAt: 0,
      sprite,
      hpBar,
    });
  }

  private updateZombies(time: number, delta: number) {
    const step = delta / 1000;
    for (const zombie of [...this.zombies]) {
      const plant = this.plants.find((p) => p.row === zombie.row && this.isZombieTouchingPlant(zombie, p));
      if (plant) {
        if (time >= zombie.nextBiteAt) {
          plant.health -= ZOMBIES[zombie.kind].damage;
          zombie.nextBiteAt = time + ZOMBIES[zombie.kind].biteRate;
          this.pulse(plant.sprite, 0xff6b46);
          this.updatePlantHp(plant);
          if (plant.health <= 0) {
            this.removePlant(plant);
          }
        }
      } else {
        const slowFactor = time < zombie.slowedUntil ? 0.48 : 1;
        zombie.x -= zombie.speed * slowFactor * step;
        zombie.sprite.x = zombie.x;
        zombie.hpBar.x = zombie.x;
      }

      const bob = Math.sin(time / 190 + zombie.row) * 1.8;
      zombie.sprite.y = zombie.y + bob;
      zombie.hpBar.y = zombie.y - 82 + bob;

      if (zombie.x < BOARD.x - 78) {
        if (!this.triggerMower(zombie.row)) {
          this.lose();
        }
      }
    }
  }

  private triggerMower(row: number) {
    const mower = this.mowers.find((item) => item.row === row && !item.used);
    if (!mower) {
      return false;
    }
    mower.used = true;
    this.cameras.main.shake(220, 0.004);
    this.tweens.add({
      targets: mower.sprite,
      x: 1260,
      duration: 1250,
      ease: 'Quad.in',
      onComplete: () => mower.sprite.destroy(),
    });
    for (const zombie of [...this.zombies]) {
      if (zombie.row === row) {
        this.removeZombie(zombie);
      }
    }
    return true;
  }

  private isZombieTouchingPlant(zombie: ZombieRuntime, plant: PlantRuntime) {
    const plantX = BOARD.x + plant.col * BOARD.cellW + BOARD.cellW / 2;
    return zombie.x - plantX < 48 && zombie.x - plantX > -38;
  }

  private damageZombie(zombie: ZombieRuntime, amount: number, slow: boolean) {
    zombie.health -= amount;
    if (slow) {
      zombie.slowedUntil = this.time.now + 2400;
      zombie.sprite.setAlpha(0.78);
      this.time.delayedCall(2400, () => {
        if (zombie.sprite.active) {
          zombie.sprite.setAlpha(1);
        }
      });
    }
    this.pulse(zombie.sprite, 0xffffff);
    zombie.hpBar.width = Math.max(0, 44 * (zombie.health / zombie.maxHealth));
    if (zombie.health <= 0) {
      this.sun += ZOMBIES[zombie.kind].reward;
      this.removeZombie(zombie);
    }
  }

  private detonateCherry(plant: PlantRuntime) {
    if (!this.plants.includes(plant)) {
      return;
    }
    const def = PLANTS.cherry;
    const radius = def.splashRadius ?? 132;
    const x = BOARD.x + plant.col * BOARD.cellW + BOARD.cellW / 2;
    const y = BOARD.y + plant.row * BOARD.cellH + BOARD.cellH / 2;
    const burst = this.add.circle(x, y, 20, 0xffd35c, 0.85);
    this.tweens.add({
      targets: burst,
      radius,
      alpha: 0,
      duration: 280,
      onComplete: () => burst.destroy(),
    });
    for (const zombie of [...this.zombies]) {
      if (Math.abs(zombie.y - y) < BOARD.cellH * 1.35 && Math.abs(zombie.x - x) < radius + 44) {
        this.damageZombie(zombie, def.damage ?? 260, false);
      }
    }
    this.removePlant(plant);
  }

  private spawnSkySun(time: number) {
    if (time < this.nextSkySunAt) {
      return;
    }
    const x = Phaser.Math.Between(BOARD.x + 30, BOARD.x + BOARD.cols * BOARD.cellW - 40);
    this.createSun(x, 132, 25, true);
    this.nextSkySunAt = time + Phaser.Math.Between(8500, 12500);
  }

  private createSun(x: number, y: number, value: number, falling = false) {
    const c = this.add.container(x, y).setSize(52, 52).setInteractive({ useHandCursor: true });
    const glow = this.add.circle(0, 0, 24, 0xffe16a, 0.7);
    const core = this.add.circle(0, 0, 15, 0xffcb36, 1);
    const rays = this.add.star(0, 0, 12, 18, 27, 0xfff09a, 0.55);
    c.add([rays, glow, core]);
    c.on('pointerdown', () => this.collectSun(sun));
    const sun: FloatingSun = {
      uid: this.nextId('sun'),
      value,
      expiresAt: this.time.now + 9200,
      sprite: c,
    };
    this.suns.push(sun);
    this.tweens.add({ targets: rays, angle: 360, duration: 4200, repeat: -1 });
    if (falling) {
      this.tweens.add({ targets: c, y: Phaser.Math.Between(250, 570), duration: 3600, ease: 'Sine.out' });
    } else {
      this.tweens.add({ targets: c, y: y - 12, duration: 550, yoyo: true, ease: 'Sine.inOut' });
    }
  }

  private collectSun(sun: FloatingSun) {
    if (!this.suns.includes(sun)) {
      return;
    }
    this.suns = this.suns.filter((s) => s !== sun);
    sun.sprite.disableInteractive();
    this.sun += sun.value;
    this.tweens.add({
      targets: sun.sprite,
      x: 58,
      y: 58,
      scale: 0.25,
      alpha: 0.2,
      duration: 360,
      onComplete: () => sun.sprite.destroy(),
    });
  }

  private cleanupExpiredSun(time: number) {
    for (const sun of [...this.suns]) {
      if (time > sun.expiresAt) {
        this.suns = this.suns.filter((s) => s !== sun);
        sun.sprite.disableInteractive();
        this.tweens.add({
          targets: sun.sprite,
          alpha: 0,
          duration: 360,
          onComplete: () => sun.sprite.destroy(),
        });
      }
    }
  }

  private updateHud(time: number, elapsed: number) {
    this.sunText.setText(`${this.sun}`);
    const maxTime = WAVES[WAVES.length - 1].at + 14000;
    this.progressFill.width = Math.min(314, 314 * (elapsed / maxTime));
    for (const id of PLANT_ORDER) {
      const node = this.cardNodes.get(id);
      if (!node) {
        continue;
      }
      const overlay = node.getByName('overlay') as Phaser.GameObjects.Rectangle;
      const readyAt = this.cooldownReady.get(id) ?? 0;
      const blocked = this.sun < PLANTS[id].cost;
      const cooldownLeft = Math.max(0, readyAt - time);
      overlay.fillAlpha = blocked || cooldownLeft > 0 ? 0.48 : 0;
      overlay.fillColor = blocked ? 0x252525 : 0x4c6ddf;
      node.setScale(this.selectedPlant === id ? 1.06 : 1);
    }
  }

  private updateToolStates() {
    for (const id of PLANT_ORDER) {
      const node = this.cardNodes.get(id);
      if (node) {
        node.setScale(this.selectedPlant === id ? 1.06 : 1);
      }
    }
    this.shovelButton.setScale(this.shovelMode ? 1.08 : 1);
  }

  private clearSelection() {
    this.selectedPlant = null;
    this.shovelMode = false;
    this.updateToolStates();
  }

  private togglePause() {
    if (this.phase !== 'playing') {
      return;
    }
    this.isPaused = !this.isPaused;
    this.bannerText.setAlpha(1);
    this.bannerText.setText(this.isPaused ? '已暂停' : '');
    this.pauseButton.setScale(this.isPaused ? 1.08 : 1);
  }

  private checkWin() {
    if (this.waveIndex >= WAVES.length && this.zombies.length === 0) {
      this.phase = 'won';
      this.flashBanner('防守成功');
      this.time.delayedCall(900, () => {
        this.bannerText.setText('防守成功  点击 R 再来一局');
        this.bannerText.setAlpha(1);
      });
    }
  }

  private lose() {
    if (this.phase === 'lost') {
      return;
    }
    this.phase = 'lost';
    this.bannerText.setAlpha(1);
    this.bannerText.setText('防线被突破  按 R 重开');
    this.cameras.main.shake(420, 0.01);
  }

  private restart() {
    this.scene.restart();
  }

  private flashBanner(text: string) {
    this.bannerText.setText(text);
    this.bannerText.setAlpha(1);
    this.tweens.add({ targets: this.bannerText, alpha: 0, delay: 1450, duration: 650 });
  }

  private flashCard(plantId: PlantKind) {
    const card = this.cardNodes.get(plantId);
    if (!card) {
      return;
    }
    this.tweens.add({ targets: card, x: card.x + 4, duration: 55, yoyo: true, repeat: 3 });
  }

  private pulse(target: Phaser.GameObjects.GameObject, _color: number) {
    if ((target as { active?: boolean }).active === false) {
      return;
    }
    this.tweens.add({
      targets: target,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 70,
      yoyo: true,
      ease: 'Sine.out',
    });
  }

  private updatePlantHp(plant: PlantRuntime) {
    plant.hpBar.width = Math.max(0, 44 * (plant.health / PLANTS[plant.kind].health));
  }

  private removePlant(plant: PlantRuntime) {
    this.cells[plant.row][plant.col].plant = undefined;
    this.plants = this.plants.filter((p) => p !== plant);
    plant.sprite.destroy();
    plant.hpBar.destroy();
  }

  private removeZombie(zombie: ZombieRuntime) {
    this.zombies = this.zombies.filter((z) => z !== zombie);
    zombie.sprite.destroy();
    zombie.hpBar.destroy();
  }

  private removeProjectile(shot: ProjectileRuntime) {
    this.projectiles = this.projectiles.filter((p) => p !== shot);
    shot.sprite.destroy();
  }

  private nextId(prefix: string) {
    this.uid += 1;
    return `${prefix}-${this.uid}`;
  }
}
