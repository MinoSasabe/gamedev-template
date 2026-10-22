import Phaser from 'phaser';
import { createInitialChests } from '../game/Chest';
import { GameEvent, GameState, transitionGameState } from '../game/GameState';
import { getGameSettings, type GameSettings } from '../game/GameSettings';
import {
  createMaze,
  LAST_SEED_STORAGE_KEY,
  MAZE_CELL_SPACING,
  MAZE_CORRIDOR_WIDTH,
  MAZE_WALL_THICKNESS,
  type MazeCellCenter,
  type MazeData,
} from '../game/Maze';
import type { ChestData } from '../game/Chest';

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const HUD_HEIGHT = 80;
const ROOM_X = 48;
const ROOM_Y = 112;
const ROOM_WIDTH = GAME_WIDTH - ROOM_X * 2;
const ROOM_HEIGHT = GAME_HEIGHT - ROOM_Y - 48;
const R = 2;
const PLAYER_RADIUS = 10 * R;
const WALL_THICKNESS = MAZE_WALL_THICKNESS;
const PLAYER_SPEED = 200;
const ENEMY_SPEED = PLAYER_SPEED * 0.75;
const ENEMY_RADIUS = PLAYER_RADIUS;
const HAND_RADIUS = 6 * R;
const PLAYER_ATTACK_RANGE = 30 * R;
const ENEMY_ATTACK_RANGE = PLAYER_ATTACK_RANGE * 0.5;
const KNOCKBACK_DISTANCE = 10 * R;
const CHEST_INTERACTION_DISTANCE = 64;
const KEY_TARGET = 3;
const COIN_REWARD = 100;
const BOOST_DRAIN_DURATION_MS = 3000;
const BOOST_RECHARGE_DURATION_MS = 5000;
const BOOST_RECHARGE_DELAY_MS = 1000;
const PLAYER_MAX_HP = 10;
const ENEMY_MAX_HP = 20;
const PLAYER_ATTACK_DAMAGE = 5;
const ENEMY_ATTACK_DAMAGE = 2;
const PLAYER_ATTACK_COST = 200 / BOOST_DRAIN_DURATION_MS;
const PLAYER_ATTACK_COOLDOWN_MS = 200;
const PLAYER_ATTACK_ANIMATION_MS = 140;
const PLAYER_ATTACK_ENERGY_DELAY_MS = 100;
const VISION_CLEAR_RADIUS = 180 * R;
const VISION_BLOCKED_RADIUS = 120 * R;
const HUD_BAR_X = 840;
const HUD_BAR_WIDTH = 160;
const CELL_SIZE = MAZE_CORRIDOR_WIDTH;
const MINIMAP_X = GAME_WIDTH - 186;
const MINIMAP_Y = ROOM_Y + 12;
const MINIMAP_WIDTH = 176;
const MINIMAP_HEIGHT = 78;
const MINIMAP_SCALE = 13;
const MINIMAP_HEADER_HEIGHT = 24;

interface GameSceneData {
  seed: number;
}

interface EnemyData {
  x: number;
  y: number;
  hp: number;
  angle: number;
  attackCooldown: number;
  hitSlowTime: number;
  isDead: boolean;
  deathTime: number;
  body: Phaser.GameObjects.Arc;
  hand: Phaser.GameObjects.Graphics;
  hpBar: Phaser.GameObjects.Graphics;
}

function cellKey(cell: Pick<MazeCellCenter, 'row' | 'column'>): string {
  return `${cell.row},${cell.column}`;
}

function passageKey(from: MazeCellCenter, to: MazeCellCenter): string {
  const firstKey = cellKey(from);
  const secondKey = cellKey(to);
  return firstKey < secondKey
    ? `${firstKey}|${secondKey}`
    : `${secondKey}|${firstKey}`;
}

function angleDifference(first: number, second: number): number {
  return Math.atan2(Math.sin(first - second), Math.cos(first - second));
}

function distanceToSegment(
  pointX: number,
  pointY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): number {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  const progress = lengthSquared === 0
    ? 0
    : Phaser.Math.Clamp(
      ((pointX - startX) * segmentX + (pointY - startY) * segmentY) / lengthSquared,
      0,
      1,
    );
  return Phaser.Math.Distance.Between(
    pointX,
    pointY,
    startX + progress * segmentX,
    startY + progress * segmentY,
  );
}

