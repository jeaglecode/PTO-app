import { Component, effect, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { PtoStore } from '../../state/pto.store';
import { Entry } from '../../pto.types';
import { PtoDataService } from '../../pto-data.service';
import { AuthService } from '../../../auth/auth.service';

@Component({
  selector: 'app-entries-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './entries-list.component.html',
  styleUrls: ['../../pto-planner.component.css']
})
export class EntriesListComponent implements OnInit, OnDestroy {
  private saveTimer: any = null;
  private suppressSave = true; // prevent save until initial load completes
  private autosaveInitialized = false;
  private currentTick = 0;
  private lastSavedTick = 0;
  private beforeUnloadHandler = () => {
    if (!this.auth.user()) return;
    if (this.currentTick === this.lastSavedTick) return;
    // Fire keepalive save to avoid losing quick changes
    this.data.saveKeepalive(this.store.st());
  };

  constructor(public store: PtoStore, private router: Router, private data: PtoDataService, private auth: AuthService) {
    // Initial load from Supabase so direct navigation/refresh doesn't overwrite with defaults
    this.initLoad();

    // Debounced autosave while on this page
    effect(() => {
      const tick = this.store.changed();
      this.currentTick = tick;

      if (!this.autosaveInitialized) { this.autosaveInitialized = true; return; }
      if (this.suppressSave || !this.auth.user()) return;

      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(async () => {
        try {
          await this.data.save(this.store.st());
          this.lastSavedTick = this.currentTick;
        } catch {}
      }, 800);
    });

    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  ngOnInit() {
    // Ensure the page starts at the top when navigating here
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'auto' }), 0);
  }

  ngOnDestroy() {
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
  }

  private async initLoad() {
    try {
      this.suppressSave = true;
      const st = await this.data.load();
      if (st) this.store.loadFromParsed(st);
      // mark current as saved to avoid immediate autosave
      try { this.lastSavedTick = this.store.changed(); } catch {}
    } catch {}
    finally {
      setTimeout(() => (this.suppressSave = false), 0);
    }
  }

  entries() {
    return this.store.entriesSorted();
  }

  async save(e: Entry) {
    this.store.updateEntry({ ...e, hours: +e.hours || 0, note: e.note || '' });
    // Trigger an immediate persist; autosave will also catch subsequent edits
    try {
      await this.data.save(this.store.st());
      this.lastSavedTick = this.currentTick;
    } catch {}
  }

  remove(id: string) {
    this.store.deleteEntry(id);
  }

  // Add entry (like planner quick entry)
  newDate = signal<string>('');
  newHours = signal<number>(8);
  newNote = signal<string>('');

  addEntryFromForm() {
    const date = this.newDate() || this.store.todayISO();
    if (!this.store.inYearRange(date)) {
      alert(`Date must be between ${this.store.yearStart()} and ${this.store.yearEndDisplay()} (inclusive).`);
      return;
    }
    this.store.addEntry(date, +this.newHours() || 0, this.newNote() || '');
    this.newDate.set(''); this.newHours.set(8); this.newNote.set('');
  }

  // --- Press-and-hold to delete support ---
  private holdMs = 700;
  holding: Record<string, boolean> = {};
  progress: Record<string, number> = {}; // 0..100
  private holdTimeouts: Record<string, any> = {};
  private progressIntervals: Record<string, any> = {};

  startHold(id: string, ev: Event) {
    ev.preventDefault();
    if (this.holdTimeouts[id]) clearTimeout(this.holdTimeouts[id]);
    if (this.progressIntervals[id]) clearInterval(this.progressIntervals[id]);
    this.holding[id] = true;
    const start = Date.now();
    this.progress[id] = 0;
    this.progressIntervals[id] = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / this.holdMs) * 100);
      this.progress[id] = pct;
    }, 20);
    this.holdTimeouts[id] = setTimeout(() => {
      this.cancelHold(id);
      this.remove(id);
    }, this.holdMs);
  }

  cancelHold(id: string) {
    if (this.holdTimeouts[id]) { clearTimeout(this.holdTimeouts[id]); delete this.holdTimeouts[id]; }
    if (this.progressIntervals[id]) { clearInterval(this.progressIntervals[id]); delete this.progressIntervals[id]; }
    this.holding[id] = false;
    this.progress[id] = 0;
  }

  holdProgressPct(id: string): string { return (this.progress[id] || 0) + '%'; }
}
