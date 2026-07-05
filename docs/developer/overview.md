# Study English — システム概要

## アプリケーション概要

**Study English** は Angular 22 製の PWA（Progressive Web App）。
英作文（英語日記）を入力すると、Google Gemini AI が添削・フィードバックを返し、結果をブラウザの LocalStorage に蓄積する英語学習アプリ。Google アカウントでログインすると、添削履歴が Firebase（Cloud Firestore）経由で端末間に自動同期される。

---

## 主な機能

| 機能 | 説明 |
|---|---|
| 英作文添削 | Gemini AI が文法・語法ミスを指摘し、修正理由を日本語で解説 |
| 自然な表現の提案 | ネイティブらしい言い回しを提案（常時有効） |
| 定量評価（スコア＋CEFR） | 文法・語彙・内容を10点満点で採点＋エラー密度・暫定CEFR評価（常時有効） |
| レベルアップ提案 | 一段階上の CEFR レベルでの英文サンプルを提示（常時有効） |
| 文法ミスの傾向分析 | 今回の文章から犯しやすいミスの傾向を解説（常時有効） |
| 穴埋め復習カード生成 | 添削のたびに穴埋め＋4択の復習カードを自動生成（常時有効） |
| ドリル（弱点克服） | 頻出ミス出題・穴埋め復習・レベルアップ例文タイピングの3モードで反復練習 |
| 履歴管理 | 過去の添削セッションを一覧表示・カレンダー表示・検索・削除 |
| インポート / エクスポート | 履歴を JSON ファイルで持ち出し・取り込み |
| 学習統計ダッシュボード | スコア推移・CEFR推移・ミス傾向を集計・可視化 |
| Google ログイン / クラウド同期 | Google SSO ログイン時に添削履歴を Firestore と双方向同期（端末間共有） |
| ダークモード | ライト / ダークテーマ切り替え |
| PWA 対応 | オフラインキャッシュ、ホーム画面追加 |

---

## 技術スタック

| 分類 | 技術 |
|---|---|
| フレームワーク | Angular 22（Standalone コンポーネント、NgModule 不使用） |
| 言語 | TypeScript（strict モード） |
| スタイル | SCSS（コンポーネントスコープ） |
| AI | Google Generative AI SDK (`@google/generative-ai`) |
| 認証・クラウド同期 | Firebase Authentication（Google SSO）+ Cloud Firestore |
| Markdown レンダリング | marked v18 |
| 永続化 | ブラウザ LocalStorage（ログイン時は Firestore とも同期） |
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
    ├── app.routes.ts                # 遅延ロードルーティング設定（/dev は本番ビルド除外）
    ├── app.config.ts                # Angular DI / Service Worker 設定
    ├── models/
    │   └── session.model.ts         # Mistake / ReviewItem / LevelUpItem / WritingEvaluation / CorrectionSession 型定義
    ├── services/
    │   ├── firebase/                # Firebase SDK 基盤層
    │   │   ├── firebase.init.ts     # initializeApp()（Auth/Firestoreインスタンス生成）
    │   │   └── auth.service.ts      # Google SSO 認証
    │   ├── storage/                 # LocalStorage 永続化（storage.service.ts が束ねるファサード＋各ストア）
    │   │   ├── storage.service.ts   # 永続化窓口（他ストアへ委譲）
    │   │   ├── session-store.service.ts    # セッションCRUD（論理削除=deletedフラグ）
    │   │   ├── settings-store.service.ts   # APIキー・モデル優先順位・テーマ
    │   │   ├── drill-progress.service.ts   # ドリル習熟度・レベルアップ進捗
    │   │   └── firestore-sync.service.ts   # Firestore 双方向同期
    │   └── gemini/                  # Gemini API 連携
    │       ├── gemini.service.ts    # Gemini API 呼び出し・レスポンス解析（mistakes/evaluation/reviewItems/levelUpItems）
    │       └── dev-log.service.ts   # 開発用の送受信ログ記録（本番ビルドでは記録スキップ）
    ├── utils/                       # 純粋関数群（Angular DI 非依存）
    │   ├── prompt.util.ts           # buildPrompt() プロンプト動的生成（全10セクション常時有効）
    │   ├── session-stats.util.ts    # セッション配列からの統計・集計計算
    │   ├── gemini-parse.util.ts     # Geminiレスポンスのタグ抽出＋JSON検証
    │   ├── evaluation.util.ts       # 総合スコア・CEFR算出
    │   ├── markdown.util.ts         # Markdown → 安全なHTML変換
    │   ├── bulk-import.util.ts      # 一括添削インポート/エクスポート
    │   ├── clipboard.util.ts        # クリップボードコピー
    │   └── date.util.ts             # 日付フォーマット/日付キー変換
    └── pages/
        ├── practice/                # 英文入力・添削結果表示
        ├── drill/                   # 弱点克服ドリル（頻出ミス出題・穴埋め復習・レベルアップタイピング）
        ├── history/                 # 過去セッション一覧・カレンダー・検索・インポート/エクスポート
        ├── mistakes/                # 学習統計・ミス傾向・スコア/CEFR推移ダッシュボード
        ├── settings/                # アカウント・APIキー・モデル優先順位・テーマ設定
        └── dev/                     # 開発者用ページ（本番ビルドではルートテーブルから除外）
