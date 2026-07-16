/**
 * @file アプリ全体で使うドメイン型定義。Mistake（1件のミス情報）・WritingEvaluation（定量評価＝スコア＋CEFR）・
 * ReviewItem（穴埋めクイズカード）・LevelUpItem（レベルアップ例文タイピング用、1文単位）・
 * DrillProgress（ドリルの習熟度）・GamificationStats/FeatureGamificationStats（添削・穴埋めクイズ・
 * 穴あきタイピングの対象機能別累積統計・実績解除状況）・LevelUpItemProgress（穴あきタイピングのマスク段階進捗）と
 * CorrectionSession（1回の添削セッション。corrected=添削解説プローズ、correctedText=添削後の全文、
 * levelUpText=レベルアップ後の全文、model=添削に使用したGeminiモデルID）を定義する。
 * 日本語の説明系フィールド（Mistake.explanation, ReviewItem.hint/translation, LevelUpItem.translation,
 * CorrectionSession.corrected/grammarNotes等）は、対応する `*En` フィールドに英語版を optional で持つ。
 * 英語版が無いセッション（旧データ・生成失敗時）は表示側（core/i18n/localized-session.util.ts）が
 * 自動で日本語にフォールバックする。Mistake.categoryKey は category（日本語固定文字列）の翻訳キー版。
 * CorrectionSession.corrected/correctedEn（添削解説プローズ）は、grammarNotes/naturalExpressions/
 * grammarTendency/cefrRationale/studyPlan の5項目（各 Gemini レスポンスの専用タグから独立抽出）を
 * 結合して合成した後方互換フィールド。1項目のタグ抽出が失敗しても他の4項目には影響しない
 * （gemini.service.ts 参照）。新しいUIはこの5項目を個別ブロックとして表示し、5項目が1つも
 * 無い旧データのみ corrected/correctedEn を単一ブロックとして表示する。
 */

// ── Mistake: Gemini が返す1件のミス情報 ─────────────────────────
export interface Mistake {
  category: string;
  categoryKey?: string; // 任意。UI表示用の翻訳キー（'grammar'|'vocabulary'|'spelling'|'collocation'|'usage'|'syntax'|'word-order'）。旧データは欠落し得る
  original: string;
  corrected: string;
  explanation: string;
  explanationEn?: string; // 任意。explanation の英語版
}

// ── ReviewItem: Gemini が返す穴埋め（クローズ）復習カード 1 件 ─────
// Drill ページの「穴埋めクイズ」モードで出題する。既定は answer をタイピング入力、
// ヒント押下時は choices（正解含む4択）に切り替えて出題する。
export interface ReviewItem {
  sentence: string; // ___（半角アンダースコア3つ）で空所を作った英文
  answer: string; // 空所に入る正解の語/句
  hint: string; // 日本語ヒント
  hintEn?: string; // 任意。hint の英語版
  translation: string; // 英文の日本語訳
  translationEn?: string; // 任意。translation の英語版
  choices: string[]; // 4択（正解を1つ含む）
}

// ── LevelUpItem: Gemini が返す「CEFR一段階上のレベルアップ」1文分の例文 ─────
// Drill ページの「穴あきタイピング」モードで、見て打つ→穴埋めで打つ→何も見ずに打つ、の
// 3段階タイピング練習に使う。keyPhrases は leveledUp 内に実際に出現する部分文字列でなければならず、
// 穴埋め表示（stage 2）は単純な文字列置換で行う。
export interface LevelUpItem {
  original: string; // 元の（レベルアップ前の）1文
  leveledUp: string; // CEFR一段階上のレベルで書き直した1文
  keyPhrases: string[]; // leveledUp 内に出現する、穴埋め対象のコロケーション・構文の完全一致部分文字列
  translation: string; // leveledUp の日本語訳（stage 3 のヒントに使用）
  translationEn?: string; // 任意。translation の英語版
}

// ── DrillProgress: ドリルの1問（ミス or 復習カード）ごとの習熟度 ─────
// key（正規化した original、または sentence+answer）ごとに DrillProgressService が保持する。
// correctStreak が一定数以上になると出題の重みを下げ、既に習熟した問題の再出題頻度を減らす。
// everCorrect は1回でも正解したら true になり、以後不正解になっても false に戻さない
// （穴埋めクイズの日付選択画面の達成バッジ判定に使用。既存データには存在しないため optional）。
export interface DrillProgress {
  correctStreak: number; // 連続正解数
  everCorrect?: boolean; // 1回でも正解したことがあるか（永続的な達成フラグ）
  lastAttemptAt: string; // 直近に解答した日時（ISO 8601）
}

