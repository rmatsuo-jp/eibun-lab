/**
 * @file 共通モーダル。オーバーレイ＋Escで閉じるのみを提供し、中身は ng-content に任せる。
 * 現在の利用元は shared/ui/celebration（達成時のお祝い表示）のみ。
 * 今後の削除確認・設定確認ダイアログ等もこのコンポーネントを土台にする想定。
 */
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  inject,
  output,
} from '@angular/core';

@Component({
  selector: 'app-modal',
  imports: [],
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown.escape)': 'closed.emit()',
  },
})
export class Modal implements OnInit {
  private elementRef: ElementRef<HTMLElement> = inject(ElementRef);
  closed = output<void>();

  ngOnInit(): void {
    this.elementRef.nativeElement.querySelector<HTMLElement>('[tabindex]')?.focus();
  }

  onOverlayClick(): void {
    this.closed.emit();
  }
}
