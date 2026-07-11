# 英文ラボ（Eibun-Lab） — 開発環境セットアップ手順

このドキュメントでは、英文ラボ（Eibun-Lab）のソースコードを clone してから、ローカルで動作確認・テスト・ビルドまで行えるようにするための手順を説明します。アーキテクチャの詳細は [overview.md](overview.md) を参照してください。

---

## 前提条件

| ソフトウェア | バージョン                                                |
| ------------ | --------------------------------------------------------- |
| Node.js      | 24.x（CI と同じバージョン）                               |
| npm          | 11.x（`packageManager` フィールドで指定、Node 24 に同梱） |

Node.js のバージョン管理には [nvm](https://github.com/nvm-sh/nvm) や [Volta](https://volta.sh/) の利用を推奨します。

---

## 1. リポジトリの clone と依存関係のインストール

```bash
git clone https://github.com/rmatsuo-jp/eibun-lab.git
cd eibun-lab
npm install
```

---

## 2. Gemini API キーの取得・設定

このアプリは API キーをサーバーではなくブラウザの LocalStorage に保存する設計のため、`.env` などの環境変数ファイルは不要です。ローカル起動後にアプリ内から設定します。

1. [Google AI Studio](https://aistudio.google.com/) で API キーを発行
2. 手順3でアプリを起動した後、下部ナビゲーションの **設定** タブを開き、「Gemini API キー」欄に貼り付けて保存

詳細な操作は [manual.md](../user/manual.md) を参照してください。

---

## 3. ローカル開発サーバーの起動

```bash
npm start
```

`http://localhost:4200` でアプリが起動します（ホットリロード対応）。

---

## 4. テストの実行

```bash
npm test
```

Vitest によるユニットテストが実行されます。`core/` 配下の純粋関数（gemini/stats/i18n/quiz等）や各サービスのテストが中心です。

---

## 5. Lint の実行

```bash
npm run lint       # ESLint
npm run lint:text  # 表記ゆれチェック（docs/README.md/prompt.util.ts）。用語やUI文言、Geminiプロンプトを変更したら必ず実行
```

---

## 6. 本番ビルドの確認

```bash
npm run build
```

`dist/eibun-lab/` 配下に本番ビルド成果物が出力されます。Service Worker（PWA）も有効化されたビルドになります。

---

## よくあるつまずきポイント

- **`npm install` でエンジンエラーが出る**: Node.js のバージョンが 24 系になっているか `node -v` で確認してください。
- **添削してもエラーが返る**: 設定タブに Gemini API キーが正しく登録されているか確認してください（キーはサーバーに送信されず、ブラウザの LocalStorage にのみ保存されます）。
- **コミット時の運用**: バージョン番号は semantic-release が自動採番するため、`package.json` の `version` は手動編集しないでください（詳細は [CLAUDE.md](../../CLAUDE.md) の「バージョン運用」を参照）。