export class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private enterKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private escapeKey!: Phaser.Input.Keyboard.Key;
  private titleKey!: Phaser.Input.Keyboard.Key;
  private player!: Phaser.GameObjects.Arc;
  private playerHands!: Phaser.GameObjects.Graphics;
  private exitDirectionGraphics!: Phaser.GameObjects.Graphics;
  private mazeGraphics!: Phaser.GameObjects.Graphics;
  private fogGraphics!: Phaser.GameObjects.Graphics;
  private exitDoorGraphics!: Phaser.GameObjects.Graphics;
  private damageOverlay!: Phaser.GameObjects.Graphics;
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private chestGraphics!: Phaser.GameObjects.Graphics;
  private hpBarGraphics!: Phaser.GameObjects.Graphics;
  private energyBarGraphics!: Phaser.GameObjects.Graphics;
  private mazeWalls!: Phaser.Geom.Rectangle[];
  private maze!: MazeData;
  private chests!: ChestData[];
  private enemies: EnemyData[] = [];
  private visibleCellKeys = new Set<string>();
  private seenCellKeys = new Set<string>();
  private visiblePassageKeys = new Set<string>();
  private seenPassageKeys = new Set<string>();
  private visibleWallIndices = new Set<number>();
  private seenWallIndices = new Set<number>();
  private cellByKey = new Map<string, MazeCellCenter>();
  private passages = new Set<string>();
  private pauseOverlay!: Phaser.GameObjects.Container;
  private keyCountText!: Phaser.GameObjects.Text;
  private pCountText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private interactionText!: Phaser.GameObjects.Text;
  private settings!: Readonly<GameSettings>;
  private keyCount = 0;
  private pCount = 0;
  private remainingTime = 0;
  private energy = 1;
  private hp = PLAYER_MAX_HP;
  private timeWithoutBoost = 0;
  private energyWasExhausted = false;
  private attackCooldown = 0;
  private attackAnimationTime = 0;
  private attackEnergyDelayTime = 0;
  private attackEnergyCostPending = false;
  private attackHandIndex = 1;
  private hitFlashTime = 0;
  private playerWorldX = 0;
  private playerWorldY = 0;
  private playerScreenX = 0;
  private playerScreenY = 0;
  private facingAngle = 0;
  private seenExitDoor = false;
  private visibleExitDoor = false;
  private isPaused = false;
  private isEnding = false;
  private state = GameState.Playing;

  constructor() {
    super('GameScene');
  }

  init(data: GameSceneData): void {
    this.settings = getGameSettings();
    this.keyCount = 0;
    this.pCount = 0;
    this.remainingTime = this.settings.roundTimeSeconds;
    this.energy = this.settings.playerEnergy;
    this.hp = PLAYER_MAX_HP * this.settings.playerHp;
    this.timeWithoutBoost = 0;
    this.energyWasExhausted = false;
    this.attackCooldown = 0;
    this.attackAnimationTime = 0;
    this.attackEnergyDelayTime = 0;
    this.attackEnergyCostPending = false;
    this.attackHandIndex = 1;
    this.hitFlashTime = 0;
    this.playerWorldX = 0;
    this.playerWorldY = 0;
    this.playerScreenX = 0;
    this.playerScreenY = 0;
    this.facingAngle = 0;
    this.seenExitDoor = false;
    this.visibleExitDoor = false;
    this.isPaused = false;
    this.isEnding = false;
    this.state = GameState.Playing;
    this.enemies = [];
    this.visibleCellKeys.clear();
    this.seenCellKeys.clear();
    this.visiblePassageKeys.clear();
    this.seenPassageKeys.clear();
    this.visibleWallIndices.clear();
    this.seenWallIndices.clear();
    this.cellByKey.clear();
    this.passages.clear();
    this.maze = createMaze(data.seed);
    localStorage.setItem(LAST_SEED_STORAGE_KEY, String(this.maze.seed));
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101722');

    const layout = this.add.graphics();
    layout.fillStyle(0x172333, 1);
    layout.fillRect(0, 0, GAME_WIDTH, HUD_HEIGHT);
    layout.fillStyle(0x1d2b3a, 1);
    layout.fillRect(256, 0, 256, HUD_HEIGHT);
    layout.fillRect(768, 0, 256, HUD_HEIGHT);
    layout.lineStyle(1, 0x526b7b, 1);
    for (const x of [256, 512, 768, 1024]) {
      layout.lineBetween(x, 8, x, HUD_HEIGHT - 8);
    }
    layout.fillStyle(0x26384a, 1);
    layout.fillRect(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT);
    layout.lineStyle(4, 0x7f9bb3, 1);
    layout.strokeRect(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT);

    this.mazeWalls = this.maze.walls.map(
      (wall) => new Phaser.Geom.Rectangle(wall.x, wall.y, wall.width, wall.height),
    );
    this.mazeGraphics = this.add.graphics().setDepth(1);
    this.mazeGraphics.fillStyle(0x0d1720, 1);
    for (const wall of this.mazeWalls) {
      this.mazeGraphics.fillRect(wall.x, wall.y, wall.width, wall.height);
    }
    this.fogGraphics = this.add.graphics().setDepth(2);
    this.chestGraphics = this.add.graphics().setDepth(3);
    this.exitDoorGraphics = this.add.graphics().setDepth(4);
    this.minimapGraphics = this.add.graphics().setDepth(20);
    this.add.text(MINIMAP_X + 7, MINIMAP_Y + 2, 'MAP', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#b7c9d8',
    }).setDepth(21);
    this.exitDirectionGraphics = this.add.graphics().setDepth(30);

    this.add.text(18, 18, 'ESCAPE ROOM', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#f5f1e8',
    }).setDepth(10);
    this.pCountText = this.add.text(18, 48, 'P: 0', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#f5d58a',
    }).setDepth(10);
    this.keyCountText = this.add.text(142, 49, `鍵: ${this.keyCount}/${KEY_TARGET}`, {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#f5d58a',
    }).setDepth(10);
    this.add.text(384, 14, '次の指示', {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#b7c9d8',
    }).setOrigin(0.5).setDepth(10);
    this.add.text(640, 15, 'WASD / ←↓↑→：移動', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#f5f1e8',
    }).setOrigin(0.5, 0).setDepth(10);
    this.add.text(640, 45, 'Space：攻撃', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#f5f1e8',
    }).setOrigin(0.5, 0).setDepth(10);
    this.timeText = this.add.text(
      1152,
      42,
      this.remainingTime.toFixed(3),
      {
        fontFamily: 'sans-serif',
        fontSize: '22px',
        color: '#f5f1e8',
      },
    ).setOrigin(0.5).setDepth(10);
    this.add.text(1152, 13, '残り時間', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#b7c9d8',
    }).setOrigin(0.5).setDepth(10);
    this.damageOverlay = this.add.graphics().setDepth(50);
    this.damageOverlay.fillStyle(0xff3030, 1);
    this.damageOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.damageOverlay.setAlpha(0);

    this.add.text(784, 24, 'HP', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#b7c9d8',
    }).setDepth(10);
    this.hpBarGraphics = this.add.graphics().setDepth(10);
    this.add.text(784, 54, 'EG', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#b7c9d8',
    }).setDepth(10);
    this.energyBarGraphics = this.add.graphics().setDepth(10);
    this.drawStatusBars();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasdKeys = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.escapeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.titleKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T);
    this.chests = createInitialChests(this.maze.walkableCells);
    this.playerWorldX = this.maze.start.x;
    this.playerWorldY = this.maze.start.y;
    const playerScreenX = ROOM_X + ROOM_WIDTH / 2;
    const playerScreenY = ROOM_Y + ROOM_HEIGHT / 2;
    this.playerScreenX = playerScreenX;
    this.playerScreenY = playerScreenY;
    this.player = this.add.circle(
      playerScreenX,
      playerScreenY,
      PLAYER_RADIUS,
      0x58c4b8,
    ).setDepth(7);
    this.player.setStrokeStyle(3, 0xd8fff4);
    this.playerHands = this.add.graphics().setDepth(8);

    for (const cell of this.maze.walkableCells) {
      this.cellByKey.set(cellKey(cell), cell);
    }
    for (const passage of this.maze.passages) {
      this.passages.add(passageKey(passage.from, passage.to));
    }
    this.createEnemies();
    this.updateWorldPosition(playerScreenX, playerScreenY);
    this.refreshVision();
    this.redrawChests();

    this.interactionText = this.add.text(384, 43, '', {
      fontFamily: 'sans-serif',
      fontSize: '17px',
      color: '#f5d58a',
      align: 'center',
      wordWrap: { width: 236 },
    }).setOrigin(0.5).setDepth(10);

    this.pauseOverlay = this.add.container(0, 0).setDepth(100);
    const pauseBackground = this.add.graphics();
    pauseBackground.fillStyle(0x000000, 0.68);
    pauseBackground.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const pauseText = this.add.text(
      GAME_WIDTH / 2,
      280,
      'ポーズ中\nEscキーで再開 / Enterキーでタイトルへ',
      {
        fontFamily: 'sans-serif',
        fontSize: '28px',
        color: '#f5f1e8',
        align: 'center',
      },
    ).setOrigin(0.5);
    const titleButton = this.add.text(
      GAME_WIDTH / 2,
      400,
      'タイトルへ戻る（Tキー / クリック）',
      {
        fontFamily: 'sans-serif',
        fontSize: '24px',
        color: '#58c4b8',
        backgroundColor: '#26384a',
        padding: { x: 18, y: 12 },
      },
    );
    titleButton.setOrigin(0.5).setInteractive();
    titleButton.on('pointerdown', this.returnToTitle, this);
    titleButton.on('pointerover', () => titleButton.setColor('#f5f1e8'));
    titleButton.on('pointerout', () => titleButton.setColor('#58c4b8'));
    this.pauseOverlay.add([pauseBackground, pauseText, titleButton]);
    this.pauseOverlay.setVisible(false);
  }

  update(_time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      this.togglePause();
    }

    if (this.isPaused) {
      if (
        Phaser.Input.Keyboard.JustDown(this.titleKey)
        || Phaser.Input.Keyboard.JustDown(this.enterKey)
      ) {
        this.returnToTitle();
      }
      return;
    }

    if (this.isEnding || this.remainingTime === 0) {
      return;
    }

    if (this.settings.timerEnabled) {
      this.remainingTime = Math.max(0, this.remainingTime - delta / 1000);
    }
    this.timeText.setText(this.remainingTime.toFixed(3));
    this.timeText.setColor(this.remainingTime <= 10 ? '#e8876b' : '#f5f1e8');
    this.hitFlashTime = Math.max(0, this.hitFlashTime - delta);
    this.damageOverlay.setAlpha(0.28 * (this.hitFlashTime / 260));
    if (this.remainingTime === 0) {
      this.finishGame('timeout');
      return;
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.attackAnimationTime = Math.max(0, this.attackAnimationTime - delta);
    const previousPlayerX = this.playerWorldX;
    const previousPlayerY = this.playerWorldY;
    this.updatePlayer(delta);
    this.updateEnemies(delta);
    this.updateWorldPosition(this.playerScreenX, this.playerScreenY);
    this.refreshVision();
    this.redrawChests();
    this.drawPlayerHands();
    this.drawStatusBars();

    if (
      this.keyCount === KEY_TARGET
      && this.crossedExitDoor(
        previousPlayerX,
        previousPlayerY,
        this.playerWorldX,
        this.playerWorldY,
      )
    ) {
      this.finishClear();
      return;
    }

    const nearbyChest = this.findNearbyChest();
    this.interactionText.setText(
      nearbyChest
        ? 'Enter：宝箱を開ける'
        : this.keyCount === KEY_TARGET
          ? this.seenExitDoor ? '扉をくぐろう' : '扉を探そう'
          : `鍵を探そう（${this.keyCount}/${KEY_TARGET}）`,
    );
    const enterPressed = Phaser.Input.Keyboard.JustDown(this.enterKey);
    const spacePressed = Phaser.Input.Keyboard.JustDown(this.spaceKey);
    if (enterPressed) {
      this.openNearbyChest();
    }
    if (spacePressed) {
      if (!this.openNearbyChest()) {
        this.attack();
      }
    }
  }

  private updatePlayer(delta: number): void {
    let directionX = 0;
    let directionY = 0;

    if (this.cursors.left.isDown || this.wasdKeys.left.isDown) {
      directionX -= 1;
    }
    if (this.cursors.right.isDown || this.wasdKeys.right.isDown) {
      directionX += 1;
    }
    if (this.cursors.up.isDown || this.wasdKeys.up.isDown) {
      directionY -= 1;
    }
    if (this.cursors.down.isDown || this.wasdKeys.down.isDown) {
      directionY += 1;
    }

    const boostRequested = (
      (directionX < 0 && this.cursors.left.isDown && this.wasdKeys.left.isDown)
      || (directionX > 0 && this.cursors.right.isDown && this.wasdKeys.right.isDown)
      || (directionY < 0 && this.cursors.up.isDown && this.wasdKeys.up.isDown)
      || (directionY > 0 && this.cursors.down.isDown && this.wasdKeys.down.isDown)
    );
    const boostFraction = this.updateEnergy(boostRequested, delta);
    if (directionX !== 0 || directionY !== 0) {
      this.facingAngle = Math.atan2(directionY, directionX);
    }

    const diagonalScale = directionX !== 0 && directionY !== 0 ? Math.SQRT1_2 : 1;
    const speedX = Math.sign(directionX)
      * (1 + (boostFraction > 0 && directionX !== 0 ? boostFraction : 0));
    const speedY = Math.sign(directionY)
      * (1 + (boostFraction > 0 && directionY !== 0 ? boostFraction : 0));
    const distance = PLAYER_SPEED * this.settings.playerSpeed
      * (delta / 1000) * diagonalScale;
    const nextX = Phaser.Math.Clamp(
      this.playerWorldX + speedX * distance,
      ROOM_X + PLAYER_RADIUS,
      ROOM_X + ROOM_WIDTH - PLAYER_RADIUS,
    );
    if (this.canOccupy(nextX, this.playerWorldY, PLAYER_RADIUS)) {
      this.playerWorldX = nextX;
    }
    const nextY = Phaser.Math.Clamp(
      this.playerWorldY + speedY * distance,
      ROOM_Y + PLAYER_RADIUS,
      ROOM_Y + ROOM_HEIGHT - PLAYER_RADIUS,
    );
    if (this.canOccupy(this.playerWorldX, nextY, PLAYER_RADIUS)) {
      this.playerWorldY = nextY;
    }
  }

  private updateEnergy(boostRequested: boolean, delta: number): number {
    let energyDelta = delta;
    if (this.attackEnergyDelayTime > 0) {
      const delayElapsed = Math.min(energyDelta, this.attackEnergyDelayTime);
      this.attackEnergyDelayTime -= delayElapsed;
      energyDelta -= delayElapsed;
      if (this.attackEnergyDelayTime > 0) {
        return 0;
      }
      if (this.attackEnergyCostPending) {
        this.energy = Math.max(0, this.energy - PLAYER_ATTACK_COST);
        this.attackEnergyCostPending = false;
        this.timeWithoutBoost = 0;
        if (this.energy === 0) {
          this.energyWasExhausted = true;
        }
      }
      if (energyDelta === 0) {
        return 0;
      }
    }

    if (boostRequested && this.energy > 0) {
      this.timeWithoutBoost = 0;
      const energyRequired = energyDelta / BOOST_DRAIN_DURATION_MS;
      const boostFraction = energyRequired > 0
        ? Math.min(1, this.energy / energyRequired)
        : 0;
      this.energy = Math.max(0, this.energy - energyRequired);
      if (this.energy === 0) {
        this.energyWasExhausted = true;
      }
      return boostFraction;
    }

    const previousTimeWithoutBoost = this.timeWithoutBoost;
    this.timeWithoutBoost += energyDelta;
    const delay = this.energyWasExhausted ? BOOST_RECHARGE_DELAY_MS : 0;
    const rechargeTime = Math.max(0, this.timeWithoutBoost - delay)
      - Math.max(0, previousTimeWithoutBoost - delay);
    this.energy = Math.min(
      this.settings.playerEnergy,
      this.energy + rechargeTime / BOOST_RECHARGE_DURATION_MS,
    );
    if (this.energy > 0) {
      this.energyWasExhausted = false;
    }
    if (this.energy === this.settings.playerEnergy) {
      this.timeWithoutBoost = 0;
    }
    return 0;
  }

  private drawStatusBars(): void {
    this.drawBar(
      this.hpBarGraphics,
      this.hp / (PLAYER_MAX_HP * this.settings.playerHp),
      0xe8876b,
      24,
      12,
    );
    this.drawBar(
      this.energyBarGraphics,
      this.energy / this.settings.playerEnergy,
      0x58c4b8,
      54,
      12,
    );
  }

  private drawBar(
    graphics: Phaser.GameObjects.Graphics,
    value: number,
    color: number,
    y: number,
    height: number,
  ): void {
    graphics.clear();
    graphics.fillStyle(0x26384a, 1);
    graphics.fillRect(HUD_BAR_X, y, HUD_BAR_WIDTH, height);
    graphics.fillStyle(color, 1);
    graphics.fillRect(
      HUD_BAR_X + 2,
      y + 2,
      (HUD_BAR_WIDTH - 4) * Phaser.Math.Clamp(value, 0, 1),
      height - 4,
    );
    graphics.lineStyle(1, 0x7f9bb3, 1);
    graphics.strokeRect(HUD_BAR_X, y, HUD_BAR_WIDTH, height);
  }

  private togglePause(): void {
    this.state = transitionGameState(this.state, GameEvent.EscapePressed);
    this.isPaused = this.state === GameState.Paused;
    this.pauseOverlay.setVisible(this.isPaused);
  }

  private returnToTitle(): void {
    this.state = transitionGameState(this.state, GameEvent.ReturnToTitlePressed);
    if (this.state === GameState.Title) {
      this.scene.start('TitleScene');
    }
  }

  private finishGame(reason: 'timeout' | 'defeated'): void {
    if (this.isEnding) {
      return;
    }
    this.isEnding = true;
    this.interactionText.setText(reason === 'timeout' ? '時間切れ' : '敵に倒された');
    this.state = transitionGameState(
      this.state,
      reason === 'timeout' ? GameEvent.TimerExpired : GameEvent.PlayerDefeated,
    );
    this.scene.start('ResultScene', {
      state: this.state,
      keyCount: this.keyCount,
      pCount: this.pCount,
      remainingTime: this.remainingTime,
      reason,
    });
  }

  private finishClear(): void {
    if (this.isEnding) {
      return;
    }
    this.isEnding = true;
    this.state = transitionGameState(this.state, GameEvent.ExitDoorCrossed);
    this.scene.start('ResultScene', {
      state: this.state,
      keyCount: this.keyCount,
      pCount: this.pCount,
      remainingTime: this.remainingTime,
      reason: 'clear',
    });
  }

  private findNearbyChest(): ChestData | undefined {
    return this.chests.find((chest) => {
      if (chest.isOpened || !this.visibleCellKeys.has(this.cellKeyAt(chest.x, chest.y))) {
        return false;
      }

      return Phaser.Math.Distance.Between(
        this.playerWorldX,
        this.playerWorldY,
        chest.x,
        chest.y,
      ) <= CHEST_INTERACTION_DISTANCE;
    });
  }

  private canOccupy(x: number, y: number, radius: number): boolean {
    const circle = new Phaser.Geom.Circle(x, y, radius);
    const fitsMaze = this.mazeWalls.every(
      (wall) => !Phaser.Geom.Intersects.CircleToRectangle(circle, wall),
    );
    if (!fitsMaze || this.keyCount === KEY_TARGET) {
      return fitsMaze;
    }
    const door = this.maze.exitDoor;
    const doorWall = new Phaser.Geom.Rectangle(
      door.x - (door.isVertical ? WALL_THICKNESS : CELL_SIZE) / 2,
      door.y - (door.isVertical ? CELL_SIZE : WALL_THICKNESS) / 2,
      door.isVertical ? WALL_THICKNESS : CELL_SIZE,
      door.isVertical ? CELL_SIZE : WALL_THICKNESS,
    );
    return !Phaser.Geom.Intersects.CircleToRectangle(circle, doorWall);
  }

  private updateWorldPosition(playerScreenX: number, playerScreenY: number): void {
    const offsetX = playerScreenX - this.playerWorldX;
    const offsetY = playerScreenY - this.playerWorldY;
    this.mazeGraphics.setPosition(offsetX, offsetY);
    this.fogGraphics.setPosition(offsetX, offsetY);
    this.chestGraphics.setPosition(offsetX, offsetY);
    this.exitDoorGraphics.setPosition(offsetX, offsetY);
  }

  private openNearbyChest(): boolean {
    const chest = this.findNearbyChest();
    if (!chest) {
      return false;
    }

    chest.isOpened = true;
    if (chest.isCorrect) {
      this.keyCount += 1;
      this.keyCountText.setText(`鍵: ${this.keyCount} / ${KEY_TARGET}`);
      this.playKeyAcquiredEffect();
    } else {
      this.pCount += COIN_REWARD;
      this.pCountText.setText(`P: ${this.pCount}`);
      this.tweens.add({
        targets: this.pCountText,
        scale: 1.2,
        duration: 120,
        yoyo: true,
        ease: 'Sine.easeOut',
      });
    }
    this.redrawChests();

    return true;
  }

  private attack(): void {
    if (this.attackCooldown > 0 || this.energy < PLAYER_ATTACK_COST) {
      return;
    }
    this.attackCooldown = PLAYER_ATTACK_COOLDOWN_MS;
    this.attackEnergyDelayTime = PLAYER_ATTACK_ENERGY_DELAY_MS;
    this.attackEnergyCostPending = true;
    this.timeWithoutBoost = 0;
    this.attackAnimationTime = PLAYER_ATTACK_ANIMATION_MS;
    this.attackHandIndex = 1 - this.attackHandIndex;

    for (const enemy of this.enemies) {
      if (enemy.isDead || !this.isVisibleAt(enemy.x, enemy.y)) {
        continue;
      }
      const targetAngle = Phaser.Math.Angle.Between(
        this.playerWorldX,
        this.playerWorldY,
        enemy.x,
        enemy.y,
      );
      const distance = Phaser.Math.Distance.Between(
        this.playerWorldX,
        this.playerWorldY,
        enemy.x,
        enemy.y,
      );
      if (
        distance <= PLAYER_ATTACK_RANGE + ENEMY_RADIUS
        && Math.abs(angleDifference(targetAngle, this.facingAngle)) <= Math.PI / 4
        && this.hasLineOfSight(this.playerWorldX, this.playerWorldY, enemy.x, enemy.y)
      ) {
        enemy.hp = Math.max(
          0,
          enemy.hp - PLAYER_ATTACK_DAMAGE * this.settings.playerAttack,
        );
        enemy.hitSlowTime = 200;
        if (enemy.hp === 0) {
          this.beginEnemyDeath(enemy);
        }
      }
    }
  }

  private beginEnemyDeath(enemy: EnemyData): void {
    if (enemy.isDead) {
      return;
    }
    enemy.isDead = true;
    enemy.deathTime = 0;
    this.pCount += 500;
    this.pCountText.setText(`P: ${this.pCount}`);
    this.tweens.add({
      targets: this.pCountText,
      scale: 1.2,
      duration: 120,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  private playKeyAcquiredEffect(): void {
    this.cameras.main.flash(220, 245, 213, 138);
    const ring = this.add.circle(
      this.player.x,
      this.player.y,
      PLAYER_RADIUS + 8,
      0xf5d58a,
      0,
    ).setDepth(10);
    ring.setStrokeStyle(7, 0xf5d58a, 1);
    this.tweens.add({
      targets: ring,
      scale: 3.4,
      alpha: 0,
      duration: 2520,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });

    const acquiredKey = this.add.graphics().setDepth(10);
    acquiredKey.setPosition(this.player.x, this.player.y - 42);
    acquiredKey.lineStyle(7, 0xf5d58a, 1);
    acquiredKey.strokeCircle(-28, 0, 15);
    acquiredKey.lineBetween(-13, 0, 44, 0);
    acquiredKey.lineBetween(25, 0, 25, 15);
    acquiredKey.lineBetween(38, 0, 38, 11);
    this.tweens.add({
      targets: acquiredKey,
      y: '-=48',
      scale: 1.8,
      alpha: 0,
      duration: 3900,
      ease: 'Cubic.easeOut',
      onComplete: () => acquiredKey.destroy(),
    });
    this.tweens.add({
      targets: this.keyCountText,
      scale: 1.2,
      duration: 120,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  private redrawChests(): void {
    this.chestGraphics.clear();
    for (const chest of this.chests) {
      const currentlyVisible = this.visibleCellKeys.has(this.cellKeyAt(chest.x, chest.y));
      if (!chest.isOpened && !currentlyVisible) {
        continue;
      }
      this.drawChest(this.chestGraphics, chest);
    }
  }

  private drawChest(graphics: Phaser.GameObjects.Graphics, chest: ChestData): void {
    const bodyColor = chest.isOpened ? 0x66717d : 0xc8894b;
    const lidColor = chest.isOpened ? 0x84909a : 0xe2ad62;

    graphics.fillStyle(bodyColor, 1);
    graphics.fillRect(chest.x - 12, chest.y - 8, 24, 16);
    graphics.fillStyle(lidColor, 1);
    graphics.fillRect(chest.x - 12, chest.y - 8, 24, 4);
    graphics.lineStyle(2, 0x593b2a, 1);
    graphics.strokeRect(chest.x - 12, chest.y - 8, 24, 16);
    graphics.lineBetween(chest.x, chest.y - 8, chest.x, chest.y + 8);
    graphics.fillStyle(0x593b2a, 1);
    graphics.fillRect(chest.x - 2, chest.y - 2, 4, 4);
  }

  private createEnemies(): void {
    const possibleCells = this.maze.walkableCells.filter(
      (cell) => Phaser.Math.Distance.Between(
        cell.x,
        cell.y,
        this.maze.start.x,
        this.maze.start.y,
      ) >= 100 * R,
    );

    for (let index = 0; index < 2 && possibleCells.length > 0; index += 1) {
      const cellIndex = Math.floor(Math.random() * possibleCells.length);
      const [cell] = possibleCells.splice(cellIndex, 1);
      const body = this.add.circle(0, 0, ENEMY_RADIUS, 0xe05252).setDepth(5);
      body.setStrokeStyle(2, 0xffb0a8);
      const hand = this.add.graphics().setDepth(6);
      const hpBar = this.add.graphics().setDepth(6);
      this.enemies.push({
        x: cell.x,
        y: cell.y,
        hp: ENEMY_MAX_HP * this.settings.enemyHp,
        angle: Math.random() * Math.PI * 2,
        attackCooldown: 0,
        hitSlowTime: 0,
        isDead: false,
        deathTime: 0,
        body,
        hand,
        hpBar,
      });
    }
  }

  private updateEnemies(delta: number): void {
    for (const enemy of this.enemies) {
      if (enemy.isDead) {
        this.updateEnemyVisuals(enemy);
        enemy.deathTime += delta;
        const fade = Math.max(0, 1 - enemy.deathTime / 450);
        enemy.body.setAlpha(fade).setScale(1 + (1 - fade) * 0.5);
        enemy.hand.setAlpha(fade);
        enemy.hpBar.setAlpha(fade);
        if (fade === 0) {
          enemy.body.setVisible(false);
          enemy.hand.setVisible(false);
          enemy.hpBar.setVisible(false);
        }
        continue;
      }

      const slowedDuration = Math.min(delta, enemy.hitSlowTime);
      const enemyDelta = delta - slowedDuration * 0.5;
      enemy.hitSlowTime -= slowedDuration;

      const distanceToPlayer = Phaser.Math.Distance.Between(
        enemy.x,
        enemy.y,
        this.playerWorldX,
        this.playerWorldY,
      );
      const isInRange = (
        distanceToPlayer <= ENEMY_ATTACK_RANGE + PLAYER_RADIUS
        && this.hasLineOfSight(
          enemy.x,
          enemy.y,
          this.playerWorldX,
          this.playerWorldY,
        )
      );
      if (!isInRange) {
        this.moveEnemyTowardPlayer(enemy, enemyDelta);
      }

      enemy.angle = (
        enemy.angle + (enemyDelta / 1000) * Math.PI * 2
      ) % (Math.PI * 2);
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - enemyDelta);
      if (isInRange) {
        this.tryEnemyAttack(enemy);
      }
      this.updateEnemyVisuals(enemy);
    }
  }

  private moveEnemyTowardPlayer(enemy: EnemyData, delta: number): void {
    const startCell = this.nearestCell(enemy.x, enemy.y);
    const goalCell = this.nearestCell(this.playerWorldX, this.playerWorldY);
    const nextCell = this.nextCellOnPath(startCell, goalCell);
    let targetX = this.playerWorldX;
    let targetY = this.playerWorldY;
    if (cellKey(startCell) !== cellKey(goalCell)) {
      if (!nextCell) {
        return;
      }
      targetX = nextCell.x;
      targetY = nextCell.y;
    }
    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, targetX, targetY);
    const distance = Math.min(
      ENEMY_SPEED * this.settings.enemySpeed * delta / 1000,
      Phaser.Math.Distance.Between(
        enemy.x,
        enemy.y,
        targetX,
        targetY,
      ),
    );
    const nextX = enemy.x + Math.cos(angle) * distance;
    const nextY = enemy.y + Math.sin(angle) * distance;
    const intersectsEnemy = this.enemies.some((other) => (
      other !== enemy
      && !other.isDead
      && Phaser.Math.Distance.Between(nextX, nextY, other.x, other.y)
        < ENEMY_RADIUS * 2
    ));
    if (!intersectsEnemy && this.canOccupy(nextX, nextY, ENEMY_RADIUS)) {
      enemy.x = nextX;
      enemy.y = nextY;
    }
  }

  private nearestCell(x: number, y: number): MazeCellCenter {
    let nearest = this.maze.start;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const cell of this.maze.walkableCells) {
      const distance = Phaser.Math.Distance.Between(x, y, cell.x, cell.y);
      if (distance < nearestDistance) {
        nearest = cell;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  private nextCellOnPath(
    start: MazeCellCenter,
    goal: MazeCellCenter,
  ): MazeCellCenter | undefined {
    const startKey = cellKey(start);
    const goalKey = cellKey(goal);
    if (startKey === goalKey) {
      return goal;
    }

    const queue = [start];
    const previous = new Map<string, MazeCellCenter | null>([[startKey, null]]);
    for (let index = 0; index < queue.length; index += 1) {
      const cell = queue[index];
      const neighbors = [
        this.cellByKey.get(`${cell.row - 1},${cell.column}`),
        this.cellByKey.get(`${cell.row + 1},${cell.column}`),
        this.cellByKey.get(`${cell.row},${cell.column - 1}`),
        this.cellByKey.get(`${cell.row},${cell.column + 1}`),
      ].filter((neighbor): neighbor is MazeCellCenter => neighbor !== undefined);
      for (const neighbor of neighbors) {
        const key = cellKey(neighbor);
        if (
          previous.has(key)
          || !this.passages.has(passageKey(cell, neighbor))
        ) {
          continue;
        }
        previous.set(key, cell);
        if (key === goalKey) {
          let step = neighbor;
          let parent = cell;
          while (cellKey(parent) !== startKey) {
            step = parent;
            parent = previous.get(cellKey(parent))!;
          }
          return step;
        }
        queue.push(neighbor);
      }
    }
    return undefined;
  }

  private tryEnemyAttack(enemy: EnemyData): void {
    if (!this.hasLineOfSight(enemy.x, enemy.y, this.playerWorldX, this.playerWorldY)) {
      return;
    }
    const handX = enemy.x + Math.cos(enemy.angle) * ENEMY_ATTACK_RANGE;
    const handY = enemy.y + Math.sin(enemy.angle) * ENEMY_ATTACK_RANGE;
    const handDistance = distanceToSegment(
      this.playerWorldX,
      this.playerWorldY,
      enemy.x,
      enemy.y,
      handX,
      handY,
    );
    if (handDistance > PLAYER_RADIUS + HAND_RADIUS || enemy.attackCooldown > 0) {
      return;
    }

    enemy.attackCooldown = 1000;
    const pushAngle = Phaser.Math.Angle.Between(
      enemy.x,
      enemy.y,
      this.playerWorldX,
      this.playerWorldY,
    );
    this.pushPlayer(
      Math.cos(pushAngle) * KNOCKBACK_DISTANCE,
      Math.sin(pushAngle) * KNOCKBACK_DISTANCE,
    );
    this.hp = Math.max(
      0,
      this.hp - ENEMY_ATTACK_DAMAGE * this.settings.enemyAttack,
    );
    if (this.hp === 0) {
      this.finishGame('defeated');
    }
  }

  private pushPlayer(offsetX: number, offsetY: number): void {
    const nextX = Phaser.Math.Clamp(
      this.playerWorldX + offsetX,
      ROOM_X + PLAYER_RADIUS,
      ROOM_X + ROOM_WIDTH - PLAYER_RADIUS,
    );
    const nextY = Phaser.Math.Clamp(
      this.playerWorldY + offsetY,
      ROOM_Y + PLAYER_RADIUS,
      ROOM_Y + ROOM_HEIGHT - PLAYER_RADIUS,
    );
    if (this.canOccupy(nextX, nextY, PLAYER_RADIUS)) {
      this.playerWorldX = nextX;
      this.playerWorldY = nextY;
      return;
    }
    if (this.canOccupy(nextX, this.playerWorldY, PLAYER_RADIUS)) {
      this.playerWorldX = nextX;
    }
    if (this.canOccupy(this.playerWorldX, nextY, PLAYER_RADIUS)) {
      this.playerWorldY = nextY;
    }
  }

  private updateEnemyVisuals(enemy: EnemyData): void {
    const visible = this.isVisibleAt(enemy.x, enemy.y);
    const screenX = this.playerScreenX + enemy.x - this.playerWorldX;
    const screenY = this.playerScreenY + enemy.y - this.playerWorldY;
    enemy.body.setPosition(screenX, screenY).setVisible(visible);
    enemy.hand.setPosition(screenX, screenY).setVisible(visible).clear();
    if (visible) {
      const directionX = Math.cos(enemy.angle);
      const directionY = Math.sin(enemy.angle);
      const perpendicularX = -directionY * HAND_RADIUS;
      const perpendicularY = directionX * HAND_RADIUS;
      const baseX = directionX * ENEMY_RADIUS;
      const baseY = directionY * ENEMY_RADIUS;
      const tipX = directionX * ENEMY_ATTACK_RANGE;
      const tipY = directionY * ENEMY_ATTACK_RANGE;
      enemy.hand.fillStyle(0xff9a72, 1);
      enemy.hand.lineStyle(1, 0xffe2c5, 1);
      enemy.hand.fillTriangle(
        tipX,
        tipY,
        baseX + perpendicularX,
        baseY + perpendicularY,
        baseX - perpendicularX,
        baseY - perpendicularY,
      );
      enemy.hand.strokeTriangle(
        tipX,
        tipY,
        baseX + perpendicularX,
        baseY + perpendicularY,
        baseX - perpendicularX,
        baseY - perpendicularY,
      );
    }
    enemy.hpBar.setVisible(visible).clear();
    if (visible) {
      enemy.hpBar.fillStyle(0x26384a, 1);
      enemy.hpBar.fillRect(screenX - 18, screenY - ENEMY_RADIUS - 12, 36, 5);
      enemy.hpBar.fillStyle(0xe8876b, 1);
      enemy.hpBar.fillRect(
        screenX - 17,
        screenY - ENEMY_RADIUS - 11,
        34 * (enemy.hp / (ENEMY_MAX_HP * this.settings.enemyHp)),
        3,
      );
    }
  }

  private refreshVision(): void {
    this.visibleCellKeys.clear();
    for (const cell of this.maze.walkableCells) {
      if (this.isVisibleAt(cell.x, cell.y)) {
        const key = cellKey(cell);
        this.visibleCellKeys.add(key);
        this.seenCellKeys.add(key);
      }
    }
    this.visiblePassageKeys.clear();
    for (const passage of this.maze.passages) {
      const key = passageKey(passage.from, passage.to);
      const middleX = (passage.from.x + passage.to.x) / 2;
      const middleY = (passage.from.y + passage.to.y) / 2;
      if (this.isVisibleAt(middleX, middleY)) {
        this.visiblePassageKeys.add(key);
        this.seenPassageKeys.add(key);
      }
    }
    this.visibleWallIndices.clear();
    this.mazeWalls.forEach((wall, index) => {
      if (this.isWallVisible(wall)) {
        this.visibleWallIndices.add(index);
        this.seenWallIndices.add(index);
      }
    });
    this.visibleExitDoor = this.isVisibleAt(this.maze.exitDoor.x, this.maze.exitDoor.y);
    this.seenExitDoor ||= this.visibleExitDoor;

    this.fogGraphics.clear();
    for (const cell of this.maze.walkableCells) {
      const key = cellKey(cell);
      const isVisible = this.visibleCellKeys.has(key);
      const hasBeenSeen = this.seenCellKeys.has(key);
      if (isVisible) {
        continue;
      }
      this.fogGraphics.fillStyle(0x000000, hasBeenSeen ? 0.5 : 1);
      this.fogGraphics.fillRect(
        cell.x - CELL_SIZE / 2,
        cell.y - CELL_SIZE / 2,
        CELL_SIZE,
        CELL_SIZE,
      );
    }
    for (const passage of this.maze.passages) {
      const key = passageKey(passage.from, passage.to);
      if (this.visiblePassageKeys.has(key)) {
        continue;
      }
      this.fogGraphics.fillStyle(0x000000, this.seenPassageKeys.has(key) ? 0.5 : 1);
      if (passage.from.row === passage.to.row) {
        this.fogGraphics.fillRect(
          Math.min(passage.from.x, passage.to.x) + CELL_SIZE / 2,
          passage.from.y - CELL_SIZE / 2,
          WALL_THICKNESS,
          CELL_SIZE,
        );
      } else {
        this.fogGraphics.fillRect(
          passage.from.x - CELL_SIZE / 2,
          Math.min(passage.from.y, passage.to.y) + CELL_SIZE / 2,
          CELL_SIZE,
          WALL_THICKNESS,
        );
      }
    }
    this.mazeWalls.forEach((wall, index) => {
      if (this.visibleWallIndices.has(index)) {
        return;
      }
      this.fogGraphics.fillStyle(
        0x000000,
        this.seenWallIndices.has(index) ? 0.5 : 1,
      );
      this.fogGraphics.fillRect(wall.x, wall.y, wall.width, wall.height);
    });
    if (!this.visibleExitDoor) {
      const door = this.maze.exitDoor;
      this.fogGraphics.fillStyle(0x0d1720, 1);
      this.fogGraphics.fillRect(
        door.x - (door.isVertical ? WALL_THICKNESS : CELL_SIZE) / 2,
        door.y - (door.isVertical ? CELL_SIZE : WALL_THICKNESS) / 2,
        door.isVertical ? WALL_THICKNESS : CELL_SIZE,
        door.isVertical ? CELL_SIZE : WALL_THICKNESS,
      );
    }
    this.drawExitDoor();
    this.drawExitDirectionIndicator();
    this.drawMinimap();
  }

  private isWallVisible(wall: Phaser.Geom.Rectangle): boolean {
    const points = [
      { x: wall.centerX, y: wall.y },
      { x: wall.centerX, y: wall.bottom },
      { x: wall.x, y: wall.centerY },
      { x: wall.right, y: wall.centerY },
    ];
    return points.some((point) => (
      Phaser.Math.Distance.Between(
        this.playerWorldX,
        this.playerWorldY,
        point.x,
        point.y,
      ) <= VISION_CLEAR_RADIUS
      && this.hasLineOfSight(
        this.playerWorldX,
        this.playerWorldY,
        point.x,
        point.y,
        wall,
      )
    ));
  }

  private drawExitDoor(): void {
    this.exitDoorGraphics.clear();
    if (!this.visibleExitDoor) {
      return;
    }
    const door = this.maze.exitDoor;
    const width = door.isVertical ? WALL_THICKNESS - 4 : CELL_SIZE - 4;
    const height = door.isVertical ? CELL_SIZE - 4 : WALL_THICKNESS - 4;
    this.exitDoorGraphics.fillStyle(
      this.keyCount === KEY_TARGET ? 0x58c4b8 : 0xc8894b,
      1,
    );
    this.exitDoorGraphics.fillRect(
      door.x - width / 2,
      door.y - height / 2,
      width,
      height,
    );
    this.exitDoorGraphics.lineStyle(2, 0xf5f1e8, 1);
    this.exitDoorGraphics.strokeRect(
      door.x - width / 2,
      door.y - height / 2,
      width,
      height,
    );
    this.exitDoorGraphics.fillStyle(0xf5d58a, 1);
    this.exitDoorGraphics.fillCircle(
      door.x + (door.isVertical ? 7 : 0),
      door.y + (door.isVertical ? 0 : 7),
      2,
    );
  }

  private drawMinimap(): void {
    const maxColumn = Math.max(...this.maze.walkableCells.map((cell) => cell.column));
    const maxRow = Math.max(...this.maze.walkableCells.map((cell) => cell.row));
    const mapWidth = maxColumn * MINIMAP_SCALE;
    const mapHeight = maxRow * MINIMAP_SCALE;
    const mapOriginX = MINIMAP_X + (MINIMAP_WIDTH - mapWidth) / 2;
    const mapOriginY = MINIMAP_Y + MINIMAP_HEADER_HEIGHT
      + (MINIMAP_HEIGHT - MINIMAP_HEADER_HEIGHT - mapHeight) / 2;

    this.minimapGraphics.clear();
    this.minimapGraphics.fillStyle(0x101722, 0.94);
    this.minimapGraphics.fillRoundedRect(
      MINIMAP_X,
      MINIMAP_Y,
      MINIMAP_WIDTH,
      MINIMAP_HEIGHT,
      5,
    );
    this.minimapGraphics.lineStyle(1, 0x7f9bb3, 1);
    this.minimapGraphics.strokeRoundedRect(
      MINIMAP_X,
      MINIMAP_Y,
      MINIMAP_WIDTH,
      MINIMAP_HEIGHT,
      5,
    );

    this.minimapGraphics.lineStyle(6, 0x84909a, 0.9);
    for (const cell of this.maze.walkableCells) {
      if (!this.seenCellKeys.has(cellKey(cell))) {
        continue;
      }
      for (const neighbor of [
        this.cellByKey.get(`${cell.row},${cell.column + 1}`),
        this.cellByKey.get(`${cell.row + 1},${cell.column}`),
      ]) {
        if (
          !neighbor
          || !this.seenCellKeys.has(cellKey(neighbor))
          || this.passages.has(passageKey(cell, neighbor))
        ) {
          continue;
        }
        const middleX = mapOriginX
          + ((cell.column + neighbor.column) / 2) * MINIMAP_SCALE;
        const middleY = mapOriginY
          + ((cell.row + neighbor.row) / 2) * MINIMAP_SCALE;
        if (cell.row === neighbor.row) {
          this.minimapGraphics.lineBetween(
            middleX,
            middleY - MINIMAP_SCALE / 2,
            middleX,
            middleY + MINIMAP_SCALE / 2,
          );
        } else {
          this.minimapGraphics.lineBetween(
            middleX - MINIMAP_SCALE / 2,
            middleY,
            middleX + MINIMAP_SCALE / 2,
            middleY,
          );
        }
      }
    }

    this.minimapGraphics.lineStyle(6, 0x58c4b8, 0.9);
    for (const passage of this.maze.passages) {
      if (!this.seenPassageKeys.has(passageKey(passage.from, passage.to))) {
        continue;
      }
      this.minimapGraphics.lineBetween(
        mapOriginX + passage.from.column * MINIMAP_SCALE,
        mapOriginY + passage.from.row * MINIMAP_SCALE,
        mapOriginX + passage.to.column * MINIMAP_SCALE,
        mapOriginY + passage.to.row * MINIMAP_SCALE,
      );
    }

    this.minimapGraphics.fillStyle(0xb7c9d8, 0.9);
    for (const cell of this.maze.walkableCells) {
      if (!this.seenCellKeys.has(cellKey(cell))) {
        continue;
      }
      this.minimapGraphics.fillCircle(
        mapOriginX + cell.column * MINIMAP_SCALE,
        mapOriginY + cell.row * MINIMAP_SCALE,
        3.2,
      );
    }

    const firstCell = this.maze.walkableCells[0];
    const playerX = mapOriginX
      + ((this.playerWorldX - firstCell.x) / MAZE_CELL_SPACING) * MINIMAP_SCALE;
    const playerY = mapOriginY
      + ((this.playerWorldY - firstCell.y) / MAZE_CELL_SPACING) * MINIMAP_SCALE;
    this.minimapGraphics.fillStyle(0xf5d58a, 1);
    this.minimapGraphics.fillCircle(playerX, playerY, 5.6);
    this.minimapGraphics.lineStyle(2, 0x101722, 1);
    this.minimapGraphics.strokeCircle(playerX, playerY, 5.6);
    if (this.seenExitDoor) {
      const exitX = mapOriginX
        + ((this.maze.exitDoor.x - firstCell.x) / MAZE_CELL_SPACING) * MINIMAP_SCALE;
      const exitY = mapOriginY
        + ((this.maze.exitDoor.y - firstCell.y) / MAZE_CELL_SPACING) * MINIMAP_SCALE;
      this.minimapGraphics.fillStyle(0xe8876b, 1);
      this.minimapGraphics.fillRect(exitX - 4, exitY - 4, 8, 8);
    }
  }

  private isVisibleAt(x: number, y: number): boolean {
    const distance = Phaser.Math.Distance.Between(
      this.playerWorldX,
      this.playerWorldY,
      x,
      y,
    );
    if (distance > VISION_CLEAR_RADIUS) {
      return false;
    }
    const isBlocked = !this.hasLineOfSight(this.playerWorldX, this.playerWorldY, x, y);
    return distance <= (isBlocked ? VISION_BLOCKED_RADIUS : VISION_CLEAR_RADIUS);
  }

  private hasLineOfSight(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    ignoredWall?: Phaser.Geom.Rectangle,
  ): boolean {
    const line = new Phaser.Geom.Line(startX, startY, endX, endY);
    return this.mazeWalls.every(
      (wall) => wall === ignoredWall || !Phaser.Geom.Intersects.LineToRectangle(line, wall),
    );
  }

  private crossedExitDoor(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): boolean {
    const door = this.maze.exitDoor;
    if (door.isVertical) {
      if ((startX - door.x) * (endX - door.x) > 0 || startX === endX) {
        return false;
      }
      const progress = (door.x - startX) / (endX - startX);
      const crossingY = startY + (endY - startY) * progress;
      return Math.abs(crossingY - door.y) <= CELL_SIZE / 2 - PLAYER_RADIUS;
    }
    if ((startY - door.y) * (endY - door.y) > 0 || startY === endY) {
      return false;
    }
    const progress = (door.y - startY) / (endY - startY);
    const crossingX = startX + (endX - startX) * progress;
    return Math.abs(crossingX - door.x) <= CELL_SIZE / 2 - PLAYER_RADIUS;
  }

  private cellKeyAt(x: number, y: number): string {
    return cellKey(this.nearestCell(x, y));
  }

  private drawExitDirectionIndicator(): void {
    this.exitDirectionGraphics.clear();
    if (this.keyCount !== KEY_TARGET || !this.seenExitDoor) {
      return;
    }
    const angle = Phaser.Math.Angle.Between(
      this.playerWorldX,
      this.playerWorldY,
      this.maze.exitDoor.x,
      this.maze.exitDoor.y,
    );
    const tipDistance = PLAYER_RADIUS + 28;
    const baseDistance = PLAYER_RADIUS + 8;
    const halfWidth = 9;
    const tipX = this.playerScreenX + Math.cos(angle) * tipDistance;
    const tipY = this.playerScreenY + Math.sin(angle) * tipDistance;
    const baseX = this.playerScreenX + Math.cos(angle) * baseDistance;
    const baseY = this.playerScreenY + Math.sin(angle) * baseDistance;
    const perpendicularX = -Math.sin(angle) * halfWidth;
    const perpendicularY = Math.cos(angle) * halfWidth;

    this.exitDirectionGraphics.fillStyle(0xf5d58a, 1);
    this.exitDirectionGraphics.lineStyle(2, 0x101722, 1);
    this.exitDirectionGraphics.fillTriangle(
      tipX,
      tipY,
      baseX + perpendicularX,
      baseY + perpendicularY,
      baseX - perpendicularX,
      baseY - perpendicularY,
    );
    this.exitDirectionGraphics.strokeTriangle(
      tipX,
      tipY,
      baseX + perpendicularX,
      baseY + perpendicularY,
      baseX - perpendicularX,
      baseY - perpendicularY,
    );
  }

  private drawPlayerHands(): void {
    const attackProgress = 1 - this.attackAnimationTime / PLAYER_ATTACK_ANIMATION_MS;
    const handExtension = Math.sin(attackProgress * Math.PI) * 24;
    this.playerHands.clear();
    this.playerHands.fillStyle(0xf5d58a, 1);
    this.playerHands.lineStyle(1, 0xfff0c2, 1);
    for (const [index, offset] of [Math.PI / 4, -Math.PI / 4].entries()) {
      const angle = this.facingAngle + offset;
      const shoulderX = this.playerScreenX
        + Math.cos(angle) * PLAYER_RADIUS * 0.45;
      const shoulderY = this.playerScreenY
        + Math.sin(angle) * PLAYER_RADIUS * 0.45;
      const activeExtension = this.attackAnimationTime > 0 && index === this.attackHandIndex
        ? handExtension
        : 0;
      const handX = this.playerScreenX
        + Math.cos(angle) * (PLAYER_RADIUS - 2)
        + Math.cos(this.facingAngle) * activeExtension;
      const handY = this.playerScreenY
        + Math.sin(angle) * (PLAYER_RADIUS - 2)
        + Math.sin(this.facingAngle) * activeExtension;
      this.playerHands.lineStyle(HAND_RADIUS, 0xf5d58a, 1);
      this.playerHands.lineBetween(shoulderX, shoulderY, handX, handY);
      this.playerHands.fillStyle(0xf5d58a, 1);
      this.playerHands.lineStyle(1, 0xfff0c2, 1);
      this.playerHands.fillCircle(handX, handY, HAND_RADIUS);
      this.playerHands.strokeCircle(handX, handY, HAND_RADIUS);
    }
  }

}
