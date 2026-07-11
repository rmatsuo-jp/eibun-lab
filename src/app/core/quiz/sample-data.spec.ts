import { SAMPLE_LEVELUP_ITEMS, SAMPLE_REVIEW_ITEMS } from './sample-data';

// GeminiServiceのparseReview/parseLevelUpが要求する形状(gemini.service.ts)と同じ制約を
// 静的サンプルデータに対しても保証し、データ側の入力ミスで出題が壊れないようにする。
describe('sample-data', () => {
  it('SAMPLE_REVIEW_ITEMS は choices が4件かつ answer を含む', () => {
    for (const item of SAMPLE_REVIEW_ITEMS) {
      expect(item.choices.length).toBe(4);
      expect(item.choices).toContain(item.answer);
    }
  });

  it('SAMPLE_LEVELUP_ITEMS の keyPhrases は leveledUp 内に実在する', () => {
    for (const item of SAMPLE_LEVELUP_ITEMS) {
      for (const phrase of item.keyPhrases) {
        expect(item.leveledUp).toContain(phrase);
      }
    }
  });
});
