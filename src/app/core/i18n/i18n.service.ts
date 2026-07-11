/**
 * @file UI 表示言語（日本語/英語）を signal で保持し、テンプレートから t() を呼ぶだけで
 * 言語切替に自動追随させる薄いサービス。翻訳データ本体は translations.ts に持つ。
 * 起動時の言語適用・永続化は app.ts / settings.ts が SettingsStoreService と組み合わせて行う
 * （このサービス自体は永続化を持たない。責務は「現在の表示言語を持つこと」と「翻訳すること」のみ）。
 */
import { Injectable, signal } from '@angular/core';
import { Lang } from './lang.model';
import { TRANSLATIONS, TranslationKey } from './translations';

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<Lang>('ja');

  setLang(lang: Lang): void {
    this.lang.set(lang);
    document.documentElement.lang = lang;
  }

  // {name} 形式のプレースホルダを params で置換する簡易実装。
  t(key: TranslationKey, params?: Record<string, string | number>): string {
    let text = TRANSLATIONS[this.lang()][key];
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  }
}
