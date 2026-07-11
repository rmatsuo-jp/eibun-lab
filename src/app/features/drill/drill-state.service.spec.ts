import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DrillState } from './drill-state.service';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import { DrillProgressSyncService } from './drill-progress-sync.service';
import { DRILL_MASTERY_STREAK } from './drill-progress.service';
import { CorrectionSession, DrillProgress, LevelUpItemProgress } from '@core/models/session.model';
import { normalizeDrillKey } from '@core/stats/session-stats.util';

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

// DrillProgressSyncService の簡易インメモリ実装（Firestore同期を経由しない純粋なテストダブル）。
class FakeDrillProgressSync {
  private drill = new Map<string, DrillProgress>();
  private levelUp = new Map<string, Record<string, LevelUpItemProgress>>();

  getDrillProgress(key: string) {
    return this.drill.get(key);
  }

  getLevelUpProgress(sessionId: string) {
    return this.levelUp.get(sessionId) ?? {};
  }

  recordDrillResult(key: string, correct: boolean) {
    const prev = this.drill.get(key);
    this.drill.set(key, {
      correctStreak: correct ? (prev?.correctStreak ?? 0) + 1 : 0,
      lastAttemptAt: new Date().toISOString(),
    });
  }

  setLevelUpItemProgress(
    sessionId: string,
    itemKey: string,
    maskLevel: number,
    completed: boolean,
  ) {
    const existing = this.levelUp.get(sessionId) ?? {};
    this.levelUp.set(sessionId, { ...existing, [itemKey]: { maskLevel, completed } });
  }

  // テスト用ヘルパー: 指定キーを一気に習熟済み（DRILL_MASTERY_STREAK）まで進める。
  masterKey(key: string) {
    for (let i = 0; i < DRILL_MASTERY_STREAK; i++) this.recordDrillResult(key, true);
  }
}

function setup(sessions: CorrectionSession[]) {
  const fakeSync = new FakeDrillProgressSync();
  TestBed.configureTestingModule({
    providers: [
      DrillState,
      { provide: SessionRepositoryService, useValue: { sessions: signal(sessions) } },
      { provide: DrillProgressSyncService, useValue: fakeSync },
    ],
  });
  return { state: TestBed.inject(DrillState), fakeSync };
}

