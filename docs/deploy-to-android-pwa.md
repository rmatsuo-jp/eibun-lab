# Android（Pixel）へのPWAデプロイ手順

このドキュメントでは、AngularアプリをPWA（Progressive Web App）としてAndroidスマートフォンで使えるようにする手順を説明します。

---

## 概要：なぜこの方法を選ぶのか

### PWAとは

PWA（Progressive Web App）とは、Webサイトをスマートフォンのアプリのようにホーム画面から起動できるようにする仕組みです。

| 比較項目               | 通常のWebサイト | PWA  | ネイティブアプリ |
| ---------------------- | --------------- | ---- | ---------------- |
| ホーム画面に追加       | ❌              | ✅   | ✅               |
| オフライン動作         | ❌              | ✅   | ✅               |
| ストアへの申請         | 不要            | 不要 | 必要             |
| データはデバイスに保存 | △               | ✅   | ✅               |

### なぜGitHub Pagesを使うのか

PWAはHTTPS（暗号化された通信）でのみ動作します。ローカルファイル（`file:///...`）では動きません。
GitHub Pagesは**無料でHTTPSのホスティング**を提供しているため採用しています。

データ（添削履歴・設定）はサーバーには保存されず、**スマートフォン本体のブラウザストレージ（localStorage）に保存**されます。
そのため他の人が同じURLを開いても、あなたのデータは見えません。

---

## 前提条件

- Node.js・npmがインストール済み
- Angular CLIがインストール済み（`npm install -g @angular/cli`）
- GitHubアカウントとリポジトリがある
- リポジトリにコードがpush済み

---

## 手順

### ステップ1：PWA対応パッケージを追加する

```powershell
ng add @angular/pwa
```

**何をしているか：**
このコマンドは以下を自動生成します。

- `public/manifest.webmanifest` — アプリ名・アイコン・表示方法などのメタ情報
- `public/icons/icon-*.png` — ホーム画面に表示されるアイコン画像
- `ngsw-config.json` — Service Workerの設定（どのファイルをオフラインでキャッシュするか）
- `src/app/app.config.ts` の更新 — Service Workerを有効化するコードの追加

**Service Workerとは：**
ブラウザのバックグラウンドで動くスクリプトで、アプリのファイルをデバイスにキャッシュ（保存）します。これによりオフラインでもアプリが起動できます。

---

### ステップ2：manifest.webmanifestを編集する（任意）

`public/manifest.webmanifest` を開いて、アプリ情報を変更します。

```json
{
  "name": "英文ラボ",
  "short_name": "英文ラボ",
  "description": "Geminiを使った英作文添削アプリ",
  "display": "standalone",
  "scope": "./",
  "start_url": "./",
  "background_color": "#ffffff",
  "theme_color": "#1976d2",
  "lang": "ja"
}
```

**各項目の意味：**

| キー                    | 意味                                                   |
| ----------------------- | ------------------------------------------------------ |
| `name`                  | インストール時に表示されるフルネーム                   |
| `short_name`            | ホーム画面のアイコン下に表示される短い名前             |
| `display: "standalone"` | ブラウザのアドレスバーを非表示にしてアプリっぽく見せる |
| `theme_color`           | Androidのステータスバーの色                            |
| `background_color`      | 起動時のスプラッシュ画面の背景色                       |

---

### ステップ3：プロダクションビルドを実行する

```powershell
ng build --configuration production --base-href "https://あなたのGitHubユーザー名.github.io/eibun-lab/"
```

**このアプリの場合：**

```powershell
ng build --configuration production --base-href "https://rmatsuo-jp.github.io/eibun-lab/"
```

**何をしているか：**

- `--configuration production` — ファイルを圧縮・最適化してファイルサイズを小さくします
- `--base-href` — 全てのファイルパスのベースURLを指定します

**⚠️ base-hrefの注意点：**
`--base-href=/eibun-lab/` のようにパスだけを指定すると、Windows環境では `C:/Program Files/Git/eibun-lab/` という**ローカルのファイルパスに誤解釈されることがあります**。
必ず `https://` から始まる完全なURLを指定してください。

