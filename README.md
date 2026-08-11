# 英文ラボ（Eibun-Lab）

Gemini AI を使った英語添削 PWA アプリです。Angular で構築されており、英文を入力すると AI が文法・語彙・表現のミスを指摘・修正します。

Gemini による添削・定量評価・レベルアップ提案・穴埋めクイズ生成を核に、練習（英文添削）・ドリル（反復練習）・
履歴（一覧管理）・ミス傾向（統計）・実績（バッジ・達成条件）・設定の6画面で構成されます。Google アカウントでログインすると
添削履歴が Cloud Firestore 経由で端末間に同期され、PWA としてのオフラインキャッシュ・ホーム画面追加にも対応します。
各画面の操作方法は [docs/manual.md](docs/manual.md)、内部構造は [ARCHITECTURE.md](ARCHITECTURE.md) を参照してください。

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

## セットアップ

### 必要なもの

- Node.js 24.x（CI と同じバージョン）／npm 11.x（`packageManager` フィールドで指定、Node 24 に同梱）
- Gemini API キー（[Google AI Studio](https://aistudio.google.com/) で取得）

Node.js のバージョン管理には [nvm](https://github.com/nvm-sh/nvm) や [Volta](https://volta.sh/) の利用を推奨します。

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
2. 使用するモデルの優先順位（ドラッグ&ドロップで並び替え可能）

添削プロンプトは `core/gemini/prompt.util.ts` で一元管理されており、ユーザーが編集することはできません
（設定ページの「プロンプトプレビュー」で実際に送信される内容を確認できます）。

API キーの取得・登録の詳細な操作は [docs/manual.md](docs/manual.md) を参照してください。

## ビルド

```bash
npm run build
```

ビルド成果物は `dist/` に出力されます。

## テスト

```bash
npm test
```

## Lint

```bash
npm run lint       # ESLint
npm run lint:text  # 表記ゆれチェック（docs, README.md, prompt.util.ts）
```

## セキュリティ

このリポジトリは public 公開されています。運用上の注意点：

- **Firebase の構成値（`apiKey` 等）は秘密情報ではなく**、クライアントに必ず露出するプロジェクト識別子です。コードに含めて公開して問題ありません。実際のアクセス保護は **Firestore セキュリティルール**（`firestore.rules`）で行います。
- **Firestore ルールは本人 UID 限定**（`apps/eibun_lab/users/{uid}/sessions`）です。これが無いと全ユーザーのデータが誰でも読み書き可能になります。ルール変更時は必ず反映してください：

  ```bash
  firebase deploy --only firestore:rules
  ```

- **Firebase apiキーには制限をかける**ことを推奨します（公開済みのため悪用防止）：
  - Google Cloud Console → 認証情報 → 該当キーに **HTTP リファラ制限**（本番ドメインのみ）を設定。
  - Firebase Console → Authentication → Settings → **承認済みドメイン** を本番ドメインに限定。
- **Gemini API キーはユーザー自身が設定画面で入力**し、本人ブラウザの LocalStorage にのみ保存されます。サーバーには送信されず、リポジトリにも含まれません。
- AI の応答（Markdown）は表示前に **DOMPurify でサニタイズ**され、スクリプト注入を防いでいます（`utils/markdown.util.ts`）。

## プロジェクト構成

依存方向は `features → core → shared` の一方向。詳細は [ARCHITECTURE.md](ARCHITECTURE.md) を参照してください。

```
src/app/
├── core/         # モデル定義・Gemini/Firebase連携・永続化サービスなど
├── shared/       # 共通UIコンポーネント・ユーティリティ
└── features/     # practice / history / mistakes / drill / achievements / settings / legal / dev
```

## よくあるつまずきポイント

- **`npm install` でエンジンエラーが出る**: Node.js のバージョンが 24 系になっているか `node -v` で確認してください。
- **添削してもエラーが返る**: 設定ページに Gemini API キーが正しく登録されているか確認してください（キーはサーバーに送信されず、ブラウザの LocalStorage にのみ保存されます）。
- **コミット時の運用**: バージョン番号は semantic-release が自動採番するため、`package.json` の `version` は手動編集しないでください（詳細は [CLAUDE.md](CLAUDE.md) の「バージョン運用」を参照）。

## ドキュメント

対象読者ごとのドキュメント一覧は [docs/index.md](docs/index.md) を参照してください。

## ライセンス・免責

本アプリは **MIT License** のもとで無償提供されます。利用にあたっては、以下の規約類をご確認ください。

- [免責事項（DISCLAIMER）](docs/legal/disclaimer.md)
- [利用規約（TERMS）](docs/legal/terms.md)
- [プライバシーポリシー（PRIVACY）](docs/legal/privacy.md)
- [ライセンス（LICENSE）](docs/legal/LICENSE.md)

本アプリは現状有姿で提供され、利用に起因する損害について、法令上許容される範囲で開発者は責任を負いません。許可された利用者のログイン時は添削セッションが Firebase（Google）に同期される点を含め、詳細は[プライバシーポリシー](docs/legal/privacy.md)をご確認ください。
