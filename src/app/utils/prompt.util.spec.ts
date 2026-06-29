import { buildPrompt } from './prompt.util';
import { AppSettings } from '../services/storage.service';

// 全トグル OFF の基準設定（API キー・モデル・テーマは出力に影響しない）
function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    apiKey: '',
    model: 'gemini-3.5-flash',
    includeNaturalExpressions: false,
    includeGrammarTendency: false,
    includeCefrEvaluation: false,
    includeLevelUpSuggestion: false,
    includeClozeReview: false,
    theme: 'dark',
    ...overrides,
  };
}

describe('buildPrompt', () => {
  it('全トグル OFF では前文＋必須指示（見出し形式）＋英作文末尾のみを含む', () => {
    const p = buildPrompt(settings());
    expect(p).toContain('あなたは英語学習者を指導する英作文の添削者です。');
    expect(p).toContain('【文法・語法のミスの指摘】');
    expect(p).toContain('【添削後の全文】');
    expect(p).toContain('【ミス一覧（JSON）】');
    expect(p).toContain('<mistakes>');
    // OFF の項目は現れない
    expect(p).not.toContain('【自然な表現の提案】');
    expect(p).not.toContain('<cefr>');
    expect(p).not.toContain('<review>');
    // 末尾はプレースホルダ
    expect(p.endsWith('英作文:\n{USER_TEXT}')).toBe(true);
  });

  it('採番は使わず全項目が【】見出し形式に統一されている', () => {
    const p = buildPrompt(settings());
    // 番号付き項目（"1. " 等）は一切現れない
    expect(p).not.toMatch(/^\s*\d+\.\s/m);
  });

  it('includeClozeReview ON で <review> 指示（復習カード）が追加される', () => {
    const p = buildPrompt(settings({ includeClozeReview: true }));
    expect(p).toContain('【復習用カードの生成】');
    expect(p).toContain('<review>');
    expect(p).toContain('"reviewItems"');
  });

  it('全トグル ON で全セクションを含む', () => {
    const p = buildPrompt(settings({
      includeNaturalExpressions: true,
      includeGrammarTendency: true,
      includeCefrEvaluation: true,
      includeLevelUpSuggestion: true,
      includeClozeReview: true,
    }));
    expect(p).toContain('【自然な表現の提案】');
    expect(p).toContain('【文法のミスの傾向】');
    expect(p).toContain('<cefr>');
    expect(p).toContain('【レベルアップした表現の提案】');
    expect(p).toContain('<review>');
  });
});
