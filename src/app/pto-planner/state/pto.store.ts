import { Injectable, computed, signal } from '@angular/core';
import { Entry, State } from '../pto.types';
import { fmt as fmtNum, iso as toIso, parseDate as parseISODate, prevDay as prevDayISO, todayISO as todayISODate } from '../logic/accrual';
import { buildWindows, computeEoyBalance, computeRowCalcs, computeTotalPlanned, entriesSorted as sortEntries } from '../logic/windows';

@Injectable({ providedIn: 'root' })
export class PtoStore {
  // state
  st = signal<State>(this.defaultState());
  // bump when mutating nested structures
  changed = signal(0);

  // year boundaries
  yearStart = computed(() => `${new Date().getFullYear() - 1}-12-31`);
  yearEndDisplay = computed(() => `${new Date().getFullYear()}-12-30`);
  yearEndExclusive = computed(() => `${new Date().getFullYear()}-12-31`);

  fmt = fmtNum;
  iso = toIso;
  prevDay = prevDayISO;
  parseDate = parseISODate;
  todayISO = todayISODate;

  windows = computed(() => {
    this.changed();
    return buildWindows(this.st(), new Date().getFullYear());
  });

  totalPlanned = computed(() => {
    this.changed();
    const tot = computeTotalPlanned(this.st(), this.yearEndDisplay());
    return this.fmt(tot);
  });

  eoyBalance = computed(() => {
    this.changed();
    const bal = computeEoyBalance(this.st(), new Date().getFullYear(), this.yearEndExclusive());
    return bal;
  });

  rowCalcs = computed(() => {
    this.changed();
    return computeRowCalcs(this.st());
  });

  // utils
  inYearRange(isoStr: string) {
    const d = this.parseDate(isoStr);
    const a = this.parseDate(this.yearStart());
    const b = this.parseDate(this.yearEndDisplay());
    return !!(d && a && b && d >= a && d <= b);
  }

  // state update helpers
  setStartBal(v: any) { this.st.update(s => ({ ...s, startBal: Number(v) || 0 })); this.touch(); }
  setStartDate(v: string) { this.st.update(s => ({ ...s, startDate: v })); this.touch(); }
  setMode(v: State['mode']) { this.st.update(s => ({ ...s, mode: v })); this.touch(); }
  setHoursPerYear(v: any) { this.st.update(s => ({ ...s, hoursPerYear: Number(v) || 0 })); this.touch(); }
  setHoursPerPeriod(v: any) { this.st.update(s => ({ ...s, hoursPerPeriod: Number(v) || 0 })); this.touch(); }
  setPeriod(v: State['period']) { this.st.update(s => ({ ...s, period: v })); this.touch(); }
  setCustomDays(v: any) { this.st.update(s => ({ ...s, customDays: Math.max(1, Number(v) || 1) })); this.touch(); }
  setCarryCap(val: any) {
    const num = Number(val);
    this.st.update(s => ({ ...s, carryCap: (val === '' || Number.isNaN(num)) ? null : num }));
    this.touch();
  }
  setCarryReset(v: string) { this.st.update(s => ({ ...s, carryReset: v })); this.touch(); }

  setOverride(k: string, val: any) {
    const num = Number(val);
    this.st.update(s => {
      const overrides = { ...(s.overrides || {}) } as Record<string, number>;
      if (val === '' || Number.isNaN(num)) delete overrides[k];
      else overrides[k] = num;
      return { ...s, overrides };
    });
    this.touch();
  }
  getOverride(key: string, computedVal: number) {
    const v = this.st().overrides?.[key];
    return (v === undefined || v === null) ? computedVal : v;
  }

  addEntryRaw(e: Entry) {
    this.st.update(s => ({ ...s, entries: [...s.entries, e] }));
    this.touch();
  }
  addEntry(date: string, hours: number, note: string) {
    const id = (globalThis.crypto as any)?.randomUUID?.() ?? 'e' + Math.random().toString(36).slice(2);
    this.addEntryRaw({ id, date, hours: +hours || 0, note: note || '' });
  }
  updateEntry(e: Entry) {
    this.st.update(s => ({
      ...s,
      entries: s.entries.map((x: Entry) => x.id === e.id ? { ...e, hours: +e.hours || 0, note: e.note || '' } : x)
    }));
    this.touch();
  }
  deleteEntry(id: string) {
    this.st.update(s => ({ ...s, entries: s.entries.filter((x: Entry) => x.id !== id) }));
    this.touch();
  }

  // expose sorted entries if needed by UI
  entriesSorted = () => sortEntries(this.st());

  // persistence
  serialize(): string {
    return JSON.stringify(this.st(), null, 2);
  }
  loadFromParsed(obj: any) {
    const idgen = () => (globalThis.crypto as any)?.randomUUID?.() ?? 'e' + Math.random().toString(36).slice(2);
    const base = this.defaultState();
    const merged: State = {
      ...base,
      ...obj,
      entries: (obj.entries || []).map((e: any) => ({ id: e.id || idgen(), date: e.date, hours: +e.hours || 0, note: e.note || '' })),
      overrides: obj.overrides || {}
    };
    this.st.set(merged);
    this.touch();
  }

  // book-keeping
  touch() {
    const { scrollX, scrollY } = window;
    // ensure all entries have ids
    this.st.update(s => {
      const idgen = () => (globalThis.crypto as any)?.randomUUID?.() ?? 'e' + Math.random().toString(36).slice(2);
      const entries = s.entries.map((e: Entry) => e.id ? e : ({ ...e, id: idgen() }));
      return { ...s, entries };
    });
    this.changed.update(v => v + 1);
    queueMicrotask(() => window.scrollTo(scrollX, scrollY));
  }

  defaultState(): State {
    const now = new Date();
    return {
      startBal: 40,
      startDate: todayISODate(),
      mode: 'perYear',
      hoursPerYear: 120,
      hoursPerPeriod: 10,
      period: 'semiMonthly',
      customDays: 14,
      carryCap: null,
      carryReset: new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10),
      entries: [],
      overrides: {}
    };
  }
}
