/**
 * @file 今後の機能追加（削除確認・設定確認等）向けの共通モーダル。オーバーレイ＋Escで閉じるのみを提供する。
 * 現時点でこのコンポーネントを使用しているfeatureはない。
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
