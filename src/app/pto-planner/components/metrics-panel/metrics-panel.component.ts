import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PtoStore } from '../../state/pto.store';

@Component({
  selector: 'app-metrics-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metrics-panel.component.html',
  styleUrls: ['../../pto-planner.component.css']
})
export class MetricsPanelComponent {
  constructor(public store: PtoStore) {}
}

