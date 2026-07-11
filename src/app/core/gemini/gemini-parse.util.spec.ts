import { vi } from 'vitest';
import { extractTaggedJson, stripKnownBlocks } from './gemini-parse.util';

describe('extractTaggedJson', () => {
  const validateArr = (json: unknown) => {
    const obj = json as { items?: unknown };
    return Array.isArray(obj.items) ? (obj.items as string[]) : undefined;
  };

  it('タグ内のJSONを抽出して検証を通す', () => {
    const text = '前置き<foo>{"items":["a","b"]}</foo>後書き';
    expect(extractTaggedJson(text, 'foo', validateArr)).toEqual(['a', 'b']);
  });

  it('タグが無ければ no-tag で失敗する', () => {
    const onError = vi.fn();
    expect(extractTaggedJson('本文のみ', 'foo', validateArr, onError)).toBeUndefined();
    expect(onError).toHaveBeenCalledWith('no-tag', expect.any(String));
  });

  it('コードフェンスに包まれていても抽出できる', () => {
    const text = '<foo>```json\n{"items":["x"]}\n```</foo>';
    expect(extractTaggedJson(text, 'foo', validateArr)).toEqual(['x']);
  });

  it('不正なJSONは json-parse で失敗する', () => {
    const onError = vi.fn();
    const text = '<foo>{items: [}</foo>';
    expect(extractTaggedJson(text, 'foo', validateArr, onError)).toBeUndefined();
    expect(onError).toHaveBeenCalledWith('json-parse', expect.anything());
  });

  it('JSONの後に説明文と別の { } が続いても最初のオブジェクトだけを抽出する', () => {
    const text = '<foo>{"items":["a"]}\n補足: この形式 {"items":[]} も可</foo>';
    expect(extractTaggedJson(text, 'foo', validateArr)).toEqual(['a']);
  });

  it('JSONの前に説明文があっても最初のバランスしたオブジェクトを抽出する', () => {
    const text = '<foo>以下が結果です。\n{"items":["x","y"]}\nご確認ください。</foo>';
    expect(extractTaggedJson(text, 'foo', validateArr)).toEqual(['x', 'y']);
  });

  it('文字列リテラル内の波括弧やエスケープに惑わされない', () => {
    const text = '<foo>{"items":["a { b } c","quote \\" here"]}</foo>';
    expect(extractTaggedJson(text, 'foo', validateArr)).toEqual(['a { b } c', 'quote " here']);
  });

  it('閉じ括弧が無い不完全なJSONは json-parse で失敗する', () => {
    const onError = vi.fn();
    const text = '<foo>{"items":["a"]</foo>';
    expect(extractTaggedJson(text, 'foo', validateArr, onError)).toBeUndefined();
    expect(onError).toHaveBeenCalledWith('json-parse', expect.anything());
  });

  it('スキーマ検証に失敗すると validation で通知される', () => {
    const onError = vi.fn();
    const text = '<foo>{"items":"not-an-array"}</foo>';
    expect(extractTaggedJson(text, 'foo', validateArr, onError)).toBeUndefined();
    expect(onError).toHaveBeenCalledWith('validation', expect.any(String));
  });
});

describe('stripKnownBlocks', () => {
  it('見出しとタグが揃っていればブロックごと消え、他のプローズは残る', () => {
    const text = [
      '【文法・語法のミスの指摘】',
      '三単現の s が抜けています。',
      '',
      '【添削後の全文】',
      '<corrected-text>He goes to school.</corrected-text>',
      '',
      '【CEFR評価の根拠】',
      '語彙は A2 相当です。',
    ].join('\n');

    const out = stripKnownBlocks(text);
    expect(out).toContain('三単現の s が抜けています。');
    expect(out).toContain('語彙は A2 相当です。');
    expect(out).not.toContain('corrected-text');
    expect(out).not.toContain('He goes to school.');
    expect(out).not.toContain('【添削後の全文】');
  });

  it('見出しが欠落しタグだけでも JSON が本文に残らない', () => {
    const text = [
      '【CEFR評価の根拠】',
      '語彙は A2 相当です。',
      '',
      '<levelup>{"levelUpItems":[{"original":"a","leveledUp":"b"}]}</levelup>',
      '<levelup-text>Leveled up prose.</levelup-text>',
    ].join('\n');

    const out = stripKnownBlocks(text);
    expect(out).toBe('【CEFR評価の根拠】\n語彙は A2 相当です。');
    expect(out).not.toContain('levelUpItems');
    expect(out).not.toContain('Leveled up prose.');
  });

  it('閉じタグが欠落しても次の見出しまでで除去が止まる', () => {
    const text = [
      '<levelup>{"levelUpItems":[{"original":"a"}]}',
      '',
      '【今のレベルから伸ばすための学習法】',
      '冠詞のドリルを1日30分。',
    ].join('\n');

    const out = stripKnownBlocks(text);
    expect(out).toBe('【今のレベルから伸ばすための学習法】\n冠詞のドリルを1日30分。');
    expect(out).not.toContain('levelUpItems');
  });

  it('閉じタグが欠落し次の開始タグが続く場合はそこで除去が止まる', () => {
    const text = '<levelup>{"levelUpItems":[]}<review>{"reviewItems":[]}</review>あとがき';
    expect(stripKnownBlocks(text)).toBe('あとがき');
  });

  it('既知タグが無ければ入力をそのまま返す', () => {
    const text = '【文法・語法のミスの指摘】\n特にミスはありません。';
    expect(stripKnownBlocks(text)).toBe(text);
  });

  it('除去跡に3行以上の連続空行を残さない', () => {
    const text = '前書き\n\n<review>{"reviewItems":[]}</review>\n\n後書き';
    expect(stripKnownBlocks(text)).toBe('前書き\n\n後書き');
  });
});
