import {
  buildClozeQuiz,
  buildLevelUpQuiz,
  buildMistakeQuiz,
  classifyMistake,
  maskedIndices,
  normalizeAnswer,
} from './quiz.util';

describe('buildMistakeQuiz', () => {
  it('頻出ミスをQuizへ正規化する', () => {
    const quiz = buildMistakeQuiz(
      { category: '文法', original: 'I go', corrected: 'I went', explanation: '過去形', count: 3 },
      'key1',
      2.4,
    );
    expect(quiz).toEqual({
      key: 'key1',
      prompt: 'I go',
      answer: 'I went',
      hint: '過去形',
      badge: '文法',
      weight: 2.4,
    });
  });
});

describe('buildClozeQuiz', () => {
  it('復習カードをQuizへ正規化する', () => {
    const quiz = buildClozeQuiz(
      { sentence: 'I ___ to school.', answer: 'go', hint: '現在形', translation: '私は学校へ行く', choices: ['go', 'went', 'gone', 'going'] },
      'key2',
      1,
    );
    expect(quiz.prompt).toBe('I ___ to school.');
    expect(quiz.answer).toBe('go');
    expect(quiz.badge).toBe('穴埋め');
    expect(quiz.choices).toEqual(['go', 'went', 'gone', 'going']);
  });
});

describe('buildLevelUpQuiz', () => {
  it('leveledUpを単語分割し、maxLevelを3〜6に丸める', () => {
    const quiz = buildLevelUpQuiz(
      { leveledUp: 'This is a short sentence', original: 'This is short', translation: '短い文' },
      'key3',
    );
    expect(quiz.words).toEqual(['This', 'is', 'a', 'short', 'sentence']);
    expect(quiz.maxLevel).toBe(5);
    expect(quiz.hideOrder).toHaveLength(5);
  });

  it('単語数が3未満でもmaxLevelは3を下回らない', () => {
    const quiz = buildLevelUpQuiz({ leveledUp: 'Go now', original: 'Go', translation: '今行け' }, 'key4');
    expect(quiz.maxLevel).toBe(3);
  });

  it('単語数が6を超えてもmaxLevelは6を上回らない', () => {
    const quiz = buildLevelUpQuiz(
      { leveledUp: 'one two three four five six seven eight', original: 'x', translation: 'y' },
      'key5',
    );
    expect(quiz.maxLevel).toBe(6);
  });
});

describe('classifyMistake', () => {
  const item = buildLevelUpQuiz({ leveledUp: 'This is a short sentence', original: 'x', translation: 'y' }, 'k');

  it('単語数が一致しない場合はgapと判定する', () => {
    expect(classifyMistake(item, 'This is short', 0)).toBe('gap');
  });

  it('maskLevel=0（全単語表示）で不一致があればtypoと判定する', () => {
    // level=0 なので hidden は空集合 → どの単語が不一致でも typo
    expect(classifyMistake(item, 'This is a short sentense', 0)).toBe('typo');
  });

  it('隠れている単語で不一致があればgapと判定する', () => {
    // maxLevel分（全単語マスク）で不一致 → 必ず隠れた単語を含むためgap
    expect(classifyMistake(item, 'This is a short sentense', item.maxLevel)).toBe('gap');
  });
});

describe('normalizeAnswer / maskedIndices', () => {
  it('大文字小文字・末尾句読点・空白差異を吸収する', () => {
    expect(normalizeAnswer('  Hello, World!  ')).toBe('hello, world');
  });

  it('maskedIndicesはlevelに比例した件数を隠す', () => {
    const hideOrder = [0, 1, 2, 3];
    expect(maskedIndices(hideOrder, 4, 4, 0).size).toBe(0);
    expect(maskedIndices(hideOrder, 4, 4, 4).size).toBe(4);
  });
});
