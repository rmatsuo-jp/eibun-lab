import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HistoryState } from './history-state.service';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import { CorrectionSession } from '@core/models/session.model';

function makeSession(id: string, date: string): CorrectionSession {
  return { id, date, original: '', corrected: '', mistakes: [] };
}

function setup(sessions: CorrectionSession[]) {
  TestBed.configureTestingModule({
    providers: [
      HistoryState,
      { provide: SessionRepositoryService, useValue: { sessions: signal(sessions) } },
    ],
  });
  return TestBed.inject(HistoryState);
}

describe('HistoryState: 同日複数添削のN回目ラベル', () => {
  // toDayKey はローカル日付で判定するため、fixture もローカル時刻表記（Zなし）で揃える。
  const sameDay = [
    makeSession('c', '2026-01-01T18:00:00.000'),
    makeSession('a', '2026-01-01T07:00:00.000'),
    makeSession('b', '2026-01-01T12:00:00.000'),
  ];
  const otherDay = makeSession('d', '2026-01-02T09:00:00.000');

  it('同日内は date 昇順で1始まりの序数が付く', () => {
    const state = setup([...sameDay, otherDay]);
    expect(state.sameDayLabel(sameDay[1])).toBe('1回目');
    expect(state.sameDayLabel(sameDay[2])).toBe('2回目');
    expect(state.sameDayLabel(sameDay[0])).toBe('3回目');
  });

  it('その日1件だけならラベルを出さない', () => {
    const state = setup([...sameDay, otherDay]);
    expect(state.sameDayLabel(otherDay)).toBeNull();
  });

  it('検索フィルタで絞り込んでも序数はずれない（母集団はフィルタ前の全セッション）', () => {
    const state = setup([...sameDay, otherDay]);
    state.searchQuery.set('該当なし');
    expect(state.filteredSessions().length).toBe(0);
    expect(state.sameDayLabel(sameDay[0])).toBe('3回目');
  });
});
