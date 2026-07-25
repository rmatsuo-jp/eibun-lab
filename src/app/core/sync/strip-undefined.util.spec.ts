import { stripUndefinedDeep, stripUndefinedShallow } from './strip-undefined.util';

describe('stripUndefinedShallow', () => {
  it('値が undefined のキーだけを削除する', () => {
    const result = stripUndefinedShallow({ a: 1, b: undefined, c: null, d: '' });
    expect(Object.keys(result).sort()).toEqual(['a', 'c', 'd']);
    expect(result.c).toBeNull();
  });

  it('元のオブジェクトを破壊しない', () => {
    const original = { a: 1, b: undefined };
    stripUndefinedShallow(original);
    expect('b' in original).toBe(true);
  });

  it('入れ子の undefined は残す（浅い1階層のみ）', () => {
    const result = stripUndefinedShallow({ nested: { x: undefined } as Record<string, unknown> });
    expect('x' in (result.nested as Record<string, unknown>)).toBe(true);
  });
});

describe('stripUndefinedDeep', () => {
  it('入れ子の undefined フィールドまで削除する', () => {
    const result = stripUndefinedDeep({ a: 1, nested: { x: undefined, y: 2 } });
    expect('x' in result.nested).toBe(false);
    expect(result.nested.y).toBe(2);
  });

  it('元のオブジェクトを破壊しない', () => {
    const original = { nested: { x: undefined } };
    stripUndefinedDeep(original);
    expect('x' in original.nested).toBe(true);
  });
});
