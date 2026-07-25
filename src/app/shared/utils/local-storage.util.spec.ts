import { vi } from 'vitest';
import { readJson, writeJson } from './local-storage.util';

describe('readJson', () => {
  beforeEach(() => localStorage.clear());

  it('保存済みの値をパースして返す', () => {
    localStorage.setItem('k', JSON.stringify({ a: 1 }));
    expect(readJson('k', {})).toEqual({ a: 1 });
  });

  it('キーが存在しなければ fallback を返す', () => {
    expect(readJson('missing', { a: 0 })).toEqual({ a: 0 });
  });

  it('壊れたJSONでも例外を投げず fallback を返す', () => {
    localStorage.setItem('broken', '{not json');
    expect(readJson('broken', [])).toEqual([]);
  });
});

describe('writeJson', () => {
  beforeEach(() => localStorage.clear());

  it('値をJSONとして書き込み true を返す', () => {
    expect(writeJson('k', [1, 2])).toBe(true);
    expect(localStorage.getItem('k')).toBe('[1,2]');
  });

  it('書き込みに失敗したら例外を投げず false を返す（容量超過など）', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(writeJson('k', { a: 1 })).toBe(false);

    spy.mockRestore();
    errorSpy.mockRestore();
  });

  it('readJson で読み戻せる（往復）', () => {
    writeJson('k', { nested: { list: [1] } });
    expect(readJson('k', null)).toEqual({ nested: { list: [1] } });
  });
});
