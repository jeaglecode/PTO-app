import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PtoStore } from '../../state/pto.store';

@Component({
  selector: 'app-quick-entry',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './quick-entry.component.html',
  styleUrls: ['../../pto-planner.component.css']
})
export class QuickEntryComponent {
  constructor(public store: PtoStore) {}
  newDate = signal<string>('');
  newHours = signal<number>(8);
  newNote = signal<string>('');

  addQuickEntry() {
    const date = this.newDate() || this.store.todayISO();
    if (!this.store.inYearRange(date)) {
      alert(`Date must be between ${this.store.yearStart()} and ${this.store.yearEndDisplay()} (inclusive).`);
      return;
    }
    this.store.addEntry(date, +this.newHours() || 0, this.newNote() || '');
    this.newDate.set(''); this.newHours.set(8); this.newNote.set('');
  }
}
