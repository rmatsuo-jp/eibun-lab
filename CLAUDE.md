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
| 永続化 | ブラウザ LocalStorage（core の各ストアサービス経由） |
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
    ├── core/                        # 基盤層。全 feature が共有（feature を import してはならない）
    │   ├── models/
    │   │   └── session.model.ts     # Mistake / WritingEvaluation / CorrectionSession 等の型定義
    │   ├── firebase/                # Firebase SDK 基盤層
    │   │   ├── firebase.init.ts     # initializeApp()（Auth/Firestoreインスタンス生成）
    │   │   └── auth.service.ts      # Google SSO 認証
    │   ├── sessions/                # セッション永続化（ローカル + クラウド同期）
    │   │   ├── session-repository.service.ts  # 永続化窓口（ローカル保存+Firestore pushを集約）
    │   │   ├── session-store.service.ts       # LocalStorage CRUD（tombstone=論理削除）
    │   │   └── firestore-sync.service.ts      # Firestore 双方向同期
    │   ├── settings/
    │   │   └── settings-store.service.ts      # APIキー・モデル優先順位・テーマ（AppSettings の正）
    │   ├── gemini/                  # Gemini API 連携（クライアント + 関連純粋関数）
    │   │   ├── gemini.service.ts    # API 呼び出し・フォールバック・レスポンス解析
    │   │   ├── gemini-models.constants.ts     # モデル一覧・デフォルト優先順位
    │   │   ├── prompt.util.ts       # buildPrompt() プロンプト動的生成
    │   │   ├── gemini-parse.util.ts # Geminiレスポンスのタグ抽出＋JSON検証
    │   │   └── evaluation.util.ts   # 総合スコア・CEFR算出
    │   ├── logging/
    │   │   └── gemini-log.token.ts  # GEMINI_LOGGER InjectionToken（依存逆転。デフォルトno-op）
    │   └── stats/
    │       └── session-stats.util.ts # セッション配列からの統計・集計計算（純粋関数）
    ├── shared/                      # ドメイン非依存の汎用 util
    │   └── utils/
    │       ├── markdown.util.ts     # Markdown → 安全なHTML変換
    │       ├── clipboard.util.ts    # クリップボードコピー
    │       ├── date.util.ts         # 日付フォーマット/日付キー変換
    │       ├── local-storage.util.ts # 型安全な localStorage 読み書き
    │       └── crypto.util.ts       # APIキー暗号化（Web Crypto AES-GCM、非抽出鍵を IndexedDB に保持）
    └── features/                    # 拡張機能（遅延ロード）。1フォルダ=1機能、専用service/utilは同居
        ├── practice/                # 英文入力・添削（practice-state.service, bulk-import.util 同居）
        ├── drill/                   # 弱点克服ドリル（drill-quiz.util, drill-progress.service, drill-progress-sync.service 同居）
        ├── history/                 # 過去セッション一覧・検索・インポート/エクスポート
        ├── mistakes/                # 学習統計・ミス傾向・スコア/CEFR推移ダッシュボード
        ├── settings/                # API キー・モデル・テーマ設定（settings.guard 同居）
        ├── legal/                   # プライバシーポリシー・利用規約
        └── dev/                     # 開発者用ページ（dev-log.service 同居。本番ビルド非搭載）
