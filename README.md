# SS Image Search - 中古アパレル買取 画像類似検索モックアプリ

商品画像から類似の過去買取データをベクトル検索し、商品情報の入力を効率化する Electron デスクトップアプリ。

## セットアップ

```bash
npm install
```

## 開発

```bash
npm run dev
```

## ビルド

```bash
npm run build
```

## E2Eテスト

Playwright + Electron で E2E テストを実行します。テスト実行時にアプリのビルドも自動で行われます。

```bash
# テスト実行（ヘッドレス）
npm run test:e2e

# テスト実行（GUI表示）
npm run test:e2e:headed

# HTMLレポート表示
npm run test:e2e:report
```

### テスト構成

| ファイル | 内容 | 本数 |
|---|---|---|
| `home.spec.ts` | ホーム画面の表示・遷移 | 3 |
| `workspace-primary.spec.ts` | 画像→候補→保存の主要フロー | 6 |
| `workspace-edge.spec.ts` | 保存制御・リセット・スケルトン等 | 6 |
| `history.spec.ts` | 履歴テーブル・詳細パネル | 3 |
| `history-edge.spec.ts` | フィルタ・ページネーション・空状態 | 7 |
| `keyboard.spec.ts` | ショートカット・コマンドパレット | 8 |
| **合計** | | **33** |

### テスト方針

- 画面要素は `data-testid` で参照（安定性最優先）
- 待機は UI 状態ベース（`waitForSelector`, `toBeVisible`）。固定 sleep は不使用
- 失敗時にスクリーンショット + トレースを `test-results/` に自動保存
- テストファイル単位で独立した Electron インスタンスを起動（DB隔離）
- 外部ネットワーク依存ゼロ

詳細なテスト計画は [tests/TEST_PLAN.md](tests/TEST_PLAN.md) を参照。

## 技術スタック

- **Electron** + electron-vite
- **React** + TypeScript + React Router
- **Tailwind CSS** (ダークモード)
- **better-sqlite3** (ローカルDB)
- **Mock Vector Search** (カテゴリ/ブランドベースのクラスタリング)
- **Playwright** (E2E テスト)

## 機能

- 3ペインワークスペース（画像 / 候補比較 / 下書きフォーム）
- 商品画像5枚アップロード（D&D対応）
- 画像ベクトル類似検索 + スケルトンローディング
- 候補からの自動入力（全適用/部分適用 + 信頼度バッジ）
- 商品情報の手修正・保存（⌘S 対応）
- 買取履歴の閲覧・フィルタ・詳細パネル
- コマンドパレット（⌘K）
- キーボードショートカット（⌘N/⌘H/数字キー候補選択）
- サンプルデータ30件（初回起動時に自動seed）
