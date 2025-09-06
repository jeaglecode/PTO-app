import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PtoStore } from '../../state/pto.store';

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-panel.component.html',
  styleUrls: ['../../pto-planner.component.css']
})
export class SettingsPanelComponent {
  constructor(public store: PtoStore) {}
  showPicker(ev: Event){ const input = (ev.currentTarget as HTMLElement).previousElementSibling as HTMLInputElement; (input as any)?.showPicker?.(); }
}

