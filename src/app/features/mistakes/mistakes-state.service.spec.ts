import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MISTAKE_SECTIONS, MistakesState } from './mistakes-state.service';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import { CorrectionSession, WritingEvaluation } from '@core/models/session.model';

function makeEvaluation(partial: Partial<WritingEvaluation>): WritingEvaluation {
  return {
    grammarScore: 5,
    vocabularyScore: 5,
    contentScore: 5,
    overallScore: 5,
    errorDensity: 1,
    grammarCefr: 'B1',
    vocabularyCefr: 'B1',
    contentCefr: 'B1',
    overallCefr: 'B1',
    ...partial,
  };
}

function makeSession(partial: Partial<CorrectionSession>): CorrectionSession {
  return {
    id: partial.id ?? 'id',
    date: partial.date ?? new Date().toISOString(),
    original: partial.original ?? '',
    corrected: partial.corrected ?? '',
    mistakes: partial.mistakes ?? [],
    ...partial,
  };
}

function setup(sessions: CorrectionSession[]) {
  TestBed.configureTestingModule({
    providers: [
      MistakesState,
      { provide: SessionRepositoryService, useValue: { sessions: signal(sessions) } },
    ],
  });
  return TestBed.inject(MistakesState);
}

describe('MistakesState', () => {
  describe('scoreDomain: 動的ズーム（0.5刻み丸め＋パディング）', () => {
    it('評価データが無い場合は0〜10固定', () => {
      const state = setup([]);
      expect(state.scoreDomain()).toEqual({ min: 0, max: 10 });
    });

    it('データ範囲の上下に0.5パディングを付け、0.5刻みに丸める', () => {
      const state = setup([
        makeSession({
          id: 'a',
          date: '2026-01-01',
          evaluation: makeEvaluation({ overallScore: 4.2 }),
        }),
        makeSession({
          id: 'b',
          date: '2026-01-02',
          evaluation: makeEvaluation({ overallScore: 6.3 }),
        }),
      ]);
      // min候補: floor((4.2-0.5)*2)/2 = floor(7.4)/2 = 7/2 = 3.5
      // max候補: ceil((6.3+0.5)*2)/2 = ceil(13.6)/2 = 14/2 = 7
      expect(state.scoreDomain()).toEqual({ min: 3.5, max: 7 });
    });

    it('全データが同値に近い場合でも最低1点分の幅を確保する', () => {
      const state = setup([
        makeSession({
          id: 'a',
          date: '2026-01-01',
          evaluation: makeEvaluation({ overallScore: 5 }),
        }),
        makeSession({
          id: 'b',
          date: '2026-01-02',
          evaluation: makeEvaluation({ overallScore: 5 }),
        }),
      ]);
      const domain = state.scoreDomain();
      expect(domain.max - domain.min).toBeGreaterThanOrEqual(1);
    });

    it('範囲は0〜10でクランプされる（下限・上限を超えない）', () => {
      const state = setup([
        makeSession({
          id: 'a',
          date: '2026-01-01',
          evaluation: makeEvaluation({ overallScore: 0.1 }),
        }),
        makeSession({
          id: 'b',
          date: '2026-01-02',
          evaluation: makeEvaluation({ overallScore: 9.9 }),
        }),
      ]);
      const domain = state.scoreDomain();
      expect(domain.min).toBeGreaterThanOrEqual(0);
      expect(domain.max).toBeLessThanOrEqual(10);
    });
  });

  describe('scoreChart: JITTER_PXによる重複データ点の見分けやすさ', () => {
    it('同値の系列でもx座標が同じ場合、系列ごとにy座標が異なる（重ならない）', () => {
      const state = setup([
        makeSession({
          id: 'a',
          date: '2026-01-01',
          evaluation: makeEvaluation({
            overallScore: 5,
            grammarScore: 5,
            vocabularyScore: 5,
            contentScore: 5,
          }),
        }),
        makeSession({
          id: 'b',
          date: '2026-01-02',
          evaluation: makeEvaluation({
            overallScore: 5,
            grammarScore: 5,
            vocabularyScore: 5,
            contentScore: 5,
          }),
        }),
      ]);
      const chart = state.scoreChart();
      expect(chart).toHaveLength(4);
      const ys = chart.map((series) => series.dots[0].y);
      // 全系列が同スコアでも、jitterにより各系列のyはすべて異なる
      expect(new Set(ys).size).toBe(4);
    });

    it('データが1件以下の場合はscoreChart/cefrChartとも空配列を返す', () => {
      const state = setup([
        makeSession({ id: 'a', date: '2026-01-01', evaluation: makeEvaluation({}) }),
      ]);
      expect(state.scoreChart()).toEqual([]);
      expect(state.cefrChart()).toEqual([]);
    });
  });

  describe('i18nラベル・構成ロジックの委譲', () => {
    it('categoryLabelは正規化済みカテゴリを翻訳して返す', () => {
      const state = setup([]);
      expect(state.categoryLabel('文法')).toBe('文法');
    });

    it('mistakeCategoryLabel/mistakeExplanationはMistakeを翻訳して返す', () => {
      const state = setup([]);
      const mistake = { category: '文法', original: 'a', corrected: 'b', explanation: 'exp' };
      expect(state.mistakeCategoryLabel(mistake)).toBe('文法');
      expect(state.mistakeExplanation(mistake)).toBe('exp');
    });

    it('toggleHighlightは同名を渡すとnullに戻り、別名を渡すと切り替わる', () => {
      const state = setup([]);
      expect(state.highlightedSeries()).toBeNull();
      state.toggleHighlight('総合');
      expect(state.highlightedSeries()).toBe('総合');
      state.toggleHighlight('総合');
      expect(state.highlightedSeries()).toBeNull();
    });
  });
});

