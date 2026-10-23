import Phaser from 'phaser';
import {
  createRandomSeed,
  LAST_SEED_STORAGE_KEY,
  seedFromInput,
} from '../game/Maze';
import { applySystemCommand, getGameSettings } from '../game/GameSettings';
import { getGameMode, setGameMode, type GameMode } from '../game/GameMode';

const GAME_MODES: readonly GameMode[] = ['limited', 'elapsed'];

export class TitleScene extends Phaser.Scene {
  private seedInput = '';
  private seedInputText!: Phaser.GameObjects.Text;
  private modeButtons: Partial<Record<GameMode, Phaser.GameObjects.Text>> = {};
  private modeDescriptionText?: Phaser.GameObjects.Text;
  private lastSeed = '';
  private seedInputFocused = false;

  constructor() {
    super('TitleScene');
  }

  create(): void {
    this.seedInput = '';
    this.seedInputFocused = false;
    this.modeButtons = {};
    const previousSeed = localStorage.getItem(LAST_SEED_STORAGE_KEY);
    this.lastSeed = previousSeed && /^\d+$/.test(previousSeed) ? previousSeed : '';
    this.cameras.main.setBackgroundColor('#101722');

    const background = this.add.graphics();
    background.fillStyle(0x101722, 1);
    background.fillRect(0, 0, 1280, 720);
    background.fillStyle(0x172333, 1);
    background.fillRect(0, 0, 1280, 96);
    background.fillRect(0, 624, 1280, 96);

    this.add.text(360, 48, 'ゲームモード', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#b7c9d8',
    }).setOrigin(0.5);
    for (const mode of GAME_MODES) {
      this.createModeButton(mode);
    }

    this.drawMazeDecoration();

    const panel = this.add.graphics();
    panel.fillStyle(0x1c2c3d, 0.96);
    panel.fillRoundedRect(250, 108, 780, 508, 18);
    panel.lineStyle(2, 0x526b7b, 1);
    panel.strokeRoundedRect(250, 108, 780, 508, 18);
    panel.fillStyle(0x58c4b8, 1);
    panel.fillRect(250, 108, 780, 6);

