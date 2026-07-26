import {
  buildClozeQuiz,
  buildLevelUpQuiz,
  classifyMistake,
  maskedIndices,
  normalizeAnswer,
} from './quiz.util';

describe('buildClozeQuiz', () => {
  it('復習カードをQuizへ正規化する', () => {
    const quiz = buildClozeQuiz(
      {
        sentence: 'I ___ to school.',
        answer: 'go',
        hint: '現在形',
        translation: '私は学校へ行く',
        choices: ['go', 'went', 'gone', 'going'],
      },
      'key2',
      1,
    );
    expect(quiz.prompt).toBe('I ___ to school.');
    expect(quiz.answer).toBe('go');
    expect(quiz.badge).toBe('穴埋め');
    expect(quiz.choices).toEqual(expect.arrayContaining(['go', 'went', 'gone', 'going']));
    expect(quiz.choices).toHaveLength(4);
  });

  it('choicesをシャッフルしても常に先頭が正解になるとは限らない', () => {
    const results = Array.from({ length: 50 }, () =>
      buildClozeQuiz(
        {
          sentence: 'I ___ to school.',
          answer: 'go',
          hint: '現在形',
          translation: '私は学校へ行く',
          choices: ['go', 'went', 'gone', 'going'],
        },
        'key2',
        1,
      ),
    );
    expect(results.some((q) => q.choices?.[0] !== 'go')).toBe(true);
  });

  it('choicesとchoiceExplanationsは同じ順列でシャッフルされ対応関係を保つ', () => {
    const quiz = buildClozeQuiz(
      {
        sentence: 'I ___ to school.',
        answer: 'go',
        hint: '現在形',
        translation: '私は学校へ行く',
        choices: ['go', 'went', 'gone', 'going'],
        choiceExplanations: ['正解:現在形', '過去形なので誤り', '過去分詞なので誤り', '進行形なので誤り'],
      },
      'key2',
      1,
    );
    const explanationByChoice: Record<string, string> = {
      go: '正解:現在形',
      went: '過去形なので誤り',
      gone: '過去分詞なので誤り',
      going: '進行形なので誤り',
    };
    quiz.choices?.forEach((c, i) => {
      expect(quiz.choiceExplanations?.[i]).toBe(explanationByChoice[c]);
    });
  });
});

describe('buildLevelUpQuiz', () => {
  it('leveledUpを単語分割し、maxLevelを3〜4に丸める', () => {
    const quiz = buildLevelUpQuiz(
      { leveledUp: 'This is a short sentence', original: 'This is short', translation: '短い文' },
      'key3',
    );
    expect(quiz.words).toEqual(['This', 'is', 'a', 'short', 'sentence']);
    expect(quiz.maxLevel).toBe(4);
    expect(quiz.hideOrder).toHaveLength(5);
  });

  it('単語数が3未満でもmaxLevelは3を下回らない', () => {
    const quiz = buildLevelUpQuiz(
      { leveledUp: 'Go now', original: 'Go', translation: '今行け' },
      'key4',
    );
    expect(quiz.maxLevel).toBe(3);
  });

  it('単語数が4を超えてもmaxLevelは4を上回らない', () => {
    const quiz = buildLevelUpQuiz(
      { leveledUp: 'one two three four five six seven eight', original: 'x', translation: 'y' },
      'key5',
    );
    expect(quiz.maxLevel).toBe(4);
  });
});

describe('classifyMistake', () => {
  const item = buildLevelUpQuiz(
    { leveledUp: 'This is a short sentence', original: 'x', translation: 'y' },
    'k',
  );

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
