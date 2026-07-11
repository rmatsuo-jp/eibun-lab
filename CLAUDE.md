# CLAUDE.md — Study English

Angular 22 製 PWA。Gemini AI で英作文を添削し、結果を LocalStorage に保存して学習履歴・ミス傾向を追跡する。
UI言語: 日本語。

## 基本ルール

- 返答は日本語。実装は簡潔に、解説は求められた時のみ。
- ファイルは全文読みせず、`grep`/`@file`コメントで該当箇所を特定してから必要範囲のみ読む。
- 依存方向は `features → core → shared` の一方向のみ。feature間import・core→features importは禁止
  （例外: 開発ビルドの app.config.ts が GEMINI_LOGGER に DevLogService を provide する箇所のみ）。
  層跨ぎは `@core/*` / `@shared/*` / `@features/*`（tsconfig.json）、同一フォルダ内は相対import。
- 型定義の正は `src/app/core/models/session.model.ts`。`CorrectionSession` に optional フィールドを
  追加したら `firestore-sync.service.ts` の `OPTIONAL_FIELDS` にも必ず追加（Firestoreはundefined不可）。
- リアクティブは `signal()`（`BehaviorSubject`不使用）。コンポーネントはStandalone。
- 永続化はコンポーネントから直接localStorageを触らず `SessionRepositoryService` /
  `SettingsStoreService` / `DrillProgressService` 経由。API呼び出しは `GeminiService` 経由。
- プロンプトは `core/gemini/prompt.util.ts` の `SECTIONS` 配列で一元管理。

## データフロー概要

practice → `buildPrompt()` → Gemini API → `<corrected-text><mistakes><evaluation><review><levelup>`タグ
→ `gemini-parse.util.ts` で分離 → `SessionRepositoryService.saveSession()`（LocalStorage + Firestore）
→ history/mistakes/drill が参照。ドリル進捗は `DrillProgressService`＋`DrillProgressSyncService`。

## バージョン運用

semantic-release による自動採番。`package.json`の`version`を手動編集しない。
`fix/perf`=PATCH、`feat`=MINOR、`feat!`/`BREAKING CHANGE`=MAJOR、それ以外は上昇なし。
`src/version.ts`はリリース時のみ生成される（通常のbuildでは再生成されない）。

## コメント管理ルール

ファイル編集時は `@file` コメントと影響するセクションコメントを同時に更新する（全読み回避のため）。
`.spec.ts`と`src/version.ts`は対象外。書式:
```typescript
/**
 * @file ファイルの役割を1〜2行で説明
 */
// ── セクション名 ──
```

## 用語ルール

日本語用語の正典は `docs/glossary.md`。UI文言・Geminiプロンプト・ドキュメント変更時は
`npm run lint:text` を実行。新しいドメイン用語は `docs/glossary.md` と `prh.yml` の両方に追記する。
チェック対象は `docs/`配下、`README.md`、`src/app/core/gemini/prompt.util.ts` のみ。
「ミス」への統一はUIラベル・見出しのみ（散文中の「誤り」等は禁止しない）。

## 開発コマンド

`npm start` / `npm run build` / `npm test` / `npm run deploy` /
`npm run lint:text`（表記ゆれチェック、`:fix`で自動修正）
