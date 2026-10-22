import Phaser from 'phaser';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101722');

    const background = this.add.graphics();
    background.fillStyle(0x101722, 1);
    background.fillRect(0, 0, 1280, 720);
    background.fillStyle(0x172333, 1);
    background.fillRect(0, 0, 1280, 96);
    background.fillRect(0, 624, 1280, 96);

    this.drawMazeDecoration();

    const panel = this.add.graphics();
    panel.fillStyle(0x1c2c3d, 0.96);
    panel.fillRoundedRect(250, 128, 780, 464, 18);
    panel.lineStyle(2, 0x526b7b, 1);
    panel.strokeRoundedRect(250, 128, 780, 464, 18);
    panel.fillStyle(0x58c4b8, 1);
    panel.fillRect(250, 128, 780, 6);

    this.add.text(640, 190, 'ESCAPE ROOM', {
      fontFamily: 'sans-serif',
      fontSize: '56px',
      color: '#f5f1e8',
      stroke: '#101722',
      strokeThickness: 8,
    }).setOrigin(0.5);
    this.add.text(640, 260, '鍵を集めて、扉から脱出しよう', {
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

    this.add.text(640, 380, '迷路の中に鍵が5つ、脱出扉が1つあります', {
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

    this.add.text(640, 488, '矢印キー：移動　　Enter：宝箱を開ける　　Space：攻撃　　Esc：ポーズ', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#b7c9d8',
    }).setOrigin(0.5);

    this.add.text(640, 540, '制限時間：60秒　／　鍵を5個集めて扉から脱出', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#f5d58a',
    }).setOrigin(0.5);

    this.input.keyboard?.once('keydown-ENTER', this.startGame, this);
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

  private startGame(): void {
    this.scene.start('GameScene');
  }
}