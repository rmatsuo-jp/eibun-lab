# 英文ラボ（Eibun-Lab） — システム概要

## アプリケーション概要

**英文ラボ（Eibun-Lab）** は Angular 22 製の PWA（Progressive Web App）。
英作文（英語日記）を入力すると、Google Gemini AI が添削・フィードバックを返し、結果をブラウザの LocalStorage に蓄積する英語学習アプリ。Google アカウントでログインすると、添削履歴が Firebase（Cloud Firestore）経由で端末間に自動同期される。

---

## 主な機能

Gemini による添削・定量評価・レベルアップ提案・穴埋めクイズ生成を核に、練習（英文添削）・ドリル（反復練習）・
履歴（一覧管理）・ミス傾向（統計）・設定の5画面で構成される。Google ログイン時は Firestore とのクラウド同期、
PWA としてのオフラインキャッシュ・ホーム画面追加にも対応する。各画面の操作方法は [manual.md](manual.md) を参照。

---

## 技術スタック

| 分類                  | 技術                                                     |
| --------------------- | -------------------------------------------------------- |
| フレームワーク        | Angular 22（Standalone コンポーネント、NgModule 不使用） |
| 言語                  | TypeScript（strict モード）                              |
| スタイル              | SCSS（コンポーネントスコープ）                           |
| AI                    | Google Generative AI SDK (`@google/generative-ai`)       |
| 認証・クラウド同期    | Firebase Authentication（Google SSO）+ Cloud Firestore   |
| Markdown レンダリング | marked v18                                               |
| 永続化                | ブラウザ LocalStorage（ログイン時は Firestore とも同期） |
| PWA                   | @angular/service-worker + ngsw-config.json               |
| テスト                | Vitest                                                   |

---

## ディレクトリ構造

依存方向は `features → core → shared` の一方向のみ（詳細は [ARCHITECTURE.md](../ARCHITECTURE.md) を参照）。

```
src/
├── main.ts                          # Angular ブートストラップ
├── index.html                       # PWA ルート HTML（lang="ja"）
└── app/
    ├── app.ts                       # ルートコンポーネント。テーマ初期化
    ├── app.html                     # ボトムナビ + router-outlet
    ├── app.scss                     # グローバルスタイル
    ├── app.routes.ts                # 遅延ロードルーティング設定（/dev は本番ビルド除外）
    ├── app.config.ts                # Angular DI / Service Worker 設定
    ├── core/                        # 全 feature が共有する基盤（providedIn: root）
    │   ├── models/
    │   │   └── session.model.ts     # Mistake / ReviewItem / LevelUpItem / WritingEvaluation / CorrectionSession 型定義
    │   ├── firebase/                # Firebase SDK 基盤層
    │   │   ├── firebase.init.ts     # initializeApp()（Auth/Firestoreインスタンス生成）
    │   │   ├── auth.constants.ts
    │   │   └── auth.service.ts      # Google SSO 認証
    │   ├── sessions/                # 永続化窓口
    │   │   ├── session-repository.service.ts # saveSession/deleteSession/import/export（唯一の窓口）
    │   │   ├── session-store.service.ts       # LocalStorage CRUD（論理削除=deletedフラグ）
    │   │   └── firestore-sync.service.ts      # Firestore 双方向同期
    │   ├── settings/
    │   │   ├── settings-store.service.ts      # APIキー・モデル優先順位・テーマ
    │   │   └── api-key.util.ts
    │   ├── gemini/                  # Gemini API 連携
    │   │   ├── gemini.service.ts        # API呼び出し・モデルフォールバック
    │   │   ├── prompt.util.ts           # buildPrompt() プロンプト動的生成（全10セクション常時有効）
    │   │   ├── gemini-parse.util.ts     # レスポンスのタグ抽出＋JSON検証
    │   │   ├── evaluation.util.ts       # 総合スコア・CEFR算出
    │   │   ├── gemini-error.util.ts / gemini-blocked.error.ts
    │   │   ├── gemini-models.constants.ts
    │   │   └── stream-progress.util.ts
    │   ├── quiz/
    │   │   └── quiz.util.ts         # 出題整形・正誤判定（drill/practiceの待機中クイズが共用）
    │   ├── stats/
    │   │   └── session-stats.util.ts # セッション配列からの統計・集計計算（純粋関数）
    │   ├── i18n/                    # 多言語表示（UI表示切り替えのみ。プロンプト/モデルには非関与）
    │   │   ├── i18n.service.ts      # I18nService（lang signal, t()）
    │   │   ├── lang.model.ts
    │   │   ├── translations.ts
    │   │   ├── localized-session.util.ts  # ja/en出し分け（en欠損時はjaへフォールバック）
    │   │   └── prose-fields.util.ts       # 添削本文系フィールドのja/enキー対応表
    │   └── logging/
    │       └── gemini-log.token.ts  # GEMINI_LOGGER トークン
    ├── shared/
    │   └── utils/                   # ドメイン非依存の汎用ユーティリティ
    │       ├── markdown.util.ts     # Markdown → 安全なHTML変換
    │       ├── clipboard.util.ts    # クリップボードコピー
    │       └── date.util.ts         # 日付フォーマット/日付キー変換
    └── features/                    # 遅延ロード。1フォルダ = 1拡張機能
        ├── practice/                # 英文入力・添削結果表示
        │   ├── practice-state.service.ts
        │   ├── bulk-import.util.ts  # 一括添削インポート/エクスポート
        │   └── waiting-quiz/        # 添削待機中の暇つぶしクイズ
        ├── drill/                   # 弱点克服ドリル（頻出ミス出題・穴埋め復習・レベルアップタイピング）
        │   ├── drill-state.service.ts        # 状態・ロジックの集約（drill.tsはDOM制御のみ）
        │   ├── drill-progress.service.ts     # 習熟度・レベルアップ進捗（LocalStorage）
        │   ├── drill-progress-sync.service.ts # ドリル進捗のクラウド同期
        │   └── sentence-list/                # レベルアップの文一覧選択サブコンポーネント
        ├── history/                 # 過去セッション一覧・カレンダー・検索・インポート/エクスポート
        │   ├── history-state.service.ts       # 状態・インポート/エクスポートの集約（history.tsはDOM制御のみ）
        │   └── history-calendar/    # カレンダー表示サブコンポーネント
        ├── mistakes/                # 学習統計・ミス傾向・スコア/CEFR推移ダッシュボード
        │   └── mistakes-state.service.ts     # 集計状態の集約（mistakes.tsはテンプレート橋渡しのみ）
        ├── settings/                # アカウント・APIキー・モデル優先順位・テーマ設定
        │   └── settings.guard.ts    # canDeactivateで未保存変更を検知
        ├── legal/                   # 利用規約・プライバシーポリシー等の表示
        └── dev/                     # 開発者用ページ（本番ビルドではルートテーブルから除外）
            └── dev-log.service.ts   # 開発用の送受信ログ記録
```

