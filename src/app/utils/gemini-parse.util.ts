/**
 * @file Gemini レスポンスの `<tag>...</tag>` ブロックから JSON を抽出する共通ヘルパー。
 * gemini.service.ts の parseMistakes/parseEvaluation/parseLevelUp/parseReview が個別に持っていた
 * 「タグ抽出 → コードフェンス除去 → JSON.parse → 型検証」を1関数に集約し、失敗理由を onError で通知できるようにする。
 * 新しいタグ付きJSON項目を追加する場合も、validate関数を1つ書いて extractTaggedJson を呼ぶだけでよい。
 */

export type ParseFailureStage = 'no-tag' | 'json-parse' | 'validation';

// ── タグ抽出＋JSON検証の共通処理 ────────────────────────────────────
export function extractTaggedJson<T>(
  text: string,
  tag: string,
  validate: (json: unknown) => T | undefined,
  onError?: (stage: ParseFailureStage, detail: unknown) => void
): T | undefined {
  const match = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!match) {
    onError?.('no-tag', `<${tag}> タグが見つかりません`);
    return undefined;
  }

  // コードフェンス等が混じっても最初の {...} ブロックだけを取り出す（軽い正規化）
  const cleaned = match[1].replace(/```[a-z]*/gi, '').trim();
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!objMatch) {
    onError?.('json-parse', `<${tag}> 内に JSON オブジェクトが見つかりません`);
    return undefined;
  }

  let json: unknown;
  try {
    json = JSON.parse(objMatch[0]);
  } catch (e) {
    onError?.('json-parse', e);
    return undefined;
  }

  const result = validate(json);
  if (result === undefined) {
    onError?.('validation', `<${tag}> の内容がスキーマを満たしません`);
  }
  return result;
}
