/**
 * @file 添削タブでユーザーが書く内容に迷ったときのテーマ提案用の静的データ。
 * Gemini API は呼ばず、日記・意見文・描写文・メールの4カテゴリからハードコードしたテーマ文を提供する。
 * features/practice の日付選択の右側に表示するテーマ提案カードが参照する。
 */

export interface PracticeTheme {
  category: 'diary' | 'opinion' | 'description' | 'letter';
  ja: string;
  en: string;
}

// ── テーマ候補（4カテゴリ、各6件、計24件） ──────────────────────
export const PRACTICE_THEMES: PracticeTheme[] = [
  // 日記
  {
    category: 'diary',
    ja: '今日あった小さな出来事について書いてみましょう。',
    en: 'Write about a small thing that happened today.',
  },
  {
    category: 'diary',
    ja: '今日食べた食事の中で一番おいしかったものについて書いてみましょう。',
    en: 'Write about the best meal you had today.',
  },
  {
    category: 'diary',
    ja: '今週末の予定について書いてみましょう。',
    en: 'Write about your plans for this weekend.',
  },
  {
    category: 'diary',
    ja: '最近始めた新しい習慣について書いてみましょう。',
    en: 'Write about a new habit you recently started.',
  },
  {
    category: 'diary',
    ja: '今日感じた小さな喜びについて書いてみましょう。',
    en: 'Write about a small joy you felt today.',
  },
  {
    category: 'diary',
    ja: '今日の天気とそれがあなたの気分に与えた影響について書いてみましょう。',
    en: "Write about today's weather and how it affected your mood.",
  },
  // 意見文
  {
    category: 'opinion',
    ja: '在宅勤務と出社、どちらが良いと思うか意見を書いてみましょう。',
    en: 'Write your opinion on whether working from home or at the office is better.',
  },
  {
    category: 'opinion',
    ja: 'SNSが人間関係に与える影響について、あなたの考えを書いてみましょう。',
    en: 'Write your thoughts on how social media affects relationships.',
  },
  {
    category: 'opinion',
    ja: '子どもにスマートフォンを持たせる時期について、あなたの意見を書いてみましょう。',
    en: 'Write your opinion on when children should be allowed to have smartphones.',
  },
  {
    category: 'opinion',
    ja: '英語学習において最も大切だと思うことについて書いてみましょう。',
    en: 'Write about what you think is most important when learning English.',
  },
  {
    category: 'opinion',
    ja: '週4日勤務制について、賛成か反対かとその理由を書いてみましょう。',
    en: 'Write whether you agree or disagree with a four-day work week and why.',
  },
  {
    category: 'opinion',
    ja: '旅行は一人旅とグループ旅行のどちらが良いか、あなたの意見を書いてみましょう。',
    en: 'Write your opinion on whether solo travel or group travel is better.',
  },
  // 描写文
  {
    category: 'description',
    ja: 'あなたのお気に入りの場所について、詳しく描写してみましょう。',
    en: 'Describe your favorite place in detail.',
  },
  {
    category: 'description',
    ja: 'あなたが尊敬する人物の性格や外見について描写してみましょう。',
    en: 'Describe the personality and appearance of someone you admire.',
  },
  {
    category: 'description',
    ja: '子どもの頃に住んでいた家について描写してみましょう。',
    en: 'Describe the house you lived in as a child.',
  },
  {
    category: 'description',
    ja: 'あなたが飼っている、または飼いたいペットについて描写してみましょう。',
    en: 'Describe a pet you have or would like to have.',
  },
  {
    category: 'description',
    ja: '今まで見た中で一番印象に残っている景色について描写してみましょう。',
    en: 'Describe the most memorable view you have ever seen.',
  },
  {
    category: 'description',
    ja: 'あなたの理想の休日の過ごし方について描写してみましょう。',
    en: 'Describe your ideal way to spend a day off.',
  },
  // メール・手紙
  {
    category: 'letter',
    ja: '友人を誕生日パーティーに招待するメールを書いてみましょう。',
    en: 'Write an email inviting a friend to a birthday party.',
  },
  {
    category: 'letter',
    ja: '海外の取引先に会議日程の変更を依頼するメールを書いてみましょう。',
    en: 'Write an email to an overseas client asking to change a meeting schedule.',
  },
  {
    category: 'letter',
    ja: '久しぶりに連絡する旧友への近況報告の手紙を書いてみましょう。',
    en: 'Write a letter to an old friend updating them on your life after a long time.',
  },
  {
    category: 'letter',
    ja: 'お世話になった先生への感謝の手紙を書いてみましょう。',
    en: 'Write a thank-you letter to a teacher who has helped you.',
  },
  {
    category: 'letter',
    ja: 'ホテルの予約を変更してもらうための問い合わせメールを書いてみましょう。',
    en: 'Write an inquiry email asking a hotel to change your reservation.',
  },
  {
    category: 'letter',
    ja: '新しい同僚に自己紹介するメールを書いてみましょう。',
    en: 'Write an email introducing yourself to a new colleague.',
  },
];
