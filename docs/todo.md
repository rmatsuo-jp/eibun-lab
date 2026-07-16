# TODO

本ファイルは今後の機能追加・修正およびリファクタリングのタスクを記録する。
Claude Codeはタスク着手・完了時に本ファイルを更新すること。完了した項目は削除するか、
取り消し線を付けて記録する（運用はユーザーと相談の上決定）。

## 機能追加・修正

- 4択クイズに誤答理由・正答理由の表示機能を追加
  - ドリルの4択クイズ（`ReviewItem.choices`）で、選択後に「選んだ選択肢がなぜ誤りか」「正答がなぜ正しいか」を
    ユーザーが把握できるように、選択肢ごとの理由を表示する。
  - `ReviewItem`（`src/app/core/models/session.model.ts`）に選択肢ごとの理由フィールドを追加する必要あり。
  - Geminiプロンプト（`core/gemini/prompt.util.ts` の `SECTIONS`）で選択肢ごとの理由も生成させる必要あり。
  - `gemini-parse.util.ts` のパース対応が必要。
  - `quiz.util.ts`（`Quiz` interface, `buildClozeQuiz`）と `features/drill` の表示側（`drill.html`等）に
    理由表示UIを追加する必要あり。
  - `CorrectionSession` に optional フィールドを追加する場合は `firestore-sync.service.ts` の
    `OPTIONAL_FIELDS_MAP` への追加が必須（CLAUDE.md のルール参照）。

- 同日複数添削の順序（N回目）表示
  - 一日一添削を基本としつつ、同じ日に追加で添削したいニーズに対応するため、同日内の何回目の
    添削かをUIで判別できるようにする。
  - `CorrectionSession.id` は既に日付非依存（`Date.now()+random`、`practice-state.service.ts`）で
    同日複数保存時も衝突しないため、ストレージ層の変更は不要。表示側のみの対応で足りる。
  - `history-state.service.ts` の `filteredSessions`（選択日の全セッションを返す）や
    `history-calendar.ts` の `sessionsByDay`（日付ごとにグループ化済み）を起点に、同日内で
    `date`（タイムスタンプ）昇順に並べ替えて「N回目」の序数を導出するヘルパーの追加を検討する。
  - `history.html` の各セッションカード表示（`filteredSessions()` のループ箇所）に「1回目」
    「2回目」等のラベルを表示する。
  - `history-calendar.ts` のカレンダーバッジは現在、同日に複数セッションがある場合でも末尾
    （＝最後に保存された）1件の評価のみを表示している。複数回あることが分かるよう見直しを検討する
    （例: 件数表示への変更）。
  - UI文言を新規追加する場合は `docs/glossary.md`／`prh.yml` への追記と `npm run lint:text`
    での確認が必要（CLAUDE.md の用語ルール参照）。

## リファクタリング

- （現時点で記載事項なし。今後追記）
