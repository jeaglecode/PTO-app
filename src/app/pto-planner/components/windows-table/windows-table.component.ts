import { Component, computed, signal, ChangeDetectorRef } from '@angular/core';
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
  constructor(public store: PtoStore, private cdr: ChangeDetectorRef) {}

  openEditor: number | null = null;
  toggleManage(idx:number){ this.openEditor = this.openEditor===idx ? null : idx; }

  // Modal state for accrual override confirmation
  showConfirmModal = false;
  pendingAccrualValue: number | null = null;
  pendingWindowKey: string | null = null;
  originalAccrualValues: Record<string, number> = {}; // Store original values by window key

  // per-window drafts
  newDateByWin: Record<number, string> = {};
  newHoursByWin: Record<number, number> = {};
  newNoteByWin: Record<number, string> = {};
  getAddDate(wi: number, fallback: string) { return this.newDateByWin[wi] ?? fallback; }
  getAddHours(wi: number) { return this.newHoursByWin[wi] ?? 8; }
  getAddNote(wi: number) { return this.newNoteByWin[wi] ?? ''; }

  trackByEntry = (_: number, e: { id: string }) => e.id;
  trackByWindow = (_: number, w: { key: string }) => w.key;

  // Format date string from YYYY-MM-DD to MM-DD-YYYY for display only
  formatDateDisplay(dateStr: string): string {
    if (!dateStr || typeof dateStr !== 'string') return dateStr;
    
    // Expecting format like "2025-09-29", convert to "09-29-2025"
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${month}-${day}-${year}`;
    }
    
    // If not in expected format, return as-is
    return dateStr;
  }

  getDayOfWeek(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const [y, m, d] = parts.map(Number);
    const dt = new Date(y, (m as number) - 1, d);
    if (isNaN(dt.getTime())) return '';
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()];
  }



  // Store original value when user starts editing
  onAccrualFocus(windowKey: string, inputElement: HTMLInputElement) {
    const window = this.store.windows().find(w => w.key === windowKey);
    if (window) {
      this.originalAccrualValues[windowKey] = this.store.getOverride(windowKey, window.computed);
    }
  }

  // Handle accrual override change when user finishes input (onBlur)
  onAccrualBlur(windowKey: string, inputElement: HTMLInputElement) {
    const newValue = inputElement.value ? parseFloat(inputElement.value) : null;
    const originalValue = this.originalAccrualValues[windowKey];
    
    // If the value hasn't actually changed, don't show modal
    if (newValue === originalValue) {
      return;
    }
    
    // Show confirmation modal
    this.pendingAccrualValue = newValue;
    this.pendingWindowKey = windowKey;
    this.showConfirmModal = true;
  }

  // Confirm the accrual override change
  confirmAccrualChange() {
    if (this.pendingWindowKey !== null && this.pendingAccrualValue !== null) {
      this.store.setOverride(this.pendingWindowKey, this.pendingAccrualValue);
    }
    this.closeConfirmModal();
  }

  // Cancel the accrual override change
  cancelAccrualChange() {
    // Reset the input to original value
    if (this.pendingWindowKey !== null) {
      const originalValue = this.originalAccrualValues[this.pendingWindowKey];
      if (originalValue !== undefined) {
        // Reset the store value
        this.store.setOverride(this.pendingWindowKey, originalValue);
        
        // Also reset the input field directly
        const inputElement = document.querySelector(`input[data-window-key="${this.pendingWindowKey}"]`) as HTMLInputElement;
        if (inputElement) {
          inputElement.value = originalValue.toString();
        }
        
        // Force change detection to update the UI immediately
        this.cdr.detectChanges();
      }
    }
    this.closeConfirmModal();
  }

  // Close the confirmation modal and reset state
  closeConfirmModal() {
    if (this.pendingWindowKey) {
      delete this.originalAccrualValues[this.pendingWindowKey];
    }
    this.showConfirmModal = false;
    this.pendingAccrualValue = null;
    this.pendingWindowKey = null;
  }

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

