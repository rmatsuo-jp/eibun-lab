/**
 * @file アプリ全体で使うドメイン型定義。Mistake（1件のミス情報）・WritingEvaluation（定量評価＝スコア＋CEFR）・
 * ReviewItem（穴埋め復習カード）・DrillProgress（ドリルの習熟度）と CorrectionSession（1回の添削セッション）を定義する。
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

// ── DrillProgress: ドリルの1問（ミス or 復習カード）ごとの習熟度 ─────
// key（正規化した original、または sentence+answer）ごとに StorageService が保持する。
// correctStreak が一定数以上になると出題の重みを下げ、既に習熟した問題の再出題頻度を減らす。
export interface DrillProgress {
  correctStreak: number;  // 連続正解数
  lastAttemptAt: string;  // 直近に解答した日時（ISO 8601）
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
export interface CorrectionSession {
  id: string;
  date: string;
  original: string;
  corrected: string;
  mistakes: Mistake[];
  evaluation?: WritingEvaluation; // 任意。定量評価が有効なセッションのみ持つ
  reviewItems?: ReviewItem[]; // 任意。復習カード生成が有効なセッションのみ持つ（後方互換）
  deleted?: boolean;       // 論理削除フラグ。true は表示・集計から除外し、クラウドにも tombstone として残す（削除の多端末同期用）
}
