import { vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PracticeState } from './practice-state.service';
import { GeminiService, CorrectionResult } from '@core/gemini/gemini.service';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import { SettingsStoreService } from '@core/settings/settings-store.service';
import { AuthService } from '@core/firebase/auth.service';

const OK_RESULT: CorrectionResult = {
  corrected: 'corrected text',
  mistakes: [{ category: '文法', original: 'a', corrected: 'b', explanation: '' }],
};

describe('PracticeState', () => {
  let service: PracticeState;
  let correctMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    correctMock = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        PracticeState,
        SessionRepositoryService,
        { provide: AuthService, useValue: { user: signal(null) } },
        { provide: GeminiService, useValue: { correct: correctMock } },
      ],
    });
    service = TestBed.inject(PracticeState);
    TestBed.inject(SettingsStoreService).saveSettings({ apiKey: 'key', modelPriority: ['m1'], theme: 'dark' });
  });

  it('APIキー未設定なら送信せずエラー通知を出す', async () => {
    TestBed.inject(SettingsStoreService).saveSettings({ apiKey: '', modelPriority: ['m1'], theme: 'dark' });
    service.userText.set('hello');
    await service.submit();
    expect(correctMock).not.toHaveBeenCalled();
    expect(service.notice()?.status).toBe('error');
  });

  it('空文字は送信しない', async () => {
    service.userText.set('   ');
    await service.submit();
    expect(correctMock).not.toHaveBeenCalled();
  });

  it('成功時に結果を保存し入力欄をクリアする', async () => {
    correctMock.mockResolvedValue(OK_RESULT);
    service.userText.set('my english text');
    await service.submit();

    expect(service.result()?.corrected).toBe('corrected text');
    expect(service.userText()).toBe('');
    expect(service.notice()?.status).toBe('success');
    expect(TestBed.inject(SessionRepositoryService).sessions().length).toBe(1);
  });

  it('失敗時はエラー通知を出し入力欄は残す', async () => {
    correctMock.mockRejectedValue(new Error('network error'));
    service.userText.set('my english text');
    await service.submit();

    expect(service.userText()).toBe('my english text');
    expect(service.notice()?.status).toBe('error');
    expect(service.error()).toContain('network error');
  });

  it('clear() で入力・結果・エラーをリセットする', () => {
    service.userText.set('x');
    service.error.set('e');
    service.clear();
    expect(service.userText()).toBe('');
    expect(service.result()).toBeNull();
    expect(service.error()).toBe('');
  });

  it('submitBulk で複数件を並列添削しstorageへ保存する', async () => {
    correctMock.mockResolvedValue(OK_RESULT);
    service.setBulkEntries([
      { date: '2026-01-01', text: 'text1' },
      { date: '2026-01-02', text: 'text2' },
    ]);
    await service.submitBulk();

    expect(correctMock).toHaveBeenCalledTimes(2);
    expect(TestBed.inject(SessionRepositoryService).sessions().length).toBe(2);
    expect(service.bulkProgress().every(p => p.status === 'success')).toBe(true);
  });
});
