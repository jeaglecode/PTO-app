import { Routes } from '@angular/router';
import { PtoPlannerComponent } from './pto-planner/pto-planner.component';
import { LoginComponent } from './auth/login/login.component';
import { authGuard } from './auth/auth.guard';
import { EntriesListComponent } from './pto-planner/components/entries-list/entries-list.component';

export const routes: Routes = [
  { path: '', redirectTo: 'planner', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'planner', component: PtoPlannerComponent, canActivate: [authGuard] },
  { path: 'entries', component: EntriesListComponent, canActivate: [authGuard] },
];