```

**依存方向は `features → core → shared` の一方向のみ**。feature 間の import は禁止。
層跨ぎの import はパスエイリアス（`@core/*` / `@shared/*` / `@features/*`、tsconfig.json）を使い、
同一フォルダ内は相対 import を使う。

---

## データフロー

```
[features/practice]
    ↓ buildPrompt() + userText
[GeminiService.correct()]（core/gemini）
    ↓ Gemini API
[レスポンス: Markdown + <corrected-text> <mistakes> <evaluation> <review> <levelup> <levelup-text> タグ]
    ↓ parseMistakes() / parseEvaluation() / parseReview() / parseLevelUp() で分離、GEMINI_LOGGER に記録（開発ビルドのみ実体あり）
[SessionRepositoryService.saveSession()]（core/sessions）→ LocalStorage + Firestore push
    ↓
[features/history(検索)]  [features/mistakes(統計/スコア・CEFR推移)]  [features/drill(頻出ミス出題)]
```

ドリルの習熟度・レベルアップ進捗は `DrillProgressService`（ローカル）に保存し、
`DrillProgressSyncService`（features/drill）が Firestore と双方向同期する。

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

interface ReviewItem {         // 穴埋め復習カード（Drill「穴埋め復習」モード）
  sentence: string;    // ___ で空所を作った英文
  answer: string;      // 空所に入る正解の語/句
  hint: string;        // 日本語ヒント
  translation: string; // 英文の日本語訳
  choices: string[];   // 4択（正解を1つ含む）
}

interface LevelUpItem {        // CEFR一段階上のレベルアップ例文（Drill「レベルアップ・タイピング」モード、1文単位）
  original: string;     // 元の1文
  leveledUp: string;    // CEFR一段階上で書き直した1文
  keyPhrases: string[]; // leveledUp 内に出現する穴埋め対象の完全一致部分文字列
  translation: string;  // leveledUp の日本語訳
}

interface DrillProgress {      // ドリル1問ごとの習熟度（DrillProgressService が保持）
  correctStreak: number;  // 連続正解数
  lastAttemptAt: string;  // 直近解答日時（ISO 8601）
}

interface LevelUpItemProgress { // レベルアップ・タイピング1文分の進捗
  maskLevel: number;   // 現在のマスク段階
  completed: boolean;  // 完了判定
}

interface CorrectionSession {
  id: string;          // 一意ID（日付非依存。同日複数添削でも衝突しない）
  date: string;        // ISO 8601（選択日付）
  original: string;    // ユーザーが入力した英文
  corrected: string;   // 添削解説プローズ（Markdown）
  correctedText?: string; // 任意。添削後の完成版全文（後方互換）
  mistakes: Mistake[];
  evaluation?: WritingEvaluation; // 任意。定量評価を含むセッションが持つ（旧データは欠落し得る）
  reviewItems?: ReviewItem[];     // 任意。穴埋め復習カード（後方互換）
  levelUpItems?: LevelUpItem[];   // 任意。レベルアップ例文（後方互換）
  levelUpText?: string;           // 任意。レベルアップ後の全文（後方互換）
  deleted?: boolean;   // 論理削除フラグ（tombstone。削除の多端末同期用）
}
```

⚠ `CorrectionSession` に optional フィールドを追加したら `firestore-sync.service.ts` の `OPTIONAL_FIELDS` にも必ず追加すること（Firestore は undefined を受け付けない）。

`AppSettings`（core/settings/settings-store.service.ts）: `apiKey`, `modelPriority`, `theme`, `consentAcceptedAt?`
localStorage 上では `apiKey` は平文で持たず、Web Crypto（AES-GCM、`shared/utils/crypto.util.ts`）で暗号化した
`apiKeyEnc` として保存する。旧形式（`model` 単一文字列・平文 apiKey）からの自動マイグレーションあり。

プロンプトは `core/gemini/prompt.util.ts` の宣言的 `SECTIONS` 配列で管理（項目追加 = 配列にオブジェクト1つ）。全添削項目は常時有効で、`buildPrompt()`（引数なし）が全セクションを順に連結する。`<review>` タグで穴埋め復習カード（`ReviewItem[]`）、`<levelup>` / `<levelup-text>` タグでレベルアップ例文・全文を出力させるほか、CEFR評価の根拠・学習法などの Markdown セクションも含む（セクションの正確な一覧は prompt.util.ts の @file コメントが正）。

---

## 開発コマンド

```bash
npm start        # 開発サーバー起動（localhost:4200）
npm run build    # 本番ビルド（dist/ へ出力、Service Worker 有効）
npm test         # Vitest 実行
npm run watch    # 開発構成でビルド監視
npm run deploy   # GitHub Pages へデプロイ
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
- **永続化**: セッションは `SessionRepositoryService`、設定は `SettingsStoreService`、ドリル進捗は `DrillProgressService` 経由のみ。コンポーネントから直接 `localStorage` を操作しない。
- **API 呼び出し**: `GeminiService` 経由のみ。
- **プロンプト構築**: `buildPrompt()` で一元管理（core/gemini/prompt.util.ts）。
- **レイヤ依存**: `features → core → shared` の一方向のみ。feature 間 import・core から features への import は禁止（例外: 開発ビルドの app.config.ts が GEMINI_LOGGER に DevLogService を provide する箇所のみ）。
- **スタイル**: SCSS ファイルはコンポーネントと同名で同ディレクトリに配置。

---

## コメント管理ルール（エージェント向け）

> **ファイルを編集したら、そのファイルの `@file` コメントと影響するセクションコメントを必ず同時に更新すること。**
> 新機能を追加した場合は新しいセクションコメントを追加する。
> このルールはトークン消費削減のためにある — コメントが最新状態であればエージェントはファイルを全読みしなくてよい。
> `.spec.ts`（テストファイル）と自動生成ファイル（`src/version.ts`）は @file ルールの対象外。

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