// ── FeatureGamificationStats: 1機能（添削／穴埋めクイズ／穴あきタイピング）分の累積統計 ─
// 挑戦回数・正誤数はグレーディング（drill-state.service.ts の grade()/checkTyping()、
// または practice-state.service.ts の添削保存）のたびに加算する。
// currentDailyStreak/longestDailyStreak は「その機能に取り組んだ日」の連続日数（lastActiveDate基準、
// 日付キーは @shared/utils/date.util.ts の toDayKey() で統一する）。
// currentPerfectStreak/longestPerfectStreak は「全問正解で終えたセッション」の連続回数
// （levelupは日程内全文完了、clozeは全問正解で1セッションとしてカウント）。
// completedSessionKeys は levelup の「日程完了」を重複カウントしないための既完了キー集合。
// 添削（correction）は totalAttempts（＝添削回数）と日次ストリーク系フィールドのみ使用し、
// 正誤・パーフェクト・セッション完了系フィールドは常に初期値（0 / 空オブジェクト）のまま未使用とする
// （型を1つに共通化することで、日次ストリーク更新・Firestoreマージのロジックを3機能で使い回せる）。
export interface FeatureGamificationStats {
  totalAttempts: number;
  totalCorrect: number;
  totalWrong: number;
  sessionsCompleted: number;
  perfectSessionCount: number;
  currentPerfectStreak: number;
  longestPerfectStreak: number;
  currentDailyStreak: number;
  longestDailyStreak: number;
  lastActiveDate?: string; // 'YYYY-MM-DD'（日次ストリーク判定用）
  bestInSessionCorrectStreak: number; // 1プレイ内の最大連続正解数（自己ベスト）
  completedSessionKeys: Record<string, true>; // levelup日程完了の重複防止
}

// ── GamificationStats: 実績判定の元データ。添削／穴埋めクイズ／穴あきタイピングの
// 対象機能別に統計を持つ（実績の分類も対象機能単位）。
// 既存データの遡及集計は行わず、本機能リリース以降のプレイ・添削から集計を開始する方針
// （docs/todo.md 参照）。CorrectionSession とは独立のモデルのため
// firestore-sync.service.ts の OPTIONAL_FIELDS_MAP 対応は不要（core/achievements/ 側で同期する）。
export interface GamificationStats {
  correction: FeatureGamificationStats;
  cloze: FeatureGamificationStats;
  levelup: FeatureGamificationStats;
  unlockedAchievements: Record<string, string>; // achievementId → 解除日時(ISO)
}

// ── LevelUpItemProgress: 穴あきタイピング1文分の進捗 ─────
// セッション（日付）単位でまとめて保持し、途中再開・完了判定に使う。
// maskLevel: 現在のマスク段階（0=全文表示 〜 maxLevel=全単語マスク）。completed: maxLevelで正解済みか。
export interface LevelUpItemProgress {
  maskLevel: number;
  completed: boolean;
}

// ── WritingEvaluation: 1回の添削の定量評価（スコア＋暫定CEFR） ─────
// スコアは各10点満点（0.5刻み）。errorDensity は 100語あたりのエラー数。
// xxxCefr は各スコアに対応する暫定CEFR（A1〜C2）。推移グラフ（スコア／CEFR）で使用する。
export interface WritingEvaluation {
  grammarScore: number; // 文法 0〜10
  vocabularyScore: number; // 語彙 0〜10
  contentScore: number; // 内容 0〜10
  overallScore: number; // 総合平均 0〜10
  errorDensity: number; // 100語あたりのエラー数
  grammarCefr: string; // 文法の暫定CEFR
  vocabularyCefr: string; // 語彙の暫定CEFR
  contentCefr: string; // 内容の暫定CEFR
  overallCefr: string; // 総合の暫定CEFR
}

// ── CorrectionSession: 1回の添削セッション（LocalStorage に保存される単位） ─
// ⚠ optional フィールド（?付き）を追加したら firestore-sync.service.ts の OPTIONAL_FIELDS_MAP にも必ず追加すること。
//   Firestore は undefined を受け付けないため、同期時に undefined のフィールドを除外する必要がある。
//   追加を忘れると OPTIONAL_FIELDS_MAP の型（Record<OptionalKeys<CorrectionSession>, true>）が
//   合わなくなり tsc がコンパイルエラーにするため、実際には検知漏れしない。
export interface CorrectionSession {
  id: string;
  date: string;
  original: string;
  corrected: string; // 添削解説プローズ（grammarNotes等5項目を結合した後方互換フィールド。後述）
  correctedEn?: string; // 任意。corrected の英語版
  correctedText?: string; // 任意。添削後の完成版の全文（corrected＝解説文とは別に、修正後の英文そのもの。後方互換）
  grammarNotes?: string; // 任意。文法・語法のミスの指摘（独立タグから抽出、1項目単位で表示・欠落判定するための本体フィールド）
  grammarNotesEn?: string; // 任意。grammarNotes の英語版
  naturalExpressions?: string; // 任意。自然な表現の提案
  naturalExpressionsEn?: string; // 任意。naturalExpressions の英語版
  grammarTendency?: string; // 任意。文法のミスの傾向
  grammarTendencyEn?: string; // 任意。grammarTendency の英語版
  cefrRationale?: string; // 任意。CEFR評価の根拠
  cefrRationaleEn?: string; // 任意。cefrRationale の英語版
  studyPlan?: string; // 任意。今のレベルから伸ばすための学習法
  studyPlanEn?: string; // 任意。studyPlan の英語版
  mistakes: Mistake[];
  evaluation?: WritingEvaluation; // 任意。定量評価が有効なセッションのみ持つ
  reviewItems?: ReviewItem[]; // 任意。復習カード生成が有効なセッションのみ持つ（後方互換）
  levelUpItems?: LevelUpItem[]; // 任意。レベルアップ例文タイピング用（1文単位、Drill専用。後方互換）
  levelUpText?: string; // 任意。レベルアップ後の全文（levelUpItemsとは別に、日記全体を通した1本の文章。後方互換）
  deleted?: boolean; // 論理削除フラグ。true は表示・集計から除外し、クラウドにも tombstone として残す（削除の多端末同期用）
  model?: string; // 任意。添削に実際に使用されたGeminiモデルID（modelPriorityフォールバック後の最終選択）。旧データは欠落し得る
}
