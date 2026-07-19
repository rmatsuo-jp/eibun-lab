# 英文ラボ（Eibun-Lab） — データ設計書

本書は LocalStorage・Firestore に保存される全データ構造と、その同期・整合性維持の仕組みを正確に記録する。
型定義の正典は `src/app/core/models/session.model.ts` であり、本書はそれを人間可読な形にまとめたもの。
コードとの乖離を発見した場合は、コードを正として本書を更新すること。

---

## 1. ドメイン型定義

正典: [session.model.ts](../src/app/core/models/session.model.ts)

### Mistake（1件のミス情報）

| フィールド    | 型     | 任意 | 意味                                                                                                                      |
| ------------- | ------ | ---- | ------------------------------------------------------------------------------------------------------------------------- |
| category      | string | 必須 | ミスのカテゴリ（日本語固定文字列）                                                                                        |
| categoryKey   | string | 任意 | UI表示用の翻訳キー（`grammar`/`vocabulary`/`spelling`/`collocation`/`usage`/`syntax`/`word-order`）。旧データは欠落し得る |
| original      | string | 必須 | 元の誤った表現                                                                                                            |
| corrected     | string | 必須 | 正しい表現                                                                                                                |
| explanation   | string | 必須 | 日本語解説                                                                                                                |
| explanationEn | string | 任意 | explanation の英語版                                                                                                      |

### ReviewItem（穴埋めクイズカード。Drillの「穴埋めクイズ」モードで出題）

| フィールド    | 型       | 任意 | 意味                     |
| ------------- | -------- | ---- | ------------------------ |
| sentence      | string   | 必須 | `___` で空所を作った英文 |
| answer        | string   | 必須 | 空所に入る正解の語/句    |
| hint          | string   | 必須 | 日本語ヒント             |
| hintEn        | string   | 任意 | hint の英語版            |
| translation   | string   | 必須 | 英文の日本語訳           |
| translationEn | string   | 任意 | translation の英語版     |
| choices       | string[] | 必須 | 4択（正解を1つ含む）     |

### LevelUpItem（レベルアップ例文タイピング用、1文単位。Drillの「穴あきタイピング」モードで使用）

| フィールド    | 型       | 任意 | 意味                                                     |
| ------------- | -------- | ---- | -------------------------------------------------------- |
| original      | string   | 必須 | 元の（レベルアップ前の）1文                              |
| leveledUp     | string   | 必須 | CEFR一段階上のレベルで書き直した1文                      |
| keyPhrases    | string[] | 必須 | `leveledUp` 内に出現する、穴埋め対象の完全一致部分文字列 |
| translation   | string   | 必須 | leveledUp の日本語訳                                     |
| translationEn | string   | 任意 | translation の英語版                                     |

### WritingEvaluation（1回の添削の定量評価）

| フィールド      | 型     | 任意 | 意味                     |
| --------------- | ------ | ---- | ------------------------ |
| grammarScore    | number | 必須 | 文法 0〜10（0.5刻み）    |
| vocabularyScore | number | 必須 | 語彙 0〜10               |
| contentScore    | number | 必須 | 内容 0〜10               |
| overallScore    | number | 必須 | 総合平均 0〜10           |
| errorDensity    | number | 必須 | 100語あたりのエラー数    |
| grammarCefr     | string | 必須 | 文法の暫定CEFR（A1〜C2） |
| vocabularyCefr  | string | 必須 | 語彙の暫定CEFR           |
| contentCefr     | string | 必須 | 内容の暫定CEFR           |
| overallCefr     | string | 必須 | 総合の暫定CEFR           |

### CorrectionSession（1回の添削セッション。LocalStorage保存の最小単位）

