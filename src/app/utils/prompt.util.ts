/**
 * @file AppSettings の機能トグルに応じて Gemini プロンプトを動的生成するユーティリティ。
 */
import { AppSettings } from '../services/storage.service';

// ── プロンプト構築 ────────────────────────────────────────────────
export function buildPrompt(settings: AppSettings): string {
  const sections: string[] = [];

  sections.push(`以下の英作文（英語日記）の添削をお願いします。
単に修正するだけでなく、以下の指示に従って詳細なフィードバックを日本語で出力してください。

1. 文法・語法のミスを指摘し、正しい表現を示してください。
   【なぜその修正が必要なのか（文法的な理由）】を、初心者にも分かりやすく丁寧に解説してください。`);

  if (settings.includeNaturalExpressions) {
    sections.push(`2. より自然な表現、ネイティブらしい表現があれば提案してください。`);
  }

  sections.push(`3. 添削後の全文（修正を反映した完成版の文章）を提示してください。
4. ミスを必ず以下のJSON形式でレスポンスの「一番最後（末尾）」にまとめてください：
<mistakes>
{"mistakes": [{"category": "カテゴリ名", "original": "元の表現", "corrected": "正しい表現", "explanation": "説明"}]}
</mistakes>`);

  const analysis: string[] = [];

  if (settings.includeGrammarTendency) {
    analysis.push(`【文法のミスの傾向】
今回の日記から読み取れる、私が犯しやすい「文法のミスの傾向や癖」があれば、今後の対策と合わせて教えてください。`);
  }

  if (settings.includeCefrEvaluation) {
    analysis.push(`【CEFR基準による評価】
今回の文章をCEFR（ヨーロッパ言語共通参照枠）の観点から、以下の3つの側面で客観的に評価してください（例：A2、B1など）。
・文法面：
・語彙面：
・内容面：
さらに、上記のCEFR評価を機械可読にするため、レスポンスの末尾（mistakesタグの後）に以下のJSON形式のタグも必ず出力してください。値は A1/A2/B1/B2/C1/C2 のいずれかのみとします：
<cefr>
{"grammar":"B1","vocabulary":"A2","content":"B1"}
</cefr>`);
  }

  if (settings.includeLevelUpSuggestion) {
    analysis.push(`【レベルアップした表現の提案】
今回のCEFR評価の「一段階上」のレベル（例：今回がA2ならB1レベル、B1ならB2レベル）で、同じ日記の内容を書いた場合の英文のサンプルを提示してください。どのような語彙や構文を使えばレベルアップできるかの解説も添えてください。`);
  }

  if (analysis.length > 0) {
    sections.push(`\nまた、添削に加えて以下の分析と評価も必ず行ってください。\n\n` + analysis.join('\n\n'));
  }

  sections.push(`\n英作文:\n{USER_TEXT}`);

  return sections.join('\n\n');
}
