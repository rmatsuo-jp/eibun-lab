/**
 * @file UI 文言の日英翻訳辞書。実体は `./translations/`（feature別に分割）に移動し、ここは
 * 既存の import パス（`@core/i18n/translations`）を変えずに済むよう薄く再エクスポートするだけ。
 */
export { TRANSLATIONS } from './translations/index';
export type { TranslationKey } from './translations/index';
