/**
 * @file 出題ロジックのうち、コンポーネントの signal 状態に依存しない純粋関数を切り出したもの。
 * 重み付きシャッフル・回答文字列の正規化・マスク順生成・マスク対象計算に加え、
 * Quiz/LevelUpQuiz への正規化ビルダーと不正解分類（classifyMistake）も提供し、
 * 呼び出し側（features/drill のドリル、features/practice の添削待機中クイズ）はこれを呼ぶだけにする。
 * 2つの feature が共用するため core に置く（feature 間 import を避けるため）。DIなしで単体テスト可能。
 * hint/badge/translation は表示言語（lang）に応じて英語版（explanationEn等）へ切り替える。
 * DI を持ち込まないよう、core/i18n の翻訳データ（プレーンオブジェクト）を直接参照する
 * （I18nService は注入せず、lang 引数だけで完結させて単体テスト可能な純粋関数のままにする）。
 */
import { ReviewItem } from '@core/models/session.model';
import { Lang } from '@core/i18n/lang.model';
import { TRANSLATIONS } from '@core/i18n/translations';

// 内部で扱う統一出題型。表示・採点に必要な値を両モードから正規化して持つ。
export interface Quiz {
  key: string; // 習熟度トラッキング用の一意キー（normalizeDrillKey 済み）
  prompt: string; // 出題本文（ミス: 誤表現 / クローズ: 穴埋め文）
  answer: string; // 正解文字列（採点基準）
  hint: string; // ヒント（日本語）
  badge: string; // カテゴリ等のバッジ表示
  weight: number; // 出題優先度（頻度 × 習熟度による重み）
  translation?: string; // クローズのみ: 日本語訳
  choices?: string[]; // クローズのみ: 4択
}

// 穴あきタイピング専用の出題型。Quiz とは形が異なる（マスク段階を持つ）ため独立させる。
export interface LevelUpQuiz {
  key: string; // 習熟度トラッキング用の一意キー（normalizeDrillKey(leveledUp)）
  leveledUp: string; // 正解の全文（採点基準・マスク生成の元）
  original: string; // 元の（レベルアップ前の）文
  translation: string; // 日本語訳（ヒント表示用）
  words: string[]; // leveledUp を空白区切りにした単語配列（マスク生成・diff判定の基準）
  hideOrder: number[]; // words のインデックスを「隠す優先順」に並べた配列（決定的に生成、保存不要）
  maxLevel: number; // マスク段階の最大値（この段階で全単語がマスクされる）
}

// 不正解の分類。'typo' = 見えている単語の入力ミス（レベル据え置き）、'gap' = 隠れている単語を思い出せなかった（レベル低下）。
export type MistakeKind = 'typo' | 'gap';

// ── 重み付きシャッフル: weight * Math.random() の降順ソートで、頻出・未習熟の問題ほど手前に出やすくしつつ、
// 完全な固定順にはならないよう毎回ランダム性を持たせる（軽量な重み付きシャッフル）。
export function shuffleByWeight<T extends { weight: number }>(source: T[]): T[] {
  return source
    .map((q) => ({ q, score: q.weight * Math.random() }))
    .sort((a, b) => b.score - a.score)
    .map(({ q }) => q);
}

// 回答文字列の正規化（大文字小文字・前後空白・末尾句読点・連続空白の差異を吸収して比較する）。
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[.!?,;:'"]+$/g, '')
    .replace(/\s+/g, ' ');
}

// ── マスクする単語の優先順を、文字列から決定的に生成する ─────────
// 同じ文なら常に同じ並びになるため、隠す順序自体は保存せずいつでも再現できる（保存するのは maskLevel のみ）。
// シンプルな文字列ハッシュを種にした mulberry32 で疑似乱数列を作り、Fisher–Yates でシャッフルする。
export function buildHideOrder(seedText: string, length: number): number[] {
  let h = 0;
  for (let i = 0; i < seedText.length; i++) {
    h = (Math.imul(31, h) + seedText.charCodeAt(i)) | 0;
  }
  let state = h >>> 0 || 1;
  const rand = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// 現在の maskLevel で隠れている単語インデックスの集合を返す。
export function maskedIndices(
  hideOrder: number[],
  wordCount: number,
  maxLevel: number,
  level: number,
): Set<number> {
  const hiddenCount = Math.round((wordCount * level) / maxLevel);
  return new Set(hideOrder.slice(0, hiddenCount));
}

// 復習カード1件 → Quiz へ正規化。weight は呼び出し側で習熟度を反映して計算済みの値を渡す。
export function buildClozeQuiz(
  r: ReviewItem,
  key: string,
  weight: number,
  lang: Lang = 'ja',
): Quiz {
  return {
    key,
    prompt: r.sentence,
    answer: r.answer,
    hint: lang === 'en' && r.hintEn ? r.hintEn : r.hint,
    badge: TRANSLATIONS[lang]['quiz.cloze.badge'],
    weight,
    translation: lang === 'en' && r.translationEn ? r.translationEn : r.translation,
    choices: r.choices,
  };
}

// levelUpItems の1件 → LevelUpQuiz へ正規化（マスク順・マスク段階の最大値を決定的に算出）。
export function buildLevelUpQuiz(
  item: { leveledUp: string; original: string; translation: string; translationEn?: string },
  key: string,
  lang: Lang = 'ja',
): LevelUpQuiz {
  const words = item.leveledUp.split(/\s+/).filter((w) => w.length > 0);
  return {
    key,
    leveledUp: item.leveledUp,
    original: item.original,
    translation: lang === 'en' && item.translationEn ? item.translationEn : item.translation,
    words,
    hideOrder: buildHideOrder(item.leveledUp, words.length),
    maxLevel: Math.min(6, Math.max(3, words.length)),
  };
}

// ユーザー入力を正解の単語配列と突き合わせ、不一致がマスクされていない単語だけなら 'typo'、
// マスクされている単語にも及ぶ（または単語数が一致せず位置を特定できない）場合は 'gap' と判定する。
export function classifyMistake(
  item: LevelUpQuiz,
  userInput: string,
  currentMaskLevel: number,
): MistakeKind {
  const userWords = userInput.split(/\s+/).filter((w) => w.length > 0);
  if (userWords.length !== item.words.length) return 'gap';

  const hidden = maskedIndices(item.hideOrder, item.words.length, item.maxLevel, currentMaskLevel);
  for (let i = 0; i < item.words.length; i++) {
    if (normalizeAnswer(userWords[i]) !== normalizeAnswer(item.words[i]) && hidden.has(i)) {
      return 'gap';
    }
  }
  return 'typo';
}
