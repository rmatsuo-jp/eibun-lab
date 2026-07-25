/**
 * @file リリースノート（「新機能」モーダル）の取得・パース・既読バージョン管理を担うサービス。
 * semantic-release が自動生成する CHANGELOG.md（angular.json の assets 設定でビルド成果物直下に
 * コピーされる）を実行時に fetch し、見出し（`# [x.y.z](...) (date)` / `## [x.y.z](...) (date)`）
 * ごとにブロックへ分割してパースする。手動での二重管理を避けるため、内容は常に CHANGELOG.md が正典。
 * 「前回既読バージョン」は localStorage に保存し、未読の全バージョン分をまとめて返す。
 * 初回起動（未読バージョンが未保存）時は、過去の全履歴が一度に表示されるのを避けるため、
 * 現在のバージョンを黙って既読として記録し、モーダルは表示しない。
 * getAllNotes() は既読/未読を問わず全件を返す。設定ページの「リリースノートを見る」から
 * ユーザーが能動的に過去の履歴を閲覧する用途で、既読状態には一切影響しない。
 */
import { Injectable } from '@angular/core';
import { readJson, writeJson } from '@shared/utils/local-storage.util';

const SEEN_KEY = 'release_notes_seen';

// ── リリースノート1バージョン分 ──────────────────────────────
export interface ReleaseNoteEntry {
  version: string; // 例: '1.1.0'
  date: string; // 例: '2026-07-16'（CHANGELOG.md記載のリリース日）
  features: string[]; // Features セクションの説明文（コミットハッシュ・リンクは除去済み）
  fixes: string[]; // Bug Fixes セクションの説明文
}

interface StoredSeen {
  lastSeenVersion?: string;
}

// CHANGELOG.md の見出し行: `# [1.1.0](link) (2026-07-16)` または `## [1.0.4](link) (2026-07-12)`
const HEADING_RE = /^#{1,2}\s+\[([^\]]+)\]\([^)]*\)\s+\(([^)]+)\)\s*$/;
// 各説明文の末尾に付く `([#123](link))` `([hash](link))` を（連続する分すべて）除去する
const COMMIT_LINK_RE = /(\s*\(\[[^\]]+\]\([^)]*\)\))+\s*$/;

@Injectable({ providedIn: 'root' })
export class ReleaseNotesService {
  // CHANGELOG.md を fetch して現在のバージョンより新しいエントリを返す。
  // 前回既読バージョンが無い（新規ユーザー）場合は、最新バージョンを既読として記録し空配列を返す。
  async getUnseenNotes(currentVersion: string): Promise<ReleaseNoteEntry[]> {
    const entries = await this.fetchAndParse();
    const { lastSeenVersion } = readJson<StoredSeen>(SEEN_KEY, {});

    if (!lastSeenVersion) {
      this.markSeen(currentVersion);
      return [];
    }
    return entries.filter((e) => this.isNewer(e.version, lastSeenVersion));
  }

  markSeen(version: string): void {
    writeJson<StoredSeen>(SEEN_KEY, { lastSeenVersion: version });
  }

  // 既読/未読を問わず CHANGELOG.md の全バージョン分を返す（設定ページの手動閲覧用）。
  async getAllNotes(): Promise<ReleaseNoteEntry[]> {
    return this.fetchAndParse();
  }

  private async fetchAndParse(): Promise<ReleaseNoteEntry[]> {
    try {
      const res = await fetch('CHANGELOG.md');
      if (!res.ok) return [];
      return this.parse(await res.text());
    } catch (e) {
      console.error('[ReleaseNotesService] CHANGELOG.mdの取得に失敗しました:', e);
      return [];
    }
  }

  private parse(text: string): ReleaseNoteEntry[] {
    // CHANGELOG.md はCRLFで保存されている。JSの正規表現の `.` は \r を除外するため、
    // 事前に \r を取り除かないと `* ` 行末の `$` にマッチせず本文が抽出できない。
    const lines = text.replace(/\r/g, '').split('\n');
    const entries: ReleaseNoteEntry[] = [];
    let current: ReleaseNoteEntry | null = null;
    let section: 'features' | 'fixes' | null = null;

    for (const line of lines) {
      const heading = HEADING_RE.exec(line);
      if (heading) {
        current = { version: heading[1], date: heading[2], features: [], fixes: [] };
        entries.push(current);
        section = null;
        continue;
      }
      if (!current) continue;
      if (/^###\s+Features/.test(line)) {
        section = 'features';
        continue;
      }
      if (/^###\s+Bug Fixes/.test(line)) {
        section = 'fixes';
        continue;
      }
      const item = /^\*\s+(.+)$/.exec(line);
      if (item && section) {
        const text = item[1].replace(COMMIT_LINK_RE, '').trim();
        current[section].push(text);
      }
    }
    return entries;
  }

  // バージョン文字列（例: '1.2.0'）を比較する。CHANGELOG.md は新しい順に並ぶため通常は不要だが、
  // lastSeenVersion との比較には必須（セマンティックバージョニング前提の数値比較）。
  private isNewer(version: string, lastSeen: string): boolean {
    const a = version.split('.').map(Number);
    const b = lastSeen.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
    }
    return false;
  }
}
