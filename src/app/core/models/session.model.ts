/**
 * @file アプリ全体で使うドメイン型定義。Mistake（1件のミス情報）・WritingEvaluation（定量評価＝スコア＋CEFR）・
 * ReviewItem（穴埋め復習カード）・LevelUpItem（レベルアップ例文タイピング用、1文単位）・
 * DrillProgress（ドリルの習熟度）・LevelUpItemProgress（レベルアップ・タイピングのマスク段階進捗）と
 * CorrectionSession（1回の添削セッション。corrected=添削解説プローズ、correctedText=添削後の全文、
 * levelUpText=レベルアップ後の全文）を定義する。
 */

// ── Mistake: Gemini が返す1件のミス情報 ─────────────────────────
export interface Mistake {
  category: string;
  original: string;
  corrected: string;
  explanation: string;
}

// ── ReviewItem: Gemini が返す穴埋め（クローズ）復習カード 1 件 ─────
// Drill ページの「穴埋め復習」モードで出題する。既定は answer をタイピング入力、
// ヒント押下時は choices（正解含む4択）に切り替えて出題する。
export interface ReviewItem {
  sentence: string;    // ___（半角アンダースコア3つ）で空所を作った英文
  answer: string;      // 空所に入る正解の語/句
  hint: string;        // 日本語ヒント
  translation: string; // 英文の日本語訳
  choices: string[];   // 4択（正解を1つ含む）
}

// ── LevelUpItem: Gemini が返す「CEFR一段階上のレベルアップ」1文分の例文 ─────
// Drill ページの「レベルアップ・タイピング」モードで、見て打つ→穴埋めで打つ→何も見ずに打つ、の
// 3段階タイピング練習に使う。keyPhrases は leveledUp 内に実際に出現する部分文字列でなければならず、
// 穴埋め表示（stage 2）は単純な文字列置換で行う。
export interface LevelUpItem {
  original: string;     // 元の（レベルアップ前の）1文
  leveledUp: string;    // CEFR一段階上のレベルで書き直した1文
  keyPhrases: string[]; // leveledUp 内に出現する、穴埋め対象のコロケーション・構文の完全一致部分文字列
  translation: string;  // leveledUp の日本語訳（stage 3 のヒントに使用）
}

// ── DrillProgress: ドリルの1問（ミス or 復習カード）ごとの習熟度 ─────
// key（正規化した original、または sentence+answer）ごとに DrillProgressService が保持する。
// correctStreak が一定数以上になると出題の重みを下げ、既に習熟した問題の再出題頻度を減らす。
export interface DrillProgress {
  correctStreak: number;  // 連続正解数
  lastAttemptAt: string;  // 直近に解答した日時（ISO 8601）
}

// ── LevelUpItemProgress: レベルアップ・タイピング1文分の進捗 ─────
// セッション（日付）単位でまとめて保持し、途中再開・完了判定に使う。
// maskLevel: 現在のマスク段階（0=全文表示 〜 maxLevel=全単語マスク）。completed: maxLevelで正解済みか。
export interface LevelUpItemProgress {
  maskLevel: number;
  completed: boolean;
}

// ── WritingEvaluation: 1回の添削の定量評価（スコア＋暫定CEFR） ─────
// スコアは各10点満点（0.5刻み）。errorDensity は 100語あたりのエラー数。
// xxxCefr は各スコアに対応する暫定CEFR（A1〜C2）。推移グラフ（スコア／CEFR）で使用する。
export interface WritingEvaluation {
  grammarScore: number;      // 文法 0〜10
  vocabularyScore: number;   // 語彙 0〜10
  contentScore: number;      // 内容 0〜10
  overallScore: number;      // 総合平均 0〜10
  errorDensity: number;      // 100語あたりのエラー数
  grammarCefr: string;       // 文法の暫定CEFR
  vocabularyCefr: string;    // 語彙の暫定CEFR
  contentCefr: string;       // 内容の暫定CEFR
  overallCefr: string;       // 総合の暫定CEFR
}

// ── CorrectionSession: 1回の添削セッション（LocalStorage に保存される単位） ─
// ⚠ optional フィールド（?付き）を追加したら firestore-sync.service.ts の OPTIONAL_FIELDS にも必ず追加すること。
//   Firestore は undefined を受け付けないため、同期時に undefined のフィールドを除外する必要がある。
export interface CorrectionSession {
  id: string;
  date: string;
  original: string;
  corrected: string; // 添削解説プローズ（文法解説・自然な表現の提案・傾向・CEFR根拠・学習法など）
  correctedText?: string; // 任意。添削後の完成版の全文（corrected＝解説文とは別に、修正後の英文そのもの。後方互換）
  mistakes: Mistake[];
  evaluation?: WritingEvaluation; // 任意。定量評価が有効なセッションのみ持つ
  reviewItems?: ReviewItem[]; // 任意。復習カード生成が有効なセッションのみ持つ（後方互換）
  levelUpItems?: LevelUpItem[]; // 任意。レベルアップ例文タイピング用（1文単位、Drill専用。後方互換）
  levelUpText?: string; // 任意。レベルアップ後の全文（levelUpItemsとは別に、日記全体を通した1本の文章。後方互換）
  deleted?: boolean;       // 論理削除フラグ。true は表示・集計から除外し、クラウドにも tombstone として残す（削除の多端末同期用）
}