`practice` / `drill` / `history` / `mistakes` は状態・ロジックを feature 内の
`{feature}-state.service.ts` に集約し、コンポーネントはテンプレート橋渡し・DOM制御に専念する
パターンを採る（新規 feature 追加時もこれに倣う）。`core` サービスへの参照は
`{feature}-state.service.ts` 内に閉じ、component が直接 inject することはない。
`features → core → shared` の一方向依存とこのパターンからの逸脱（feature間import等）は
`eslint-plugin-boundaries`（`eslint.config.js`）により `npm run lint` で機械的に検知される。
全コンポーネントは `ChangeDetectionStrategy.OnPush` を採用する。

---

## ルーティング

| パス        | 内容                                               |
| ----------- | -------------------------------------------------- |
| `/`         | `/practice` へリダイレクト                         |
| `/practice` | 英文入力・添削結果表示                             |
| `/drill`    | 弱点克服ドリル                                     |
| `/history`  | 履歴一覧・検索・インポート/エクスポート            |
| `/mistakes` | 学習統計ダッシュボード                             |
| `/settings` | 設定（`canDeactivate` ガードで未保存変更を検知）   |
| `/dev`      | 開発者用ページ（本番ビルドではルート自体が非搭載） |

---

## データフロー

```
[Practice ページ]
    ↓ buildPrompt() + userText
[GeminiService.correct()]
    ↓ Gemini API（modelPriority順にフォールバック）
[レスポンス: Markdown + <mistakes>/<evaluation>/<levelup>/<review> JSON]
    ↓ 各タグを抽出しJSON検証（gemini-parse.util）
    ↓ DevLogService に記録（本番ビルドではスキップ）
[SessionRepositoryService.saveSession()] → LocalStorage に保存
    ↓ ログイン中なら Firestore へも fire-and-forget で push
[History ページ(検索)]  [Mistakes ページ(統計/スコア・CEFR推移)]  [Drill ページ(頻出ミス出題)]
```

