import { describe, expect, it } from 'vitest';
import { toUserMessage } from './gemini-error.util';
import { GeminiBlockedError } from './gemini-blocked.error';

describe('toUserMessage', () => {
  it('セーフティブロックのメッセージはそのまま通す', () => {
    const e = new GeminiBlockedError('SAFETY');
    expect(toUserMessage(e)).toBe(e.message);
  });

  it('400 + API key not valid を無効キーの案内に変換する', () => {
    const e = new Error('[GoogleGenerativeAI Error]: [400 Bad Request] API key not valid. Please pass a valid API key.');
    expect(toUserMessage(e)).toContain('API キーが無効です');
  });

  it('403 をキー拒否の案内に変換する', () => {
    const e = new Error('[GoogleGenerativeAI Error]: [403 Forbidden] permission denied');
    expect(toUserMessage(e)).toContain('API キーが拒否されました');
  });

  it('429 を利用上限の案内に変換する', () => {
    const e = new Error('[GoogleGenerativeAI Error]: [429 Too Many Requests] quota exceeded');
    const msg = toUserMessage(e);
    expect(msg).toContain('利用上限');
    expect(msg).toContain('料金が発生することがあります');
  });

  it('5xx を一時的なエラーの案内に変換する', () => {
    const e = new Error('[GoogleGenerativeAI Error]: [503 Service Unavailable] overloaded');
    expect(toUserMessage(e)).toContain('一時的なエラー');
  });

  it('status プロパティを持つエラーも分類できる', () => {
    expect(toUserMessage({ status: 429, message: 'quota' })).toContain('利用上限');
  });

  it('分類できないエラーは元のメッセージを返す', () => {
    expect(toUserMessage(new Error('network down'))).toBe('network down');
  });

  it('Error 以外の値も文字列化して返す', () => {
    expect(toUserMessage('boom')).toBe('boom');
  });
});
