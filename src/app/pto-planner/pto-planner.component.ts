import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsPanelComponent } from './components/settings-panel/settings-panel.component';
import { QuickEntryComponent } from './components/quick-entry/quick-entry.component';
import { MetricsPanelComponent } from './components/metrics-panel/metrics-panel.component';
import { WindowsTableComponent } from './components/windows-table/windows-table.component';
import { PtoStore } from './state/pto.store';

@Component({
  selector: 'app-pto-planner',
  standalone: true,
  imports: [CommonModule, FormsModule, SettingsPanelComponent, QuickEntryComponent, MetricsPanelComponent, WindowsTableComponent],
  templateUrl: './pto-planner.component.html',
  styleUrls: ['./pto-planner.component.css'],
})
export class PtoPlannerComponent {
  constructor(public store: PtoStore) {}

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
}
