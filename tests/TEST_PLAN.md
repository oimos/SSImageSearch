# E2E テスト計画 — SS Image Search

## 1. テスト戦略

### アプローチ
- **Playwright Electron** (`_electron.launch`) でアプリを起動し、実際のUIを操作
- **worker-scoped fixture** でテストファイル単位にElectronインスタンスを共有（速度とDBの独立性を両立）
- 各テストファイル実行時に `E2E_USER_DATA` 環境変数で一時ディレクトリを指定し、DBを隔離
- 画面要素は **`data-testid`** で参照（安定性最優先）
- 待機は **UI状態ベース**（`waitForSelector`, `toBeVisible`, `toBeHidden`）。固定 `sleep` は使わない
- 失敗時に **スクリーンショット** + **トレース** を自動保存
- 外部ネットワーク依存ゼロ（全てローカル SQLite + モック埋め込み）

### テストデータ
- アプリ起動時に seed.ts が30件のサンプル商品 + SVG画像 + ベクトルを自動生成
- テスト画像は fixture で小さいPNGを生成（カテゴリクラスタにヒットする）
- 外部APIスタブは不要（全てIPC経由でメインプロセス内完結）

### CI実行
- `electron-vite build` → `playwright test` のパイプライン
- `xvfb-run` で headless Linux 環境対応
- GitHub Actions ワークフロー付属

---

## 2. テストケース一覧

### A. 主要パス（Primary Flow）— 12本

| # | ID | 画面 | 操作 | 期待結果 |
|---|---|---|---|---|
| 1 | `home-loads` | Home | アプリ起動 | タイトル・新規買取ボタン・履歴ボタン・直近商品リストが表示される |
| 2 | `home-to-workspace` | Home | 「新規買取」クリック | Workspace画面に遷移し、3ペインが表示される |
| 3 | `home-to-history` | Home | 「買取履歴」クリック | History画面に遷移し、テーブルが表示される |
| 4 | `workspace-idle` | Workspace | 初期表示 | 左ペイン=ドロップゾーン、中央=「画像をドロップして開始」、右=空フォーム |
| 5 | `workspace-upload` | Workspace | テスト画像をファイル入力 | 左ペインにプレビュー表示、中央に検索スケルトン→候補カード表示 |
| 6 | `workspace-select-candidate` | Workspace | 候補カードをクリック | 右ペインに候補データが自動入力、「適用済」バッジ表示 |
| 7 | `workspace-edit-form` | Workspace | フォームのブランド欄を手動変更 | 値が反映され、保存ボタンが有効 |
| 8 | `workspace-save` | Workspace | 「保存」ボタンクリック | 保存中→「保存しました」→自動リセットしてidle状態に戻る |
| 9 | `workspace-full-flow` | Workspace | 画像アップ→候補選択→編集→保存 | 全ステップが途切れず完了する |
| 10 | `history-loads` | History | 画面表示 | テーブルに商品一覧、件数表示、ページネーション |
| 11 | `history-detail` | History | テーブル行クリック | 右側に詳細パネル表示（画像・全フィールド） |
| 12 | `history-close-detail` | History | 詳細パネルの×ボタン | パネルが閉じる |

### B. キーボード・ナビゲーション — 8本

| # | ID | 画面 | 操作 | 期待結果 |
|---|---|---|---|---|
| 13 | `shortcut-cmd-n` | 任意 | ⌘N | Workspace画面に遷移 |
| 14 | `shortcut-cmd-h` | 任意 | ⌘H | History画面に遷移 |
| 15 | `shortcut-cmd-k` | 任意 | ⌘K | コマンドパレット表示 |
| 16 | `palette-navigate` | コマンドパレット | ↓↓Enter | 選択コマンド実行 |
| 17 | `palette-close-esc` | コマンドパレット | Escape | パレット閉じる |
| 18 | `workspace-num-select` | Workspace(結果あり) | 数字キー「1」 | 1番目の候補が選択される |
| 19 | `workspace-num-in-input` | Workspace(結果あり) | 価格欄にフォーカスして「1」入力 | 候補選択されず、値が入力される |
| 20 | `history-esc-detail` | History(詳細表示中) | Escape | 詳細パネルが閉じる |

### C. 状態異常・エッジケース — 12本

| # | ID | 画面 | 操作 | 期待結果 |
|---|---|---|---|---|
| 21 | `workspace-save-disabled` | Workspace | ブランド・カテゴリ未入力で保存 | 保存ボタンが disabled |
| 22 | `workspace-reset` | Workspace | フォーム入力後「リセット」 | フォーム・画像・候補すべてクリア |
| 23 | `workspace-weak-results` | Workspace | 低類似度の検索結果 | 黄色バナー「類似度が低めです」表示 |
| 24 | `workspace-multi-images` | Workspace | 3枚の画像をアップロード | 左ペインに3枚プレビュー、「3/5」表示 |
| 25 | `workspace-clear-images` | Workspace | 画像クリアボタン | ドロップゾーンに戻る、phase=idle |
| 26 | `history-filter-brand` | History | ブランド名入力+Enter | テーブルがフィルタリングされる |
| 27 | `history-filter-category` | History | カテゴリ選択 | テーブルがフィルタリングされる |
| 28 | `history-filter-clear` | History | 「クリア」ボタン | フィルタリセット、全件表示 |
| 29 | `history-filter-empty` | History | 存在しないブランドで検索 | 空状態メッセージ表示 |
| 30 | `history-pagination` | History | 次へ/前へ | ページが切り替わる |
| 31 | `loading-skeletons` | Workspace | 検索中 | 3枚のスケルトンカード表示 |
| 32 | `save-success-auto-reset` | Workspace | 保存完了後1.5秒待機 | 自動的にidle状態に戻る |

---

## 3. テスト優先度

1. **P0（ブロッカー）**: #1, #5, #6, #8, #9, #10, #11 — デモの成否に直結
2. **P1（重要）**: #2, #3, #4, #7, #13-#20 — UX品質
3. **P2（Nice-to-have）**: #21-#32 — 堅牢性

---

## 4. 非機能テスト方針

| 項目 | 検証方法 |
|---|---|
| 画面フリーズ | 各操作後にUI要素が200ms以内に応答（`timeout` 設定） |
| ローディング適切 | 検索中にスケルトン表示を確認 (#31) |
| エラー表示 | バナーが表示されユーザーに状況が伝わる (#23) |
| 保存ボタン制御 | 必須項目未入力時 disabled (#21) |
| キーボード操作 | 全ショートカットが動作 (#13-#20) |

---

## 5. ファイル構成

```
tests/
  TEST_PLAN.md              ← 本ファイル
  e2e/
    electron-test.ts        ← Playwright fixture（Electron起動・page取得）
    global-setup.ts         ← ビルド実行
    fixtures/
      test-image.png        ← テスト用画像（自動生成）
    home.spec.ts            ← #1-#3
    workspace-primary.spec.ts ← #4-#9
    workspace-edge.spec.ts  ← #21-#25, #31-#32
    history.spec.ts         ← #10-#12, #26-#30
    keyboard.spec.ts        ← #13-#20
playwright.config.ts
```
