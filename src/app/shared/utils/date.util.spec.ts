import {
  FULL_DATE_OPTIONS,
  formatLocaleDate,
  formatShortDate,
  formatTimestampForFilename,
  toDayKey,
} from './date.util';

describe('formatTimestampForFilename', () => {
  it('ローカル時刻を YYMMDDhhmm でゼロ埋めする', () => {
    expect(formatTimestampForFilename(new Date(2026, 0, 5, 9, 7))).toBe('2601050907');
  });

  it('年は下2桁のみを使う', () => {
    expect(formatTimestampForFilename(new Date(2030, 11, 31, 23, 59))).toBe('3012312359');
  });
});

describe('toDayKey', () => {
  it('ISO日時をローカル時刻の YYYY-MM-DD に正規化する', () => {
    expect(toDayKey(new Date(2026, 0, 5, 12, 0).toISOString())).toBe('2026-01-05');
  });

  it('月日をゼロ埋めする', () => {
    expect(toDayKey(new Date(2026, 8, 9, 0, 30).toISOString())).toBe('2026-09-09');
  });

  it('同じ日の異なる時刻は同じキーになる（streak集計の前提）', () => {
    const morning = new Date(2026, 4, 20, 1, 0).toISOString();
    const night = new Date(2026, 4, 20, 23, 30).toISOString();
    expect(toDayKey(morning)).toBe(toDayKey(night));
  });
});

describe('formatShortDate', () => {
  it('M/D 形式にする（ゼロ埋めしない）', () => {
    expect(formatShortDate(new Date(2026, 0, 5, 12, 0).toISOString())).toBe('1/5');
  });
});

describe('formatLocaleDate', () => {
  const date = new Date(2026, 0, 5, 12, 0);

  it("lang が 'en' なら英語ロケールで整形する", () => {
    expect(formatLocaleDate(date, 'en', { year: 'numeric', month: 'long' })).toBe('January 2026');
  });

  it("lang が 'en' 以外なら日本語ロケールで整形する", () => {
    expect(formatLocaleDate(date, 'ja', { year: 'numeric', month: 'long' })).toBe('2026年1月');
  });

  it('ISO文字列でも Date でも同じ結果になる', () => {
    expect(formatLocaleDate(date.toISOString(), 'ja', FULL_DATE_OPTIONS)).toBe(
      formatLocaleDate(date, 'ja', FULL_DATE_OPTIONS),
    );
  });

  it('FULL_DATE_OPTIONS は曜日まで含む', () => {
    expect(formatLocaleDate(date, 'ja', FULL_DATE_OPTIONS)).toContain('月');
  });
});
