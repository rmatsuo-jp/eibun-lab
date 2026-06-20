/**
 * @file public/favicon.svg から PWA 用 PNG アイコン群と favicon.ico を生成する。
 *        再生成可能なよう scripts/ に常駐。実行: node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ── パス設定 ─────────────────────────────────────────────────
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svgPath = join(root, 'public', 'favicon.svg');
const iconsDir = join(root, 'public', 'icons');
const svg = readFileSync(svgPath);

mkdirSync(iconsDir, { recursive: true });

// ── PWA 用 PNG（manifest のサイズに合わせる。白背景・余白付き）───────────
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

/** SVG を指定サイズの白背景 PNG にラスタライズ（デザインは中央 ~80% に配置）*/
async function renderPng(size) {
  const inner = Math.round(size * 0.82);
  const pad = Math.round((size - inner) / 2);
  const icon = await sharp(svg, { density: 384 })
    .resize(inner, inner)
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: '#ffffff' },
  })
    .composite([{ input: icon, top: pad, left: pad }])
    .png()
    .toBuffer();
}

for (const size of sizes) {
  const buf = await renderPng(size);
  writeFileSync(join(iconsDir, `icon-${size}x${size}.png`), buf);
  console.log(`generated icon-${size}x${size}.png`);
}

// ── favicon.ico（16/32/48px マルチサイズ）─────────────────────
const icoBuffers = await Promise.all([16, 32, 48].map((s) => renderPng(s)));
const ico = await pngToIco(icoBuffers);
writeFileSync(join(root, 'public', 'favicon.ico'), ico);
console.log('generated favicon.ico');
