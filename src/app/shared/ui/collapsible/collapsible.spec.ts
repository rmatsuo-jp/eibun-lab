import { TestBed } from '@angular/core/testing';
import { Collapsible } from './collapsible';

function render(open: boolean) {
  const fixture = TestBed.createComponent(Collapsible);
  fixture.componentRef.setInput('title', 'テスト見出し');
  fixture.componentRef.setInput('open', open);
  fixture.detectChanges();
  return fixture;
}

describe('Collapsible', () => {
  it('title を見出しとして表示する', () => {
    const el = render(false).nativeElement as HTMLElement;
    expect(el.querySelector('.collapse-title')?.textContent).toContain('テスト見出し');
  });

  it('open に応じて aria-expanded と本文の表示状態が切り替わる', () => {
    const opened = render(true).nativeElement as HTMLElement;
    expect(opened.querySelector('.collapse-head')?.getAttribute('aria-expanded')).toBe('true');
    expect(opened.querySelector('.collapse-body')?.classList.contains('closed')).toBe(false);

    const closed = render(false).nativeElement as HTMLElement;
    expect(closed.querySelector('.collapse-head')?.getAttribute('aria-expanded')).toBe('false');
    expect(closed.querySelector('.collapse-body')?.classList.contains('closed')).toBe(true);
  });

  it('ヘッダのクリックで toggled が発火する（自身では開閉状態を持たない）', () => {
    const fixture = render(false);
    let fired = 0;
    fixture.componentInstance.toggled.subscribe(() => fired++);
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.collapse-head')
      ?.click();
    expect(fired).toBe(1);
  });
});
