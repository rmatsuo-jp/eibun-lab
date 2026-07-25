/**
 * @file 添削したことがない新規ユーザー向けの静的サンプル問題データ。
 * Gemini API は呼ばず、CEFR A2〜B1相当の英文をもとにハードコードした
 * ReviewItem（4択穴埋め）・LevelUpItem（穴あきタイピング）を提供する。
 * features/practice/waiting-quiz（添削待機中クイズ）と features/drill（空状態）が参照する。
 */
import { LevelUpItem, ReviewItem } from '@core/models/session.model';

// ── サンプル4択穴埋め問題（15問、CEFR A2-B1相当） ────────────────
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
  {
    sentence: 'This letter was written ___ my grandfather.',
    answer: 'by',
    hint: '受動態で動作主を示す前置詞です。',
    hintEn: 'The preposition used to show the agent in a passive sentence.',
    translation: 'この手紙は祖父によって書かれました。',
    translationEn: 'This letter was written by my grandfather.',
    choices: ['by', 'from', 'with', 'of'],
  },
  {
    sentence: 'The woman ___ is standing over there is our new teacher.',
    answer: 'who',
    hint: '人を先行詞にとる関係代名詞です。',
    hintEn: 'The relative pronoun used when the antecedent is a person.',
    translation: 'あそこに立っている女性は私たちの新しい先生です。',
    translationEn: 'The woman who is standing over there is our new teacher.',
    choices: ['who', 'which', 'whose', 'what'],
  },
  {
    sentence: 'I decided ___ a new language this year.',
    answer: 'to learn',
    hint: 'decideの後は不定詞（to + 動詞原形）が続きます。',
    hintEn: 'The verb "decide" is followed by a to-infinitive.',
    translation: '私は今年、新しい言語を学ぶことに決めました。',
    translationEn: 'I decided to learn a new language this year.',
    choices: ['to learn', 'learning', 'learn', 'learned'],
  },
  {
    sentence: 'She enjoys ___ novels in her free time.',
    answer: 'reading',
    hint: 'enjoyの後は動名詞（-ing）が続きます。',
    hintEn: 'The verb "enjoy" is followed by a gerund (-ing form).',
    translation: '彼女は自由時間に小説を読むのを楽しんでいます。',
    translationEn: 'She enjoys reading novels in her free time.',
    choices: ['reading', 'to read', 'read', 'reads'],
  },
  {
    sentence: 'I ___ for this company for over ten years.',
    answer: 'have been working',
    hint: '過去に始まり現在も続く動作は現在完了進行形で表します。',
    hintEn:
      'Use the present perfect continuous for an action that started in the past and is still continuing.',
    translation: '私はこの会社で10年以上働いています。',
    translationEn: 'I have been working for this company for over ten years.',
    choices: ['have been working', 'am working', 'worked', 'work'],
  },
  {
    sentence: 'Not knowing what to say, she ___ silent.',
    answer: 'remained',
    hint: '分詞構文の主節は過去の出来事なので過去形になります。',
    hintEn:
      'The main clause after a participial phrase describing a past situation takes the past tense.',
    translation: '何を言えばいいかわからず、彼女は黙ったままでした。',
    translationEn: 'Not knowing what to say, she remained silent.',
    choices: ['remained', 'remains', 'remaining', 'has remained'],
  },
  {
    sentence: '___ it was raining heavily, we decided to go for a walk.',
    answer: 'Although',
    hint: '前後の内容が逆接であることを示す接続詞です。',
    hintEn: 'A conjunction used to show contrast between two clauses.',
    translation: '雨が激しく降っていましたが、私たちは散歩に行くことにしました。',
    translationEn: 'Although it was raining heavily, we decided to go for a walk.',
    choices: ['Although', 'Because', 'If', 'Unless'],
  },
  {
    sentence: 'By the time we arrived, the movie ___ already started.',
    answer: 'had',
    hint: '過去のある時点よりさらに前に完了した動作は過去完了で表します。',
    hintEn: 'Use the past perfect for an action completed before another point in the past.',
    translation: '私たちが到着したときには、映画はすでに始まっていました。',
    translationEn: 'By the time we arrived, the movie had already started.',
    choices: ['had', 'has', 'was', 'did'],
  },
  {
    sentence: 'If I ___ more money, I would travel around the world.',
    answer: 'had',
    hint: '現実とは異なる仮定を表す仮定法過去です。',
    hintEn:
      'The past subjunctive (unreal conditional) form used for a hypothetical present situation.',
    translation: 'もっとお金があれば、世界中を旅するのに。',
    translationEn: 'If I had more money, I would travel around the world.',
    choices: ['had', 'have', 'has', 'will have'],
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
