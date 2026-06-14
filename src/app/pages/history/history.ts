import { Component, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { StorageService } from '../../services/storage.service';
import { CorrectionSession } from '../../models/session.model';

@Component({
  selector: 'app-history',
  templateUrl: './history.html',
  styleUrl: './history.scss',
})
export class History {
  sessions = signal<CorrectionSession[]>([]);
  expandedId = signal<string | null>(null);

  constructor(
    private storage: StorageService,
    private sanitizer: DomSanitizer,
  ) {
    this.sessions.set(this.storage.getSessions());
  }

  toHtml(markdown: string): SafeHtml {
    const html = marked.parse(markdown) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  toggle(id: string) {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  delete(id: string, event: Event) {
    event.stopPropagation();
    this.storage.deleteSession(id);
    this.sessions.set(this.storage.getSessions());
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  }
}
