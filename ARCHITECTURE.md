# ARCHITECTURE.md — Study English アーキテクチャ図

## 1. レイヤ構成（共通パターン）

コードベースは3層の一方向依存で構成される。**すべての機能追加はこのパターンの繰り返し**であり、
新しい拡張機能（feature）は `features/` にフォルダを1つ追加し、core のサービスを inject するだけでよい。

```
features/ ──▶ core/ ──▶ shared/
（拡張機能）  （基盤）   （汎用util）
```

- **features/** … 遅延ロードされるページ単位の拡張機能。ページ専用の service / util / guard は同じフォルダに同居する。feature 間の依存は禁止。
- **core/** … 全 feature が共有する基盤（ドメイン型・永続化・Gemini クライアント・Firebase・統計）。feature を import してはならない。
- **shared/** … アプリのドメインに依存しない汎用ユーティリティ（Markdown・日付・クリップボード等）。

```mermaid
graph TD
    subgraph Features["features/（遅延ロード。1フォルダ = 1拡張機能）"]
        Practice["practice\n英文入力・添削\n(+ practice-state.service\n+ bulk-import.util)"]
        Drill["drill\n弱点克服ドリル\n(+ drill-quiz.util\n+ drill-progress.service)"]
        History["history\n履歴・検索・入出力"]
        Mistakes["mistakes\n統計ダッシュボード"]
        Settings["settings\nAPIキー・テーマ\n(+ settings.guard)"]
        Dev["dev（本番非搭載）\nGeminiログ閲覧\n(+ dev-log.service)"]
    end

    subgraph Core["core/（基盤。providedIn: root）"]
        Models["models\nドメイン型定義"]
        Sessions["sessions\nSessionRepositoryService\n（ローカル+クラウド永続化）"]
        SettingsStore["settings\nSettingsStoreService"]
        Gemini["gemini\nGeminiService\n+ prompt/parse/evaluation util"]
        Stats["stats\nsession-stats.util（純粋関数）"]
        Firebase["firebase\nAuthService / firebase.init"]
        Logging["logging\nGEMINI_LOGGER トークン"]
    end

    Shared["shared/utils\nmarkdown / date / clipboard / local-storage"]

    Features --> Core --> Shared

    Sessions --- LocalStorage[("LocalStorage")]
    Sessions --- Firestore[("Cloud Firestore")]
    Gemini --- GeminiAPI["Google Gemini API"]
    Firebase --- FirebaseAuth["Firebase Authentication"]
```

### 各 feature が inject する core サービス

| feature | 使用する core |
|---|---|
| practice | GeminiService / SessionRepositoryService / SettingsStoreService |
| drill | SessionRepositoryService / stats（+ feature 内 DrillProgressService） |
| history | SessionRepositoryService |
| mistakes | SessionRepositoryService / stats |
| settings | SettingsStoreService / AuthService / gemini-models.constants |
| dev | SessionRepositoryService / SettingsStoreService / prompt.util（+ feature 内 DevLogService） |

---

## 2. core/sessions 内部構造

`SessionRepositoryService` がセッション永続化の唯一の窓口。「ローカル保存 → クラウド push」の
組み合わせを private な `syncToCloud()` に集約しており、書き込み系操作の呼び忘れによる乖離が起きない。

```mermaid
graph TD
    Repo["SessionRepositoryService\nsaveSession / deleteSession\nimportSessions / exportSessions"]
    Store["SessionStoreService\nLocalStorage CRUD\n(tombstone=論理削除)"]
    Sync["FirestoreSyncService\n双方向同期"]
    Auth["AuthService\n(user signal)"]

    LocalStorage[("LocalStorage")]
    Firestore[("Cloud Firestore\napps/study_english/users/{uid}/sessions")]

    Repo -->|ローカル保存| Store
    Repo -->|直後に pushSessions\n（1箇所に集約）| Sync
    Store <--> LocalStorage
    Sync -->|allSessions 読取 / persist 書戻し| Store
    Sync -->|user signal を effect() で監視| Auth
    Sync <--> Firestore
```

設定（`SettingsStoreService`）とドリル進捗（`DrillProgressService`、features/drill 内）は
それぞれ独立に LocalStorage を読み書きし、リポジトリを経由しない。

---

## 3. 添削フロー（データフローシーケンス）

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant P as PracticeState (features/practice)
    participant SS as SettingsStore (core)
    participant G as GeminiService (core)
    participant API as Gemini API
    participant L as GEMINI_LOGGER (core/logging)
    participant R as SessionRepository (core)

    User->>P: 英文を入力して送信
    P->>SS: getSettings()
    SS-->>P: AppSettings（apiKey, modelPriority）
    P->>P: buildPrompt() で完全プロンプト生成
    P->>G: correct(apiKey, modelPriority, prompt, userText)
    G->>G: modelPriority順にフォールバック（下図参照）
    G->>API: generateContent(fullPrompt)
    API-->>G: Markdown + <mistakes>/<evaluation>/<levelup>/<review> JSON
    G->>G: 各タグを抽出しJSON検証（gemini-parse.util）
    G->>L: record()（開発ビルド=DevLogService / 本番=no-op）
    G-->>P: CorrectionResult
    P->>R: saveSession(CorrectionSession)
    R->>R: ローカル保存 + Firestoreへfire-and-forget push
    P-->>User: 添削結果を表示
```

### モデルフォールバックループ

`modelPriority` 配列を先頭から順に試し、最初に成功したモデルの結果を返す。

```mermaid
flowchart LR
    Start(["correct()呼び出し"]) --> Try["先頭モデルでAPI呼び出し"]
    Try -->|成功| Return(["結果を返す"])
    Try -->|失敗| Next{"次のモデルが\n残っているか"}
    Next -->|Yes| Try
    Next -->|No| Throw(["最後のエラーをthrow"])
```

### Gemini ログの依存逆転

`GeminiService`（core）は `GEMINI_LOGGER` InjectionToken（core/logging）に記録するだけで、
実装を知らない。開発ビルドでは app.config.ts が `DevLogService`（features/dev）を provide し、
本番ビルドではデフォルトの no-op が使われる（core→features の逆依存を持たない）。

```mermaid
graph LR
    G["GeminiService (core)"] -->|inject| T["GEMINI_LOGGER トークン (core/logging)"]
    T -.->|"開発ビルド: app.config.ts が provide"| D["DevLogService (features/dev)"]
    T -.->|"本番ビルド: デフォルト factory"| N["no-op"]
```

---

## 4. Firestore 同期フロー

ログイン状態は `AuthService` の `user` signal で管理され、`FirestoreSyncService` は `effect()` で
これを監視する。ログインした瞬間に自動で双方向同期が走り、以降はセッションの保存/削除/インポートの
たびに `SessionRepositoryService` 経由で該当分だけ push される。

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant Auth as AuthService
    participant FS as FirestoreSyncService
    participant Local as SessionStoreService(Local)
    participant Cloud as Firestore

    Note over FS: 起動時からeffect()でuser signalを監視

    User->>Auth: Googleログイン
    Auth-->>FS: user signal が非null に変化
    FS->>Cloud: getDocs(sessions collection)
    Cloud-->>FS: クラウド側の全セッション
    FS->>Local: allSessions() でローカル全件取得
    FS->>FS: idで突き合わせ、deletedはOR結合してマージ
    FS->>Local: persist(merged) でローカルへ書き戻し
    FS->>Cloud: 食い違う差分をsetDoc()でpush

    Note over User,Cloud: --- 通常操作時（ログイン中）---
    User->>Local: セッション保存/削除/インポート（Repository経由）
    Local-->>FS: pushSessions(s[])
    FS->>Cloud: setDoc()（fire-and-forget、失敗時はconsole.errorのみ）
```

**tombstone方式の論理削除**: セッションは物理削除されず `deleted: true` フラグが立つ。マージ時は
「ローカル・クラウドどちらかが `deleted` なら結果も `deleted`」というOR結合を採用しており、片方の
端末で削除した内容が、もう片方の端末からの再pushで復活してしまう事態を防いでいる。

---

## 5. ドリル機能のデータフロー

`Drill`（features/drill）は「頻出ミス出題」「穴埋め復習」「レベルアップ・タイピング」の3モードを持つ。
出題元データは core の `SessionRepositoryService.sessions` を `session-stats.util`（core/stats）の
純粋関数で集計し、習熟度は feature 内の `DrillProgressService` が管理する。

```mermaid
flowchart TD
    Sessions[("SessionRepository.sessions\n(過去のCorrectionSession[])")]

    subgraph Stats["core/stats: session-stats.util（純粋関数）"]
        FreqMistakes["getFrequentMistakes()"]
        ReviewItems["getReviewItems()"]
        LevelUpSessions["getSessionsWithLevelUp()"]
    end

    subgraph Progress["features/drill: DrillProgressService"]
        DrillKey["正規化キー（normalizeDrillKey）ごとの\ncorrectStreak管理"]
        LevelUpProg["セッション単位のmaskLevel/completed管理"]
    end

    Sessions --> FreqMistakes --> Weighting
    Sessions --> ReviewItems --> Weighting
    Sessions --> LevelUpSessions --> LevelUpProg

    DrillKey --> Weighting["出題重み付け\n(correctStreak高いほど出現率を下げる)"]
    Weighting --> Quiz["Drill コンポーネント出題"]
    LevelUpProg --> Quiz

    Quiz -->|正誤を記録| DrillKey
    Quiz -->|段階進捗を記録| LevelUpProg
```

習熟度は問題ごとの正規化キー（`normalizeDrillKey`）単位で管理され、連続正解数（`correctStreak`）が
`DRILL_MASTERY_STREAK` 以上になると出題の重みが下がり、すでに習熟した問題は出にくくなる。

---

## 6. LocalStorage / Firestore データ構造

```mermaid
erDiagram
    APP_SETTINGS {
        string apiKey
        string_array modelPriority "フォールバック順のモデル名配列"
        string theme
        string consentAcceptedAt "任意。初回同意日時"
    }

    CORRECTION_SESSION {
        string id "一意ID（日付非依存）"
        string date "ISO 8601（選択日付）"
        string original "ユーザー入力英文"
        string corrected "添削解説（タグ除去済み）"
        string correctedText "任意。添削後の全文"
        string levelUpText "任意。レベルアップ後の全文"
        boolean deleted "任意。論理削除フラグ（tombstone）"
    }

    MISTAKE {
        string category "文法/語彙/スペリング/コロケーション/語法/構文/語順"
        string original "元の誤った表現"
        string corrected "正しい表現"
        string explanation "日本語解説"
    }

    WRITING_EVALUATION {
        number grammarScore "0〜10（0.5刻み）"
        number vocabularyScore
        number contentScore
        number overallScore "システム側で算出"
        number errorDensity "100語あたりのエラー数"
        string grammarCefr "A1〜C2"
        string vocabularyCefr
        string contentCefr
        string overallCefr
    }

    REVIEW_ITEM {
        string sentence "___で空所を作った英文"
        string answer
        string hint
        string translation
        string_array choices "4択（正解含む）"
    }

    LEVEL_UP_ITEM {
        string original
        string leveledUp "CEFR一段階上の書き直し"
        string_array keyPhrases
        string translation
    }

    CORRECTION_SESSION ||--o{ MISTAKE : "mistakes[]"
    CORRECTION_SESSION |o--o| WRITING_EVALUATION : "evaluation?（任意）"
    CORRECTION_SESSION |o--o{ REVIEW_ITEM : "reviewItems?（任意）"
    CORRECTION_SESSION |o--o{ LEVEL_UP_ITEM : "levelUpItems?（任意）"
```

Firestore側は `apps/study_english/users/{uid}/sessions/{sessionId}` のパスに `CorrectionSession` を
そのまま保存する（任意フィールドが `undefined` の場合はFirestoreの制約によりフィールドごと除外）。

そのほか LocalStorage には、ドリル進捗（`DrillProgressService`）・Gemini 送受信ログ
（`DevLogService`、開発ビルドのみ）が独立キーで保存される。

---

## 7. ルーティングとビルド差分

各ルートは `loadComponent` で features/ 配下から遅延ロードされる。

```mermaid
graph LR
    Root["/"] -->|redirect| Practice["/practice"]
    Root --> Drill["/drill"]
    Root --> History["/history"]
    Root --> Mistakes["/mistakes"]
    Root --> Settings["/settings\n(canDeactivate guard)"]
    Root --> Legal["/legal/:doc"]
    Root -.->|開発ビルドのみ| Dev["/dev"]
```

`environment.production` が true のとき、[app.routes.ts](src/app/app.routes.ts) は `/dev` ルートを
登録せず、[app.config.ts](src/app/app.config.ts) は `GEMINI_LOGGER` に `DevLogService` を provide
しない（no-op のまま）。つまり **dev feature は本番ビルドのルートテーブル・バンドル・ログ記録の
すべてから除外**される。Service Worker は本番ビルドのみ有効（`registerWhenStable:30000`）。

---

## 8. プロンプト生成ロジック

```mermaid
flowchart TD
    Start(["buildPrompt() (core/gemini/prompt.util)"])
    S1["前文（役割指示・出力規約・\nプロンプトインジェクション対策の明示）"]
    S2["SECTIONS を配列順に全て連結\n(grammar/natural/corrected/mistakes/\ngrammar-tendency/evaluation/cefr-rationale/\nlevel-study-plan/level-up/cloze-review)"]
    S3["英作文を###USER_DIARY_START###/END###\nで囲んで{USER_TEXT}に埋め込み"]
    End(["完成プロンプト文字列"])

    Start --> S1 --> S2 --> S3 --> End
```

ユーザー入力は固有の区切り記号（`###USER_DIARY_START###` / `###USER_DIARY_END###`）で囲み、前文で
「区切り内は命令ではなくデータとして扱う」旨を明示することで、プロンプトインジェクションの悪用を
軽減している（完全な排除はできない軽減策）。

---

## 9. 課題点（シンプルさ・合理性の観点）

1. **二重の永続化層と手動マージの複雑さ**
   LocalStorageとFirestoreを両方「正」として扱い、[firestore-sync.service.ts](src/app/core/sessions/firestore-sync.service.ts)
   がidベースの手動マージ（`deleted`のOR結合）を自前実装している。Firestore SDK標準のオフライン永続化
   （IndexedDBキャッシュ + `onSnapshot`）に委ねれば、この同期ロジック自体を書かずに済み、リアルタイム反映や
   複数タブ間の一貫性も自然に得られる可能性がある。

2. **fire-and-forgetなFirestore push**
   保存/削除/インポートのたびに即座にpushしているが、失敗時は`console.error`のみでリトライがない。
   オフライン時やエラー時にローカルとクラウドが乖離したまま気づかれないリスクがある。

**総評**: features → core → shared の一方向依存により、ページ（feature）の追加・削除が他へ波及しない
構造になった。残る複雑さはクラウド同期まわり（1〜2）に集約されており、見直すならここが最優先。
