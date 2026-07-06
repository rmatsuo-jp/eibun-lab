/**
 * @file Gemini レスポンスの `<tag>...</tag>` ブロックを抽出する共通ヘルパー。
 * 構造化データ用の extractTaggedJson（タグ抽出 → コードフェンス除去 → JSON.parse → 型検証）と、
 * 自由記述の英文・Markdown用の extractTaggedText（タグ抽出のみ、JSON化しない）の2種類を提供する。
 * 新しいタグ付き項目を追加する場合も、対応する関数を呼ぶだけでよい。
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

// ── タグ抽出のみ（JSON化しない自由記述の英文・Markdown用） ────────────
export function extractTaggedText(
  text: string,
  tag: string,
  onError?: (stage: 'no-tag', detail: unknown) => void
): string | undefined {
  const match = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!match) {
    onError?.('no-tag', `<${tag}> タグが見つかりません`);
    return undefined;
  }
  return match[1].trim();
}