| フィールド           | 型                | 任意 | 意味                                                                            |
| -------------------- | ----------------- | ---- | ------------------------------------------------------------------------------- |
| id                   | string            | 必須 | 一意ID（日付非依存、`Date.now()+random`）                                       |
| date                 | string            | 必須 | ISO 8601（選択日付）                                                            |
| original             | string            | 必須 | ユーザーが入力した英文                                                          |
| corrected            | string            | 必須 | 添削解説プローズ（`grammarNotes`等5項目を結合した後方互換フィールド）           |
| correctedEn          | string            | 任意 | corrected の英語版                                                              |
| correctedText        | string            | 任意 | 添削後の完成版の全文（後方互換）                                                |
| grammarNotes         | string            | 任意 | 文法・語法のミスの指摘                                                          |
| grammarNotesEn       | string            | 任意 | grammarNotes の英語版                                                           |
| naturalExpressions   | string            | 任意 | 自然な表現の提案                                                                |
| naturalExpressionsEn | string            | 任意 | naturalExpressions の英語版                                                     |
| grammarTendency      | string            | 任意 | 文法のミスの傾向                                                                |
| grammarTendencyEn    | string            | 任意 | grammarTendency の英語版                                                        |
| cefrRationale        | string            | 任意 | CEFR評価の根拠                                                                  |
| cefrRationaleEn      | string            | 任意 | cefrRationale の英語版                                                          |
| studyPlan            | string            | 任意 | 学習法の提案                                                                    |
| studyPlanEn          | string            | 任意 | studyPlan の英語版                                                              |
| mistakes             | Mistake[]         | 必須 | ミス一覧                                                                        |
| evaluation           | WritingEvaluation | 任意 | 定量評価が有効なセッションのみ                                                  |
| reviewItems          | ReviewItem[]      | 任意 | 復習カード生成が有効なセッションのみ（後方互換）                                |
| levelUpItems         | LevelUpItem[]     | 任意 | レベルアップ例文タイピング用（Drill専用、後方互換）                             |
| levelUpText          | string            | 任意 | レベルアップ後の全文（後方互換）                                                |
| deleted              | boolean           | 任意 | 論理削除フラグ（tombstone）。多端末同期のため物理削除しない                     |
| model                | string            | 任意 | 添削に実際に使用されたGeminiモデルID（modelPriorityフォールバック後の最終選択） |

`corrected`/`correctedEn`（添削解説プローズ）は、`grammarNotes`/`naturalExpressions`/`grammarTendency`/`cefrRationale`/`studyPlan`
の5項目（各Geminiレスポンスの専用タグから独立抽出）を結合した後方互換フィールド。1項目のタグ抽出が失敗しても
他の4項目には影響しない（[gemini.service.ts](../src/app/core/gemini/gemini.service.ts)参照）。新しいUIはこの5項目を
個別ブロックとして表示し、5項目が1つも無い旧データのみ`corrected`/`correctedEn`を単一ブロックとして表示する。

### DrillProgress（ドリルの1問ごとの習熟度）

| フィールド    | 型      | 任意 | 意味                                                                                                |
| ------------- | ------- | ---- | --------------------------------------------------------------------------------------------------- |
| correctStreak | number  | 必須 | 連続正解数                                                                                          |
| everCorrect   | boolean | 任意 | 1回でも正解したことがあるか（永続的な達成フラグ、穴埋めクイズの日付選択画面の達成バッジ判定に使用） |
| lastAttemptAt | string  | 必須 | 直近に解答した日時（ISO 8601）                                                                      |

`correctStreak`が一定数（`DRILL_MASTERY_STREAK`＝3）以上になると出題の重みを下げ、既に習熟した問題の再出題頻度を減らす。

### LevelUpItemProgress（穴あきタイピング1文分の進捗）

| フィールド | 型      | 任意 | 意味                                                    |
| ---------- | ------- | ---- | ------------------------------------------------------- |
| maskLevel  | number  | 必須 | 現在のマスク段階（0=全文表示 〜 maxLevel=全単語マスク） |
| completed  | boolean | 必須 | maxLevelで正解済みか                                    |

セッション（日付）単位でまとめて保持し、途中再開・完了判定に使う。

### FeatureGamificationStats（1機能分の累積統計）／GamificationStats

