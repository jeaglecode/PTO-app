import { Entry, State } from '../pto.types';
import { accrualBetween, accrualEventDates, applyCarryover, fmt, iso, parseDate, prevDay } from './accrual';

export interface WindowRow {
  start: string;         // inclusive
  endDisplay: string;    // exclusive-1 day, for display
  accrualDate: string;   // accrual event date
  startBal: number;
  items: Entry[];
  used: number;
  computed: number;
  key: string;           // ISO of accrual date
  endBal: number;
}

export function entriesSorted(st: State): Entry[] {
  return [...st.entries]
    .filter(e => !!e.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildWindows(st: State, year: number): WindowRow[] {
  const sd = parseDate(st.startDate); if (!sd) return [];
  const events = accrualEventDates(st, year, sd);
  const eoy = new Date(year, 11, 31);

  let lastCut = sd;
  const evs = events.filter(d => d <= eoy).map(d => {
    const comp = accrualBetween(st, lastCut, d); lastCut = d;
    const key = d.toISOString().slice(0, 10);
    const posted = Object.prototype.hasOwnProperty.call(st.overrides ?? {}, key)
      ? Number((st.overrides ?? {})[key]) || 0
      : comp;
    return { date: d, key, computed: comp, posted };
  });

  // FIRST WINDOW STARTS 12/31 OF PREVIOUS YEAR
  let windowStart = new Date(year - 1, 11, 31);

  // balance at first window start
  let balanceAtStart = applyCarryover(st,
    st.startBal + accrualBetween(st, sd, windowStart), windowStart);

  const rows = entriesSorted(st);
  const out: WindowRow[] = [];

  for (const ev of evs) {
    // include >= start and < accrual date
    const items = rows.filter(r => {
      const d = parseDate(r.date)!;
      return d >= windowStart && d < ev.date;
    });

    const used = items.reduce((s, e) => s + (Number(e.hours) || 0), 0);
    const before = balanceAtStart - used;

    out.push({
      start: iso(windowStart),
      endDisplay: prevDay(iso(ev.date)),
      accrualDate: iso(ev.date),
      startBal: balanceAtStart,
      items, used,
      computed: ev.computed,
      key: ev.key,
      endBal: applyCarryover(st, before, ev.date)
    });

    // next window begins ON the accrual date (accrual posts first)
    windowStart = ev.date;
    balanceAtStart = applyCarryover(st, before + ev.posted, ev.date);
  }
  return out;
}

export function computeTotalPlanned(st: State, yearEndDisplayISO: string) {
  const yearEndDisp = parseDate(yearEndDisplayISO)!;
  return entriesSorted(st)
    .filter(e => parseDate(e.date)! <= yearEndDisp)
    .reduce((s, e) => s + (Number(e.hours) || 0), 0);
}

export function computeEoyBalance(st: State, year: number, yearEndExclusiveISO: string) {
  const sd = parseDate(st.startDate); if (!sd) return 0;
  const yearEnd = parseDate(yearEndExclusiveISO)!; // include 12/31 accrual
  const events = accrualEventDates(st, year, sd).filter(d => d <= yearEnd);
  let running = applyCarryover(st, st.startBal + accrualBetween(st, sd, sd), sd);

  let ei = 0;
  const rows = entriesSorted(st);

  let lastCut = sd;
  const eventObjs = events.map(d => {
    const comp = accrualBetween(st, lastCut, d); lastCut = d;
    const key = d.toISOString().slice(0, 10);
    const posted = Object.prototype.hasOwnProperty.call(st.overrides ?? {}, key)
      ? Number((st.overrides ?? {})[key]) || 0
      : comp;
    return { date: d, posted };
  });

  for (const r of rows) {
    const rd = parseDate(r.date)!;
    while (ei < eventObjs.length && eventObjs[ei].date < rd) {
      running = applyCarryover(st, running + eventObjs[ei].posted, eventObjs[ei].date);
      ei++;
    }
    running = running - (Number(r.hours) || 0);
  }
  while (ei < eventObjs.length) {
    running = applyCarryover(st, running + eventObjs[ei].posted, eventObjs[ei].date);
    ei++;
  }
  return applyCarryover(st, running, yearEnd);
}

export function computeRowCalcs(st: State) {
  const sd = parseDate(st.startDate); if (!sd) return [] as { before: string, after: string, ok: boolean }[];
  const year = new Date().getFullYear();
  const events = accrualEventDates(st, year, sd).map(d => ({
    date: d, key: d.toISOString().slice(0, 10), computed: 0, posted: 0
  }));

  let lastCut = sd;
  for (const ev of events) {
    const comp = accrualBetween(st, lastCut, ev.date);
    ev.computed = comp;
    ev.posted = Object.prototype.hasOwnProperty.call(st.overrides ?? {}, ev.key)
      ? Number((st.overrides ?? {})[ev.key]) || 0
      : comp;
    lastCut = ev.date;
  }

  const rows = entriesSorted(st);
  let running = applyCarryover(st, st.startBal + accrualBetween(st, sd, sd), sd);
  const out: { before: string, after: string, ok: boolean }[] = [];
  let ei = 0;
  for (const r of rows) {
    const d = parseDate(r.date)!;
    while (ei < events.length && events[ei].date < d) {
      running = applyCarryover(st, running + events[ei].posted, events[ei].date);
      ei++;
    }
    const before = running; const after = before - (Number(r.hours) || 0);
    out.push({ before: fmt(before), after: fmt(after), ok: after >= 0 });
    running = after;
  }
  return out;
}

