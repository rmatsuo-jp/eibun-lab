import { StorageService, cefrToNumber } from './storage.service';
import { CorrectionSession } from '../models/session.model';

// テスト用セッション生成ヘルパ
function makeSession(partial: Partial<CorrectionSession>): CorrectionSession {
  return {
    id: partial.id ?? Math.random().toString(),
    date: partial.date ?? new Date().toISOString(),
    original: partial.original ?? '',
    corrected: partial.corrected ?? '',
    mistakes: partial.mistakes ?? [],
    cefr: partial.cefr,
  };
}

// n 日前の ISO 文字列
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

describe('cefrToNumber', () => {
  it('CEFR レベルを 1〜6 に変換する', () => {
    expect(cefrToNumber('A1')).toBe(1);
    expect(cefrToNumber('b1')).toBe(3);
    expect(cefrToNumber('C2')).toBe(6);
  });

  it('未知の値は 0 を返す', () => {
    expect(cefrToNumber('X9')).toBe(0);
    expect(cefrToNumber('')).toBe(0);
  });
});

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    localStorage.clear();
    service = new StorageService();
  });

  describe('getStudyStats', () => {
    it('セッションが無いときはゼロ値を返す', () => {
      const s = service.getStudyStats();
      expect(s.totalSessions).toBe(0);
      expect(s.totalMistakes).toBe(0);
      expect(s.avgMistakes).toBe(0);
      expect(s.currentStreak).toBe(0);
    });

    it('総数・平均ミス数を集計する', () => {
      service.saveSession(makeSession({ mistakes: [{ category: '文法', original: 'a', corrected: 'b', explanation: '' }] }));
      service.saveSession(makeSession({ mistakes: [] }));
      service.saveSession(makeSession({ mistakes: [{ category: '語彙', original: 'c', corrected: 'd', explanation: '' }, { category: '文法', original: 'e', corrected: 'f', explanation: '' }] }));
      const s = service.getStudyStats();
      expect(s.totalSessions).toBe(3);
      expect(s.totalMistakes).toBe(3);
      expect(s.avgMistakes).toBe(1); // 3 / 3
    });

    it('今日・昨日・一昨日の連続学習で streak=3 になる', () => {
      service.saveSession(makeSession({ id: '1', date: daysAgo(0) }));
      service.saveSession(makeSession({ id: '2', date: daysAgo(1) }));
      service.saveSession(makeSession({ id: '3', date: daysAgo(2) }));
      expect(service.getStudyStats().currentStreak).toBe(3);
    });

    it('間が空くと streak は途切れる', () => {
      service.saveSession(makeSession({ id: '1', date: daysAgo(0) }));
      service.saveSession(makeSession({ id: '2', date: daysAgo(3) }));
      expect(service.getStudyStats().currentStreak).toBe(1);
    });
  });

  describe('getCefrHistory', () => {
    it('cefr を持つセッションのみ日付昇順で返す', () => {
      service.saveSession(makeSession({ id: '1', date: daysAgo(2), cefr: { grammar: 'A2', vocabulary: 'A2', content: 'B1' } }));
      service.saveSession(makeSession({ id: '2', date: daysAgo(1) })); // cefr なし
      service.saveSession(makeSession({ id: '3', date: daysAgo(0), cefr: { grammar: 'B1', vocabulary: 'B1', content: 'B2' } }));
      const hist = service.getCefrHistory();
      expect(hist.length).toBe(2);
      expect(hist[0].cefr.grammar).toBe('A2'); // 古い方が先頭
      expect(hist[1].cefr.grammar).toBe('B1');
    });
  });
});
