import { Mode, Period, State } from '../pto.types';

export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const parseDate = (s?: string) => (s ? new Date(s + 'T00:00:00') : null);
export const prevDay = (isoStr: string) => {
  const d = new Date(isoStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return iso(d);
};

export const fmt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

export const daysBetween = (a: Date, b: Date) => Math.max(0, Math.floor((+b - +a) / 86400000));
export const monthsBetween = (a: Date, b: Date) =>
  (b.getFullYear() - a.getFullYear()) * 12 +
  (b.getMonth() - a.getMonth()) -
  (b.getDate() < a.getDate() ? 1 : 0);

export const lastDayOfMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

export function periodsBetween(per: Period, customDays: number, d1: Date, d2: Date) {
  const custom = Math.max(1, customDays || 14);
  if (per === 'weekly') return Math.floor(daysBetween(d1, d2) / 7);
  if (per === 'biweekly') return Math.floor(daysBetween(d1, d2) / 14);
  if (per === 'monthly') return Math.max(0, monthsBetween(d1, d2));
  // custom
  return Math.floor(daysBetween(d1, d2) / custom);
}

export function countSemiMonthly(start: Date, end: Date) {
  let count = 0;
  let y = start.getFullYear(), m = start.getMonth();
  while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
    const d15 = new Date(y, m, 15);
    const dL = new Date(y, m, lastDayOfMonth(y, m));
    if (d15 > start && d15 <= end) count++;
    if (dL > start && dL <= end) count++;
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return count;
}

export function accrualBetween(st: State, start: Date, end: Date) {
  if (st.mode === 'perYear') {
    const days = daysBetween(start, end) + 1;
    return (st.hoursPerYear || 0) / 365 * days;
  }
  const amt = st.hoursPerPeriod || 0;
  if (st.period === 'semiMonthly') return amt * countSemiMonthly(start, end);
  return amt * periodsBetween(st.period, st.customDays, start, end);
}

export function accrualEventDates(st: State, year: number, startDate: Date) {
  const per = st.period;
  const mode: Mode = st.mode;
  const events: Date[] = [];
  const eoy = new Date(year, 11, 31);

  if (mode === 'perYear') {
    for (let m = 0; m < 12; m++) {
      const d = new Date(year, m, lastDayOfMonth(year, m));
      if (d >= startDate) events.push(d);
    }
    return events.filter(d => d <= eoy);
  }

  if (per === 'semiMonthly') {
    for (let m = 0; m < 12; m++) {
      const d15 = new Date(year, m, 15), dL = new Date(year, m, lastDayOfMonth(year, m));
      if (d15 >= startDate) events.push(d15);
      if (dL >= startDate) events.push(dL);
    }
    return events.filter(d => d <= eoy).sort((a, b) => +a - +b);
  }

  if (per === 'monthly') {
    for (let m = 0; m < 12; m++) {
      const dL = new Date(year, m, lastDayOfMonth(year, m));
      if (dL >= startDate) events.push(dL);
    }
    return events.filter(d => d <= eoy);
  }

  // weekly/biweekly/custom
  const step = st.period === 'weekly' ? 7 : st.period === 'biweekly' ? 14 : Math.max(1, st.customDays || 14);
  let d = new Date(+startDate);
  while (d.getFullYear() === year && d <= eoy) {
    d = new Date(+d + step * 86400000);
    events.push(d);
    if (d > eoy) break;
  }
  if (!events.length || events[events.length - 1] < eoy) events.push(eoy);
  return events;
}

export function applyCarryover(st: State, balance: number, asOf: Date) {
  const cap = st.carryCap;
  if (cap === null || cap === undefined) return balance;
  const reset = st.carryReset ? new Date(st.carryReset + 'T00:00:00') : new Date(asOf.getFullYear(), 0, 1);
  const capDate = new Date(asOf.getFullYear(), reset.getMonth(), reset.getDate());
  if (asOf >= capDate) return Math.min(balance, cap);
  return balance;
}

