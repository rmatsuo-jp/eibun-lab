import { decryptText, encryptText } from './crypto.util';

// jsdom には IndexedDB が無いため getOrCreateAesKey はテストせず、
// Web Crypto（Node の webcrypto 実装で利用可能）による暗号化/復号のラウンドトリップのみ検証する。
const hasSubtle = typeof crypto !== 'undefined' && !!crypto.subtle;

describe.skipIf(!hasSubtle)('encryptText / decryptText', () => {
  async function generateKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
  }

  it('暗号化した文字列を同じ鍵で復号すると元に戻る', async () => {
    const key = await generateKey();
    const encoded = await encryptText(key, 'AIzaSy-dummy-api-key-123');
    expect(encoded).not.toContain('AIzaSy'); // 平文が含まれない
    expect(await decryptText(key, encoded)).toBe('AIzaSy-dummy-api-key-123');
  });

  it('同じ平文でも IV がランダムなため暗号文は毎回異なる', async () => {
    const key = await generateKey();
    const a = await encryptText(key, 'same-text');
    const b = await encryptText(key, 'same-text');
    expect(a).not.toBe(b);
    expect(await decryptText(key, a)).toBe('same-text');
    expect(await decryptText(key, b)).toBe('same-text');
  });

  it('別の鍵では復号できない', async () => {
    const key1 = await generateKey();
    const key2 = await generateKey();
    const encoded = await encryptText(key1, 'secret');
    await expect(decryptText(key2, encoded)).rejects.toThrow();
  });
});
