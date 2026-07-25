/**
 * @file 選択可能な Gemini モデルの一覧（ID + 表示ラベル）。
 * settings-store.service.ts（デフォルト優先順位）と settings.ts（設定UIの選択肢）の
 * 両方から参照される唯一の定義元。モデルの追加・削除はここだけを変更すればよい。
 */

export interface GeminiModelOption {
  value: string; // Gemini API に渡すモデルID
  label: string; // 設定画面に表示する日本語ラベル
}

// ── 選択可能なモデル一覧（表示順 = デフォルトの優先順位） ──────────────
export const GEMINI_MODELS: GeminiModelOption[] = [
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
];

export const DEFAULT_MODEL_PRIORITY: string[] = GEMINI_MODELS.map((m) => m.value);

/**
 * モデルIDを人間可読ラベルに変換する（practice / history の結果表示で共用）。
 * GEMINI_MODELS に見つからない場合（廃止モデルで添削した過去セッション等）は生のモデルIDを返す。
 */
export function modelLabel(modelId: string): string {
  return GEMINI_MODELS.find((m) => m.value === modelId)?.label ?? modelId;
}