実績（ゲーミフィケーション）機能に関するデータ設計は [§6](#6-実績achievementsデータ設計) を参照。

### AppSettings（アプリ設定）

正典: [settings-store.service.ts](../src/app/core/settings/settings-store.service.ts)

| フィールド        | 型                   | 任意 | 意味                                                                       |
| ----------------- | -------------------- | ---- | -------------------------------------------------------------------------- |
| apiKey            | string               | 必須 | Gemini APIキー（**LocalStorageには平文で保存しない**。§3参照）             |
| modelPriority     | string[]             | 必須 | 使用モデルのフォールバック順（先頭優先）                                   |
| theme             | `'light'\|'dark'`    | 必須 | テーマ                                                                     |
| language          | Lang（`'ja'\|'en'`） | 必須 | UI表示言語・添削結果表示言語                                               |
| consentAcceptedAt | string               | 任意 | 同意日時（ISO 8601）。未同意なら`undefined`                                |
| consentVersion    | number               | 任意 | 同意した規約のバージョン。未設定は`1`とみなす（現行`CONSENT_VERSION = 2`） |

LocalStorage実際の保存形は `StoredSettings = Partial<AppSettings> & { model?: string; apiKeyEnc?: string }`。
`apiKey`はキーそのものとしては保存されず、代わりに暗号化済みの`apiKeyEnc`が保存される（§3参照）。
旧形式（`model`という単一文字列フィールド）は`getSettings()`実行時に`modelPriority`配列へ自動変換される。

---

## 2. `*En` フィールド対応（日英並行フィールド）

日本語の説明系フィールドは、対応する`*En`フィールドに英語版をoptionalで持つ。英語版が無いセッション
（旧データ・生成失敗時）は表示側（[localized-session.util.ts](../src/app/core/i18n/localized-session.util.ts)）が
自動で日本語にフォールバックする。

| 日本語フィールド                       | 英語フィールド                           | 所属                          |
| -------------------------------------- | ---------------------------------------- | ----------------------------- |
| `Mistake.explanation`                  | `Mistake.explanationEn`                  | Mistake                       |
| `ReviewItem.hint`                      | `ReviewItem.hintEn`                      | ReviewItem                    |
| `ReviewItem.translation`               | `ReviewItem.translationEn`               | ReviewItem                    |
| `LevelUpItem.translation`              | `LevelUpItem.translationEn`              | LevelUpItem                   |
| `CorrectionSession.corrected`          | `CorrectionSession.correctedEn`          | CorrectionSession（後方互換） |
| `CorrectionSession.grammarNotes`       | `CorrectionSession.grammarNotesEn`       | CorrectionSession             |
| `CorrectionSession.naturalExpressions` | `CorrectionSession.naturalExpressionsEn` | CorrectionSession             |
| `CorrectionSession.grammarTendency`    | `CorrectionSession.grammarTendencyEn`    | CorrectionSession             |
| `CorrectionSession.cefrRationale`      | `CorrectionSession.cefrRationaleEn`      | CorrectionSession             |
| `CorrectionSession.studyPlan`          | `CorrectionSession.studyPlanEn`          | CorrectionSession             |

添削解説プローズ系5項目（`grammarNotes`/`naturalExpressions`/`grammarTendency`/`cefrRationale`/`studyPlan`とその`*En`）は
[prose-fields.util.ts](../src/app/core/i18n/prose-fields.util.ts)の`PROSE_FIELDS`配列で一元管理され、
practice・historyの表示ロジックがこの配列を介して共通の見出し・フォールバック処理を行う。

`Mistake.category`/`categoryKey`は`*En`ペアではない。`categoryKey`は`category`（固定の日本語文字列）に対応する
i18n翻訳キーであり、旧データには存在しないため任意。

`buildPrompt()`（core/gemini/prompt.util.ts）と`GeminiService`は表示言語（`lang`）を一切参照しない。Geminiは常に
日本語本文と対応する`*En`フィールドを同一APIレスポンスで生成する。

---

## 3. LocalStorageキー一覧

| キー                            | 定数名                   | 定義ファイル                                                                                | 保存型                                                                          | 読み書きサービス                                                                       |
| ------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `correction_sessions`           | `SESSIONS_KEY`           | [session-store.service.ts](../src/app/core/sessions/session-store.service.ts)               | `CorrectionSession[]`                                                           | `SessionStoreService`（CRUD、`deleted`フラグで論理削除）。`FirestoreSyncService`が同期 |
| `app_settings`                  | `SETTINGS_KEY`           | [settings-store.service.ts](../src/app/core/settings/settings-store.service.ts)             | `StoredSettings`（`Partial<AppSettings> & { model?, apiKeyEnc? }`）             | `SettingsStoreService`のみ。クラウド同期なし                                           |
| `eibun-lab-drill-progress`      | `DRILL_PROGRESS_KEY`     | [drill-progress.service.ts](../src/app/features/drill/drill-progress.service.ts)            | `Record<string, DrillProgress>`（キー=`normalizeDrillKey(...)`）                | `DrillProgressService`。`DrillProgressSyncService`が同期                               |
| `eibun-lab-levelup-progress`    | `LEVELUP_PROGRESS_KEY`   | 同上                                                                                        | `Record<string, Record<string, LevelUpItemProgress>>`（sessionId→itemKey→進捗） | 同上                                                                                   |
| `eibun-lab-drill-perfect-count` | `PERFECT_COUNT_KEY`      | 同上                                                                                        | `Record<string, number>`（キー=`` `cloze-${id}` `` / `` `levelup-${id}` ``）    | 同上                                                                                   |
| `eibun-lab-gamification-stats`  | `GAMIFICATION_STATS_KEY` | [gamification-stats.service.ts](../src/app/core/achievements/gamification-stats.service.ts) | `GamificationStats`（§6参照）                                                   | `GamificationStatsService`。`GamificationSyncService`が同期                            |
| `release_notes_seen`            | `SEEN_KEY`               | [release-notes.service.ts](../src/app/core/release-notes/release-notes.service.ts)          | `{ lastSeenVersion?: string }`                                                  | `ReleaseNotesService`のみ。クラウド同期なし                                            |
| `dev_logs`                      | `LOGS_KEY`               | [dev-log.service.ts](../src/app/features/dev/dev-log.service.ts)                            | `DevLogEntry[]`（最大20件）                                                     | `DevLogService`のみ。開発ビルドのみ記録                                                |

`DevLogEntry`は`GeminiLogRecord`（[gemini-log.token.ts](../src/app/core/logging/gemini-log.token.ts)）を拡張し、
`id`・`timestamp`を追加したもの。`GeminiLogRecord`は`model`/`fullPrompt`/`userText`/`rawResponse`/`parsed`/`parseWarnings?`を持つ。

---

## 4. Firestore設計

### セキュリティルール

正典: [firestore.rules](../firestore.rules)（リポジトリルート）

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAllowedUser() {
      return request.auth != null
        && request.auth.token.email in [<許可済みメールアドレス>]
        && request.auth.token.email_verified == true;
    }

    match /apps/eibun_lab/users/{uid}/sessions/{sessionId} {
      allow read, write: if isAllowedUser() && request.auth.uid == uid;
    }
    match /apps/eibun_lab/users/{uid}/drillProgress/{docId} {
      allow read, write: if isAllowedUser() && request.auth.uid == uid;
    }
    match /apps/eibun_lab/users/{uid}/gamification/{docId} {
      allow read, write: if isAllowedUser() && request.auth.uid == uid;
    }
  }
}
```

ホワイトリスト方式（許可済みメールアドレス＋`email_verified`必須）＋本人UID限定の二重チェック。許可済みメール
アドレスの一覧は[auth.constants.ts](../src/app/core/firebase/auth.constants.ts)（クライアント側のログイン許可判定）
と必ず同期させること。ルール変更時は `firebase deploy --only firestore:rules` で反映する。

### コレクション構成

すべて `apps/eibun_lab/users/{uid}/` 配下（`apps/eibun_lab`は他アプリとのFirebaseプロジェクト共有を想定した名前空間）。

| パス                   | 内容                                                   | ドキュメント粒度                            |
| ---------------------- | ------------------------------------------------------ | ------------------------------------------- |
| `sessions/{sessionId}` | `CorrectionSession`をそのまま保存                      | セッション単位（1セッション=1ドキュメント） |
| `drillProgress/data`   | `{ drillProgress?, levelUpProgress?, perfectCounts? }` | 固定ID`data`の単一ドキュメント              |
| `gamification/data`    | `GamificationStats`相当                                | 固定ID`data`の単一ドキュメント              |

### sessions の同期・マージ（`FirestoreSyncService`）

正典: [firestore-sync.service.ts](../src/app/core/sessions/firestore-sync.service.ts)

- **書き込み時（`toDocData()`）**: 任意フィールドで値が`undefined`のものをトップレベルから削除。加えて
  `mistakes`/`reviewItems`/`levelUpItems`配列の各要素にも`stripUndefinedShallow()`を適用し、1階層だけundefinedキーを除去する
  （Firestoreは`undefined`を受け付けないため）。
- **`OPTIONAL_FIELDS_MAP`**: `Record<OptionalKeys<CorrectionSession>, true>`型で、`CorrectionSession`の全任意フィールド
  （現在18個）を列挙する。`CorrectionSession`に任意フィールドを追加/削除してこのマップの更新を忘れると、
  型が一致せず`tsc`/`ng build`/`ng lint`がコンパイルエラーにする（CLAUDE.md記載の規約、型レベルで検知漏れを防止）。
- **`pushSessions(sessions)`**: セッションごとにfire-and-forgetで`setDoc`。失敗時は`pendingPushIds`に積み、
  `window`の`online`イベントで再送する。
- **`syncFromCloud(uid)`**（ログイン直後・以降のオペレーション時に実行）:
  1. クラウド側の全ドキュメントを取得し、ローカル・クラウド双方を`id`でMap化。
  2. 全idの和集合について、`deleted = ローカルのdeleted || クラウドのdeleted`（**OR結合のtombstone方式**）で
     マージ後の値を決定。片方の端末で削除した内容が、もう片方の再pushで復活する事態を防ぐ。
  3. `date`降順にソートし、`SessionStoreService.persist(merged)`でローカルへ書き戻す。
  4. クラウド側にドキュメントが無い、または`deleted`状態が食い違うセッションのみcrawl差分pushする。

### drillProgress の同期・マージ（`DrillProgressSyncService`）

正典: [drill-progress-sync.service.ts](../src/app/features/drill/drill-progress-sync.service.ts)

削除（tombstone）の概念はない。`syncFromCloud`でのマージ規則：

- `drillProgress`: キーごとに`lastAttemptAt`が新しい方を採用（ローカル欠落時はクラウド優先）。
- `levelUpProgress`: `sessionId`→`itemKey`ごとに`maskLevel`が高い方（進捗が進んでいる方）を採用。
- `perfectCounts`: キーごとに`Math.max(ローカル, クラウド)`。

マージ後、ローカルへ書き戻し、マージ結果が生のクラウドデータと異なる場合のみ1回の`setDoc`でクラウドへ書き戻す。

### gamification の同期・マージ（`GamificationSyncService`）

正典: [gamification-sync.service.ts](../src/app/core/achievements/gamification-sync.service.ts)

`mergeFeatureStats`によるマージ規則：

- 各種カウンタ（`totalAttempts`等）は`Math.max(ローカル, クラウド)`。
- `lastActiveDate`は日付として新しい方を採用。
- `completedSessionKeys`・`unlockedAchievements`はキー単位のマージ（オブジェクトのスプレッド結合、
  `unlockedAchievements`はローカル値優先）。
- 読み込んだクラウドデータが期待する形状（`isValidStats()`）と一致しない場合は無視する（移行処理は行わない。
  §6・docs/todo.md参照）。

---

## 5. `OPTIONAL_FIELDS_MAP` 運用規約（詳細）

CLAUDE.mdに記載の規約の技術的背景：

1. `CorrectionSession`に`?`付きの任意フィールドを追加する。
2. 同時に`firestore-sync.service.ts`の`OPTIONAL_FIELDS_MAP`オブジェクトへ同名キー・値`true`を追加する。
3. `OPTIONAL_FIELDS_MAP`の型は`Record<OptionalKeys<CorrectionSession>, true>`（`OptionalKeys<T>`は`T`の任意フィールド名の
   ユニオン型を導出するユーティリティ型）と宣言されているため、`CorrectionSession`の任意フィールド集合と
   `OPTIONAL_FIELDS_MAP`のキー集合が完全一致していないと型エラーになる。
4. 結果として、手順2を忘れると`tsc`（`ng build`/`ng lint`含む）が即座にコンパイルエラーを出すため、
   「追加し忘れてFirestoreに`undefined`を送ろうとする」バグは実質的に発生しない。

この仕組みは、Firestoreの「undefinedフィールド不可」制約に対する軽量な対応であり、ランタイムスキーマ検証
ライブラリ（zod等）を導入せずに型レベルの強制で同等の安全性を得ている。

---

## 6. 実績（Achievements）データ設計

正典: [achievement.model.ts](../src/app/core/achievements/achievement.model.ts) /
[achievement-definitions/](../src/app/core/achievements/achievement-definitions/)（featureId別に分割）/
[gamification-stats.service.ts](../src/app/core/achievements/gamification-stats.service.ts)

### GamificationStats（featureId汎用マップ構造）

```typescript
export interface GamificationStats {
  features: Record<string, FeatureGamificationStats>; // featureIdごとの累積統計
  unlockedAchievements: Record<string, string>; // achievementId → 解除日時(ISO)
}
```

`features`のキー（featureId）は現在 `'correction'`（練習・添削）／`'cloze'`（穴埋めクイズ）／`'levelup'`（穴あきタイピング）
の3種を使用するが、型としては任意の文字列を受け付ける汎用マップである。新しいゲーミフィケーション対象機能を
追加する場合は、新しいfeatureId文字列を決めて`gamification-stats.service.ts`の呼び出し元（例: 新feature側の
state service）から`recordAnswer(featureId, ...)`/`recordSessionComplete(featureId, ...)`を呼ぶだけでよく、
`GamificationStats`自体の型変更は不要。

`FeatureGamificationStats`の形は[§1](#1-ドメイン型定義)を参照。添削（correction）は`totalAttempts`と日次ストリーク系
フィールドのみ使用し、正誤・パーフェクト・セッション完了系フィールドは常に初期値のまま未使用とする
（型を1つに共通化することで、日次ストリーク更新・Firestoreマージのロジックをfeature間で共有できる）。

### AchievementDef（実績定義。featureId別ファイルに分割）

```typescript
export type AchievementGroup = string; // 表示上のグルーピング単位。現状は featureId と同じ値を使う

