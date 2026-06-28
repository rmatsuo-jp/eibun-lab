/**
 * @file ビルド/開発サーバ起動時に src/version.ts を自動生成するスクリプト。
 *       package.json の version を読み取り、実行当日（JST）をリリース日として埋め込む。
 *       package.json の "prestart" / "prebuild" / "predeploy" フックから呼ばれる。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(here, '../package.json'), 'utf8'));

// JST の YYYY-MM-DD。'sv-SE' ロケールは ISO 形式（年-月-日）で返るため整形が楽。
const releaseDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });

const contents = `// このファイルは scripts/generate-version.mjs により自動生成されます（手動編集しない）。
export const APP_VERSION = '${pkg.version}';
export const RELEASE_DATE = '${releaseDate}';
`;

writeFileSync(resolve(here, '../src/version.ts'), contents, 'utf8');
console.log(`[generate-version] APP_VERSION=${pkg.version} RELEASE_DATE=${releaseDate}`);
