import { buildPrompt } from './prompt.util';

describe('buildPrompt', () => {
  it('前文・必須指示・末尾プレースホルダを含む', () => {
    const p = buildPrompt();
    expect(p).toContain('あなたは英語学習者を指導する英作文の添削者です。');
    expect(p).toContain('【文法・語法のミスの指摘】');
    expect(p).toContain('【添削後の全文】');
    expect(p).toContain('【ミス一覧（JSON）】');
    expect(p).toContain('<mistakes>');
    // 末尾はプレースホルダ
    expect(p.endsWith('英作文:\n{USER_TEXT}')).toBe(true);
  });

  it('全セクション（自然な表現・文法傾向・定量評価・レベルアップ・復習カード）を常に含む', () => {
    const p = buildPrompt();
    expect(p).toContain('【自然な表現の提案】');
    expect(p).toContain('【文法のミスの傾向】');
    expect(p).toContain('【定量評価（10点満点・0.5刻み）】');
    expect(p).toContain('エラー密度');
    expect(p).toContain('<evaluation>');
    expect(p).toContain('"overallScore"');
    expect(p).toContain('【レベルアップした表現の提案】');
    expect(p).toContain('【復習用カードの生成】');
    expect(p).toContain('<review>');
    expect(p).toContain('"reviewItems"');
  });
});