describe('DrillState', () => {
  describe('新規ユーザー（セッション0件）', () => {
    it('isNewUserがtrueになり、start()でsampleModeがtrueになりサンプル問題が出題される', () => {
      const { state } = setup([]);
      expect(state.isNewUser()).toBe(true);

      state.start('cloze');
      expect(state.sampleMode()).toBe(true);
      expect(state.clozeDateChosen()).toBe(true);
      expect(state.quiz().length).toBeGreaterThan(0);
    });

    it('levelupモードのサンプル問題も出題され、日付選択がスキップされる', () => {
      const { state } = setup([]);
      state.start('levelup');
      expect(state.sampleMode()).toBe(true);
      expect(state.levelUpDateChosen()).toBe(true);
      expect(state.levelUpQuiz().length).toBeGreaterThan(0);
    });
  });

  describe('穴埋め復習（cloze）: 出題重み付け', () => {
    it('習熟済み（correctStreak >= DRILL_MASTERY_STREAK）の問題は重みが下がる', () => {
      const session = makeSession({
        id: 's1',
        reviewItems: [
          { sentence: 'a ___ b', answer: 'fox', hint: 'h', translation: 't', choices: ['fox'] },
          { sentence: 'c ___ d', answer: 'dog', hint: 'h', translation: 't', choices: ['dog'] },
        ],
      });
      const { state, fakeSync } = setup([session]);
      state.start('cloze');
      state.selectClozeDate(session);

      const masteredKey = state.quiz().find((q) => q.answer === 'fox')!.key;
      // 習熟前は両方とも基準重み1
      expect(state.quiz().find((q) => q.answer === 'fox')!.weight).toBe(1);

      fakeSync.masterKey(masteredKey);
      state.selectClozeDate(session); // 再構築して重みを再計算させる

      const masteredWeight = state.quiz().find((q) => q.answer === 'fox')!.weight;
      const freshWeight = state.quiz().find((q) => q.answer === 'dog')!.weight;
      expect(masteredWeight).toBeLessThan(freshWeight);
    });

    it('progressForClozeSessionは習熟済み数/全体数を返す', () => {
      const session = makeSession({
        id: 's1',
        reviewItems: [
          { sentence: 'a ___ b', answer: 'fox', hint: 'h', translation: 't', choices: ['fox'] },
          { sentence: 'c ___ d', answer: 'dog', hint: 'h', translation: 't', choices: ['dog'] },
        ],
      });
      const { state, fakeSync } = setup([session]);
      expect(state.progressForClozeSession(session)).toEqual({ done: 0, total: 2 });

      const key = normalizeDrillKey(
        `${session.reviewItems![0].sentence}${session.reviewItems![0].answer}`,
      );
      fakeSync.masterKey(key);
      expect(state.progressForClozeSession(session)).toEqual({ done: 1, total: 2 });
    });
  });

  describe('穴埋め復習: 回答・採点', () => {
    it('choose()で正解を選ぶとscoreが増え、revealedがtrueになる', () => {
      const session = makeSession({
        id: 's1',
        reviewItems: [
          {
            sentence: 'a ___ b',
            answer: 'fox',
            hint: 'h',
            translation: 't',
            choices: ['fox', 'dog'],
          },
        ],
      });
      const { state } = setup([session]);
      state.start('cloze');
      state.selectClozeDate(session);

      state.choose('fox');
      expect(state.currentCorrect()).toBe(true);
      expect(state.score()).toBe(1);
      expect(state.revealed()).toBe(true);
    });

    it('check()で不正解の場合はscoreが増えない', () => {
      const session = makeSession({
        id: 's1',
        reviewItems: [
          {
            sentence: 'a ___ b',
            answer: 'fox',
            hint: 'h',
            translation: 't',
            choices: ['fox', 'dog'],
          },
        ],
      });
      const { state } = setup([session]);
      state.start('cloze');
      state.selectClozeDate(session);
      state.choiceMode.set(false);
      state.userAnswer.set('wrong-answer');

      state.check();
      expect(state.currentCorrect()).toBe(false);
      expect(state.score()).toBe(0);
    });

    it('next()は最後の問題到達でfinishedをtrueにする', () => {
      const session = makeSession({
        id: 's1',
        reviewItems: [
          { sentence: 'a ___ b', answer: 'fox', hint: 'h', translation: 't', choices: ['fox'] },
        ],
      });
      const { state } = setup([session]);
      state.start('cloze');
      state.selectClozeDate(session);
      state.choose('fox');

      state.next();
      expect(state.finished()).toBe(true);
    });
  });

  describe('レベルアップ・タイピング: 境界ケース', () => {
    it('reviewItems/levelUpItemsを持たない旧データのセッションはclozeDates/levelUpDatesから除外される', () => {
      const legacy = makeSession({ id: 'legacy' });
      const { state } = setup([legacy]);
      expect(state.clozeDates()).toEqual([]);
      expect(state.levelUpDates()).toEqual([]);
      expect(state.clozeCount()).toBe(0);
      expect(state.levelUpCount()).toBe(0);
    });

    it('全問習熟済みでもlevelUpAchievementのdone/totalは正しく集計される', () => {
      const session = makeSession({
        id: 's1',
        levelUpItems: [
          {
            original: 'o',
            leveledUp: 'this is a test sentence',
            keyPhrases: ['test'],
            translation: 't',
          },
        ],
      });
      const { state, fakeSync } = setup([session]);
      state.selectLevelUpDate(session);
      const item = state.levelUpQuiz()[0];
      fakeSync.setLevelUpItemProgress(session.id, item.key, item.maxLevel, true);

      expect(state.levelUpAchievement()).toEqual({ done: 1, total: 1 });
      expect(state.progressForSession(session)).toEqual({ done: 1, total: 1 });
    });

    it('checkTyping()でmaxLevelに到達して正解するとmasteredCountが増え、進捗が完了として記録される', () => {
      const session = makeSession({
        id: 's1',
        levelUpItems: [
          { original: 'o', leveledUp: 'short text', keyPhrases: ['short'], translation: 't' },
        ],
      });
      const { state, fakeSync } = setup([session]);
      state.selectLevelUpDate(session);
      state.selectLevelUpSentence(0);

      const item = state.levelUpQuiz()[0];
      state.maskLevel.set(item.maxLevel);
      state.userAnswer.set(item.leveledUp);
      state.checkTyping();

      expect(state.currentCorrect()).toBe(true);
      expect(state.masteredCount()).toBe(1);
      expect(fakeSync.getLevelUpProgress(session.id)[item.key]).toEqual({
        maskLevel: item.maxLevel,
        completed: true,
      });
    });
  });
});
