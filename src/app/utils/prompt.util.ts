/**
 * @file AppSettings の機能トグルに応じて Gemini プロンプトを動的生成するユーティリティ。
 * 各指示を「宣言的なセクション定義（PromptSection）の配列」として持ち、buildPrompt() は
 * 有効なセクションを配列順に連結するだけの薄いオーケストレーションに徹する。
 * 新しい添削項目の追加 = SECTIONS 配列にオブジェクトを 1 つ足すだけで済む（拡張容易）。
 * 全項目は【】見出し形式に統一し、出力順（mistakes→cefr→review）は解析側の前提と一致させる。
 */
import { AppSettings } from '../services/storage.service';

// ── セクション定義 ───────────────────────────────────────────────
/**
 * プロンプトを構成する 1 区画の宣言。enabled が真のセクションだけが配列順で連結される。
 * グループ分けや区切り見出しは持たず、各セクションは独立した【】見出しブロックとして並ぶ。
 */
interface PromptSection {
  id: string;
  enabled: (s: AppSettings) => boolean;
  text: string;
}

const ALWAYS = () => true;

const SECTIONS: PromptSection[] = [
  {
    id: 'grammar',
    enabled: ALWAYS,
    text: `【文法・語法のミスの指摘】
文法・語法の誤りを指摘し、正しい表現と「なぜそう直すのか」の理由を、初心者にもわかるよう簡潔に説明してください。`,
  },
  {
    id: 'natural',
    enabled: (s) => s.includeNaturalExpressions,
    text: `【自然な表現の提案】
より自然でネイティブらしい言い回しがあれば提案してください。`,
  },
  {
    id: 'corrected',
    enabled: ALWAYS,
    text: `【添削後の全文】
修正を反映した完成版の全文を提示してください。`,
  },
  {
    id: 'mistakes',
    enabled: ALWAYS,
    text: `【ミス一覧（JSON）】
上で指摘したミスを、回答の末尾に次のJSON形式で再掲してください。
<mistakes>
{"mistakes":[{"category":"カテゴリ","original":"元の表現","corrected":"正しい表現","explanation":"説明"}]}
</mistakes>`,
  },
  {
    id: 'grammar-tendency',
    enabled: (s) => s.includeGrammarTendency,
    text: `【文法のミスの傾向】
今回の日記から読み取れる「間違いやすい癖」と、その対策を簡潔に示してください。`,
  },
  {
    id: 'cefr',
    enabled: (s) => s.includeCefrEvaluation,
    text: `【CEFR基準による評価】
文法・語彙・内容の3観点をCEFR（A1〜C2）で評価してください。各観点を簡潔にコメントし、回答末尾（mistakesの後）に次のJSON形式でも出力してください。値はA1/A2/B1/B2/C1/C2のいずれか。
<cefr>
{"grammar":"B1","vocabulary":"A2","content":"B1"}
</cefr>`,
  },
  {
    id: 'level-up',
    enabled: (s) => s.includeLevelUpSuggestion,
    text: `【レベルアップした表現の提案】
CEFRの一段階上のレベルで同じ内容を書いた英文例を示し、レベルアップに役立つ語彙・構文を簡潔に解説してください。`,
  },
  {
    id: 'cloze-review',
    enabled: (s) => s.includeClozeReview,
    text: `【復習用カードの生成】
上で指摘した各ミスを復習できる穴埋めカードを作成してください。添削後の正しい文の中で、訂正した語・句を ___ で隠し、誤りやすい誤答を交えた4択（正解を1つ含む計4個）にします。ヒント（日本語）と日本語訳も添えてください。ミスが無い場合は、添削後の文の重要表現を題材にしてください。回答末尾（cefrの後）に次のJSON形式で出力してください。
<review>
{"reviewItems":[{"sentence":"I ___ to school every day.","answer":"go","hint":"主語がIの現在形","translation":"私は毎日学校へ行く。","choices":["go","goes","went","going"]}]}
</review>`,
  },
];

// ── プロンプト構築 ────────────────────────────────────────────────
export function buildPrompt(settings: AppSettings): string {
  const sections: string[] = [];

  // 前文（常に固定）: 役割を与えて指示を明確化する
  sections.push(`あなたは英語学習者を指導する英作文の添削者です。次の英語日記を添削し、フィードバックはすべて日本語で出力してください。`);

  // 有効なセクションを配列順に連結（instruction/analysis の区別なし）
  for (const section of SECTIONS) {
    if (section.enabled(settings)) {
      sections.push(section.text);
    }
  }

  // 末尾（常に固定）
  sections.push(`\n英作文:\n{USER_TEXT}`);

  return sections.join('\n\n');
}
