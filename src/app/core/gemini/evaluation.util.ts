/**
 * @file 定量評価（WritingEvaluation）の算出を担う純粋関数群。
 * 総合スコア（3観点平均）はコードで機械的に算出する。CEFRは実際の基準に沿った厳密判定を得るため
 * AI の出力値を正として採用し、AIがCEFRを欠落/不正出力した場合のみ scoreToCefr でフォールバックする。
 */
import { WritingEvaluation } from '@core/models/session.model';

// ── スコア→CEFR 変換（フォールバック専用） ────────────────────────
// AIがCEFRを欠落/不正出力した場合のみ使用する。通常はAIの判定値を採用する。
// 帯域は prompt.util.ts の採点基準（例: Grammar [8-7]=B2）と整合させること。
// 「実際のレベルより高く見積もらない」というプロンプト指示に合わせて保守的に判定し、
// C2 は機械換算では出さない（C2 は AI の実判定のみが付与できる）。
// 対応（0〜10スコア）: 9.0以上=C1, 7.0以上=B2, 5.0以上=B1, 3.5以上=A2, それ未満=A1。
export function scoreToCefr(score: number): string {
  if (score >= 9.0) return 'C1';
  if (score >= 7.0) return 'B2';
  if (score >= 5.0) return 'B1';
  if (score >= 3.5) return 'A2';
  return 'A1';
}

// ── 総合スコア算出（3観点平均を0.5刻みに丸め、0〜10にクランプ） ──────
export function computeOverallScore(grammar: number, vocabulary: number, content: number): number {
  const avg = (grammar + vocabulary + content) / 3;
  const rounded = Math.round(avg * 2) / 2;
  return Math.max(0, Math.min(10, rounded));
}

// ── AI出力データから完全な WritingEvaluation を構築 ─────────────────
// 総合スコアは常にコードで算出。CEFR4項目は引数で与えられればAI判定値を採用し、
// 無ければ（undefined）該当スコアから scoreToCefr でフォールバックする。
export interface EvaluationInput {
  grammarScore: number;
  vocabularyScore: number;
  contentScore: number;
  errorDensity: number;
  grammarCefr?: string;
  vocabularyCefr?: string;
  contentCefr?: string;
  overallCefr?: string;
}

export function buildEvaluation(input: EvaluationInput): WritingEvaluation {
  const overallScore = computeOverallScore(input.grammarScore, input.vocabularyScore, input.contentScore);
  return {
    grammarScore: input.grammarScore,
    vocabularyScore: input.vocabularyScore,
    contentScore: input.contentScore,
    overallScore,
    errorDensity: input.errorDensity,
    grammarCefr: input.grammarCefr ?? scoreToCefr(input.grammarScore),
    vocabularyCefr: input.vocabularyCefr ?? scoreToCefr(input.vocabularyScore),
    contentCefr: input.contentCefr ?? scoreToCefr(input.contentScore),
    overallCefr: input.overallCefr ?? scoreToCefr(overallScore),
  };
}
