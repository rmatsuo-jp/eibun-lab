import { vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Drill } from './drill';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import { DrillProgressSyncService } from './drill-progress-sync.service';
import { I18nService } from '@core/i18n/i18n.service';

// サンプル問題出題中（sampleMode）はDrillProgressSyncServiceへの永続化を行わないことを検証する。
// 89a06b5（サンプル問題出題中の「日付選択に戻る」不具合修正）と同種の回帰を検知するためのテスト。
describe('Drill - sampleMode', () => {
  let component: Drill;
  let recordDrillResult: ReturnType<typeof vi.fn>;
  let setLevelUpItemProgress: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    recordDrillResult = vi.fn();
    setLevelUpItemProgress = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        Drill,
        { provide: SessionRepositoryService, useValue: { sessions: signal([]) } },
        {
          provide: DrillProgressSyncService,
          useValue: {
            getDrillProgress: () => undefined,
            getLevelUpProgress: () => ({}),
            recordDrillResult,
            setLevelUpItemProgress,
          },
        },
        { provide: I18nService, useValue: { lang: () => 'ja' } },
      ],
    });
    component = TestBed.inject(Drill);
  });

  it('セッション0件の新規ユーザーはsampleMode=trueで開始する', () => {
    component.start('cloze');
    expect(component.sampleMode()).toBe(true);
  });

  it('sampleMode中のclozeで採点してもrecordDrillResultは呼ばれない', () => {
    component.start('cloze');
    component.userAnswer.set(component.current()!.answer);
    component.check();
    expect(component.revealed()).toBe(true);
    expect(recordDrillResult).not.toHaveBeenCalled();
  });

  it('sampleMode中のlevelupで正解してもsetLevelUpItemProgressは呼ばれない（currentSessionId=nullで自動ガード）', () => {
    component.start('levelup');
    expect(component.currentSessionId()).toBeNull();
    component.userAnswer.set(component.currentLevelUp()!.leveledUp);
    component.checkTyping();
    expect(component.revealed()).toBe(true);
    expect(setLevelUpItemProgress).not.toHaveBeenCalled();
  });

  it('sampleMode中はbackToDateSelectがrestart()相当でモード選択画面まで戻す', () => {
    component.start('cloze');
    component.backToDateSelect();
    expect(component.started()).toBe(false);
  });
});
