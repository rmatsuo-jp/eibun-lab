/**
 * @file アプリ全体で使うドメイン型定義。Mistake（1件のミス情報）・CefrEvaluation（CEFR評価）・
 * ReviewItem（穴埋め復習カード）と CorrectionSession（1回の添削セッション）を定義する。
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

// ── CefrEvaluation: CEFR の3観点レベル（CEFR推移トラッキングで使用） ─
export interface CefrEvaluation {
  grammar: string;     // 例 "B1"
  vocabulary: string;
  content: string;
}

// ── CorrectionSession: 1回の添削セッション（LocalStorage に保存される単位） ─
export interface CorrectionSession {
  id: string;
  date: string;
  original: string;
  corrected: string;
  mistakes: Mistake[];
  cefr?: CefrEvaluation;   // 任意。CEFR評価が有効なセッションのみ持つ（後方互換）
  reviewItems?: ReviewItem[]; // 任意。復習カード生成が有効なセッションのみ持つ（後方互換）
  deleted?: boolean;       // 論理削除フラグ。true は表示・集計から除外し、クラウドにも tombstone として残す（削除の多端末同期用）
}
