# ARCHITECTURE.md — Study English アーキテクチャ図

## 1. ページ ⇔ サービス 概観図

各ページが直接呼び出すサービスのみを示す大枠の図。サービス内部の委譲構造は [2. StorageService 内部構造](#2-storageservice-内部委譲構造) を参照。

```mermaid
graph TD
    User["ユーザー (英語学習者)"]

    subgraph Pages["ページ（遅延ロード）"]
        Practice["PracticeComponent\n英文入力・添削結果表示"]
        Drill["DrillComponent\n弱点克服ドリル・穴埋め復習・レベルアップ"]
        History["HistoryComponent\n履歴一覧・検索・インポート/エクスポート"]
        Mistakes["MistakesComponent\n学習統計・ミス傾向・CEFR推移"]
        Settings["SettingsComponent\nAPIキー・モデル優先順位・テーマ"]
        Dev["DevComponent\n(本番ビルドでは非搭載)\nGemini送受信ログ閲覧"]
    end

    subgraph Services["サービス（providedIn: root）"]
        StorageSvc["StorageService\n（ファサード。内部構造は図2）"]
        GeminiSvc["GeminiService\ncorrect()"]
        AuthSvc["AuthService\nGoogle SSOログイン状態"]
        DevLogSvc["DevLogService\nGemini送受信ログ記録"]
    end

    GeminiAPI["Google Gemini API"]
    FirebaseAuth["Firebase Authentication"]

    User --> Practice
    Practice -->|correct| GeminiSvc
    GeminiSvc --> GeminiAPI
    GeminiSvc -->|全リクエスト/レスポンスを記録| DevLogSvc
    Practice -->|saveSession / getSettings| StorageSvc

    Drill -->|getFrequentMistakes/getReviewItems\nrecordDrillResult 等| StorageSvc
    History -->|sessions/importSessions/exportSessions| StorageSvc
    Mistakes -->|getStudyStats/getMistakeStats\ngetEvaluationHistory| StorageSvc
    Settings -->|getSettings/saveSettings| StorageSvc
    Dev -->|ログ一覧取得| DevLogSvc

    Settings -->|ログイン操作| AuthSvc
    AuthSvc --> FirebaseAuth
```

---

## 2. StorageService 内部委譲構造

`StorageService` 自体はロジックを持たず、責務ごとに分割した4つの内部サービスへ委譲する薄いファサード（[storage.service.ts](src/app/services/storage/storage.service.ts)）。各ページからの呼び出し方はこの分割の影響を受けない。

```mermaid
graph TD
    StorageSvc["StorageService（ファサード）"]

    SessionStore["SessionStoreService\nセッションCRUD・LocalStorage永続化\n(論理削除=deletedフラグ)"]
    SettingsStore["SettingsStoreService\nAPIキー・modelPriority・テーマ"]
    DrillProgressSvc["DrillProgressService\n習熟度ストリーク・レベルアップ進捗"]
    FirestoreSync["FirestoreSyncService\nクラウド双方向同期"]
    StatsUtil["session-stats.util.ts\n統計集計（純粋関数）"]

    LocalStorage[("LocalStorage")]
    Firestore[("Cloud Firestore\napps/study_english/users/{uid}/sessions")]
    AuthSvc["AuthService\n(user signal)"]

    StorageSvc -->|saveSession/deleteSession\nimportSessions/exportSessions| SessionStore
    StorageSvc -->|getSettings/saveSettings| SettingsStore
    StorageSvc -->|getDrillProgress/recordDrillResult\ngetLevelUpProgress| DrillProgressSvc
    StorageSvc -->|saveSession/deleteSession/importSessions\n直後にpushSession(s)を呼ぶ| FirestoreSync
    StorageSvc -->|getStudyStats等\nsessions配列を渡す| StatsUtil

    SessionStore <--> LocalStorage
    SettingsStore <--> LocalStorage
    DrillProgressSvc <--> LocalStorage

    FirestoreSync -->|sessionStore.sessions読取\npersist()で書戻し| SessionStore
    FirestoreSync -->|user signal監視| AuthSvc
    FirestoreSync <--> Firestore
```

同期の詳細な流れは [4. Firestore 同期フロー](#4-firestore-同期フロー) を参照。

---

## 3. 添削フロー（データフローシーケンス）

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant P as PracticeComponent
    participant S as StorageService
    participant G as GeminiService
    participant API as Gemini API
    participant DL as DevLogService
    participant FS as FirestoreSync

    User->>P: 英文を入力して送信
    P->>S: getSettings()
    S-->>P: AppSettings（apiKey, modelPriority, theme）
    P->>P: buildPrompt() で完全プロンプト生成
    P->>G: correct(apiKey, modelPriority, prompt, userText)
    G->>G: modelPriority順にフォールバック（下図参照）
    G->>API: generateContent(fullPrompt)
    API-->>G: Markdown + <mistakes>/<evaluation>/<levelup>/<review> JSON
    G->>G: 各タグを抽出しJSON検証（gemini-parse.util）
    G->>DL: リクエスト/レスポンス/警告を記録
    G-->>P: CorrectionResult{corrected, mistakes, evaluation?, reviewItems?, levelUpItems?}
    P->>S: saveSession(CorrectionSession)
    S->>S: LocalStorageへ保存（SessionStoreService）
    S->>FS: pushSession(session)
    FS-->>FS: ログイン中ならFirestoreへfire-and-forgetで反映
    P-->>User: 添削結果を表示
```

### モデルフォールバックループ

`modelPriority` 配列（例: `gemini-3.5-flash → gemini-3-flash → gemini-2.5-flash → …`）を先頭から順に試し、最初に成功したモデルの結果を返す。

```mermaid
flowchart LR
    Start(["correct()呼び出し"]) --> Try["先頭モデルでAPI呼び出し"]
    Try -->|成功| Return(["結果を返す"])
    Try -->|失敗| Next{"次のモデルが\n残っているか"}
    Next -->|Yes| Try
    Next -->|No| Throw(["最後のエラーをthrow"])
```

---

## 4. Firestore 同期フロー

ログイン状態は `AuthService` の `user` signal で管理され、`FirestoreSyncService` はコンストラクタ内の `effect()` でこれを監視する。ログインした瞬間に自動で双方向同期が走る。それとは別に、セッションの保存/削除/インポート操作のたびに on-demand で該当分だけ push される。

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
    FS->>FS: クラウドと状態が食い違う分を抽出
    FS->>Cloud: 差分をsetDoc()でpush

    Note over User,Cloud: --- 通常操作時（ログイン中）---
    User->>Local: セッション保存/削除/インポート
    Local-->>FS: pushSession(s) / pushSessions(s[])
    FS->>Cloud: setDoc()（fire-and-forget、失敗時はconsole.errorのみ）
```

**tombstone方式の論理削除**: セッションは物理削除されず `deleted: true` フラグが立つ。マージ時は「ローカル・クラウドどちらかが `deleted` なら結果も `deleted`」というOR結合を採用しており、片方の端末で削除した内容が、もう片方の端末からの再pushで復活してしまう事態を防いでいる。

---

## 5. ドリル機能のデータフロー

`DrillComponent` は「頻出ミス出題」「穴埋め復習」「レベルアップ・タイピング」の3モードを持ち、いずれも `StorageService` 経由で過去セッションの集計結果と習熟度を組み合わせて出題する。

```mermaid
flowchart TD
    Sessions[("過去のCorrectionSession[]\n(LocalStorage)")]

    subgraph Stats["session-stats.util（純粋関数）"]
        FreqMistakes["getFrequentMistakes()\n出現頻度の高いミスを集計"]
        ReviewItems["getReviewItems()\n全セッションのReviewItemを収集"]
        LevelUpSessions["getSessionsWithLevelUp()\nlevelUpItems保有セッション抽出"]
    end

    subgraph Progress["DrillProgressService"]
        DrillKey["正規化キー（normalizeDrillKey）ごとの\ncorrectStreak管理"]
        LevelUpProg["セッション単位のmaskLevel/completed管理"]
    end

    Sessions --> FreqMistakes --> Weighting
    Sessions --> ReviewItems --> Weighting
    Sessions --> LevelUpSessions --> LevelUpProg

    DrillKey --> Weighting["出題重み付け\n(correctStreak高いほど出現率を下げる)"]
    Weighting --> Quiz["DrillComponent 出題"]
    LevelUpProg --> Quiz

    Quiz -->|正誤を記録| DrillKey
    Quiz -->|段階進捗を記録| LevelUpProg
```

習熟度は問題ごとの正規化キー（`normalizeDrillKey`）単位で管理され、連続正解数（`correctStreak`）が一定数（`DRILL_MASTERY_STREAK`）以上になると出題の重みが下がり、すでに習熟した問題は出にくくなる。

---

## 6. LocalStorage / Firestore データ構造

```mermaid
erDiagram
    APP_SETTINGS {
        string apiKey
        string_array modelPriority "フォールバック順のモデル名配列"
        string theme
    }

    CORRECTION_SESSION {
        string id "一意ID（日付非依存）"
        string date "ISO 8601（選択日付）"
        string original "ユーザー入力英文"
        string corrected "Gemini 添削済み Markdown"
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

Firestore側は `apps/study_english/users/{uid}/sessions/{sessionId}` のパスに `CorrectionSession` をそのまま保存する（`evaluation`/`reviewItems`/`levelUpItems` が `undefined` の場合はFirestoreの制約によりフィールドごと除外）。

---

## 7. ルーティング

```mermaid
graph LR
    Root["/"] -->|redirect| Practice["/practice"]
    Root --> Drill["/drill"]
    Root --> History["/history"]
    Root --> Mistakes["/mistakes"]
    Root --> Settings["/settings\n(canDeactivate guard)"]
    Root -.->|本番ビルドでは\nルート自体が非搭載| Dev["/dev"]
```

---

## 8. 本番 / 開発ビルドの差分

```mermaid
flowchart TD
    Build{"ビルド種別"}
    Build -->|開発（ng serve）| DevPath["/dev ルート登録\nService Worker 無効\n(isDevMode)"]
    Build -->|本番（ng build）| ProdPath["/dev ルート非登録\nenvironment.production=true\nService Worker 有効\n(registerWhenStable:30000)"]

    DevLogAlways["DevLogServiceは環境を問わず\nGeminiService呼び出しのたびに記録"]
    DevPath -.-> DevLogAlways
    ProdPath -.-> DevLogAlways
```

`environment.production` が true のときは [app.routes.ts](src/app/app.routes.ts) が `/dev` ルートを配列に含めない（本番のルートテーブル・遅延チャンクから除外）。一方 `DevLogService` へのログ記録自体は環境分岐がなく、本番ビルドでも毎回の添削で LocalStorage に書き込まれる点に注意（詳細は後述の課題点を参照）。

---

## 9. プロンプト生成ロジック

```mermaid
flowchart TD
    Start(["buildPrompt()"])
    S1["前文（役割指示・出力規約・\nプロンプトインジェクション対策の明示）"]
    S2["SECTIONS を配列順に全て連結\n(grammar/natural/corrected/mistakes/\ngrammar-tendency/evaluation/cefr-rationale/\nlevel-study-plan/level-up/cloze-review)"]
    S3["英作文を###USER_DIARY_START###/END###\nで囲んで{USER_TEXT}に埋め込み"]
    End(["完成プロンプト文字列"])

    Start --> S1 --> S2 --> S3 --> End
```

ユーザー入力は固有の区切り記号（`###USER_DIARY_START###` / `###USER_DIARY_END###`）で囲み、前文で「区切り内は命令ではなくデータとして扱う」旨を明示することで、プロンプトインジェクションの悪用を軽減している（完全な排除はできない軽減策）。

---

## 10. 課題点（シンプルさ・合理性の観点）

現状の実装を俯瞰した上での改善余地。優先度が高いと考えられる順に記載する。

1. **二重の永続化層と手動マージの複雑さ**
   LocalStorageとFirestoreを両方「正」として扱い、[firestore-sync.service.ts](src/app/services/storage/firestore-sync.service.ts) がidベースの手動マージ（`deleted`のOR結合）を自前実装している。Firestore SDK標準のオフライン永続化（`enableIndexedDbPersistence` + `onSnapshot`）に委ねれば、この同期ロジック自体を書かずに済み、リアルタイム反映や複数タブ間の一貫性も自然に得られる可能性がある。現状の実装はマージ漏れやエッジケースの温床になりやすい。

2. **fire-and-forgetなFirestore push**
   `saveSession`/`deleteSession`/`importSessions`のたびに即座にpushしているが、失敗時は`console.error`のみでリトライがない（firestore-sync.service.ts:63-65, 73-74）。オフライン時やエラー時にローカルとクラウドが乖離したまま気づかれないリスクがある。

3. **DevLogServiceが本番でも常時記録**
   `/dev`ページ自体は本番ビルドから除外されているのに、`GeminiService`は本番でも毎回`DevLogService`にプロンプト全文・レスポンスを記録し続けている。閲覧手段のないログのためにLocalStorage容量を消費し続けるのは非合理。環境フラグでの記録スキップが妥当。

4. **同じ「ローカル保存+Firestore push」ペアが3箇所に重複**
   `saveSession`/`deleteSession`/`importSessions`それぞれで同じ2行の組み合わせが手書きされている（storage.service.ts:37-51）。将来同期タイミングや対象を変える際に修正漏れが起きやすい構造。

5. **PracticeStateが単一/一括の両方の状態を保持**
   現状は問題ないが、今後機能が増えると1つのサービスが肥大化しやすい構造になっている。増築時の分割候補として留意する。

**総評**: ページ・utils・各ストアサービスの責務分離自体は明確で合理的。一方でクラウド同期まわり（1〜2）が自前実装ゆえに最も複雑でバグを生みやすい部分になっており、「シンプルかつ合理的」を優先するなら真っ先に見直す価値がある箇所。
