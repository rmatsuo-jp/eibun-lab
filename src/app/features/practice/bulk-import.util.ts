/**
 * @file 一括添削用 JSON テンプレートの生成・アップロードされた JSON の解析を行う純粋関数群。
 * date は practice-state.service.ts と同じ 'YYYY-MM-DD' 形式。
 * buildBulkTemplateFromSessions() は History の既存セッションをテンプレート形式に変換する（再添削の検証用）。
 * ローカル日付キーへの変換は date.util.ts の toDayKey() を共用する（重複実装しない）。
 */
import { CorrectionSession } from '@core/models/session.model';
import { toDayKey } from '@shared/utils/date.util';

export interface BulkEntry {
  date: string;
  text: string;
}

// ── テンプレート生成: サンプル2件を含む JSON 文字列を返す ─────────────
export function buildBulkTemplateJson(): string {
  const sample: BulkEntry[] = [
    { date: '2026-06-01', text: 'ここに1日目の英作文を貼り付けてください。' },
    { date: '2026-06-02', text: 'ここに2日目の英作文を貼り付けてください。' },
  ];
  return JSON.stringify(sample, null, 2);
}

// ── 履歴セッションから一括添削テンプレートを生成 ──────────────────────
// date は ISO 文字列（UTC基準）のため、toDayKey() でローカルタイムゾーンの 'YYYY-MM-DD' に変換する
// （toISOString().slice(0,10) は UTC 変換で日付がずれるため使わない）。
export function buildBulkTemplateFromSessions(sessions: CorrectionSession[]): string {
  const entries: BulkEntry[] = sessions.map(s => ({
    date: toDayKey(s.date),
    text: s.original,
  }));
  return JSON.stringify(entries, null, 2);
}

// ── アップロードされた JSON をパースし、有効なエントリとエラーメッセージに分ける ──
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseBulkImportJson(raw: string): { entries: BulkEntry[]; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { entries: [], errors: ['JSONの形式が正しくありません'] };
  }
  if (!Array.isArray(parsed)) {
    return { entries: [], errors: ['配列形式のJSONを指定してください'] };
  }

  const entries: BulkEntry[] = [];
  const errors: string[] = [];
  parsed.forEach((item, i) => {
    const o = item as Record<string, unknown>;
    const date = o?.['date'];
    const text = o?.['text'];
    if (typeof date !== 'string' || !DATE_PATTERN.test(date)) {
      errors.push(`${i + 1}件目: date が 'YYYY-MM-DD' 形式ではありません`);
      return;
    }
    if (typeof text !== 'string' || !text.trim()) {
      errors.push(`${i + 1}件目: text が空です`);
      return;
    }
    entries.push({ date, text: text.trim() });
  });

  return { entries, errors };
}
