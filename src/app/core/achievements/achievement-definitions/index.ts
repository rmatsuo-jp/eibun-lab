/**
 * @file 実績（バッジ）の宣言的な一覧。featureId（添削・穴埋めクイズ・穴あきタイピング）ごとに
 * correction.ts/cloze.ts/levelup.ts へ分割し、ここで結合して ACHIEVEMENTS をexportする。
 * 穴埋めクイズ／穴あきタイピングは同じ4系統（累積・連続・パーフェクト・制覇）構成を持つが、
 * 参照する統計（GamificationStats.features['cloze'] / ['levelup']）が独立しているため、
 * 一方だけプレイしても他方の実績条件は進まない。
 * 「制覇」は文法カテゴリ別ではなく、そのモードの全日程クリアで判定する
 * （ReviewItemに文法カテゴリ情報がないため）。
 * 新しいゲーミフィケーション対象featureを追加する際は、新しい定義ファイルを1つ追加しここに1行加えるだけで済み、
 * 既存ファイルの編集は不要。
 */
import { AchievementDef } from '../achievement.model';
import { CORRECTION_ACHIEVEMENTS } from './correction';
import { CLOZE_ACHIEVEMENTS } from './cloze';
import { LEVELUP_ACHIEVEMENTS } from './levelup';

export const ACHIEVEMENTS: AchievementDef[] = [
  ...CORRECTION_ACHIEVEMENTS,
  ...CLOZE_ACHIEVEMENTS,
  ...LEVELUP_ACHIEVEMENTS,
];
