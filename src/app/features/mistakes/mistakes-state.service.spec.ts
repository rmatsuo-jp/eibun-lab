import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MistakesState } from './mistakes-state.service';
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
