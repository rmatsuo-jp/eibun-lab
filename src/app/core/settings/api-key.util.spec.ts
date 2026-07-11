import { describe, expect, it } from 'vitest';
import { normalizeApiKey } from './api-key.util';

describe('normalizeApiKey', () => {
  it('前後の空白・改行・タブを除去する', () => {
    expect(normalizeApiKey('  AIzaSyABCDEFGHIJ \n\t')).toBe('AIzaSyABCDEFGHIJ');
  });

  it('全角空白も除去する', () => {
    expect(normalizeApiKey('　AIzaSyABCDEFGHIJ　')).toBe('AIzaSyABCDEFGHIJ');
  });

  it('キー全体を囲む引用符を除去する', () => {
    expect(normalizeApiKey('"AIzaSyABCDEFGHIJ"')).toBe('AIzaSyABCDEFGHIJ');
    expect(normalizeApiKey("' AIzaSyABCDEFGHIJ '")).toBe('AIzaSyABCDEFGHIJ');
  });

  it('キー内部の文字は変更しない（新形式の AQ. キーのドットも保持する）', () => {
    expect(normalizeApiKey('AIza-Sy_ABC')).toBe('AIza-Sy_ABC');
    expect(normalizeApiKey('  AQ.Ab8RN6J_abc-DEF123  ')).toBe('AQ.Ab8RN6J_abc-DEF123');
  });

  it('空文字はそのまま返す', () => {
    expect(normalizeApiKey('')).toBe('');
  });
});
