# Study English

Gemini AI を使った英語添削 PWA アプリです。Angular で構築されており、英文を入力すると AI が文法・語彙・表現のミスを指摘・修正します。

## 機能

- **練習 (Practice)** — 英文を入力し、Gemini AI によるリアルタイム添削を受ける
- **履歴 (History)** — 過去の添削セッションを一覧で確認する
- **ミス一覧 (Mistakes)** — 蓄積されたミスをカテゴリ別に振り返る
- **設定 (Settings)** — Gemini API キー・モデル・添削プロンプトを設定する

## 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | Angular 22 |
| AI | Google Gemini API (`@google/generative-ai`) |
| ストレージ | LocalStorage（`StorageService`） |
| スタイル | SCSS |
| テスト | Vitest |

## セットアップ

### 必要なもの

- Node.js
- Gemini API キー（[Google AI Studio](https://aistudio.google.com/) で取得）

### インストール

```bash
npm install
```

### 開発サーバーの起動

```bash
npm start
```

ブラウザで `http://localhost:4200/` を開きます。

### 初回設定

アプリ起動後、**Settings** ページで以下を設定してください。

1. Gemini API キー
2. 使用するモデル（例: `gemini-1.5-flash`）
3. 添削プロンプト（`{USER_TEXT}` が入力テキストに置換されます）

## ビルド

```bash
ng build
```

ビルド成果物は `dist/` に出力されます。

## テスト

```bash
ng test
```

## セキュリティ

このリポジトリは public 公開されています。運用上の注意点：

- **Firebase の構成値（`apiKey` 等）は秘密情報ではなく**、クライアントに必ず露出するプロジェクト識別子です。コードに含めて公開して問題ありません。実際のアクセス保護は **Firestore セキュリティルール**（`firestore.rules`）で行います。
- **Firestore ルールは本人 UID 限定**（`apps/study_english/users/{uid}/sessions`）です。これが無いと全ユーザーのデータが誰でも読み書き可能になります。ルール変更時は必ず反映してください：

  ```bash
  firebase deploy --only firestore:rules
  ```

- **Firebase apiキーには制限をかける**ことを推奨します（公開済みのため悪用防止）：
  - Google Cloud Console → 認証情報 → 該当キーに **HTTP リファラ制限**（本番ドメインのみ）を設定。
  - Firebase Console → Authentication → Settings → **承認済みドメイン** を本番ドメインに限定。
- **Gemini API キーはユーザー自身が設定画面で入力**し、本人ブラウザの LocalStorage にのみ保存されます。サーバーには送信されず、リポジトリにも含まれません。
- AI の応答（Markdown）は表示前に **DOMPurify でサニタイズ**され、スクリプト注入を防いでいます（`utils/markdown.util.ts`）。

## プロジェクト構成

```
src/app/
├── models/
│   └── session.model.ts      # CorrectionSession / Mistake の型定義
├── services/
│   ├── gemini.service.ts     # Gemini API 呼び出し・ミス解析
│   └── storage.service.ts    # LocalStorage の読み書き
└── pages/
    ├── practice/             # 添削入力ページ
    ├── history/              # 履歴ページ
    ├── mistakes/             # ミス一覧ページ
    └── settings/             # 設定ページ
```

## ライセンス・免責

本アプリは **MIT License** のもとで無償提供されます。利用にあたっては、以下の規約類をご確認ください。

- [免責事項（DISCLAIMER）](docs/legal/DISCLAIMER.md)
- [利用規約（TERMS）](docs/legal/TERMS.md)
- [プライバシーポリシー（PRIVACY）](docs/legal/PRIVACY.md)
- [ライセンス（LICENSE）](docs/legal/LICENSE.md)

本アプリは現状有姿で提供され、利用に起因する損害について、法令上許容される範囲で開発者は責任を負いません。ログイン時は添削セッションが Firebase（Google）に同期される点を含め、詳細は[プライバシーポリシー](docs/legal/PRIVACY.md)をご確認ください。
