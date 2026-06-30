# Study English — システム概要

## アプリケーション概要

**Study English** は Angular 製の PWA（Progressive Web App）。  
英作文（英語日記）を入力すると、Google Gemini AI が添削・フィードバックを返し、結果をブラウザの LocalStorage に蓄積する英語学習アプリ。

---

## 主な機能

| 機能 | 説明 |
|---|---|
| 英作文添削 | Gemini AI が文法・語法ミスを指摘し、修正理由を日本語で解説 |
| 自然な表現の提案 | ネイティブらしい言い回しを提案（ON/OFF 可） |
| CEFR 評価 | 文法・語彙・内容を CEFR 基準で評価（ON/OFF 可） |
| レベルアップ提案 | 一段階上の CEFR レベルでの英文サンプルを提示（ON/OFF 可） |
| 文法ミスの傾向分析 | 今回の文章から犯しやすいミスの傾向を解説（ON/OFF 可） |
| 履歴管理 | 過去の添削セッションを一覧表示・削除 |
| インポート / エクスポート | 履歴を JSON ファイルで持ち出し・取り込み |
| ミス傾向ダッシュボード | 全セッションのミスをカテゴリ別に集計・可視化 |
| ダークモード | ライト / ダークテーマ切り替え |
| PWA 対応 | オフラインキャッシュ、ホーム画面追加 |

---

## 技術スタック

| 分類 | 技術 |
|---|---|
| フレームワーク | Angular 22（Standalone コンポーネント） |
| 言語 | TypeScript（strict モード） |
| スタイル | SCSS（コンポーネントスコープ） |
| AI | Google Generative AI SDK (`@google/generative-ai`) |
| Markdown レンダリング | marked v18 |
| 永続化 | ブラウザ LocalStorage |
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
    │   └── session.model.ts         # Mistake / CorrectionSession 型定義
    ├── services/
    │   ├── gemini.service.ts        # Gemini API 呼び出し・レスポンス解析
    │   └── storage.service.ts       # LocalStorage 永続化・プロンプト構築
    └── pages/
        ├── practice/                # 英文入力・添削結果表示
        ├── history/                 # 過去セッション一覧・インポート/エクスポート
        ├── mistakes/                # ミス傾向分析ダッシュボード
        └── settings/                # API キー・モデル・テーマ設定
```

---

## データフロー

```
[Practice ページ]
    ↓ userText（ユーザー入力の英文）
[GeminiService.correct()]
    ↓ buildPrompt() + userText → Gemini API
[レスポンス: Markdown 本文 + <mistakes>JSON</mistakes>]
    ↓ parseMistakes() で Markdown と JSON を分離
[StorageService.saveSession()] → LocalStorage に保存
    ↓
[History ページ]  [Mistakes ページ]
```

---

## 主要データ型

```typescript
// ミス1件
interface Mistake {
  category: string;    // ミスのカテゴリ（例: "文法", "語彙"）
  original: string;    // 元の誤った表現
  corrected: string;   // 正しい表現
  explanation: string; // 日本語解説
}

// 添削セッション1件
interface CorrectionSession {
  id: string;          // Date.now().toString()
  date: string;        // ISO 8601
  original: string;    // ユーザーが入力した英文
  corrected: string;   // Gemini が返した添削済み Markdown
  mistakes: Mistake[];
}

// アプリ設定
interface AppSettings {
  apiKey: string;
  model: string;
  theme: 'light' | 'dark';
}
```

---

## LocalStorage キー

| キー | 内容 |
|---|---|
| `correction_sessions` | `CorrectionSession[]` の JSON 配列 |
| `app_settings` | `AppSettings` の JSON オブジェクト |

---

## 開発コマンド

```bash
npm start        # 開発サーバー起動（http://localhost:4200）
npm run build    # 本番ビルド（dist/ へ出力、Service Worker 有効）
npm test         # Vitest 実行
```
