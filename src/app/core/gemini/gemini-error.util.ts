/**
 * @file Gemini API 呼び出しで発生した例外を、ユーザーが次に取るべき行動の分かる日本語メッセージへ変換する。
 * @google/generative-ai SDK は HTTP ステータスを専用フィールドではなくエラーメッセージ文字列
 * （例: "[GoogleGenerativeAI Error]: ... [400 Bad Request] API key not valid ..."）に埋め込むため、
 * 文字列からステータスコードを読み取って分類する。判別できない場合は元のメッセージをそのまま返す。
 * 依存は GeminiBlockedError の定義ファイルのみ（GeminiService を import すると Gemini SDK まで巻き込むため）。
 */
import { GeminiBlockedError } from './gemini-blocked.error';

// ── ステータスコード抽出: SDK のメッセージ内 "[429 Too Many Requests]" 等から数値を取り出す ──
// status / code プロパティを持つ実装（将来の SDK 変更・fetch 由来の例外）にも先に対応する。
function extractStatus(e: unknown): number | undefined {
  const withStatus = e as { status?: unknown; code?: unknown };
  if (typeof withStatus?.status === 'number') return withStatus.status;
  if (typeof withStatus?.code === 'number') return withStatus.code;

  const message = e instanceof Error ? e.message : String(e);
  const matched = /\[(\d{3})\s/.exec(message);
  return matched ? Number(matched[1]) : undefined;
}

// ── ユーザー向けメッセージへの変換 ────────────────────────────────
// 課金・キー設定の誤りは利用者自身にしか直せないため、原因と対処先を明示する。
export function toUserMessage(e: unknown): string {
  // セーフティブロックは専用エラーが既に日本語の説明を持っているのでそのまま使う。
  if (e instanceof GeminiBlockedError) return e.message;

  const raw = e instanceof Error ? e.message : String(e);
  const status = extractStatus(e);

  if (status === 400 && /API key not valid/i.test(raw)) {
    return 'API キーが無効です。設定ページでキーを確認してください。';
  }
  if (status === 401 || status === 403) {
    return 'API キーが拒否されました。キーが有効であること、および Gemini API が利用可能な状態かを確認してください。';
  }
  if (status === 429) {
    return '利用上限（レート制限または無料枠）に達しました。時間をおいて再試行してください。'
      + '継続して利用する場合、Google 側の課金設定により料金が発生することがあります。';
  }
  if (status !== undefined && status >= 500 && status < 600) {
    return 'Gemini 側で一時的なエラーが発生しました。時間をおいて再試行してください。';
  }
  return raw;
}
