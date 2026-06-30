# ARCHITECTURE.md — Study English アーキテクチャ図

## アプリ全体構成

```mermaid
graph TD
    User["ユーザー (英語学習者)"]

    subgraph Browser["ブラウザ"]
        subgraph PWA["Angular 22 PWA"]
            App["AppComponent\nボトムナビ + router-outlet"]

            subgraph Pages["ページ（遅延ロード）"]
                Practice["PracticeComponent\n英文入力・添削結果表示"]
                Drill["DrillComponent\n弱点克服ドリル（頻出ミス出題）"]
                History["HistoryComponent\n履歴一覧・検索・インポート/エクスポート"]
                Mistakes["MistakesComponent\n学習統計・ミス傾向・CEFR推移"]
                Settings["SettingsComponent\nAPIキー・モデル・機能設定・テーマ"]
            end

            subgraph Services["サービス（providedIn: root）"]
                GeminiSvc["GeminiService\ncorrect() / parseMistakes() / parseEvaluation()"]
                StorageSvc["StorageService\nセッション CRUD / 設定管理\n統計集計(streak/スコア・CEFR推移) / インポート・エクスポート"]
                BuildPrompt["buildPrompt()\nプロンプト動的生成（純粋関数）"]
            end

            LocalStorage[("LocalStorage\ncorrection_sessions\napp_settings")]
            SW["Service Worker\n(ngsw)"]
        end
    end

    GeminiAPI["Google Gemini API\n(generateContent)"]

    User -->|英文入力| Practice
    Practice -->|correct| GeminiSvc
    GeminiSvc -->|buildPrompt + userText| GeminiAPI
    GeminiAPI -->|Markdown + mistakes/cefr JSON| GeminiSvc
    GeminiSvc -->|CorrectionResult| Practice
    Practice -->|saveSession| StorageSvc
    StorageSvc -->|JSON| LocalStorage
    LocalStorage -->|JSON| StorageSvc
    StorageSvc -->|sessions / 検索フィルタ| History
    StorageSvc -->|getFrequentMistakes| Drill
    StorageSvc -->|getStudyStats / getMistakeStats / getEvaluationHistory| Mistakes
    StorageSvc -->|getSettings / saveSettings| Settings
    BuildPrompt -.->|使用| Practice
    SW -->|オフラインキャッシュ| PWA
```

---

## データフロー（添削シーケンス）

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant P as PracticeComponent
    participant G as GeminiService
    participant S as StorageService
    participant API as Gemini API
    participant LS as LocalStorage

    User->>P: 英文を入力して送信
    P->>S: getSettings()
    S-->>P: AppSettings（apiKey, model, theme）
    P->>P: buildPrompt() で完全プロンプト生成
    P->>G: correct(apiKey, model, prompt, userText)
    G->>API: generateContent(fullPrompt)
    API-->>G: テキスト（Markdown + <mistakes>/<evaluation> JSON）
    G->>G: parseMistakes() / parseEvaluation() で JSON 抽出
    G-->>P: CorrectionResult { corrected, mistakes, evaluation? }
    P->>S: saveSession(CorrectionSession)
    S->>LS: JSON.stringify して保存
    P-->>User: 添削結果を表示
```

---

## LocalStorage データ構造

```mermaid
erDiagram
    APP_SETTINGS {
        string apiKey
        string model
        string theme
    }

    CORRECTION_SESSION {
        string id "一意ID（日付非依存）"
        string date "ISO 8601（選択日付）"
        string original "ユーザー入力英文"
        string corrected "Gemini 添削済み Markdown"
    }

    MISTAKE {
        string category "例: 文法 / 語彙"
        string original "元の誤った表現"
        string corrected "正しい表現"
        string explanation "日本語解説"
    }

    CEFR_EVALUATION {
        string grammar "文法面 (A1〜C2)"
        string vocabulary "語彙面 (A1〜C2)"
        string content "内容面 (A1〜C2)"
    }

    CORRECTION_SESSION ||--o{ MISTAKE : "mistakes[]"
    CORRECTION_SESSION |o--o| CEFR_EVALUATION : "cefr?（任意）"
```

---

## ルーティング

```mermaid
graph LR
    Root["/"] -->|redirect| Practice["/practice\nPracticeComponent"]
    Root --> Drill["/drill\nDrillComponent"]
    Root --> History["/history\nHistoryComponent"]
    Root --> Mistakes["/mistakes\nMistakesComponent"]
    Root --> Settings["/settings\nSettingsComponent"]
```

---

## プロンプト生成ロジック

```mermaid
flowchart TD
    Start(["buildPrompt()"])
    S1["前文（役割指示・固定）"]
    S2["SECTIONS を配列順に全て連結\n（文法ミス指摘 / 自然な表現 / 添削後全文 / mistakes JSON /\n 文法傾向 / 定量評価＋evaluation JSON / レベルアップ / 復習カード＋review JSON）"]
    S4["英作文: {USER_TEXT}（固定）"]
    End(["完成プロンプト文字列"])

    Start --> S1 --> S2 --> S4 --> End
```