// ── 追加セクション（改善/悪化トレンド・未克服ミス・再発ミス・AI診断）の computed ──
describe('MistakesState: ミス傾向の追加セクション', () => {
  const mistake = (original: string) => ({
    category: '文法',
    original,
    corrected: 'fixed',
    explanation: '',
  });

  it('aiInsights は直近3件のうち診断テキストを持つセッションだけを返す', () => {
    const state = setup([
      makeSession({ id: '1', grammarTendency: '冠詞の脱落が多い' }),
      makeSession({ id: '2' }), // 診断テキスト無しは除外
      makeSession({ id: '3', studyPlan: '毎日3文書く' }),
      makeSession({ id: '4', cefrRationale: '4件目は直近3件の範囲外' }),
    ]);
    expect(state.aiInsights().map((i) => i.grammarTendency ?? i.studyPlan)).toEqual([
      '冠詞の脱落が多い',
      '毎日3文書く',
    ]);
  });

  it('recurring は別々の日に再登場したミスだけを返す', () => {
    const state = setup([
      makeSession({ id: '1', date: '2026-01-10T00:00:00.000Z', mistakes: [mistake('a apple')] }),
      makeSession({ id: '2', date: '2026-02-10T00:00:00.000Z', mistakes: [mistake('a apple')] }),
      makeSession({ id: '3', date: '2026-02-11T00:00:00.000Z', mistakes: [mistake('go to home')] }),
    ]);
    expect(state.recurring().map((m) => m.original)).toEqual(['a apple']);
    expect(state.recurring()[0].dayCount).toBe(2);
  });

  it('unmastered は進捗が無いミスを未着手として返す', () => {
    const state = setup([makeSession({ id: '1', mistakes: [mistake('a apple')] })]);
    expect(state.unmastered().map((m) => m.state)).toEqual(['untouched']);
  });

  it('categoryTrends は比較対象が無ければ空（セクションごと非表示）', () => {
    const state = setup([makeSession({ id: '1', mistakes: [mistake('a apple')] })]);
    expect(state.categoryTrends()).toEqual([]);
  });

  it('densityChart は評価が2件未満なら null', () => {
    const state = setup([makeSession({ id: '1', evaluation: makeEvaluation({}) })]);
    expect(state.densityChart()).toBeNull();
  });
});

describe('MistakesState: セクションの開閉状態', () => {
  beforeEach(() => localStorage.clear());

  it('行動優先の上位2セクション（未克服ミス・再発ミス）だけが既定で展開されている', () => {
    const state = setup([]);
    expect(state.isOpen('unmastered')).toBe(true);
    expect(state.isOpen('recurring')).toBe(true);
    for (const id of MISTAKE_SECTIONS.filter((s) => s !== 'unmastered' && s !== 'recurring')) {
      expect(state.isOpen(id)).toBe(false);
    }
  });

  it('toggleSection ですべてのセクションを開閉できる', () => {
    const state = setup([]);
    for (const id of MISTAKE_SECTIONS) {
      const before = state.isOpen(id);
      state.toggleSection(id);
      expect(state.isOpen(id)).toBe(!before);
    }
  });

  it('開閉状態は localStorage に保存され、次のインスタンスで復元される', () => {
    const state = setup([]);
    state.toggleSection('unmastered'); // true → false
    state.toggleSection('category'); // false → true

    TestBed.resetTestingModule();
    const restored = setup([]);
    expect(restored.isOpen('unmastered')).toBe(false);
    expect(restored.isOpen('category')).toBe(true);
    expect(restored.isOpen('recurring')).toBe(true); // 触っていないものは既定値のまま
  });

  it('保存値が壊れていても既定値にフォールバックする', () => {
    localStorage.setItem('eibun-lab-mistakes-sections', '{"unmastered":"yes","unknown":true}');
    const state = setup([]);
    expect(state.isOpen('unmastered')).toBe(true); // boolean でない値は無視して既定値
    expect(state.isOpen('category')).toBe(false);
  });
});
