import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type Period = 'weekly'|'biweekly'|'monthly'|'semiMonthly'|'custom';
type Mode = 'perYear'|'perPeriod';

interface Entry { id: string; date: string; hours: number; note: string; }
interface State {
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

@Component({
  selector: 'app-pto-planner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pto-planner.component.html',
  styleUrls: ['./pto-planner.component.css'],
})
export class PtoPlannerComponent {
  // ---------- STATE ----------
  st: State = this.defaultState();

  // quick-entry form (global)
  newDate = signal<string>('');
  newHours = signal<number>(8);
  newNote = signal<string>('');

  // per-window add drafts
  newDateByWin: Record<number, string> = {};
  newHoursByWin: Record<number, number> = {};
  newNoteByWin: Record<number, string> = {};
  getAddDate(wi: number, fallback: string) { return this.newDateByWin[wi] ?? fallback; }
  getAddHours(wi: number) { return this.newHoursByWin[wi] ?? 8; }
  getAddNote(wi: number) { return this.newNoteByWin[wi] ?? ''; }

  openEditor: number | null = null;
  changed = signal(0);

  // Allowed PTO: 12/31/prev → 12/30/curr (inclusive)
  yearStart = computed(() => `${new Date().getFullYear()-1}-12-31`);
  yearEndDisplay = computed(() => `${new Date().getFullYear()}-12-30`);
  // Accrual still posts 12/31/current (exclusive end for PTO)
  yearEndExclusive = computed(() => `${new Date().getFullYear()}-12-31`);

  // ---------- utils ----------
  todayISO() { return new Date().toISOString().slice(0,10); }
  iso(d: Date){ return d.toISOString().slice(0,10); }
  fmt = (n: number) => (Math.round(n*100)/100).toFixed(2);
  genId(){ return (globalThis.crypto as any)?.randomUUID?.() ?? 'e' + Math.random().toString(36).slice(2); }
  parseDate = (s?: string) => s ? new Date(s+'T00:00:00') : null;
  daysBetween = (a: Date, b: Date) => Math.max(0, Math.floor((+b - +a)/86400000));
  monthsBetween(a: Date, b: Date){
    return (b.getFullYear()-a.getFullYear())*12 + (b.getMonth()-a.getMonth()) - (b.getDate()<a.getDate()?1:0);
  }
  lastDayOfMonth = (y:number,m:number)=> new Date(y,m+1,0).getDate();
  prevDay(iso: string){ const d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()-1); return this.iso(d); }

  inYearRange(iso: string) {
    const d = this.parseDate(iso), a = this.parseDate(this.yearStart()), b = this.parseDate(this.yearEndDisplay());
    return !!(d && a && b && d >= a && d <= b);
  }
  assertInYear(iso: string) {
    if (!this.inYearRange(iso)) {
      alert(`Date must be between ${this.yearStart()} and ${this.yearEndDisplay()} (inclusive).`);
      return false;
    }
    return true;
  }

  touch() {
    const { scrollX, scrollY } = window;
    this.st.entries = this.st.entries.map(e => e.id ? e : ({ ...e, id: this.genId() }));
    this.changed.update(v => v+1);
    queueMicrotask(() => window.scrollTo(scrollX, scrollY));
  }

  showPicker(ev: Event){ const input = (ev.currentTarget as HTMLElement).previousElementSibling as HTMLInputElement; input?.showPicker?.(); }
  setCarryCap(val: any){
    const num = Number(val);
    this.st.carryCap = (val === '' || Number.isNaN(num)) ? null : num;
    this.touch();
  }
  setOverride(k: string, val: any){
    const num = Number(val);
    if (!this.st.overrides) this.st.overrides = {};
    if (val==='' || Number.isNaN(num)) delete this.st.overrides[k];
    else this.st.overrides[k] = num;
    this.touch();
  }
  getOverride(key: string, computed: number) {
    const v = this.st.overrides?.[key];
    return (v === undefined || v === null) ? computed : v;
  }

