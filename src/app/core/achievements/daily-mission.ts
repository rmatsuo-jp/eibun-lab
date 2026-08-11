/**
 * @file デイリーミッションの定義（カタログ）と、その日ぶんの出題を決める純粋ロジック。
 * 進捗の保持・永続化は gamification-stats.service.ts、クラウドマージは
 * gamification-sync.service.ts が担い、このファイルは状態を持たない。
 * その日の3件は dayKey（'YYYY-MM-DD'）を種にした決定論的な選択で決まる（Math.random は使わない）。
 * 端末をまたいでも必ず同じ3件になるため、Firestore マージ時に missionIds の食い違いを
 * 考慮しなくてよい（gamification-sync.service.ts の mergeDailyMissions 参照）。
 */

// ミッションの達成度を測る指標。DrillState が採点・完了のたびに該当する指標を加算する。
// 'bestStreak' だけは累積加算ではなく「その日の最大値」で判定する（加算では意味をなさないため）。
export type DailyMissionMetric =
  | 'answers' // 解答した問題数（正誤を問わない）
  | 'correctAnswers' // 正解した問題数
  | 'mastered' // 穴あきタイピングで新たに習熟した文の数
  | 'perfectSessions' // パーフェクトで完了した日程の数
  | 'bestStreak'; // その日の最大連続正解数

export interface DailyMissionDef {
  id: string;
  metric: DailyMissionMetric;
  target: number;
  titleKey: string; // i18n キー（drill.missions.<id>）
}

// 1日に提示する件数。
export const DAILY_MISSION_COUNT = 3;

// ── カタログ ────────────────────────────────────────────────
// 指標が偏らないよう、負荷の軽いもの（answers/correctAnswers）と重いもの（mastered/perfect）を混ぜる。
export const DAILY_MISSIONS: DailyMissionDef[] = [
  { id: 'answer-5', metric: 'answers', target: 5, titleKey: 'drill.missions.answer-5' },
  { id: 'answer-15', metric: 'answers', target: 15, titleKey: 'drill.missions.answer-15' },
  { id: 'correct-5', metric: 'correctAnswers', target: 5, titleKey: 'drill.missions.correct-5' },
  { id: 'correct-10', metric: 'correctAnswers', target: 10, titleKey: 'drill.missions.correct-10' },
  { id: 'correct-20', metric: 'correctAnswers', target: 20, titleKey: 'drill.missions.correct-20' },
  { id: 'streak-5', metric: 'bestStreak', target: 5, titleKey: 'drill.missions.streak-5' },
  { id: 'streak-10', metric: 'bestStreak', target: 10, titleKey: 'drill.missions.streak-10' },
  { id: 'mastered-1', metric: 'mastered', target: 1, titleKey: 'drill.missions.mastered-1' },
  { id: 'mastered-3', metric: 'mastered', target: 3, titleKey: 'drill.missions.mastered-3' },
  { id: 'perfect-1', metric: 'perfectSessions', target: 1, titleKey: 'drill.missions.perfect-1' },
];

// dayKey を 32bit 整数の種に畳み込む。
function seedFrom(dayKey: string): number {
  let hash = 7;
  for (let i = 0; i < dayKey.length; i++) {
    hash = (hash * 31 + dayKey.charCodeAt(i)) | 0;
  }
  return hash;
}

// 線形合同法の擬似乱数。種を進めながら [0, 1) を返すクロージャを作る。
function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    // 符号なし化してから正規化する（| 0 の結果は負になり得るため）。
    return (state >>> 0) / 4294967296;
  };
}

// その日のミッションを決定論的に選ぶ。同じ dayKey なら常に同じ3件・同じ並びを返す。
// カタログが DAILY_MISSION_COUNT 未満でも、あるだけ返して壊れないようにする。
export function pickMissionsFor(dayKey: string): DailyMissionDef[] {
  const pool = [...DAILY_MISSIONS];
  const random = lcg(seedFrom(dayKey));
  const count = Math.min(DAILY_MISSION_COUNT, pool.length);

  // 部分 Fisher-Yates: 先頭 count 件だけ確定させれば足りる。
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

// id から定義を引く（保存済みの missionIds を表示用の定義に戻すのに使う）。
export function findMission(id: string): DailyMissionDef | undefined {
  return DAILY_MISSIONS.find((m) => m.id === id);
}