ログインすると、`AuthService` の `user` signal 変化を `FirestoreSyncService` が監視し、クラウド側の全セッションとローカルをID単位でマージ（`deleted` フラグはOR結合のtombstone方式）してから差分を書き戻す。詳しい図解は[ARCHITECTURE.md](../ARCHITECTURE.md)を参照。

---

## 主要データ型（session.model.ts）

```typescript
interface Mistake {
  category: string; // 文法/語彙/スペリング/コロケーション/語法/構文/語順
  original: string; // 元の誤った表現
  corrected: string; // 正しい表現
  explanation: string; // 日本語解説
}

interface ReviewItem {
  sentence: string; // ___ で空所を作った英文
  answer: string; // 空所の正解
  hint: string; // 日本語ヒント
  translation: string; // 英文の日本語訳
  choices: string[]; // 4択（正解含む）
}

interface LevelUpItem {
  original: string; // 元の1文
  leveledUp: string; // CEFR一段階上の書き直し
  keyPhrases: string[]; // leveledUp内の穴埋め対象フレーズ
  translation: string; // leveledUpの日本語訳
}

interface WritingEvaluation {
  grammarScore: number; // 文法 0〜10（0.5刻み）
  vocabularyScore: number; // 語彙 0〜10
  contentScore: number; // 内容 0〜10
  overallScore: number; // 総合平均（システム側で算出）
  errorDensity: number; // 100語あたりのエラー数
  grammarCefr: string; // 文法の暫定CEFR (A1〜C2)
  vocabularyCefr: string; // 語彙の暫定CEFR
  contentCefr: string; // 内容の暫定CEFR
  overallCefr: string; // 総合の暫定CEFR
}

interface CorrectionSession {
  id: string; // 一意ID（日付非依存。同日複数添削でも衝突しない）
  date: string; // ISO 8601（選択日付）
  original: string; // ユーザーが入力した英文
  corrected: string; // Gemini が返した添削済み Markdown
  mistakes: Mistake[];
  evaluation?: WritingEvaluation; // 任意（旧データは欠落し得る）
  reviewItems?: ReviewItem[]; // 任意
  levelUpItems?: LevelUpItem[]; // 任意
  deleted?: boolean; // 論理削除フラグ（tombstone）
}
```

`AppSettings`（settings-store.service.ts）: `apiKey`, `modelPriority`（フォールバック順のモデル名配列）, `theme`

`Mistake`/`ReviewItem`/`LevelUpItem`/`CorrectionSession` の各文字列フィールドには、対応する
`*En`（例: `explanationEn`, `correctedEn`）という任意の英語版フィールドが存在する。表示言語の切り替えは
`core/i18n/localized-session.util.ts` が担い、en側が未設定の場合はja側へフォールバックする
（詳細は [ARCHITECTURE.md](../ARCHITECTURE.md) の i18n セクションを参照）。

プロンプトは `core/gemini/prompt.util.ts` の宣言的 `SECTIONS` 配列で管理（項目追加 = 配列にオブジェクト1つ）。全10セクション（文法指摘・自然表現・添削全文・ミス一覧・ミス傾向・定量評価・CEFR根拠・学習法・レベルアップ・穴埋めクイズ）は常時有効で、`buildPrompt()`（引数なし）が全セクションを順に連結する。ユーザー入力は `###USER_DIARY_START###` / `###USER_DIARY_END###` で囲み、プロンプトインジェクションを軽減している。

---

## LocalStorage キー

| キー                         | 内容                                                                  |
| ---------------------------- | --------------------------------------------------------------------- |
| `correction_sessions`        | `CorrectionSession[]` の JSON 配列（論理削除済みも含む）              |
| `app_settings`               | `AppSettings` の JSON オブジェクト                                    |
| `eibun-lab-drill-progress`   | ドリルの正規化キーごとの正解ストリーク（`DrillProgress`）             |
| `eibun-lab-levelup-progress` | レベルアップドリルのセッション単位マスク進捗（`LevelUpItemProgress`） |
| `dev_logs`                   | Gemini 送受信ログ（最大20件、本番ビルドでは記録されない）             |

ログイン中は、上記のうち `correction_sessions` に相当するデータが `apps/eibun_lab/users/{uid}/sessions` パスの Cloud Firestore とも双方向同期される。

---

## 開発コマンド

```bash
npm start          # 開発サーバー起動（localhost:4200）
npm run build      # 本番ビルド（dist/ へ出力、Service Worker 有効）
npm test           # Vitest 実行
npm run lint       # ESLint
npm run lint:text  # 表記ゆれチェック（docs/README.md/prompt.util.ts。:fixで自動修正）
```
