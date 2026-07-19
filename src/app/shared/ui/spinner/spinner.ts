/**
 * @file ボタン内ローディング表示用の共通スピナー。practiceで単発実装されていたものを抽出。
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-spinner',
  imports: [],
  templateUrl: './spinner.html',
  styleUrl: './spinner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Spinner {}