  addQuickEntry() {
    const date = this.newDate() || this.todayISO();
    if (!this.assertInYear(date)) return;
    const entry: Entry = { id: this.genId(), date, hours: +this.newHours() || 0, note: this.newNote() || '' };
    this.st.entries.push(entry);
    this.newDate.set(''); this.newHours.set(8); this.newNote.set('');
    this.touch();
  }

  // ---------- JSON SAVE / LOAD ----------
  saveToFile() {
    const data = JSON.stringify(this.st, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pto-plan-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async onImport(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0]; if (!file) return;
    const text = await file.text();
    try {
      const obj = JSON.parse(text);
      if (!obj || typeof obj !== 'object') throw new Error('Bad JSON');
      this.st = {
        ...this.defaultState(),
        ...obj,
        entries: (obj.entries || []).map((e: any) => ({
          id: e.id || this.genId(),
          date: e.date, hours: +e.hours || 0, note: e.note || ''
        })),
        overrides: obj.overrides || {}
      };
      this.touch();
    } catch {
      alert('Invalid PTO JSON file.');
    } finally { input.value = ''; }
  }

  // ---------- defaults ----------
  defaultState(): State {
    const now = new Date();
    return {
      startBal: 40,
      startDate: this.todayISO(),
      mode: 'perYear',
      hoursPerYear: 120,
      hoursPerPeriod: 10,
      period: 'semiMonthly',
      customDays: 14,
      carryCap: null,
      carryReset: new Date(now.getFullYear(),0,1).toISOString().slice(0,10),
      entries: [],
      overrides: {}
    };
  }

  // ---------- accrual math ----------
  periodsBetween(d1: Date, d2: Date){
    const per = this.st.period; const custom = Math.max(1, this.st.customDays||14);
    if (per==='weekly') return Math.floor(this.daysBetween(d1,d2)/7);
    if (per==='biweekly') return Math.floor(this.daysBetween(d1,d2)/14);
    if (per==='monthly') return Math.max(0, this.monthsBetween(d1,d2));
    return Math.floor(this.daysBetween(d1,d2)/custom);
  }
  countSemiMonthly(start: Date, end: Date){
    let count = 0; let y=start.getFullYear(), m=start.getMonth();
    while (y<end.getFullYear() || (y===end.getFullYear() && m<=end.getMonth())){
      const d15 = new Date(y,m,15);
      const dL  = new Date(y,m,this.lastDayOfMonth(y,m));
      if (d15>start && d15<=end) count++;
      if (dL >start && dL <=end) count++;
      m++; if (m>11){ m=0; y++; }
    }
    return count;
  }
  accrualBetween(start: Date, end: Date){
    if (this.st.mode==='perYear'){
      const days = this.daysBetween(start,end)+1;
      return (this.st.hoursPerYear||0)/365 * days;
    } else {
      const amt = this.st.hoursPerPeriod||0;
      if (this.st.period==='semiMonthly') return amt * this.countSemiMonthly(start,end);
      return amt * this.periodsBetween(start,end);
    }
  }
  accrualEventDates(year:number, startDate: Date){
    const per = this.st.period;
    const mode = this.st.mode;
    const events: Date[] = [];
    const eoy = new Date(year,11,31);

    if (mode==='perYear'){
      for (let m=0;m<12;m++){ const d=new Date(year,m,this.lastDayOfMonth(year,m)); if (d>=startDate) events.push(d); }
      return events.filter(d=>d<=eoy);
    }

    if (per==='semiMonthly'){
      for (let m=0;m<12;m++){
        const d15=new Date(year,m,15), dL=new Date(year,m,this.lastDayOfMonth(year,m));
        if (d15>=startDate) events.push(d15);
        if (dL >=startDate) events.push(dL);
      }
      return events.filter(d=>d<=eoy).sort((a,b)=>+a-+b);
    }

    if (per==='monthly'){
      for (let m=0;m<12;m++){ const dL=new Date(year,m,this.lastDayOfMonth(year,m)); if (dL>=startDate) events.push(dL); }
      return events.filter(d=>d<=eoy);
    }

    // weekly/biweekly/custom
    const step = this.st.period==='weekly' ? 7 : this.st.period==='biweekly' ? 14 : Math.max(1,this.st.customDays||14);
    let d = new Date(+startDate);
    while (d.getFullYear()===year && d<=eoy){
      d = new Date(+d + step*86400000);
      events.push(d);
      if (d>eoy) break;
    }
    if (!events.length || events[events.length-1] < eoy) events.push(eoy);
    return events;
  }
  applyCarryover(balance:number, asOf: Date){
    const cap = this.st.carryCap;
    if (cap===null || cap===undefined) return balance;
    const reset = this.st.carryReset ? new Date(this.st.carryReset+'T00:00:00') : new Date(asOf.getFullYear(),0,1);
    const capDate = new Date(asOf.getFullYear(), reset.getMonth(), reset.getDate());
    if (asOf >= capDate) return Math.min(balance, cap);
    return balance;
  }

  entriesSorted = () =>
    [...this.st.entries]
      .filter(e=>!!e.date)
      .sort((a,b)=>a.date.localeCompare(b.date));

  // ---------- row calcs ----------
  rowCalcs = computed(() => {
    this.changed();
    const sd = this.parseDate(this.st.startDate); if (!sd) return [];
    const year = new Date().getFullYear();
    const events = this.accrualEventDates(year, sd).map(d => ({
      date: d, key: d.toISOString().slice(0,10), computed: 0, posted: 0
    }));

    let lastCut = sd;
    for (const ev of events){
      const comp = this.accrualBetween(lastCut, ev.date);
      ev.computed = comp;
      ev.posted = Object.prototype.hasOwnProperty.call(this.st.overrides ?? {}, ev.key)
        ? Number((this.st.overrides ?? {})[ev.key])||0
        : comp;
      lastCut = ev.date;
    }

    const rows = this.entriesSorted();
    let running = this.applyCarryover(this.st.startBal + this.accrualBetween(sd, sd), sd);
    const out: {before:string,after:string,ok:boolean}[] = [];
    let ei = 0;
    for (const r of rows){
      const d = this.parseDate(r.date)!;
      while (ei < events.length && events[ei].date < d){
        running = this.applyCarryover(running + events[ei].posted, events[ei].date);
        ei++;
      }
      const before = running; const after = before - (Number(r.hours)||0);
      out.push({ before: this.fmt(before), after: this.fmt(after), ok: after>=0 });
      running = after;
    }
    return out;
  });

  totalPlanned = computed(()=>{
    this.changed();
    const yearEndDisp = this.parseDate(this.yearEndDisplay())!;
    return this.fmt(this.entriesSorted()
      .filter(e=> this.parseDate(e.date)! <= yearEndDisp)
      .reduce((s,e)=> s + (Number(e.hours)||0), 0) as unknown as number);
  });

  eoyBalance = computed(()=>{
    this.changed();
    const sd = this.parseDate(this.st.startDate); if (!sd) return 0;
    const yr = new Date().getFullYear();
    const yearEnd = this.parseDate(this.yearEndExclusive())!; // include 12/31 accrual
    const events = this.accrualEventDates(yr, sd).filter(d=>d<=yearEnd);
    let running = this.applyCarryover(this.st.startBal + this.accrualBetween(sd, sd), sd);

    let ei = 0;
    const rows = this.entriesSorted();

    let lastCut = sd;
    const eventObjs = events.map(d=>{
      const comp = this.accrualBetween(lastCut, d); lastCut = d;
      const key = d.toISOString().slice(0,10);
      const posted = Object.prototype.hasOwnProperty.call(this.st.overrides ?? {}, key)
        ? Number((this.st.overrides ?? {})[key])||0
        : comp;
      return { date:d, posted };
    });

    for (const r of rows){
      const rd = this.parseDate(r.date)!;
      while (ei < eventObjs.length && eventObjs[ei].date < rd){
        running = this.applyCarryover(running + eventObjs[ei].posted, eventObjs[ei].date);
        ei++;
      }
      running = running - (Number(r.hours)||0);
    }
    while (ei < eventObjs.length){
      running = this.applyCarryover(running + eventObjs[ei].posted, eventObjs[ei].date);
      ei++;
    }
    return this.applyCarryover(running, yearEnd);
  });

  // ---------- windows (inclusive start / exclusive end) ----------
  trackByEntry = (_: number, e: { id: string }) => e.id;
  trackByWindow = (_: number, w: { key: string }) => w.key;

  windows = computed(()=>{
    this.changed();
    const sd = this.parseDate(this.st.startDate); if (!sd) return [];
    const yr = new Date().getFullYear();
    const events = this.accrualEventDates(yr, sd);
    const eoy = new Date(yr,11,31);

    let lastCut = sd;
    const evs = events.filter(d=>d<=eoy).map(d=>{
      const comp = this.accrualBetween(lastCut, d); lastCut = d;
      const key = d.toISOString().slice(0,10);
      const posted = Object.prototype.hasOwnProperty.call(this.st.overrides ?? {}, key)
        ? Number((this.st.overrides ?? {})[key])||0
        : comp;
      return { date:d, key, computed: comp, posted };
    });

    // FIRST WINDOW STARTS 12/31 OF PREVIOUS YEAR
    let windowStart = new Date(yr-1, 11, 31);

    // balance at first window start
    let balanceAtStart = this.applyCarryover(
      this.st.startBal + this.accrualBetween(sd, windowStart), windowStart);

    const rows = this.entriesSorted();
    const out: Array<{
      start: string; endDisplay: string; accrualDate: string;
      startBal: number; items: Entry[]; used: number; computed: number; key: string; endBal: number;
    }> = [];

    for (const ev of evs){
      // include >= start and < accrual date
      const items = rows.filter(r=>{
        const d = this.parseDate(r.date)!;
        return d >= windowStart && d < ev.date;
      });

      const used = items.reduce((s,e)=> s + (Number(e.hours)||0), 0);
      const before = balanceAtStart - used;

      out.push({
        start: this.iso(windowStart),                       // e.g. 2024-12-31
        endDisplay: this.prevDay(this.iso(ev.date)),        // e.g. 2025-01-14
        accrualDate: this.iso(ev.date),                     // e.g. 2025-01-15
        startBal: balanceAtStart,
        items, used,
        computed: ev.computed,
        key: ev.key,
        endBal: this.applyCarryover(before, ev.date)
      });

      // next window begins ON the accrual date (accrual posts first)
      windowStart = ev.date;
      balanceAtStart = this.applyCarryover(before + ev.posted, ev.date);
    }
    return out;
  });

  // ---------- inline editor ops ----------
  toggleManage(idx:number){ this.openEditor = this.openEditor===idx ? null : idx; }
  commitEditorRow(wi:number, ri:number){
    const row = this.windows()[wi].items[ri] as Entry;
    const idx = this.st.entries.findIndex(e => e.id === row.id);
    if (idx>=0){
      this.st.entries[idx] = { ...row, hours:+row.hours||0, note: row.note||'' };
      this.touch();
    }
  }
  deleteEditorRow(wi:number, ri:number){
    const row = this.windows()[wi].items[ri] as Entry;
    const idx = this.st.entries.findIndex(e => e.id === row.id);
    if (idx>=0) { this.st.entries.splice(idx,1); this.touch(); }
  }
  addEditorRow(wi:number){
    const w = this.windows()[wi];
    const d = this.getAddDate(wi, w.start);
    if (!this.assertInYear(d)) return;
    this.st.entries.push({
      id:this.genId(),
      date:d,
      hours:+this.getAddHours(wi)||0,
      note:this.getAddNote(wi)
    });
    delete this.newDateByWin[wi];
    delete this.newHoursByWin[wi];
    delete this.newNoteByWin[wi];
    this.touch();
  }
}
