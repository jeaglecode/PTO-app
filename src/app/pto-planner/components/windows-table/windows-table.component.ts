import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PtoStore } from '../../state/pto.store';
import { Entry } from '../../pto.types';

@Component({
  selector: 'app-windows-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './windows-table.component.html',
  styleUrls: ['../../pto-planner.component.css']
})
export class WindowsTableComponent {
  constructor(public store: PtoStore) {}

  openEditor: number | null = null;
  toggleManage(idx:number){ this.openEditor = this.openEditor===idx ? null : idx; }

  // per-window drafts
  newDateByWin: Record<number, string> = {};
  newHoursByWin: Record<number, number> = {};
  newNoteByWin: Record<number, string> = {};
  getAddDate(wi: number, fallback: string) { return this.newDateByWin[wi] ?? fallback; }
  getAddHours(wi: number) { return this.newHoursByWin[wi] ?? 8; }
  getAddNote(wi: number) { return this.newNoteByWin[wi] ?? ''; }

  trackByEntry = (_: number, e: { id: string }) => e.id;
  trackByWindow = (_: number, w: { key: string }) => w.key;

  commitEditorRow(wi:number, ri:number){
    const row = this.store.windows()[wi].items[ri] as Entry;
    this.store.updateEntry({ ...row, hours:+row.hours||0, note: row.note||'' });
  }
  deleteEditorRow(wi:number, ri:number){
    const row = this.store.windows()[wi].items[ri] as Entry;
    this.store.deleteEntry(row.id);
  }
  addEditorRow(wi:number){
    const w = this.store.windows()[wi];
    const d = this.getAddDate(wi, w.start);
    if (!this.store.inYearRange(d)){
      alert(`Date must be between ${this.store.yearStart()} and ${this.store.yearEndDisplay()} (inclusive).`);
      return;
    }
    this.store.addEntry(d, +this.getAddHours(wi)||0, this.getAddNote(wi));
    delete this.newDateByWin[wi];
    delete this.newHoursByWin[wi];
    delete this.newNoteByWin[wi];
  }
}