export interface AchievementContext {
  masteryProgress: Record<string, { done: number; total: number }>; // featureIdごとの制覇進捗（例: 'cloze'→穴埋めクイズの全日程クリア状況）
}

export interface AchievementDef {
  id: AchievementId;
  group: AchievementGroup;
  titleKey: string;
  descKey: string;
  isUnlocked(stats: GamificationStats, ctx: AchievementContext): boolean;
  progress?: { target: number; currentValue(stats: GamificationStats): number };
}
```

`achievement-definitions/`フォルダに`correction.ts`/`cloze.ts`/`levelup.ts`（featureIdごとに1ファイル）があり、
それぞれ`AchievementDef[]`をexportする。`index.ts`が全ファイルの配列を結合して`ACHIEVEMENTS`をexportする。
新しいゲーミフィケーション対象featureを追加する際は、新しい定義ファイルを1つ追加し`index.ts`に1行加えるだけで済み、
既存ファイルの編集は不要。

`AchievementContext.masteryProgress`は、`GamificationStats`だけでは判定できない「制覇」系実績
（例: 穴埋めクイズの全日程クリア）のために、呼び出し元（drill機能）が`DrillProgressSyncService`のデータから
computeして渡す値。featureIdをキーにした汎用マップのため、新feature側で同様の「制覇」実績を追加する場合も
`AchievementContext`自体の型変更は不要。

### 実績データのマイグレーション方針

`GamificationStats`の保存形状を変更した場合、**マイグレーションコードは書かず、旧形状のデータは初期値に
リセットする**方針を採る（`isValidStats()`によるガード）。実績・統計のみがリセット対象であり、
添削・ドリルの実データ（`CorrectionSession`・`DrillProgress`等）は一切影響を受けない。

---

## 関連ドキュメント

- 型定義の正典: [session.model.ts](../src/app/core/models/session.model.ts)
- アーキテクチャ全体: [ARCHITECTURE.md](../ARCHITECTURE.md)
- システム概要: [overview.md](overview.md)
- 用語の正典: [glossary.md](glossary.md)
