import Phaser from 'phaser';
import { GameEvent, GameState, transitionGameState } from '../game/GameState';

interface ResultData {
  state: GameState;
  keyCount: number;
  pCount: number;
  remainingTime: number;
  reason?: 'timeout' | 'defeated' | 'clear';
}

export class ResultScene extends Phaser.Scene {
  private state!: GameState;
  private keyCount = 0;
  private pCount = 0;
  private remainingTime = 0;
  private reason: ResultData['reason'] = 'timeout';

  constructor() {
    super('ResultScene');
  }

  init(data: ResultData): void {
    this.state = data.state;
    this.keyCount = data.keyCount;
    this.pCount = data.pCount;
    this.remainingTime = data.remainingTime;
    this.reason = data.reason ?? 'timeout';
  }

  create(): void {
    const isClear = this.state === GameState.Clear;
    const title = isClear ? 'クリア！' : 'ゲームオーバー';
    const detail = isClear
      ? `集めた鍵：${this.keyCount}個　／　P：${this.pCount}\n残り時間：${this.remainingTime.toFixed(3)}秒`
      : `${this.reason === 'defeated' ? '敵に倒されました' : '時間切れです'}　／　P：${this.pCount}\n残り時間：${this.remainingTime.toFixed(3)}秒`;
    const accentColor = isClear ? 0x58c4b8 : 0xe8876b;

    this.cameras.main.setBackgroundColor('#101722');
    const background = this.add.graphics();
    background.fillStyle(0x172333, 1);
    background.fillRect(0, 0, 1280, 720);
    background.fillStyle(0x26384a, 1);
    background.fillRoundedRect(320, 160, 640, 400, 16);
    background.lineStyle(4, accentColor, 1);
    background.strokeRoundedRect(320, 160, 640, 400, 16);
    background.fillStyle(accentColor, 1);
    background.fillRect(320, 160, 640, 12);

    this.add.text(640, 260, title, {
      fontFamily: 'sans-serif',
      fontSize: '56px',
      color: isClear ? '#58c4b8' : '#e8876b',
    }).setOrigin(0.5);
    this.add.text(640, 340, detail, {
      fontFamily: 'sans-serif',
      fontSize: '24px',
      color: '#f5f1e8',
    }).setOrigin(0.5);
    this.add.text(640, 440, 'Enterキーでタイトルへ戻る', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#b7c9d8',
    }).setOrigin(0.5);

    this.input.keyboard?.once('keydown-ENTER', this.returnToTitle, this);
  }

  private returnToTitle(): void {
    const nextState = transitionGameState(this.state, GameEvent.EnterPressed);
    if (nextState === GameState.Title) {
      this.scene.start('TitleScene');
    }
  }
}