    this.add.text(640, 190, 'ESCAPE ROOM', {
      fontFamily: 'sans-serif',
      fontSize: '56px',
      color: '#f5f1e8',
      stroke: '#101722',
      strokeThickness: 8,
    }).setOrigin(0.5);
    this.add.text(640, 260, '鍵を集めて、迷路から脱出しよう', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#b7c9d8',
      letterSpacing: 2,
    }).setOrigin(0.5);

    const keyIcon = this.add.graphics();
    keyIcon.lineStyle(5, 0xf5d58a, 1);
    keyIcon.strokeCircle(612, 330, 16);
    keyIcon.lineBetween(628, 330, 678, 330);
    keyIcon.lineBetween(660, 330, 660, 344);
    keyIcon.lineBetween(672, 330, 672, 340);

    this.add.text(640, 380, '迷路の中に鍵が3つ隠されています', {
      fontFamily: 'sans-serif',
      fontSize: '24px',
      color: '#f5d58a',
    }).setOrigin(0.5);

    const startPrompt = this.add.text(640, 432, 'Enterキーでゲーム開始', {
      fontFamily: 'sans-serif',
      fontSize: '28px',
      color: '#58c4b8',
      stroke: '#101722',
      strokeThickness: 5,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: startPrompt,
      alpha: 0.35,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add.text(640, 462, '迷路シード（数字・文字）', {
      fontFamily: 'sans-serif',
      fontSize: '17px',
      color: '#f5f1e8',
    }).setOrigin(0.5);

    const seedBox = this.add.graphics();
    seedBox.fillStyle(0x101722, 1);
    seedBox.fillRoundedRect(510, 476, 260, 34, 6);
    seedBox.lineStyle(2, 0x58c4b8, 1);
    seedBox.strokeRoundedRect(510, 476, 260, 34, 6);
    this.seedInputText = this.add.text(640, 493, 'ランダム', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#f5d58a',
    }).setOrigin(0.5);
    this.add.zone(640, 493, 260, 34)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.seedInputFocused = true;
        this.seedInput = '';
        this.updateSeedInputText();
      });

    if (this.lastSeed) {
      const previousSeedText = this.add.text(640, 525, `前回のシード：${this.lastSeed}`, {
        fontFamily: 'sans-serif',
        fontSize: '15px',
        color: '#b7c9d8',
      }).setOrigin(0.5).setInteractive();
      previousSeedText.on('pointerdown', () => {
        this.seedInputFocused = true;
        this.seedInput = this.lastSeed;
        this.updateSeedInputText();
      });
    }

    this.add.text(640, 550, '移動：WASD / 矢印　宝箱：Enter　攻撃：Space　Esc：ポーズ', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#b7c9d8',
    }).setOrigin(0.5);

    this.add.text(640, 574, '同じ方向の同時押しでダッシュ（エネルギー制）　／　鍵以外の宝箱：100P', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#b7c9d8',
    }).setOrigin(0.5);

    this.modeDescriptionText = this.add.text(640, 598, '', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#f5d58a',
    }).setOrigin(0.5);
    this.updateModeDescription();

    const rankingButton = this.add.text(640, 660, 'ランキング', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#f5d58a',
      backgroundColor: '#26384a',
      padding: { x: 18, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    rankingButton.on('pointerdown', () => this.scene.start('RankingScene'));
    rankingButton.on('pointerover', () => rankingButton.setColor('#f5f1e8'));
    rankingButton.on('pointerout', () => rankingButton.setColor('#f5d58a'));

    this.input.keyboard?.on('keydown', this.handleSeedInput, this);
    this.input.keyboard?.on('keydown-ENTER', this.startGame, this);
  }

  private createModeButton(mode: GameMode): void {
    const label = mode === 'limited' ? '制限モード' : '経過モード';
    const button = this.add.text(mode === 'limited' ? 520 : 700, 48, label, {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: getGameMode() === mode ? '#58c4b8' : '#b7c9d8',
      backgroundColor: '#26384a',
      padding: { x: 14, y: 7 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => {
      setGameMode(mode);
      this.refreshModeButtons();
    });
    this.modeButtons[mode] = button;
  }

  private refreshModeButtons(): void {
    for (const mode of GAME_MODES) {
      this.modeButtons[mode]?.setColor(
        getGameMode() === mode ? '#58c4b8' : '#b7c9d8',
      );
    }
    this.updateModeDescription();
  }

  private updateModeDescription(): void {
    const settings = getGameSettings();
    const modeDescription = getGameMode() === 'limited'
      ? `制限時間：${settings.roundTimeSeconds}秒`
      : `経過時間：${settings.elapsedTimeStartSeconds}秒から`;
    this.modeDescriptionText?.setText(
      `HP：10　／　${modeDescription}　／　鍵を3つ集めて扉から脱出`,
    );
  }

  private drawMazeDecoration(): void {
    const maze = this.add.graphics();
    maze.lineStyle(15, 0x26384a, 1);
    const paths: readonly [number, number, number, number][] = [
      [70, 160, 210, 160],
      [210, 160, 210, 270],
      [70, 270, 210, 270],
      [70, 160, 70, 430],
      [70, 430, 230, 430],
      [230, 430, 230, 540],
      [1050, 160, 1210, 160],
      [1050, 160, 1050, 300],
      [1050, 300, 1210, 300],
      [1210, 160, 1210, 540],
      [1050, 540, 1210, 540],
      [1050, 420, 1050, 540],
    ];
    for (const [x1, y1, x2, y2] of paths) {
      maze.lineBetween(x1, y1, x2, y2);
    }

    maze.lineStyle(3, 0x58c4b8, 0.75);
    maze.lineBetween(90, 205, 185, 205);
    maze.lineBetween(1095, 255, 1180, 255);
    maze.fillStyle(0xf5d58a, 1);
    maze.fillCircle(90, 205, 7);
    maze.fillCircle(1180, 255, 7);
  }

  private handleSeedInput(event: KeyboardEvent): void {
    if (!this.seedInputFocused || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      this.seedInput = Array.from(this.seedInput).slice(0, -1).join('');
      this.updateSeedInputText();
    } else if (event.key.length === 1 && Array.from(this.seedInput).length < 32) {
      this.seedInput += event.key;
      this.updateSeedInputText();
    }
  }

  private updateSeedInputText(): void {
    this.seedInputText.setText(
      this.seedInput || (this.seedInputFocused ? '入力中...' : 'ランダム'),
    );
  }

  private startGame(): void {
    const commandResult = applySystemCommand(this.seedInput);
    if (commandResult !== 'not-command') {
      this.seedInput = '';
      this.seedInputText.setText(
        commandResult === 'applied'
          ? '設定を適用しました'
          : commandResult === 'ignored'
            ? '敵にエネルギーはありません'
            : 'コマンドを確認してください',
      );
      if (commandResult === 'applied') {
        this.updateModeDescription();
      }
      return;
    }

    const seed = this.seedInput.trim() === ''
      ? createRandomSeed()
      : seedFromInput(this.seedInput);
    this.scene.start('GameScene', {
      seed,
      seedWasSet: this.seedInput.trim() !== '',
      mode: getGameMode(),
    });
  }
}