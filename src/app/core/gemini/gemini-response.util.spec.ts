import { vi } from 'vitest';
import {
  buildLegacyProse,
  parseEvaluation,
  parseLevelUp,
  parseMistakes,
  parseReview,
  PROSE_SECTIONS,
} from './gemini-response.util';

const noop = () => {
  /* エラー通知を無視する既定のレポーター */
};

describe('parseMistakes', () => {
  it('mistakes 配列を取り出す', () => {
    const text =
      '<mistakes>{"mistakes":[{"category":"文法","original":"a","corrected":"b","explanation":"e"}]}</mistakes>';
    expect(parseMistakes(text, noop)).toHaveLength(1);
  });

  it('タグが無ければ空配列を返し no-tag を通知する', () => {
    const onError = vi.fn();
    expect(parseMistakes('本文のみ', onError)).toEqual([]);
    expect(onError).toHaveBeenCalledWith('no-tag', expect.any(String));
  });

  it('mistakes が配列でなければ空配列を返す', () => {
    expect(parseMistakes('<mistakes>{"mistakes":"nope"}</mistakes>', noop)).toEqual([]);
  });
});

describe('parseEvaluation', () => {
  const scores = '"grammarScore":8,"vocabularyScore":7,"contentScore":6,"errorDensity":0.1';

  it('3観点スコアと errorDensity が揃えば評価を組み立てる', () => {
    const result = parseEvaluation(`<evaluation>{${scores}}</evaluation>`, noop);
    expect(result?.grammarScore).toBe(8);
    expect(result?.overallScore).toBeTypeOf('number');
    expect(result?.overallCefr).toBeTruthy();
  });

  it('AI が返した CEFR 判定値を優先採用する', () => {
    const result = parseEvaluation(
      `<evaluation>{${scores},"grammarCefr":"B2","overallCefr":"B1"}</evaluation>`,
      noop,
    );
    expect(result?.grammarCefr).toBe('B2');
    expect(result?.overallCefr).toBe('B1');
  });

  it('スコアが1つでも欠けると undefined を返す', () => {
    const onError = vi.fn();
    const text = '<evaluation>{"grammarScore":8,"vocabularyScore":7,"contentScore":6}</evaluation>';
    expect(parseEvaluation(text, onError)).toBeUndefined();
    expect(onError).toHaveBeenCalledWith('validation', expect.any(String));
  });
});

describe('parseLevelUp', () => {
  const valid = {
    original: 'a',
    leveledUp: 'b',
    translation: 'c',
    keyPhrases: ['b'],
  };

  it('必須フィールドが揃った項目だけを採用する', () => {
    const text = `<levelup>${JSON.stringify({
      levelUpItems: [valid, { original: 'x' }],
    })}</levelup>`;
    expect(parseLevelUp(text, noop)).toEqual([valid]);
  });

  it('空文字を含む keyPhrases の項目は除外する', () => {
    const text = `<levelup>${JSON.stringify({
      levelUpItems: [{ ...valid, keyPhrases: [''] }],
    })}</levelup>`;
    expect(parseLevelUp(text, noop)).toBeUndefined();
  });

  it('1件も残らなければ undefined を返す', () => {
    expect(parseLevelUp('<levelup>{"levelUpItems":[]}</levelup>', noop)).toBeUndefined();
  });
});

describe('parseReview', () => {
  const card = {
    sentence: 's',
    answer: 'a',
    hint: 'h',
    translation: 't',
    choices: ['a', 'b', 'c', 'd'],
  };

  it('choices が4要素かつ answer を含むカードを採用する', () => {
    const text = `<review>${JSON.stringify({ reviewItems: [card] })}</review>`;
    expect(parseReview(text, noop)).toEqual([card]);
  });

  it('choices に正解が含まれないカードは除外する', () => {
    const text = `<review>${JSON.stringify({
      reviewItems: [{ ...card, choices: ['w', 'x', 'y', 'z'] }],
    })}</review>`;
    expect(parseReview(text, noop)).toBeUndefined();
  });

  it('choices と要素数が合わない choiceExplanations だけを取り除く', () => {
    const text = `<review>${JSON.stringify({
      reviewItems: [{ ...card, choiceExplanations: ['1', '2'] }],
    })}</review>`;
    const result = parseReview(text, noop);
    expect(result?.[0].choiceExplanations).toBeUndefined();
    expect(result?.[0].sentence).toBe('s');
  });

  it('要素数が一致する choiceExplanations は残す', () => {
    const explanations = ['1', '2', '3', '4'];
    const text = `<review>${JSON.stringify({
      reviewItems: [{ ...card, choiceExplanations: explanations }],
    })}</review>`;
    expect(parseReview(text, noop)?.[0].choiceExplanations).toEqual(explanations);
  });
});

describe('buildLegacyProse', () => {
  it('抽出できた項目だけを見出し付きで結合する', () => {
    const out = buildLegacyProse([
      { heading: '見出しA', text: '本文A' },
      { heading: '見出しB', text: undefined },
      { heading: '見出しC', text: '本文C' },
    ]);
    expect(out).toBe('【見出しA】\n本文A\n\n【見出しC】\n本文C');
  });

  it('全項目が欠落していれば空文字を返す', () => {
    expect(buildLegacyProse([{ heading: '見出しA', text: undefined }])).toBe('');
  });
});

describe('PROSE_SECTIONS', () => {
  it('id / tag / heading がすべて一意（結合プローズの重複見出しを防ぐ）', () => {
    for (const key of ['id', 'tag', 'heading'] as const) {
      const values = PROSE_SECTIONS.map((s) => s[key]);
      expect(new Set(values).size).toBe(values.length);
    }
  });
});