```

---

## ルーティング

| パス | 内容 |
|---|---|
| `/` | `/practice` へリダイレクト |
| `/practice` | 英文入力・添削結果表示 |
| `/drill` | 弱点克服ドリル |
| `/history` | 履歴一覧・検索・インポート/エクスポート |
| `/mistakes` | 学習統計ダッシュボード |
| `/settings` | 設定（`canDeactivate` ガードで未保存変更を検知） |
| `/dev` | 開発者用ページ（本番ビルドではルート自体が非搭載） |

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
[StorageService.saveSession()] → LocalStorage に保存
    ↓ ログイン中なら Firestore へも fire-and-forget で push
[History ページ(検索)]  [Mistakes ページ(統計/スコア・CEFR推移)]  [Drill ページ(頻出ミス出題)]
```

ログインすると、`AuthService` の `user` signal 変化を `FirestoreSyncService` が監視し、クラウド側の全セッションとローカルをID単位でマージ（`deleted` フラグはOR結合のtombstone方式）してから差分を書き戻す。詳しい図解は[ARCHITECTURE.md](../ARCHITECTURE.md)を参照。

---

## 主要データ型（session.model.ts）

```typescript
interface Mistake {
  category: string;    // 文法/語彙/スペリング/コロケーション/語法/構文/語順
  original: string;    // 元の誤った表現
  corrected: string;   // 正しい表現
  explanation: string; // 日本語解説
}

interface ReviewItem {
  sentence: string;    // ___ で空所を作った英文
  answer: string;      // 空所の正解
  hint: string;        // 日本語ヒント
  translation: string; // 英文の日本語訳
  choices: string[];   // 4択（正解含む）
}

interface LevelUpItem {
  original: string;      // 元の1文
  leveledUp: string;     // CEFR一段階上の書き直し
  keyPhrases: string[];  // leveledUp内の穴埋め対象フレーズ
  translation: string;   // leveledUpの日本語訳
}

interface WritingEvaluation {
  grammarScore: number;      // 文法 0〜10（0.5刻み）
  vocabularyScore: number;   // 語彙 0〜10
  contentScore: number;      // 内容 0〜10
  overallScore: number;      // 総合平均（システム側で算出）
  errorDensity: number;      // 100語あたりのエラー数
  grammarCefr: string;       // 文法の暫定CEFR (A1〜C2)
  vocabularyCefr: string;    // 語彙の暫定CEFR
  contentCefr: string;       // 内容の暫定CEFR
  overallCefr: string;       // 総合の暫定CEFR
}

interface CorrectionSession {
  id: string;                      // 一意ID（日付非依存。同日複数添削でも衝突しない）
  date: string;                    // ISO 8601（選択日付）
  original: string;                // ユーザーが入力した英文
  corrected: string;               // Gemini が返した添削済み Markdown
  mistakes: Mistake[];
  evaluation?: WritingEvaluation;  // 任意（旧データは欠落し得る）
  reviewItems?: ReviewItem[];      // 任意
  levelUpItems?: LevelUpItem[];    // 任意
  deleted?: boolean;               // 論理削除フラグ（tombstone）
}
```

`AppSettings`（storage.service.ts）: `apiKey`, `modelPriority`（フォールバック順のモデル名配列）, `theme`

プロンプトは `utils/prompt.util.ts` の宣言的 `SECTIONS` 配列で管理（項目追加 = 配列にオブジェクト1つ）。全10セクション（文法指摘・自然表現・添削全文・ミス一覧・ミス傾向・定量評価・CEFR根拠・学習法・レベルアップ・穴埋め復習）は常時有効で、`buildPrompt()`（引数なし）が全セクションを順に連結する。ユーザー入力は `###USER_DIARY_START###` / `###USER_DIARY_END###` で囲み、プロンプトインジェクションを軽減している。

---

## LocalStorage キー

| キー | 内容 |
|---|---|
| `correction_sessions` | `CorrectionSession[]` の JSON 配列（論理削除済みも含む） |
| `app_settings` | `AppSettings` の JSON オブジェクト |
| `study-english-drill-progress` | ドリルの正規化キーごとの正解ストリーク（`DrillProgress`） |
| `study-english-levelup-progress` | レベルアップドリルのセッション単位マスク進捗（`LevelUpItemProgress`） |
| `dev_logs` | Gemini 送受信ログ（最大20件、本番ビルドでは記録されない） |

ログイン中は、上記のうち `correction_sessions` に相当するデータが `apps/study_english/users/{uid}/sessions` パスの Cloud Firestore とも双方向同期される。

---

## 開発コマンド

```bash
npm start        # 開発サーバー起動（localhost:4200）
npm run build    # 本番ビルド（dist/ へ出力、Service Worker 有効）
npm test         # Vitest 実行
```
