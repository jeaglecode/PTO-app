export type Period = 'weekly'|'biweekly'|'monthly'|'semiMonthly'|'custom';
export type Mode = 'perYear'|'perPeriod';

export interface Entry { id: string; date: string; hours: number; note: string; }

export interface State {
  startBal: number;
  startDate: string;
  mode: Mode;
  hoursPerYear: number;
  hoursPerPeriod: number;
  period: Period;
  customDays: number;
  carryCap: number | null;
  carryReset: string;
  entries: Entry[];
  overrides: Record<string, number>;
}

