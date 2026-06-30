# CLAUDE.md — Study English プロジェクト概要

## プロジェクト概要

**Study English** は Angular 22 製の PWA。Google Gemini AI で英作文を添削し、結果をブラウザの LocalStorage に保存して学習履歴・ミス傾向を追跡するアプリ。

UI 言語: 日本語。対象ユーザー: 英語学習者。

---

## エージェント向け基本ルール

- **会話言語**: Claude Code はすべての返答・説明・質問を**日本語**で行うこと。
- **学習目的の教授ルール**: ユーザーがスクリプト作成やコード変更を依頼した際、エージェントは単に実装するのではなく、Claude Code 上で同時に「なぜそのファイルをどう変更するとその挙動になるのか」を日本語で解説すること。目的は、ユーザー自身が今後 Angular のコードを自力で修正できるレベルまで精通すること。実装と解説を必ずセットで行う。

---

## 技術スタック

| 分類 | 技術 |
|---|---|
| フレームワーク | Angular 22（Standalone コンポーネント、NgModule 不使用） |
| 言語 | TypeScript（strict モード） |
| スタイル | SCSS（コンポーネントスコープ） |
| AI | Google Generative AI SDK (`@google/generative-ai`) |
| Markdown | marked v18 |
| 永続化 | ブラウザ LocalStorage（StorageService 経由） |
| PWA | @angular/service-worker + ngsw-config.json |
| テスト | Vitest |

---

## ディレクトリ構造

```
src/
├── main.ts                          # Angular ブートストラップ
├── index.html                       # PWA ルート HTML（lang="ja"）
└── app/
    ├── app.ts                       # ルートコンポーネント。テーマ初期化
    ├── app.html                     # ボトムナビ + router-outlet
    ├── app.scss                     # グローバルスタイル
    ├── app.routes.ts                # 遅延ロードルーティング設定
    ├── app.config.ts                # Angular DI / Service Worker 設定
    ├── models/
    │   └── session.model.ts         # Mistake / WritingEvaluation / CorrectionSession 型定義
    ├── services/
    │   ├── gemini.service.ts        # Gemini API 呼び出し・レスポンス解析（mistakes/evaluation）
    │   └── storage.service.ts       # LocalStorage 永続化・統計集計（streak/スコア・CEFR推移）
    ├── utils/
    │   └── prompt.util.ts           # buildPrompt() プロンプト動的生成（純粋関数）
    └── pages/
        ├── practice/                # 英文入力・添削結果表示
        ├── drill/                   # 弱点克服ドリル（頻出ミス出題・自動採点）
        ├── history/                 # 過去セッション一覧・検索・インポート/エクスポート
        ├── mistakes/                # 学習統計・ミス傾向・スコア/CEFR推移ダッシュボード
        └── settings/                # API キー・モデル・機能トグル・テーマ設定
```

---

## データフロー

```
[Practice ページ]
    ↓ buildPrompt(settings) + userText
[GeminiService.correct()]
    ↓ Gemini API
[レスポンス: Markdown + <mistakes>JSON</mistakes> + <evaluation>JSON</evaluation>]
    ↓ parseMistakes() / parseEvaluation() で分離
[StorageService.saveSession()] → LocalStorage
    ↓
[History ページ(検索)]  [Mistakes ページ(統計/スコア・CEFR推移)]  [Drill ページ(頻出ミス出題)]
```

---

## 主要型定義（session.model.ts）

