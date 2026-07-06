/**
 * @file Gemini レスポンスの `<tag>...</tag>` ブロックを抽出する共通ヘルパー。
 * 構造化データ用の extractTaggedJson（タグ抽出 → コードフェンス除去 → JSON.parse → 型検証）と、
 * 自由記述の英文・Markdown用の extractTaggedText（タグ抽出のみ、JSON化しない）の2種類を提供する。
 * 新しいタグ付き項目を追加する場合も、対応する関数を呼ぶだけでよい。
 */

export type ParseFailureStage = 'no-tag' | 'json-parse' | 'validation';

// ── 最初のバランスした JSON オブジェクトの切り出し ─────────────────────
// 正規表現 /\{[\s\S]*\}/ は「最初の { から最後の } まで」を貪欲にマッチするため、
// タグ内に説明文と複数の {...} が混在すると不正な文字列を返してしまう。
// ここではブレース深度を数え、最初の { に対応する閉じ } までを正確に切り出す。
// JSON 文字列リテラル内の {} や \" エスケープは深度に数えない。
function extractFirstJsonObject(text: string): string | undefined {
  const start = text.indexOf('{');
  if (start === -1) return undefined;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++; // エスケープ文字は次の1文字ごと読み飛ばす
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return undefined; // 閉じ括弧が見つからない（不完全なJSON）
}

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

  // コードフェンス等が混じっても最初のバランスした {...} ブロックだけを取り出す（軽い正規化）
  const cleaned = match[1].replace(/```[a-z]*/gi, '').trim();
  const objText = extractFirstJsonObject(cleaned);
  if (!objText) {
    onError?.('json-parse', `<${tag}> 内に JSON オブジェクトが見つかりません`);
    return undefined;
  }

  let json: unknown;
  try {
    json = JSON.parse(objText);
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
