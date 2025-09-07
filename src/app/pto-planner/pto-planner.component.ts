import { Component, OnInit, OnDestroy, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsPanelComponent } from './components/settings-panel/settings-panel.component';
import { QuickEntryComponent } from './components/quick-entry/quick-entry.component';
import { MetricsPanelComponent } from './components/metrics-panel/metrics-panel.component';
import { WindowsTableComponent } from './components/windows-table/windows-table.component';
import { PtoStore } from './state/pto.store';
import { AuthService } from '../auth/auth.service';
import { Router } from '@angular/router';
import { PtoDataService } from './pto-data.service';
import { supabase } from '../supabase/supabase.client';

@Component({
  selector: 'app-pto-planner',
  standalone: true,
  imports: [CommonModule, FormsModule, SettingsPanelComponent, QuickEntryComponent, MetricsPanelComponent, WindowsTableComponent],
  templateUrl: './pto-planner.component.html',
  styleUrls: ['./pto-planner.component.css'],
})
export class PtoPlannerComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);
  private data = inject(PtoDataService);

  constructor(public store: PtoStore) {
    // Try initial load immediately (in case session is already present)
    this.tryInitialLoad();

    // Also attempt once when auth state changes to a session
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !this.didInitialLoad) this.tryInitialLoad();
    });

    // Debounced autosave on any change in the store
    effect(() => {
      // Track mutations
      const tick = this.store.changed();
      this.currentTick = tick;

      // Skip the very first run (initial render)
      if (!this.autosaveInitialized) {
        this.autosaveInitialized = true;
        return;
      }

      // Skip while loading or if not authenticated
      if (this.suppressSave || !this.auth.user()) return;

      // Debounce saves
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(async () => {
        try {
          await this.data.save(this.store.st());
          this.lastSavedTick = this.currentTick;
        } catch (e) {
          console.warn('Auto-save failed', e);
        }
      }, 800);
    });

    // Flush when tab is hidden (reload/navigation)
    window.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('pagehide', this.pageHideHandler);
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  // JSON SAVE / LOAD kept here for toolbar
  saveToFile() {
    const data = this.store.serialize();
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pto-plan-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async onImport(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0]; if (!file) return;
    const text = await file.text();
    try {
      const obj = JSON.parse(text);
      if (!obj || typeof obj !== 'object') throw new Error('Bad JSON');
      this.store.loadFromParsed(obj);
    } catch {
      alert('Invalid PTO JSON file.');
    } finally { input.value = ''; }
  }

  get userEmail() {
    return this.auth.user()?.email ?? '';
  }

  async logout() {
    // Flush pending autosave before ending the session
    await this.flushSave();
    await this.auth.logout().catch(() => {});
    await this.router.navigate(['/login']);
  }

  // --- Auto-save to Supabase ---
  private autosaveInitialized = false; // used to skip first autosave effect run
  private didInitialLoad = false; // ensure we load once after auth is ready
  private suppressSave = false;
  private saveTimer: any = null;
  private currentTick = 0;
  private lastSavedTick = 0;
  private visibilityHandler = () => { if (document.visibilityState === 'hidden') this.flushSave(true); };
  private pageHideHandler = () => this.flushSave(true);
  private beforeUnloadHandler = () => this.flushSave(true);

  ngOnInit() {}

  ngOnDestroy() {
    window.removeEventListener('visibilitychange', this.visibilityHandler);
    window.removeEventListener('pagehide', this.pageHideHandler);
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
  }

  private async tryInitialLoad() {
    try {
      this.suppressSave = true; // prevent immediate re-save of loaded data
      const st = await this.data.load();
      if (st) this.store.loadFromParsed(st);
      this.didInitialLoad = true;
      // Mark loaded state as saved to avoid immediate autosave of unchanged data
      try { this.lastSavedTick = this.store.changed(); } catch {}
    } catch (e) {
      console.warn('Initial load failed or no data yet', e);
    } finally {
      // Release suppression on next tick
      setTimeout(() => (this.suppressSave = false), 0);
    }
  }

  private async flushSave(useKeepalive = false) {
    try {
      if (!this.auth.user()) return;
      // Refresh tick from store directly to catch very recent changes
      try { this.currentTick = this.store.changed(); } catch {}
      // If a debounce is pending, we definitely have changes to save
      if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
      else if (this.currentTick === this.lastSavedTick) return; // nothing changed
      if (useKeepalive) await this.data.saveKeepalive(this.store.st());
      else await this.data.save(this.store.st());
      this.lastSavedTick = this.currentTick;
    } catch (e) {
      console.warn('Flush save failed', e);
    }
  }
}
