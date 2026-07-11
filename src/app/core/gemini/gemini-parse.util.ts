/**
 * @file Gemini レスポンスの `<tag>...</tag>` ブロックを抽出・除去する共通ヘルパー。
 * 構造化データ用の extractTaggedJson（タグ抽出 → コードフェンス除去 → JSON.parse → 型検証）と、
 * 自由記述の英文・Markdown用の extractTaggedText（タグ抽出のみ、JSON化しない）、
 * および抽出済みタグを本文から取り除く stripKnownBlocks の3種類を提供する。
 * 新しいタグ付き項目を追加する場合は、対応する抽出関数を呼びつつ KNOWN_TAGS にもタグ名を足すこと。
 * gemini.service.ts は全セクション（解説5項目 + corrected-text/levelup-text/mistakes/evaluation/
 * levelup/review）を extractTaggedText/extractTaggedJson で個別に抽出しており、1タグの抽出失敗は
 * そのフィールドが undefined になるだけで他タグの抽出には影響しない。stripKnownBlocks は
 * どのタグも一切見つからない最終フォールバック（万一プレーンテキストへ生JSON等が混入した場合の
 * 除去用）としてのみ用意する保険であり、通常の抽出経路では呼ばれない。
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

// ── 抽出済みブロックの除去（最終フォールバック用） ──────────────────────
// prompt.util.ts が Gemini に出力させるタグの全一覧。新しいタグを増やしたらここにも足す。
const KNOWN_TAGS = [
  'grammar-notes-ja',
  'grammar-notes-en',
  'natural-expr-ja',
  'natural-expr-en',
  'corrected-text',
  'mistakes',
  'grammar-tendency-ja',
  'grammar-tendency-en',
  'evaluation',
  'cefr-rationale-ja',
  'cefr-rationale-en',
  'study-plan-ja',
  'study-plan-en',
  'levelup',
  'levelup-text',
  'review',
] as const;

// 見出しから閉じタグまでを丸ごと落とすブロック。見出しと閉じタグの間には、他コンポーネントで
// 表示済みの内容（スコアの講評など）や複数のタグが挟まるため、末尾のタグまで一括で除去する。
const HEADING_BLOCKS: readonly (readonly [string, string])[] = [
  // 各見出しの後は -ja → -en の順で日英タグが続く
  ['文法・語法のミスの指摘', 'grammar-notes-en'],
  ['自然な表現の提案', 'natural-expr-en'],
  ['添削後の全文', 'corrected-text'],
  ['ミス一覧（JSON）', 'mistakes'],
  ['文法のミスの傾向', 'grammar-tendency-en'],
  ['定量評価（10点満点・0.5刻み）', 'evaluation'],
  ['CEFR評価の根拠', 'cefr-rationale-en'],
  ['今のレベルから伸ばすための学習法', 'study-plan-en'],
  // 【レベルアップした表現の提案】の後は <levelup> → 説明文 → <levelup-text> の順で続く
  ['レベルアップした表現の提案', 'levelup-text'],
  ['復習用カードの生成', 'review'],
];

/**
 * Gemini の生レスポンスから、専用タグとして抽出済みのブロックを取り除き、
 * 添削解説プローズ（文法解説・自然な表現の提案・傾向・CEFR根拠・学習法など）だけを残す。
 *
 * 見出し（【】）だけに頼ると、Gemini が見出しを省略・改変したときに除去が丸ごと失敗し、
 * `<levelup>` の JSON などが本文に残って画面に出てしまう。そのため見出し基準の除去に加えて、
 * タグ基準の除去（閉じタグ欠落時のフォールバックを含む）を必ず後段で通す。
 */
export function stripKnownBlocks(text: string): string {
  let out = text;

  // 1. 見出し 〜 閉じタグ（見出しと閉じタグが揃った正常系）
  for (const [heading, endTag] of HEADING_BLOCKS) {
    out = out.replace(new RegExp(`【${heading}】[\\s\\S]*?</${endTag}>`, 'g'), '');
  }

  // 2. 閉じタグ自体が欠落したフォールバック。末尾まで一括削除すると後続の正常なプローズを
  //    巻き添えにするため、「次の既知の開始タグ」か「次の【見出し】」を境界にする。
  //    この境界となる開始タグは 3. で消えてしまうため、必ず 3. より先に実行すること。
  const openTags = KNOWN_TAGS.join('|');
  for (const tag of KNOWN_TAGS) {
    if (out.includes(`</${tag}>`)) continue;
    out = out.replace(new RegExp(`<${tag}>[\\s\\S]*?(?=<(?:${openTags})>|【|$)`, 'g'), '');
  }

  // 3. タグ基準の除去。見出しが欠落・改変されて 1. が空振りしても、ここで必ず落とす
  for (const tag of KNOWN_TAGS) {
    out = out.replace(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, 'g'), '');
  }

  // 4. 中身が消えて残った見出し行を落とす（空見出しだけが本文に残るのを防ぐ）
  for (const [heading] of HEADING_BLOCKS) {
    out = out.replace(new RegExp(`^[ \\t]*【${heading}】.*$`, 'gm'), '');
  }

  // 5. 除去跡の連続空行を畳む
  return out.replace(/\n{3,}/g, '\n\n').trim();
}
