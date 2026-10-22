import Phaser from 'phaser';
import { CORRECT_CHEST_COUNT, createInitialChests } from '../game/Chest';
import {
  createInitialMeleeEnemies,
  MELEE_ENEMY_CONTACT_COOLDOWN,
  MELEE_ENEMY_CONTACT_DAMAGE,
} from '../game/Enemy';
import {
  createDanmakuBurst,
  createInitialRangedEnemies,
  RANGED_ENEMY_SHOT_INTERVAL,
} from '../game/RangedEnemy';
import { GameEvent, GameState, transitionGameState } from '../game/GameState';
import { createMaze } from '../game/Maze';
import { selectRandomWalkableCells } from '../game/Placement';
import type { ChestData } from '../game/Chest';
import type { MeleeEnemyData } from '../game/Enemy';
import type { DanmakuBulletData, RangedEnemyData } from '../game/RangedEnemy';
import type { MazeCellCenter } from '../game/Maze';

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const HUD_HEIGHT = 80;
const ROOM_X = 48;
const ROOM_Y = 112;
const ROOM_WIDTH = (GAME_WIDTH - ROOM_X * 2) * 1.5;
const ROOM_HEIGHT = (GAME_HEIGHT - ROOM_Y - 48) * 1.5;
const PLAYER_BASE_SPEED = 200;
const PLAYER_MIN_SPEED = 140;
const KEY_WEIGHT_SPEED_PENALTY = 8;
const WALL_SLOW_DISTANCE = 12;
const WALL_SPEED_MULTIPLIER = 0.75;
const PLAYER_RADIUS = 20;
const MELEE_ATTACK_DAMAGE = 1;
const MELEE_ATTACK_RANGE = 56;
const MELEE_ATTACK_COOLDOWN_MS = 450;
const VISION_HALF_SIZE = 260;
const CAMERA_MIN_ZOOM = 1;
const CAMERA_MAX_ZOOM = 1.8;
const CAMERA_DEFAULT_ZOOM = 1.1;
const CAMERA_ZOOM_STEP = 0.1;
const CHEST_INTERACTION_DISTANCE = 64;
const TIME_LIMIT_SECONDS = 60;
const TIME_LIMIT_CENTISECONDS = TIME_LIMIT_SECONDS * 100;
const KEY_TARGET = CORRECT_CHEST_COUNT;
const SCORE_PER_CHEST = 1000;
const MAX_PLAYER_HEALTH = 10;

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
  private player!: Phaser.GameObjects.Arc;
  private mazeGraphics!: Phaser.GameObjects.Graphics;
  private chests!: ChestData[];
  private chestGraphics!: Phaser.GameObjects.Graphics;
  private enemies!: MeleeEnemyData[];
  private enemyGraphics!: Phaser.GameObjects.Graphics;
  private rangedEnemies!: RangedEnemyData[];
  private rangedEnemyGraphics!: Phaser.GameObjects.Graphics;
  private bullets: DanmakuBulletData[] = [];
  private bulletGraphics!: Phaser.GameObjects.Graphics;
  private door!: MazeCellCenter;
  private doorGraphics!: Phaser.GameObjects.Graphics;
  private mazeWalls!: Phaser.Geom.Rectangle[];
  private visibilityFog!: Phaser.GameObjects.Graphics;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private keyCountText!: Phaser.GameObjects.Text;
  private healthText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private interactionText!: Phaser.GameObjects.Text;
  private keyCount = 0;
  private playerHealth = MAX_PLAYER_HEALTH;
  private score = 0;
  private remainingTimeCentiseconds = TIME_LIMIT_CENTISECONDS;
  private meleeAttackCooldown = 0;
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
    this.playerHealth = MAX_PLAYER_HEALTH;
    this.score = 0;
    this.remainingTimeCentiseconds = TIME_LIMIT_CENTISECONDS;
    this.meleeAttackCooldown = 0;
    this.isPaused = false;
    this.isEnding = false;
    this.state = GameState.Playing;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101722');

    const layout = this.add.graphics();
    layout.fillStyle(0x26384a, 1);
    layout.fillRect(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT);
    layout.lineStyle(4, 0x7f9bb3, 1);
    layout.strokeRect(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT);

    const hudBackground = this.add.graphics();
    hudBackground.fillStyle(0x172333, 1);
    hudBackground.fillRect(0, 0, GAME_WIDTH, HUD_HEIGHT);
    hudBackground.setScrollFactor(0);
    hudBackground.setDepth(35);

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
    }).setScrollFactor(0).setDepth(40);
    this.keyCountText = this.add.text(420, 27, `鍵: 0 / ${KEY_TARGET}`, {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#f5d58a',
    }).setScrollFactor(0).setDepth(40);
    this.healthText = this.add.text(250, 27, `HP: ${this.playerHealth} / ${MAX_PLAYER_HEALTH}`, {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#e8876b',
    }).setScrollFactor(0).setDepth(40);
    this.scoreText = this.add.text(570, 27, 'スコア: 0', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#f5d58a',
    }).setScrollFactor(0).setDepth(40);
    this.timeText = this.add.text(1040, 27, `残り時間: ${this.formatRemainingTime()}`, {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#f5f1e8',
    }).setScrollFactor(0).setDepth(40);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasdKeys = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.escapeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.gameTimer = this.time.addEvent({
      delay: 10,
      callback: this.decrementTimer,
      callbackScope: this,
      loop: true,
    });

    this.chests = createInitialChests(maze.walkableCells);
    this.chestGraphics = this.add.graphics();
    this.redrawChests();
    const [door] = selectRandomWalkableCells(maze.walkableCells, 1, this.chests);
    if (!door) {
      throw new Error('Unable to place the escape door');
    }
    this.door = door;
    this.doorGraphics = this.add.graphics();
    this.drawDoor();
    this.enemies = createInitialMeleeEnemies(maze.walkableCells, [
      ...this.chests,
      this.door,
    ]);
    this.enemyGraphics = this.add.graphics();
    this.drawEnemies();
    this.rangedEnemies = createInitialRangedEnemies(maze.walkableCells, [
      ...this.chests,
      this.door,
      ...this.enemies,
    ]);
    this.rangedEnemyGraphics = this.add.graphics();
    this.bulletGraphics = this.add.graphics();
    this.drawRangedEnemies();

    const startPosition = maze.start;
    this.playerWorldX = startPosition.x;
    this.playerWorldY = startPosition.y;
    this.player = this.add.circle(this.playerWorldX, this.playerWorldY, PLAYER_RADIUS, 0x58c4b8);
    this.player.setStrokeStyle(3, 0xd8fff4);
    this.player.setDepth(30);

    const camera = this.cameras.main;
    camera.setBounds(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT);
    camera.setZoom(CAMERA_DEFAULT_ZOOM);
    camera.startFollow(this.player, true, 0.12, 0.12);
    camera.setDeadzone(240, 160);
    this.input.on('wheel', this.handleMouseWheel, this);

    this.visibilityFog = this.add.graphics();
    this.visibilityFog.setScrollFactor(0);
    this.drawVisibilityFog();
    this.visibilityFog.setDepth(20);

    this.add.text(700, 18, '鍵を探そう', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#b7c9d8',
    }).setScrollFactor(0).setDepth(40);
    this.interactionText = this.add.text(700, 48, '', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#f5d58a',
    }).setScrollFactor(0).setDepth(40);

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
    this.pauseOverlay.setScrollFactor(0);
    this.pauseOverlay.setDepth(50);
    this.pauseOverlay.setVisible(false);
  }

  update(_time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      this.togglePause();
    }

    if (this.isPaused || this.isEnding || this.remainingTimeCentiseconds === 0) {
      return;
    }

    this.meleeAttackCooldown = Math.max(0, this.meleeAttackCooldown - delta);
    this.moveEnemies(delta);
    this.updateRangedCombat(delta);
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.performMeleeAttack();
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
    const distance = this.getPlayerSpeed() * (delta / 1000) * diagonalScale;
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
    this.player.setPosition(this.playerWorldX, this.playerWorldY);
    this.drawVisibilityFog();

    const nearbyChest = this.findNearbyChest();
    const nearDoor = this.isNearDoor();
    if (nearbyChest) {
      this.interactionText.setText('Enterキーで開ける');
    } else if (nearDoor) {
      this.interactionText.setText(
        this.keyCount === KEY_TARGET
          ? 'Enterキーで脱出'
          : `鍵が足りません（${this.keyCount} / ${KEY_TARGET}）`,
      );
    } else {
      this.interactionText.setText('Spaceキーで近接攻撃');
    }
    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      if (nearbyChest) {
        this.openNearbyChest();
      } else if (nearDoor) {
        this.tryEscape();
      }
    }
  }

  private togglePause(): void {
    this.state = transitionGameState(this.state, GameEvent.EscapePressed);
    this.isPaused = this.state === GameState.Paused;
    this.gameTimer.paused = this.isPaused;
    this.pauseOverlay.setVisible(this.isPaused);
  }

  private decrementTimer(): void {
    if (this.remainingTimeCentiseconds === 0) {
      this.gameTimer.paused = true;
      return;
    }

    this.remainingTimeCentiseconds -= 1;
    this.timeText.setText(`残り時間: ${this.formatRemainingTime()}`);
    this.timeText.setColor(
      this.remainingTimeCentiseconds <= 1000 ? '#e8876b' : '#f5f1e8',
    );

    if (this.remainingTimeCentiseconds === 0) {
      this.gameTimer.paused = true;
      this.interactionText.setText('時間切れ');
      this.state = transitionGameState(this.state, GameEvent.TimerExpired);
      this.scene.start('ResultScene', {
        state: this.state,
        keyCount: this.keyCount,
        score: this.score,
        gameOverReason: 'timeout',
      });
    }
  }

  private formatRemainingTime(): string {
    const seconds = Math.floor(this.remainingTimeCentiseconds / 100);
    const centiseconds = this.remainingTimeCentiseconds % 100;
    return `${seconds}.${centiseconds.toString().padStart(2, '0')}`;
  }

  private getPlayerSpeed(): number {
    const inventorySpeed = Math.max(
      PLAYER_MIN_SPEED,
      PLAYER_BASE_SPEED - this.keyCount * KEY_WEIGHT_SPEED_PENALTY,
    );
    return inventorySpeed * this.getEnvironmentSpeedMultiplier();
  }

  private getEnvironmentSpeedMultiplier(): number {
    const nearbyWall = new Phaser.Geom.Circle(
      this.playerWorldX,
      this.playerWorldY,
      PLAYER_RADIUS + WALL_SLOW_DISTANCE,
    );
    return this.mazeWalls.some((wall) =>
      Phaser.Geom.Intersects.CircleToRectangle(nearbyWall, wall),
    )
      ? WALL_SPEED_MULTIPLIER
      : 1;
  }

  private drawVisibilityFog(): void {
    const camera = this.cameras.main;
    const centerX = (this.playerWorldX - camera.worldView.x) * camera.zoom;
    const centerY = (this.playerWorldY - camera.worldView.y) * camera.zoom;
    const left = centerX - VISION_HALF_SIZE;
    const top = centerY - VISION_HALF_SIZE;
    const visibleSize = VISION_HALF_SIZE * 2;

    this.visibilityFog.clear();
    this.visibilityFog.fillStyle(0x050a10, 0.9);
    this.visibilityFog.fillRect(0, 0, GAME_WIDTH, Math.max(0, top));
    this.visibilityFog.fillRect(
      0,
      centerY + VISION_HALF_SIZE,
      GAME_WIDTH,
      Math.max(0, GAME_HEIGHT - centerY - VISION_HALF_SIZE),
    );
    this.visibilityFog.fillRect(0, top, Math.max(0, left), visibleSize);
    this.visibilityFog.fillRect(
      centerX + VISION_HALF_SIZE,
      top,
      Math.max(0, GAME_WIDTH - centerX - VISION_HALF_SIZE),
      visibleSize,
    );
    this.drawWallShadows(centerX, centerY);
  }

  private drawWallShadows(centerX: number, centerY: number): void {
    const camera = this.cameras.main;
    const viewLeft = centerX - VISION_HALF_SIZE;
    const viewTop = centerY - VISION_HALF_SIZE;
    const viewRight = centerX + VISION_HALF_SIZE;
    const viewBottom = centerY + VISION_HALF_SIZE;

    this.visibilityFog.fillStyle(0x050a10, 0.78);
    for (const wall of this.mazeWalls) {
      const wallLeft = (wall.x - camera.worldView.x) * camera.zoom;
      const wallTop = (wall.y - camera.worldView.y) * camera.zoom;
      const wallRight = wallLeft + wall.width * camera.zoom;
      const wallBottom = wallTop + wall.height * camera.zoom;
      if (
        wallRight < viewLeft ||
        wallLeft > viewRight ||
        wallBottom < viewTop ||
        wallTop > viewBottom
      ) {
        continue;
      }

      if (wall.width >= wall.height) {
        const shadowStartsBelow = this.playerWorldY < wall.y + wall.height / 2;
        const edge = (shadowStartsBelow ? wallBottom : wallTop);
        if (shadowStartsBelow) {
          this.visibilityFog.fillRect(
            wallLeft,
            edge,
            wallRight - wallLeft,
            Math.max(0, GAME_HEIGHT - edge),
          );
        } else {
          this.visibilityFog.fillRect(wallLeft, 0, wallRight - wallLeft, Math.max(0, edge));
        }
      } else {
        const shadowStartsRight = this.playerWorldX < wall.x + wall.width / 2;
        const edge = shadowStartsRight ? wallRight : wallLeft;
        if (shadowStartsRight) {
          this.visibilityFog.fillRect(
            edge,
            wallTop,
            Math.max(0, GAME_WIDTH - edge),
            wallBottom - wallTop,
          );
        } else {
          this.visibilityFog.fillRect(0, wallTop, Math.max(0, edge), wallBottom - wallTop);
        }
      }
    }
  }

  private handleMouseWheel(
    _pointer: Phaser.Input.Pointer,
    _currentlyOver: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void {
    const zoomDirection = deltaY > 0 ? -1 : 1;
    const nextZoom = Phaser.Math.Clamp(
      this.cameras.main.zoom + zoomDirection * CAMERA_ZOOM_STEP,
      CAMERA_MIN_ZOOM,
      CAMERA_MAX_ZOOM,
    );
    this.cameras.main.setZoom(nextZoom);
    this.drawVisibilityFog();
  }

  public performMeleeAttack(): number {
    if (this.meleeAttackCooldown > 0 || this.isPaused || this.isEnding) {
      return 0;
    }

    this.meleeAttackCooldown = MELEE_ATTACK_COOLDOWN_MS;
    const damage = MELEE_ATTACK_DAMAGE;
    for (const enemy of this.enemies) {
      const distance = Phaser.Math.Distance.Between(
        this.playerWorldX,
        this.playerWorldY,
        enemy.x,
        enemy.y,
      );
      if (distance <= MELEE_ATTACK_RANGE + enemy.radius) {
        enemy.health -= damage;
      }
    }
    this.enemies = this.enemies.filter((enemy) => enemy.health > 0);
    for (const enemy of this.rangedEnemies) {
      const distance = Phaser.Math.Distance.Between(
        this.playerWorldX,
        this.playerWorldY,
        enemy.x,
        enemy.y,
      );
      if (distance <= MELEE_ATTACK_RANGE + enemy.radius) {
        enemy.health -= damage;
      }
    }
    this.rangedEnemies = this.rangedEnemies.filter((enemy) => enemy.health > 0);
    this.drawEnemies();
    this.drawRangedEnemies();
    const attackEffect = this.add.circle(
      this.player.x,
      this.player.y,
      MELEE_ATTACK_RANGE,
      0xf5d58a,
      0.28,
    );
    attackEffect.setStrokeStyle(3, 0xf5d58a, 1);
    attackEffect.setDepth(31);
    this.tweens.add({
      targets: attackEffect,
      scale: 1.2,
      alpha: 0,
      duration: 180,
      ease: 'Cubic.easeOut',
      onComplete: () => attackEffect.destroy(),
    });
    return damage;
  }

  public takeDamage(amount: number): void {
    if (amount <= 0 || this.isPaused || this.isEnding || this.playerHealth === 0) {
      return;
    }

    this.playerHealth = Math.max(0, this.playerHealth - amount);
    this.healthText.setText(`HP: ${this.playerHealth} / ${MAX_PLAYER_HEALTH}`);
    this.cameras.main.flash(160, 232, 135, 107);

    if (this.playerHealth === 0) {
      this.state = transitionGameState(this.state, GameEvent.PlayerDefeated);
      this.isEnding = true;
      this.gameTimer.paused = true;
      this.interactionText.setText('力尽きた');
      this.scene.start('ResultScene', {
        state: this.state,
        keyCount: this.keyCount,
        score: this.score,
        gameOverReason: 'health',
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

  private moveEnemies(delta: number): void {
    for (const enemy of this.enemies) {
      enemy.contactCooldown = Math.max(0, enemy.contactCooldown - delta);
      const deltaX = this.playerWorldX - enemy.x;
      const deltaY = this.playerWorldY - enemy.y;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance > 0) {
        const movement = Math.min(enemy.speed * (delta / 1000), distance);
        const nextX = enemy.x + (deltaX / distance) * movement;
        const nextY = enemy.y + (deltaY / distance) * movement;
        if (this.canOccupy(nextX, enemy.y, enemy.radius)) {
          enemy.x = nextX;
        }
        if (this.canOccupy(enemy.x, nextY, enemy.radius)) {
          enemy.y = nextY;
        }
      }

      const contactDistance = PLAYER_RADIUS + enemy.radius;
      if (
        Phaser.Math.Distance.Between(
          this.playerWorldX,
          this.playerWorldY,
          enemy.x,
          enemy.y,
        ) <= contactDistance &&
        enemy.contactCooldown === 0
      ) {
        this.takeDamage(MELEE_ENEMY_CONTACT_DAMAGE);
        enemy.contactCooldown = MELEE_ENEMY_CONTACT_COOLDOWN;
      }
    }
    this.drawEnemies();
  }

  private updateRangedCombat(delta: number): void {
    for (const enemy of this.rangedEnemies) {
      enemy.shotCooldown -= delta;
      if (enemy.shotCooldown <= 0) {
        this.bullets.push(
          ...createDanmakuBurst(enemy, this.playerWorldX, this.playerWorldY),
        );
        enemy.shotCooldown = RANGED_ENEMY_SHOT_INTERVAL;
      }
    }

    const activeBullets: DanmakuBulletData[] = [];
    for (const bullet of this.bullets) {
      const nextX = bullet.x + bullet.velocityX * (delta / 1000);
      const nextY = bullet.y + bullet.velocityY * (delta / 1000);
      const bulletCircle = new Phaser.Geom.Circle(nextX, nextY, bullet.radius);
      const hitWall = this.mazeWalls.some((wall) =>
        Phaser.Geom.Intersects.CircleToRectangle(bulletCircle, wall),
      );
      const hitPlayer =
        Phaser.Math.Distance.Between(
          nextX,
          nextY,
          this.playerWorldX,
          this.playerWorldY,
        ) <= bullet.radius + PLAYER_RADIUS;
      if (hitPlayer) {
        this.takeDamage(bullet.damage);
        continue;
      }
      if (hitWall || nextX < ROOM_X || nextX > ROOM_X + ROOM_WIDTH || nextY < ROOM_Y || nextY > ROOM_Y + ROOM_HEIGHT) {
        continue;
      }
      activeBullets.push({ ...bullet, x: nextX, y: nextY });
    }
    this.bullets = activeBullets;
    this.drawRangedEnemies();
  }

  private canOccupy(x: number, y: number, radius = PLAYER_RADIUS): boolean {
    const playerCircle = new Phaser.Geom.Circle(x, y, radius);
    return this.mazeWalls.every(
      (wall) => !Phaser.Geom.Intersects.CircleToRectangle(playerCircle, wall),
    );
  }

  private drawEnemies(): void {
    this.enemyGraphics.clear();
    for (const enemy of this.enemies) {
      this.enemyGraphics.fillStyle(0xe8876b, 1);
      this.enemyGraphics.fillCircle(enemy.x, enemy.y, enemy.radius);
      this.enemyGraphics.lineStyle(3, 0xffd2c8, 1);
      this.enemyGraphics.strokeCircle(enemy.x, enemy.y, enemy.radius);
      this.enemyGraphics.fillStyle(0x401b25, 1);
      this.enemyGraphics.fillCircle(enemy.x - 6, enemy.y - 3, 3);
      this.enemyGraphics.fillCircle(enemy.x + 6, enemy.y - 3, 3);
    }
  }

  private drawRangedEnemies(): void {
    this.rangedEnemyGraphics.clear();
    for (const enemy of this.rangedEnemies) {
      this.rangedEnemyGraphics.fillStyle(0x8f7ae5, 1);
      this.rangedEnemyGraphics.fillCircle(enemy.x, enemy.y, enemy.radius);
      this.rangedEnemyGraphics.lineStyle(3, 0xe5ddff, 1);
      this.rangedEnemyGraphics.strokeCircle(enemy.x, enemy.y, enemy.radius);
      this.rangedEnemyGraphics.fillStyle(0x24194f, 1);
      this.rangedEnemyGraphics.fillCircle(enemy.x - 6, enemy.y - 3, 3);
      this.rangedEnemyGraphics.fillCircle(enemy.x + 6, enemy.y - 3, 3);
    }
    this.bulletGraphics.clear();
    this.bulletGraphics.fillStyle(0xf5d58a, 1);
    for (const bullet of this.bullets) {
      this.bulletGraphics.fillCircle(bullet.x, bullet.y, bullet.radius);
    }
  }

  private isNearDoor(): boolean {
    return (
      Phaser.Math.Distance.Between(
        this.playerWorldX,
        this.playerWorldY,
        this.door.x,
        this.door.y,
      ) <= CHEST_INTERACTION_DISTANCE
    );
  }

  private openNearbyChest(): void {
    const chest = this.findNearbyChest();
    if (!chest) {
      return;
    }

    chest.isOpened = true;
    this.score += SCORE_PER_CHEST;
    this.scoreText.setText(`スコア: ${this.score}`);
    if (chest.isCorrect) {
      this.keyCount += 1;
      this.keyCountText.setText(`鍵: ${this.keyCount} / ${KEY_TARGET}`);
      this.playKeyAcquiredEffect();
      this.drawDoor();
    }
    this.redrawChests();
  }

  private tryEscape(): void {
    if (this.keyCount !== KEY_TARGET) {
      return;
    }

    this.state = transitionGameState(this.state, GameEvent.AllKeysCollected);
    this.isEnding = true;
    this.gameTimer.paused = true;
    this.interactionText.setText('脱出成功');
    this.scene.start('ResultScene', {
      state: this.state,
      keyCount: this.keyCount,
      score: this.score,
    });
  }

  private drawDoor(): void {
    this.doorGraphics.clear();
    const isUnlocked = this.keyCount === KEY_TARGET;
    const doorColor = isUnlocked ? 0x58c4b8 : 0x526b7b;
    this.doorGraphics.fillStyle(doorColor, 1);
    this.doorGraphics.fillRect(this.door.x - 24, this.door.y - 28, 48, 56);
    this.doorGraphics.lineStyle(3, 0xd8fff4, 1);
    this.doorGraphics.strokeRect(this.door.x - 24, this.door.y - 28, 48, 56);
    this.doorGraphics.fillStyle(0xf5d58a, 1);
    this.doorGraphics.fillCircle(this.door.x + 12, this.door.y, 4);
    this.doorGraphics.lineStyle(3, 0xf5d58a, 1);
    this.doorGraphics.lineBetween(this.door.x - 12, this.door.y - 12, this.door.x + 12, this.door.y - 12);
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