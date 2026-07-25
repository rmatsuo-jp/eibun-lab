/**
 * @file Firestore へ書き込む直前に undefined フィールドを取り除く純粋関数群。
 * Firestore は値 undefined を受け付けない（フィールドごと存在しない扱いにする必要がある）ため、
 * setDoc の直前に必ずどちらかを通す。浅い版と深い版で用途が異なるため統合はしない。
 */

/**
 * オブジェクト1階層分だけ、値が undefined のキーを削除する。
 * 配列要素の任意フィールド（Mistake.explanationEn 等）を落とす用途で使う。
 */
export function stripUndefinedShallow<T extends Record<string, unknown>>(obj: T): T {
  const copy: Record<string, unknown> = { ...obj };
  for (const key of Object.keys(copy)) {
    if (copy[key] === undefined) delete copy[key];
  }
  return copy as T;
}

/**
 * JSON の往復で入れ子の undefined フィールドまで確実に落とす。
 * ネスト構造（GamificationStats.features 配下の lastActiveDate 等）に使う。
 */
export function stripUndefinedDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
