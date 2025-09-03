import { Component, effect, signal, computed } from '@angular/core';
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
  private STORAGE_KEY = 'ptoPlannerStateV1';
  st: State = this.load() ?? this.defaultState();

  // inline editor helpers
  newDate = signal<string>('');
  newHours = signal<number>(8);
  newNote = signal<string>('');
  openEditor: number | null = null;
  trackByEntry = (_: number, e: { id: string }) => e.id;
  trackByWindow = (_: number, w: { key: string }) => w.key;

  // autosave
  changed = signal(0);
  constructor() {
    effect(() => {
      this.changed();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.st));
    });
  }

  // ---------- helpers ----------
  todayISO() { return new Date().toISOString().slice(0,10); }
  fmt = (n: number) => (Math.round(n*100)/100).toFixed(2);
  touch() {
    const { scrollX, scrollY } = window;
    this.st.entries = this.st.entries.map(e =>
      e.id ? e : ({ ...e, id: this.genId() })
    );
    this.changed.update(v => v + 1);
    queueMicrotask(() => window.scrollTo(scrollX, scrollY));
  }
  genId(){ return (globalThis.crypto as any)?.randomUUID?.() ?? 'e' + Math.random().toString(36).slice(2); }
  setCarryCap(val: any){
    const num = Number(val);
    this.st.carryCap = (val === '' || Number.isNaN(num)) ? null : num;
    this.touch();
  }
  showPicker(ev: Event){ const input = (ev.currentTarget as HTMLElement).previousElementSibling as HTMLInputElement; input?.showPicker?.(); }
  getOverride(key: string, computed: number) {
    const v = this.st.overrides?.[key];
    return (v === undefined || v === null) ? computed : v;
  }

  // ---------- defaults / persistence ----------
  defaultState(): State {
    const now = new Date();
    return {
      startBal: 40,
      startDate: this.todayISO(),
      mode: 'perYear',
      hoursPerYear: 120,
      hoursPerPeriod: 4,
      period: 'biweekly',
      customDays: 14,
      carryCap: null,
      carryReset: new Date(now.getFullYear(),0,1).toISOString().slice(0,10),
      entries: [],
      overrides: {}
    };
  }

  load(): State | null {
    try {
      const obj = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || 'null');
      if (!obj) return null;
      const st: State = { ...this.defaultState(), ...obj, overrides: obj.overrides ?? {} };
      st.entries = (st.entries || []).map((e: any) => ({ id: e.id ?? this.genId(), date: e.date, hours: +e.hours || 0, note: e.note || '' }));
      return st;
    } catch { return null; }
  }

  clearSaved(){ localStorage.removeItem(this.STORAGE_KEY); alert('Saved plan cleared.'); }

  // ---------- entries ops ----------
  addRow(){ this.st.entries.push({ id: this.genId(), date: this.todayISO(), hours: 8, note: 'Sample Day' }); this.touch(); }
  removeAt(i: number){ this.st.entries.splice(i,1); this.touch(); }
  sortByDate(){ this.st.entries.sort((a,b)=> (a.date||'').localeCompare(b.date||'')); this.touch(); }
  demo(){
    const t = new Date();
    const d1 = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    const d2 = new Date(t.getFullYear(), t.getMonth(), t.getDate()+10);
    const d3 = new Date(t.getFullYear(), t.getMonth(), t.getDate()+25);
    this.st.entries = [
      { id:this.genId(), date: d1.toISOString().slice(0,10), hours: 8, note:'Vacation' },
      { id:this.genId(), date: d2.toISOString().slice(0,10), hours: 4, note:'Dentist' },
      { id:this.genId(), date: d3.toISOString().slice(0,10), hours: 8, note:'Family trip' },
    ];
    this.touch();
  }

  // ---------- import/export ----------
  exportJSON(){
    const data = JSON.stringify(this.st, null, 2);
    const blob = new Blob([data], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'pto-planner.json';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  onImport(ev: Event){
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        const st: State = { ...this.defaultState(), ...obj, overrides: obj.overrides ?? {} };
        st.entries = (st.entries || []).map((e: any) => ({ id: e.id ?? this.genId(), date: e.date, hours: +e.hours || 0, note: e.note || '' }));
        this.st = st; this.touch();
      } catch { alert('Invalid JSON file.'); }
      (ev.target as HTMLInputElement).value = '';
    };
    reader.readAsText(file);
  }

  // ---------- math utils ----------
  parseDate = (s?: string) => s ? new Date(s+'T00:00:00') : null;
  daysBetween = (a: Date, b: Date) => Math.max(0, Math.floor((+b - +a)/86400000));
  monthsBetween(a: Date, b: Date){
    return (b.getFullYear()-a.getFullYear())*12 + (b.getMonth()-a.getMonth()) - (b.getDate()<a.getDate()?1:0);
  }
  lastDayOfMonth = (y:number,m:number)=> new Date(y,m+1,0).getDate();

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

  // ---------- rows table ----------
  rowCalcs = computed(() => {
    this.changed(); // re-run on edits
    const sd = this.parseDate(this.st.startDate); if (!sd) return [];
    const year = new Date().getFullYear();
    const events = this.accrualEventDates(year, sd).map(d => ({
      date: d, key: d.toISOString().slice(0,10),
      computed: 0, posted: 0
    }));

    // computed/posted per window
    let lastCut = sd;
    for (const ev of events){
      const computed = this.accrualBetween(lastCut, ev.date);
      ev.computed = computed;
      ev.posted = Object.prototype.hasOwnProperty.call(this.st.overrides ?? {}, ev.key)
        ? Number((this.st.overrides ?? {})[ev.key])||0
        : computed;
      lastCut = ev.date;
    }

    const rows = this.entriesSorted();
    let running = this.applyCarryover(this.st.startBal + this.accrualBetween(sd, sd), sd);
    const out: {before:string,after:string,ok:boolean}[] = [];
    let ei = 0;
    for (const r of rows){
      const d = this.parseDate(r.date)!;
      while (ei < events.length && events[ei].date <= d){
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
    const yearEnd = new Date(new Date().getFullYear(),11,31);
    return this.fmt(this.entriesSorted()
      .filter(e=> this.parseDate(e.date)! <= yearEnd)
      .reduce((s,e)=> s + (Number(e.hours)||0), 0) as unknown as number);
  });

  eoyBalance = computed(()=>{
    this.changed();
    const sd = this.parseDate(this.st.startDate); if (!sd) return 0;
    const yr = new Date().getFullYear();
    const yearEnd = new Date(yr,11,31);
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
      while (ei < eventObjs.length && eventObjs[ei].date <= rd){
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

  // ---------- windows + inline editor ----------
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

    let windowStart = new Date(yr,0,1); if (sd > windowStart) windowStart = sd;
    let balanceAtStart = this.applyCarryover(this.st.startBal + this.accrualBetween(sd, windowStart), windowStart);

    const rows = this.entriesSorted();
    const out: Array<{
      start: string; end: string; startBal: number; items: Entry[];
      used: number; computed: number; key: string; endBal: number;
    }> = [];

    for (const ev of evs){
      const items = rows
        .filter(r=>{
          const d = this.parseDate(r.date)!;
          return d > windowStart && d <= ev.date;
        })
        .map(x=>({ ...x })); // preserve id

      const used = items.reduce((s,e)=> s + (Number(e.hours)||0), 0);
      const before = balanceAtStart - used;
      const endBal = this.applyCarryover(before, ev.date);

      out.push({
        start: this.iso(windowStart),
        end: this.iso(ev.date),
        startBal: balanceAtStart,
        items,
        used,
        computed: ev.computed,
        key: ev.key,
        endBal
      });

      windowStart = ev.date;
      balanceAtStart = this.applyCarryover(before + ev.posted, ev.date);
    }
    return out;
  });

  iso(d: Date){ return d.toISOString().slice(0,10); }
  overrideFor(k: string){ return (this.st.overrides ?? {})[k]; }

  setOverride(k: string, val: any){
    const num = Number(val);
    if (!this.st.overrides) this.st.overrides = {};
    if (val==='' || Number.isNaN(num)) delete this.st.overrides[k];
    else this.st.overrides[k] = num;
    this.touch();
  }

  toggleManage(idx:number){ this.openEditor = this.openEditor===idx ? null : idx; }
  minInside(windowStartISO: string){ const d = new Date(windowStartISO+'T00:00:00'); d.setDate(d.getDate()+1); return this.iso(d); }

  commitEditorRow(wi:number, ri:number){
    const row = this.windows()[wi].items[ri] as Entry; // has id
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
    const d = this.newDate() || this.minInside(w.start);
    this.st.entries.push({ id:this.genId(), date:d, hours:this.newHours(), note:this.newNote() });
    this.touch();
  }
}