```typescript
interface Mistake {
  category: string;    // ミスのカテゴリ（例: "文法", "語彙"）
  original: string;    // 元の誤った表現
  corrected: string;   // 正しい表現
  explanation: string; // 日本語解説
}

interface WritingEvaluation {
  grammarScore: number;      // 文法 0〜10（0.5刻み）
  vocabularyScore: number;   // 語彙 0〜10
  contentScore: number;      // 内容 0〜10
  overallScore: number;      // 総合平均 0〜10
  errorDensity: number;      // 100語あたりのエラー数
  grammarCefr: string;       // 文法の暫定CEFR (A1〜C2)
  vocabularyCefr: string;    // 語彙の暫定CEFR
  contentCefr: string;       // 内容の暫定CEFR
  overallCefr: string;       // 総合の暫定CEFR
}

interface CorrectionSession {
  id: string;          // 一意ID（日付非依存。同日複数添削でも衝突しない）
  date: string;        // ISO 8601（選択日付）
  original: string;    // ユーザーが入力した英文
  corrected: string;   // Gemini が返した添削済み Markdown
  mistakes: Mistake[];
  evaluation?: WritingEvaluation; // 任意。定量評価が有効なセッションのみ持つ
}
```

`AppSettings`（storage.service.ts）: `apiKey`, `model`, `includeNaturalExpressions`, `includeGrammarTendency`, `includeCefrEvaluation`, `includeLevelUpSuggestion`, `includeClozeReview`, `theme`

プロンプトは `utils/prompt.util.ts` の宣言的 `SECTIONS` 配列で管理（項目追加 = 配列にオブジェクト1つ）。`includeClozeReview` 有効時は `<review>` タグで穴埋め復習カード（`ReviewItem[]`）を出力させ、Drill ページの「穴埋め復習」モードで出題する。

---

## 開発コマンド

```bash
npm start        # 開発サーバー起動（localhost:4200）
npm run build    # 本番ビルド（dist/ へ出力、Service Worker 有効）
npm test         # Vitest 実行
```

---

## バージョン運用

バージョンは **Conventional Commits + semantic-release** で自動採番する。手動で `package.json` の
`version` を編集しない。main への push をトリガに GitHub Actions が最新タグ以降のコミット種別を解析し、
バージョンを上げてタグ・GitHub Release・`CHANGELOG.md` を生成する。

| コミット種別 | バージョン上昇 | 例 |
|---|---|---|
| `fix:` / `perf:` | PATCH | 1.0.0 → 1.0.1 |
| `feat:` | MINOR | 1.0.0 → 1.1.0 |
| `feat!:` / 本文に `BREAKING CHANGE:` | MAJOR | 1.0.0 → 2.0.0 |
| `docs:` `chore:` `refactor:` `style:` `test:` `ci:` | 上昇なし | — |

- `src/version.ts`（`APP_VERSION` / `RELEASE_DATE`）は **リリース時のみ** semantic-release が
  `scripts/generate-version.mjs` を実行して更新し、version 更新コミットに含める。
  普段の `npm start` / `npm run build` では再生成されない（= 日付差分が紛れ込まない）。
- 設定（`.releaserc.json`）とリリースフローは3プロジェクト共通。

---

## コーディング規約

- **リアクティブ**: `signal()` を使用（`BehaviorSubject` は使わない）。
- **コンポーネント**: Standalone（`imports: []` で直接インポート）。
- **永続化**: `StorageService` 経由のみ。コンポーネントから直接 `localStorage` を操作しない。
- **API 呼び出し**: `GeminiService` 経由のみ。
- **プロンプト構築**: `buildPrompt(settings)` で一元管理（utils/prompt.util.ts）。
- **スタイル**: SCSS ファイルはコンポーネントと同名で同ディレクトリに配置。

---

## コメント管理ルール（エージェント向け）

> **ファイルを編集したら、そのファイルの `@file` コメントと影響するセクションコメントを必ず同時に更新すること。**
> 新機能を追加した場合は新しいセクションコメントを追加する。
> このルールはトークン消費削減のためにある — コメントが最新状態であればエージェントはファイルを全読みしなくてよい。

### コメント書式

**TypeScript:**
```typescript
/**
 * @file ファイルの役割を 1〜2 行で説明
 */

// ── セクション名 ─────────────────────────────────────────────────
```

**HTML:**
```html
<!-- @file ファイルの役割を 1〜2 行で説明 -->

<!-- ── セクション名 ─────────────────────────────────────────────── -->
```
