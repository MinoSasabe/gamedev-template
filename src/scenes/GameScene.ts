import Phaser from 'phaser';
import { createInitialChests } from '../game/Chest';
import { GameEvent, GameState, transitionGameState } from '../game/GameState';
import { createMaze } from '../game/Maze';
import type { ChestData } from '../game/Chest';

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const HUD_HEIGHT = 80;
const ROOM_X = 48;
const ROOM_Y = 112;
const ROOM_WIDTH = GAME_WIDTH - ROOM_X * 2;
const ROOM_HEIGHT = GAME_HEIGHT - ROOM_Y - 48;
const PLAYER_SPEED = 200;
const PLAYER_RADIUS = 20;
const CHEST_INTERACTION_DISTANCE = 64;
const TIME_LIMIT_SECONDS = 60;
const KEY_TARGET = 3;

export class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private enterKey!: Phaser.Input.Keyboard.Key;
  private escapeKey!: Phaser.Input.Keyboard.Key;
  private player!: Phaser.GameObjects.Arc;
  private mazeGraphics!: Phaser.GameObjects.Graphics;
  private chests!: ChestData[];
  private chestGraphics!: Phaser.GameObjects.Graphics;
  private mazeWalls!: Phaser.Geom.Rectangle[];
  private pauseOverlay!: Phaser.GameObjects.Container;
  private keyCountText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private interactionText!: Phaser.GameObjects.Text;
  private keyCount = 0;
  private remainingTime = TIME_LIMIT_SECONDS;
  private gameTimer!: Phaser.Time.TimerEvent;
  private playerWorldX = 0;
  private playerWorldY = 0;
  private isPaused = false;
  private isEnding = false;
  private state = GameState.Playing;

  constructor() {
    super('GameScene');
  }

  init(): void {
    this.keyCount = 0;
    this.remainingTime = TIME_LIMIT_SECONDS;
    this.isPaused = false;
    this.isEnding = false;
    this.state = GameState.Playing;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101722');

    const layout = this.add.graphics();
    layout.fillStyle(0x172333, 1);
    layout.fillRect(0, 0, GAME_WIDTH, HUD_HEIGHT);
    layout.fillStyle(0x26384a, 1);
    layout.fillRect(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT);
    layout.lineStyle(4, 0x7f9bb3, 1);
    layout.strokeRect(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT);

    const maze = createMaze();
    this.mazeWalls = maze.walls.map(
      (wall) => new Phaser.Geom.Rectangle(wall.x, wall.y, wall.width, wall.height),
    );
    this.mazeGraphics = this.add.graphics();
    this.mazeGraphics.fillStyle(0x0d1720, 1);
    this.mazeGraphics.lineStyle(2, 0x526b7b, 1);
    for (const wall of this.mazeWalls) {
      this.mazeGraphics.fillRect(wall.x, wall.y, wall.width, wall.height);
      this.mazeGraphics.strokeRect(wall.x, wall.y, wall.width, wall.height);
    }

    this.add.text(32, 24, 'ESCAPE ROOM', {
      fontFamily: 'sans-serif',
      fontSize: '28px',
      color: '#f5f1e8',
    });
    this.keyCountText = this.add.text(420, 27, `鍵: 0 / ${KEY_TARGET}`, {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#f5d58a',
    });
    this.timeText = this.add.text(1040, 27, `残り時間: ${this.remainingTime}`, {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#f5f1e8',
    });

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasdKeys = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.escapeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.gameTimer = this.time.addEvent({
      delay: 1000,
      callback: this.decrementTimer,
      callbackScope: this,
      loop: true,
    });

    this.chests = createInitialChests(maze.walkableCells);
    this.chestGraphics = this.add.graphics();
    this.redrawChests();

    const startPosition = maze.start;
    this.playerWorldX = startPosition.x;
    this.playerWorldY = startPosition.y;
    const playerScreenX = ROOM_X + ROOM_WIDTH / 2;
    const playerScreenY = ROOM_Y + ROOM_HEIGHT / 2;
    this.player = this.add.circle(playerScreenX, playerScreenY, PLAYER_RADIUS, 0x58c4b8);
    this.player.setStrokeStyle(3, 0xd8fff4);
    this.updateWorldPosition(playerScreenX, playerScreenY);

    this.add.text(700, 18, '鍵を探そう', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#b7c9d8',
    });
    this.interactionText = this.add.text(700, 48, '', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#f5d58a',
    });

    this.pauseOverlay = this.add.container(0, 0);
    const pauseBackground = this.add.graphics();
    pauseBackground.fillStyle(0x000000, 0.68);
    pauseBackground.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const pauseText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ポーズ中\nEscキーで再開', {
      fontFamily: 'sans-serif',
      fontSize: '32px',
      color: '#f5f1e8',
      align: 'center',
    });
    pauseText.setOrigin(0.5);
    this.pauseOverlay.add(pauseBackground);
    this.pauseOverlay.add(pauseText);
    this.pauseOverlay.setVisible(false);
  }

  update(_time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      this.togglePause();
    }

    if (this.isPaused || this.isEnding || this.remainingTime === 0) {
      return;
    }

    let directionX = 0;
    let directionY = 0;

    if (this.cursors.left.isDown) {
      directionX -= 1;
    }
    if (this.wasdKeys.left.isDown) {
      directionX -= 1;
    }
    if (this.cursors.right.isDown) {
      directionX += 1;
    }
    if (this.wasdKeys.right.isDown) {
      directionX += 1;
    }
    if (this.cursors.up.isDown) {
      directionY -= 1;
    }
    if (this.wasdKeys.up.isDown) {
      directionY -= 1;
    }
    if (this.cursors.down.isDown) {
      directionY += 1;
    }
    if (this.wasdKeys.down.isDown) {
      directionY += 1;
    }

    const diagonalScale = directionX !== 0 && directionY !== 0 ? Math.SQRT1_2 : 1;
    const distance = PLAYER_SPEED * (delta / 1000) * diagonalScale;
    const minimumX = ROOM_X + PLAYER_RADIUS;
    const maximumX = ROOM_X + ROOM_WIDTH - PLAYER_RADIUS;
    const minimumY = ROOM_Y + PLAYER_RADIUS;
    const maximumY = ROOM_Y + ROOM_HEIGHT - PLAYER_RADIUS;

    const nextX = Phaser.Math.Clamp(
      this.playerWorldX + directionX * distance,
      minimumX,
      maximumX,
    );
    if (this.canOccupy(nextX, this.playerWorldY)) {
      this.playerWorldX = nextX;
    }

    const nextY = Phaser.Math.Clamp(
      this.playerWorldY + directionY * distance,
      minimumY,
      maximumY,
    );
    if (this.canOccupy(this.playerWorldX, nextY)) {
      this.playerWorldY = nextY;
    }
    this.updateWorldPosition(this.player.x, this.player.y);

    const nearbyChest = this.findNearbyChest();
    this.interactionText.setText(nearbyChest ? 'Enterキーで開ける' : '');
    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      this.openNearbyChest();
    }
  }

  private togglePause(): void {
    this.state = transitionGameState(this.state, GameEvent.EscapePressed);
    this.isPaused = this.state === GameState.Paused;
    this.gameTimer.paused = this.isPaused;
    this.pauseOverlay.setVisible(this.isPaused);
  }

  private decrementTimer(): void {
    if (this.remainingTime === 0) {
      this.gameTimer.paused = true;
      return;
    }

    this.remainingTime -= 1;
    this.timeText.setText(`残り時間: ${this.remainingTime}`);
    this.timeText.setColor(this.remainingTime <= 10 ? '#e8876b' : '#f5f1e8');

    if (this.remainingTime === 0) {
      this.gameTimer.paused = true;
      this.interactionText.setText('時間切れ');
      this.state = transitionGameState(this.state, GameEvent.TimerExpired);
      this.scene.start('ResultScene', {
        state: this.state,
        keyCount: this.keyCount,
      });
    }
  }

  private findNearbyChest(): ChestData | undefined {
    return this.chests.find((chest) => {
      if (chest.isOpened) {
        return false;
      }

      const distance = Phaser.Math.Distance.Between(
        this.playerWorldX,
        this.playerWorldY,
        chest.x,
        chest.y,
      );
      return distance <= CHEST_INTERACTION_DISTANCE;
    });
  }

  private canOccupy(x: number, y: number): boolean {
    const playerCircle = new Phaser.Geom.Circle(x, y, PLAYER_RADIUS);
    return this.mazeWalls.every(
      (wall) => !Phaser.Geom.Intersects.CircleToRectangle(playerCircle, wall),
    );
  }

  private updateWorldPosition(playerScreenX: number, playerScreenY: number): void {
    this.mazeGraphics.setPosition(
      playerScreenX - this.playerWorldX,
      playerScreenY - this.playerWorldY,
    );
    this.chestGraphics.setPosition(
      playerScreenX - this.playerWorldX,
      playerScreenY - this.playerWorldY,
    );
  }

  private openNearbyChest(): void {
    const chest = this.findNearbyChest();
    if (!chest) {
      return;
    }

    chest.isOpened = true;
    if (chest.isCorrect) {
      this.keyCount += 1;
      this.keyCountText.setText(`鍵: ${this.keyCount} / ${KEY_TARGET}`);
      this.playKeyAcquiredEffect();
    }
    this.redrawChests();

    if (this.keyCount === KEY_TARGET) {
      this.state = transitionGameState(this.state, GameEvent.AllKeysCollected);
      this.isEnding = true;
      this.gameTimer.paused = true;
      this.time.delayedCall(4200, () => {
        this.scene.start('ResultScene', {
          state: this.state,
          keyCount: this.keyCount,
        });
      });
    }
  }

  private playKeyAcquiredEffect(): void {
    this.cameras.main.flash(220, 245, 213, 138);
    const ring = this.add.circle(this.player.x, this.player.y, PLAYER_RADIUS + 8, 0xf5d58a, 0);
    ring.setStrokeStyle(7, 0xf5d58a, 1);
    ring.setDepth(10);
    this.tweens.add({
      targets: ring,
      scale: 3.4,
      alpha: 0,
      duration: 2520,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });

    const acquiredKey = this.add.graphics();
    acquiredKey.setPosition(this.player.x, this.player.y - 42);
    acquiredKey.lineStyle(7, 0xf5d58a, 1);
    acquiredKey.strokeCircle(-28, 0, 15);
    acquiredKey.lineBetween(-13, 0, 44, 0);
    acquiredKey.lineBetween(25, 0, 25, 15);
    acquiredKey.lineBetween(38, 0, 38, 11);
    acquiredKey.setDepth(10);
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
      this.drawChest(this.chestGraphics, chest);
    }
  }

  private drawChest(graphics: Phaser.GameObjects.Graphics, chest: ChestData): void {
    const bodyColor = chest.isOpened ? 0x66717d : 0xc8894b;
    const lidColor = chest.isOpened ? 0x84909a : 0xe2ad62;

    graphics.fillStyle(bodyColor, 1);
    graphics.fillRect(chest.x - 24, chest.y - 16, 48, 32);
    graphics.fillStyle(lidColor, 1);
    graphics.fillRect(chest.x - 24, chest.y - 16, 48, 8);
    graphics.lineStyle(2, 0x593b2a, 1);
    graphics.strokeRect(chest.x - 24, chest.y - 16, 48, 32);
    graphics.lineBetween(chest.x, chest.y - 16, chest.x, chest.y + 16);
    graphics.fillStyle(0x593b2a, 1);
    graphics.fillRect(chest.x - 4, chest.y - 3, 8, 8);
  }
}