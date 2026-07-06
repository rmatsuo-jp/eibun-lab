/**
 * @file Gemini 呼び出しログの依存逆転用 InjectionToken。
 * core（GeminiService）が features/dev の DevLogService を直接 import すると core→features の
 * 逆依存になるため、ここでロガーのインターフェースとトークンだけを定義し、実装は
 * features/dev/dev-log.service.ts が担う（app.config.ts で開発ビルド時のみ provide）。
 * デフォルトは no-op（本番ビルドでは何も記録しない）。
 */
import { InjectionToken } from '@angular/core';
import type { CorrectionResult } from '@core/gemini/gemini.service';

// GeminiService が1回の呼び出しごとに記録する内容（id/timestamp はロガー実装側で付与する）
export interface GeminiLogRecord {
  model: string;        // 実際に応答したモデル（フォールバック後の値）
  fullPrompt: string;   // {USER_TEXT} 置換後の送信プロンプト全文
  userText: string;
  rawResponse: string;  // Gemini の生レスポンステキスト（タグ除去前）
  parsed: CorrectionResult;
  parseWarnings?: string[]; // レスポンス解析（<mistakes>等のタグ）が失敗した項目のログ（正常時は空）
}

export interface GeminiLogger {
  record(entry: GeminiLogRecord): void;
}

export const GEMINI_LOGGER = new InjectionToken<GeminiLogger>('GEMINI_LOGGER', {
  factory: () => ({ record: () => {} }),
});
