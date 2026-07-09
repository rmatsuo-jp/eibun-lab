/**
 * @file Gemini のセーフティフィルタで入力がブロックされた場合の専用エラー。
 * gemini.service.ts（送出側）と gemini-error.util.ts（判別側）の双方から参照されるため、
 * サービス本体とは独立したファイルに置く。ここに Gemini SDK や Angular への依存を持ち込まないこと
 * （純粋関数の util がサービス経由で SDK を巻き込むのを避けるため）。
 */

// モデル起因の障害ではないため、GeminiService.correct() のモデルフォールバックを中断する判定に使う。
export class GeminiBlockedError extends Error {
  constructor(blockReason: string) {
    super(
      `入力内容が Gemini のコンテンツポリシーによりブロックされました（理由: ${blockReason}）。` +
        '表現を変えて再度お試しください。'
    );
    this.name = 'GeminiBlockedError';
  }
}
