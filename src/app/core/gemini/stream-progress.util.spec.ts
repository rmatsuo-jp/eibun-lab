import { beforeEach, describe, expect, it } from 'vitest';
import {
  computeProgress,
  DEFAULT_EXPECTED_CHARS,
  getExpectedTotalChars,
  MAX_STREAM_PERCENT,
  median,
  recordResponseLength,
} from './stream-progress.util';

describe('computeProgress', () => {
  it('マイルストーン未到達かつ短文なら文字数比で算出する', () => {
    // 1000文字 / 期待10000文字 * 95 = 9.5 → floor 9
    expect(computeProgress('a'.repeat(1000), 10000)).toBe(9);
  });

  it('到達済みマイルストーンを下限として使う（文字数比が低くても下がらない）', () => {
    const text = 'x</corrected-text>';
    expect(computeProgress(text, 100000)).toBe(20);
  });

  it('後続のマイルストーンに到達すると進捗が上がる', () => {
    const text = '</corrected-text></mistakes></evaluation>';
    expect(computeProgress(text, 100000)).toBe(45);
  });

  it('文字数比がマイルストーンを上回る場合は文字数比を採る', () => {
    // 到達は 20%、文字数比は 500/1000*95 = 47.5 → 47
    const text = '</corrected-text>'.padEnd(500, 'a');
    expect(computeProgress(text, 1000)).toBe(47);
  });

  it('ストリーム中は MAX_STREAM_PERCENT を超えない', () => {
    expect(computeProgress('a'.repeat(100000), 1000)).toBe(MAX_STREAM_PERCENT);
  });

  it('期待文字数が0以下でも既定値で計算しNaNにならない', () => {
    const percent = computeProgress('a'.repeat(DEFAULT_EXPECTED_CHARS), 0);
    expect(percent).toBe(MAX_STREAM_PERCENT);
  });
});

describe('median', () => {
  it('奇数個は中央の値', () => expect(median([3, 1, 2])).toBe(2));
  it('偶数個は中央2件の平均', () => expect(median([1, 2, 3, 4])).toBe(2.5));
});

describe('getExpectedTotalChars / recordResponseLength', () => {
  beforeEach(() => localStorage.clear());

  it('履歴が無ければ既定値を返す', () => {
    expect(getExpectedTotalChars()).toBe(DEFAULT_EXPECTED_CHARS);
  });

  it('記録した長さの中央値を返す', () => {
    [100, 300, 200].forEach(recordResponseLength);
    expect(getExpectedTotalChars()).toBe(200);
  });

  it('直近10件のみ保持する', () => {
    // 先頭の外れ値(999999)が押し出され、中央値が 1〜10 の範囲へ収まることで確認する。
    recordResponseLength(999999);
    for (let i = 1; i <= 10; i++) recordResponseLength(i);
    expect(getExpectedTotalChars()).toBe(5.5);
  });

  it('0以下の長さは記録しない', () => {
    recordResponseLength(0);
    expect(getExpectedTotalChars()).toBe(DEFAULT_EXPECTED_CHARS);
  });
});
