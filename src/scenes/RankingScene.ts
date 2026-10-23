import Phaser from 'phaser';
import {
  getRankings,
  RANKING_LIMIT,
  type RankingCategory,
} from '../game/Ranking';

const PAGE_SIZE = 20;
const PAGE_COUNT = RANKING_LIMIT / PAGE_SIZE;

export class RankingScene extends Phaser.Scene {
  private page = 0;
  private pageContent: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('RankingScene');
  }

  create(): void {
    this.page = 0;
    this.pageContent = [];
    this.cameras.main.setBackgroundColor('#101722');

    const background = this.add.graphics();
    background.fillStyle(0x172333, 1);
    background.fillRect(0, 0, 1280, 720);
    background.fillStyle(0x1c2c3d, 0.96);
    background.fillRoundedRect(100, 54, 1080, 612, 16);
    background.lineStyle(2, 0x526b7b, 1);
    background.strokeRoundedRect(100, 54, 1080, 612, 16);
    background.fillStyle(0x58c4b8, 1);
    background.fillRect(100, 54, 1080, 6);

    this.add.text(640, 98, 'ランキング', {
      fontFamily: 'sans-serif',
      fontSize: '38px',
      color: '#f5f1e8',
    }).setOrigin(0.5);

    const previousButton = this.add.text(430, 665, '◀ 前のページ', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#b7c9d8',
      backgroundColor: '#26384a',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    previousButton.on('pointerdown', () => this.changePage(-1));

    const nextButton = this.add.text(850, 665, '次のページ ▶', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#b7c9d8',
      backgroundColor: '#26384a',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    nextButton.on('pointerdown', () => this.changePage(1));

    this.input.keyboard?.on('keydown-ESC', this.returnToTitle, this);
    this.input.keyboard?.on('keydown-LEFT', () => this.changePage(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.changePage(1));
    this.renderPage();
  }

  private changePage(offset: number): void {
    this.page = (this.page + offset + PAGE_COUNT) % PAGE_COUNT;
    this.renderPage();
  }

  private renderPage(): void {
    for (const gameObject of this.pageContent) {
      gameObject.destroy();
    }
    this.pageContent = [];

    const rankings = getRankings();
    this.addPageText('RSG（ランダムシード）', 380, 145, '#58c4b8', '26px');
    this.addPageText('SSG（シード指定）', 900, 145, '#f5d58a', '26px');
    this.addPageText('順位   名前         クリアタイム', 380, 180, '#b7c9d8', '16px');
    this.addPageText('順位   名前         クリアタイム', 900, 180, '#b7c9d8', '16px');
    this.renderCategory(rankings.RSG, 380);
    this.renderCategory(rankings.SSG, 900);
    this.addPageText(`${this.page + 1} / ${PAGE_COUNT}　（← →で切り替え / Escでタイトル）`, 640, 635, '#b7c9d8', '17px');
  }

  private renderCategory(
    entries: ReturnType<typeof getRankings>[RankingCategory],
    centerX: number,
  ): void {
    const startIndex = this.page * PAGE_SIZE;
    const visibleEntries = entries.slice(startIndex, startIndex + PAGE_SIZE);
    for (let index = 0; index < PAGE_SIZE; index += 1) {
      const entry = visibleEntries[index];
      const line = entry
        ? `${startIndex + index + 1}位    ${entry.name.padEnd(5)}    ${entry.timeSeconds.toFixed(3)}秒`
        : `${startIndex + index + 1}位`;
      this.addPageText(line, centerX, 208 + index * 20, '#f5f1e8', '15px');
    }
  }

  private addPageText(
    text: string,
    x: number,
    y: number,
    color: string,
    fontSize: string,
  ): void {
    const item = this.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize,
      color,
      align: 'center',
    }).setOrigin(0.5, 0);
    this.pageContent.push(item);
  }

  private returnToTitle(): void {
    this.scene.start('TitleScene');
  }
}
