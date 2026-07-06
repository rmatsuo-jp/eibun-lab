import { vi } from 'vitest';
import { extractTaggedJson } from './gemini-parse.util';

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
