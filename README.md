# gamedev-template

Phaser 4 + Vite + TypeScript のゲーム開発テンプレート。

## セットアップ

```bash
npm install
npm run dev
```

`npm run dev` でブラウザが自動で開き、`http://localhost:5173` でゲームが動く。
`src/` 以下を編集すると HMR で即座に反映される（Phaser の Game インスタンスは破棄・再生成される）。

## スクリプト

- `npm run dev` — 開発サーバー起動（HMR 有効）
- `npm run build` — 型チェック後に `dist/` へ本番ビルド
- `npm run preview` — ビルド結果をローカルで確認
- `npm run typecheck` — 型チェックのみ

## ゲームモードとランキング

タイトル画面上部で「制限モード」または「経過モード」を選びます。制限モードは残り時間が0になると終了し、経過モードは経過時間を計測してゲームを続けます。シード入力欄に `system time 10`（`sys` も可）を入力して Enter を押すと、ゲームを開始せず時間を変更できます。`system time true` / `system time false` で時間の進行を切り替え、`system def` でシステム設定を初期状態に戻します。

タイトル画面下部からRSG（ランダムシード）とSSG（シード指定）のランキングを確認できます。クリアタイムはブラウザーのローカルストレージに各100位まで保存されます。設定変更中のプレイはランキング対象外です。名前は英数字0〜5文字で入力できます。

## 構成

```
index.html            エントリ HTML。#game-container に canvas が入る
vite.config.ts        Vite 設定
tsconfig.json         TypeScript 設定
public/               そのまま配信される静的アセット置き場
src/
  main.ts             GameConfig と Game インスタンスの生成、HMR 処理
  scenes/
    HelloScene.ts     'Hello, world!' を表示するだけのシーン
```

## アセットの置き方

`public/` に置いたファイルはルート直下から参照できる。

```ts
this.load.image('logo', 'logo.png'); // public/logo.png
```

## シーンの追加

1. `src/scenes/` に `Phaser.Scene` を継承したクラスを作る
2. `src/main.ts` の `scene` 配列に追加する（配列の先頭のシーンが最初に起動する）

## AI コーディングエージェント向け

`AGENTS.md` に作業指針を置いている（Claude Code 用に `CLAUDE.md` から取り込み済み）。

Phaser 4 の公式ドキュメントは `node_modules/phaser/skills/<トピック>/SKILL.md` に 28 トピック分同梱されている。
API を書く前に該当トピックを読ませると、v3 と v4 の取り違えを防げる。詳細は `AGENTS.md` を参照。

ああああああああああああああああああああああああああああああああああああああああああああああああああああああああああああああああああああああああ