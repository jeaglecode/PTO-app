import { Routes } from '@angular/router';
import { PtoPlannerComponent } from './pto-planner/pto-planner.component';

export const routes: Routes = [
  { path: '', redirectTo: 'planner', pathMatch: 'full' },
  { path: 'planner', component: PtoPlannerComponent },
];

