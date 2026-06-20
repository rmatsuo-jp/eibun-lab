/**
 * @file アプリ全体で使うドメイン型定義。Mistake（1件のミス情報）・CefrEvaluation（CEFR評価）と
 * CorrectionSession（1回の添削セッション）を定義する。
 */

// ── Mistake: Gemini が返す1件のミス情報 ─────────────────────────
export interface Mistake {
  category: string;
  original: string;
  corrected: string;
  explanation: string;
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
}
