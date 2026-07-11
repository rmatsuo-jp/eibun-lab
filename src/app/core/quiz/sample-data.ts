/**
 * @file 添削したことがない新規ユーザー向けの静的サンプル問題データ。
 * Gemini API は呼ばず、CEFR A2〜B1相当の英文をもとにハードコードした
 * ReviewItem（4択穴埋め）・LevelUpItem（レベルアップ・タイピング）を提供する。
 * features/practice/waiting-quiz（添削待機中クイズ）と features/drill（空状態）が参照する。
 */
import { LevelUpItem, ReviewItem } from '@core/models/session.model';

// ── サンプル4択穴埋め問題（5問、CEFR A2-B1相当） ─────────────────
export const SAMPLE_REVIEW_ITEMS: ReviewItem[] = [
  {
    sentence: 'I ___ to school by bus every morning.',
    answer: 'go',
    hint: '現在の習慣を表す動詞を選びましょう。',
    hintEn: 'Choose the verb that expresses a habitual action.',
    translation: '私は毎朝バスで学校に行きます。',
    translationEn: 'I go to school by bus every morning.',
    choices: ['go', 'goes', 'going', 'went'],
  },
  {
    sentence: 'She has lived in Tokyo ___ five years.',
    answer: 'for',
    hint: '期間の長さを表す前置詞です。',
    hintEn: 'A preposition used with a length of time.',
    translation: '彼女は5年間東京に住んでいます。',
    translationEn: 'She has lived in Tokyo for five years.',
    choices: ['for', 'since', 'during', 'at'],
  },
  {
    sentence: 'If it rains tomorrow, I ___ stay at home.',
    answer: 'will',
    hint: '条件文（if節）に対する未来の帰結を表します。',
    hintEn: 'Expresses the future result of a condition (if-clause).',
    translation: '明日雨が降ったら、私は家にいます。',
    translationEn: 'If it rains tomorrow, I will stay at home.',
    choices: ['will', 'would', 'can', 'must'],
  },
  {
    sentence: 'This book is ___ interesting than the one I read last week.',
    answer: 'more',
    hint: '2つを比較する比較級の形です。',
    hintEn: 'The comparative form used to compare two things.',
    translation: 'この本は先週読んだ本より面白いです。',
    translationEn: 'This book is more interesting than the one I read last week.',
    choices: ['more', 'most', 'much', 'very'],
  },
  {
    sentence: 'You ___ finish your homework before dinner.',
    answer: 'should',
    hint: '相手にやるべきことを助言する助動詞です。',
    hintEn: 'A modal verb used to give advice about what someone ought to do.',
    translation: '夕食前に宿題を終わらせるべきです。',
    translationEn: 'You should finish your homework before dinner.',
    choices: ['should', 'may', 'could', 'need'],
  },
];

// ── サンプル・レベルアップ例文（3文、CEFR A2→B1相当への書き換え） ───
export const SAMPLE_LEVELUP_ITEMS: LevelUpItem[] = [
  {
    original: 'I was very happy because I passed the test.',
    leveledUp: 'I was delighted because I managed to pass the test.',
    keyPhrases: ['delighted', 'managed to pass'],
    translation: 'テストに合格できてとても嬉しかったです。',
    translationEn: 'I was delighted because I managed to pass the test.',
  },
  {
    original: 'The weather was bad, so we did not go out.',
    leveledUp: 'Since the weather was terrible, we decided not to go out.',
    keyPhrases: ['Since', 'terrible', 'decided not to'],
    translation: '天気がひどかったので、外出しないことにしました。',
    translationEn: 'Since the weather was terrible, we decided not to go out.',
  },
  {
    original: 'I think this restaurant is good because the food is nice.',
    leveledUp: 'I believe this restaurant is worth visiting because the food is delicious.',
    keyPhrases: ['I believe', 'worth visiting', 'delicious'],
    translation: '料理が美味しいので、このレストランは訪れる価値があると思います。',
    translationEn: 'I believe this restaurant is worth visiting because the food is delicious.',
  },
];