ビルド結果は `dist/eibun-lab/browser/` に生成されます。
ビルド後に `dist/eibun-lab/browser/index.html` を開き、以下のようになっているか確認してください：

```html
<base href="https://rmatsuo-jp.github.io/eibun-lab/" />
```

---

### ステップ4：GitHub Pagesにデプロイする

#### デプロイツールのインストール（初回のみ）

```powershell
npm install --save-dev angular-cli-ghpages
```

**何をしているか：**
`angular-cli-ghpages` は `dist` フォルダの中身を、GitHubリポジトリの `gh-pages` ブランチに自動でpushするツールです。

#### デプロイの実行

```powershell
npx angular-cli-ghpages --dir=dist/eibun-lab/browser
```

このコマンドは以下を自動で行います：

1. `gh-pages` ブランチを作成または更新する
2. `dist/eibun-lab/browser/` の中身を全てそのブランチにpushする

---

### ステップ5：GitHub PagesのPages設定を有効にする（初回のみ）

1. GitHubのリポジトリページを開く
2. **Settings** → **Pages** を開く
3. **Source** を `Deploy from a branch` に設定
4. **Branch** を `gh-pages` / `/ (root)` に設定
5. **Save** を押す

数分後に `Your site is live at https://...` と表示されれば完了です。

**2回目以降はこの設定は不要です。** ステップ3・4を実行するだけで更新されます。

---

### ステップ6：AndroidにPWAをインストールする

1. Pixel の Chrome で `https://rmatsuo-jp.github.io/eibun-lab/` を開く
2. アドレスバーの右側にインストールアイコン（⬇️）が表示されたらタップ
   - または右上の「︙」メニュー → **「アプリをインストール」**
3. 「インストール」をタップ
4. ホーム画面に「英文ラボ」アプリが追加される

---

## コードを更新した後の手順

機能を追加・修正した後は、ステップ3・4を繰り返すだけです。

```powershell
# 1. ビルド
ng build --configuration production --base-href "https://rmatsuo-jp.github.io/eibun-lab/"

# 2. デプロイ
npx angular-cli-ghpages --dir=dist/eibun-lab/browser
```

Androidのアプリは次回起動時またはバックグラウンドで自動的に更新されます（Service Workerが新しいファイルを検出して更新します）。

---

## データの保存について

このアプリのデータ（添削履歴・設定・APIキー）は全て**デバイスのlocalStorage**に保存されます。

| 特性                     | 内容                                             |
| ------------------------ | ------------------------------------------------ |
| 保存場所                 | スマートフォンのChromeブラウザ内                 |
| 他の端末から見えるか     | 見えない                                         |
| サーバーに送られるか     | 送られない（Gemini APIへのリクエストを除く）     |
| データが消えるタイミング | Chromeの設定から「サイトのデータを削除」したとき |
| 永続性                   | アプリを閉じても・再起動しても残る               |

**注意：** Chromeの「閲覧データを削除」で「サイトデータ」を選択するとデータが消えます。通常の使用では消えません。

---

## トラブルシューティング

### アプリが真っ白で何も表示されない

→ `dist/eibun-lab/browser/index.html` の `<base href>` を確認してください。
`file:///` や `C:/` から始まっている場合、ステップ3のコマンドが正しくありません。
`https://` から始まる完全なURLを指定して再ビルド・再デプロイしてください。

### デプロイしたのに古いバージョンが表示される

→ Chromeで **Ctrl+Shift+R**（強制リロード）を試してください。
Service Workerのキャッシュが残っている場合があります。

### インストールボタンが表示されない

→ 以下を確認してください：

- HTTPSのURLで開いているか（`https://` から始まるURL）
- `manifest.webmanifest` が正しく読み込まれているか（DevToolsのApplicationタブで確認）
- Service Workerが有効になっているか（DevToolsのApplicationタブで確認）
