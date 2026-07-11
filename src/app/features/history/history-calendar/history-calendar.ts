/**
 * @file History ページ上部の月表示カレンダー（添削済みの日を総合スコア/CEFR表示、評価未取得の旧データはドット表示）。
 * sessions を input() で受け取り、日付クリックで選択日を dateSelected 出力する（waiting-quiz と同じ設計）。
 * 選択中の日付・表示月はこのコンポーネント内部で保持し、日付フィルタバナー（クリアボタン付き）も併せて描画する。
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toDayKey } from '@shared/utils/date.util';
import { CorrectionSession, WritingEvaluation } from '@core/models/session.model';
import { I18nService } from '@core/i18n/i18n.service';

interface CalendarCell {
  date: Date;
  dayKey: string;
  inMonth: boolean;
  hasSession: boolean;
  isToday: boolean;
  evaluation?: WritingEvaluation;
}

@Component({
  selector: 'app-history-calendar',
  imports: [],
  templateUrl: './history-calendar.html',
  styleUrl: './history-calendar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryCalendar {
  protected i18n = inject(I18nService);

  sessions = input.required<CorrectionSession[]>();
  dateSelected = output<string | null>();

  calendarMonth = signal<Date>(new Date());
  selectedDate = signal<string | null>(null);

  // 日付キー（YYYY-MM-DD）ごとにセッションをグルーピングし、カレンダー描画に使う。
  private sessionsByDay = computed(() => {
    const map = new Map<string, CorrectionSession[]>();
    for (const s of this.sessions()) {
      const key = toDayKey(s.date);
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
    return map;
  });

  // 表示月を含む週の日曜から、月末を含む週の土曜までのセルを生成する。
  calendarCells = computed<CalendarCell[]>(() => {
    const month = this.calendarMonth();
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstOfMonth = new Date(year, monthIndex, 1);
    const lastOfMonth = new Date(year, monthIndex + 1, 0);

    const start = new Date(firstOfMonth);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(lastOfMonth);
    end.setDate(end.getDate() + (6 - end.getDay()));

    const byDay = this.sessionsByDay();
    const todayKey = toDayKey(new Date().toISOString());

    const cells: CalendarCell[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const dayKey = toDayKey(cursor.toISOString());
      const daySessions = byDay.get(dayKey);
      cells.push({
        date: new Date(cursor),
        dayKey,
        inMonth: cursor.getMonth() === monthIndex,
        hasSession: byDay.has(dayKey),
        isToday: dayKey === todayKey,
        evaluation: daySessions?.at(-1)?.evaluation,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return cells;
  });

  weekdayLabels = computed(() =>
    this.i18n.lang() === 'en'
      ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      : ['日', '月', '火', '水', '木', '金', '土'],
  );

  calendarMonthLabel = computed(() =>
    this.calendarMonth().toLocaleDateString(this.i18n.lang() === 'en' ? 'en-US' : 'ja-JP', {
      year: 'numeric',
      month: 'long',
    }),
  );

  prevMonth() {
    const m = this.calendarMonth();
    this.calendarMonth.set(new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  nextMonth() {
    const m = this.calendarMonth();
    this.calendarMonth.set(new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  selectDay(dayKey: string) {
    const next = this.selectedDate() === dayKey ? null : dayKey;
    this.selectedDate.set(next);
    this.dateSelected.emit(next);
  }

  clearDateFilter() {
    this.selectedDate.set(null);
    this.dateSelected.emit(null);
  }

  formatDayKey(dayKey: string): string {
    return new Date(dayKey).toLocaleDateString(this.i18n.lang() === 'en' ? 'en-US' : 'ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  }
}
