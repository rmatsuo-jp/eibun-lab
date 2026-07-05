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

  it('スキーマ検証に失敗すると validation で通知される', () => {
    const onError = vi.fn();
    const text = '<foo>{"items":"not-an-array"}</foo>';
    expect(extractTaggedJson(text, 'foo', validateArr, onError)).toBeUndefined();
    expect(onError).toHaveBeenCalledWith('validation', expect.any(String));
  });
});
