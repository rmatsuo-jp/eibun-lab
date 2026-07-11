/**
 * @file Web Crypto (AES-GCM) によるテキスト暗号化ユーティリティ。
 * 鍵は extractable: false の CryptoKey として IndexedDB に保存し、JS からは鍵素材を取り出せない。
 * これにより localStorage を読むだけの攻撃（DevTools 覗き見や単純な XSS）では復号できない。
 * ⚠ 実行中のページで復号処理そのものを呼べる本格的な XSS への完全防御ではない点に注意。
 */

const DB_NAME = 'eibun-lab-crypto';
const STORE_NAME = 'keys';
const KEY_ID = 'aes-key';
const IV_LENGTH = 12; // AES-GCM 推奨の 96bit

// この環境で暗号化保存が使えるか（Web Crypto と IndexedDB の両方が必要）
export function isCryptoSupported(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle && typeof indexedDB !== 'undefined';
}

// ── IndexedDB への CryptoKey 保存/取得 ─────────────────────────────
// CryptoKey は structured clone 可能なため、extractable: false のまま IndexedDB に保存できる。
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db: IDBDatabase): Promise<CryptoKey | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(KEY_ID);
    req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(key, KEY_ID);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// IndexedDB から AES 鍵を取得し、なければ生成して保存する。
export async function getOrCreateAesKey(): Promise<CryptoKey> {
  const db = await openDb();
  try {
    const existing = await idbGet(db);
    if (existing) return existing;
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false, // extractable: false — JS から鍵素材をエクスポートできない
      ['encrypt', 'decrypt'],
    );
    await idbPut(db, key);
    return key;
  } finally {
    db.close();
  }
}

// ── 暗号化/復号（IV は暗号文の先頭に連結して base64 化） ───────────────
export async function encryptText(key: CryptoKey, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain),
  );
  const combined = new Uint8Array(IV_LENGTH + cipher.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(cipher), IV_LENGTH);
  // spread はセッション1件分の文字列長では安全だが、超巨大なバイト列では引数上限に注意
  return btoa(String.fromCharCode(...combined));
}

export async function decryptText(key: CryptoKey, encoded: string): Promise<string> {
  const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, IV_LENGTH);
  const cipher = combined.slice(IV_LENGTH);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plain);
}
