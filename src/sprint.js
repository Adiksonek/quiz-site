import { ALL, CATS, CAT_NAME, shuffle, rng, hash } from './bank.js';

// Tryby: 'streak' - do pierwszego błędu, 'time' - 60 sekund, 'daily' - Sprint dnia (jak streak, wspólne pytania).
const MODES = ['streak', 'time', 'daily'];
const TIME_MODE_MS = 60_000;
const TIME_PENALTY_MS = 5_000;
const GRACE_MS = 1_000; // opóźnienie sieci przy limicie czasu
const RUN_TTL_MS = 60 * 60 * 1000;

export const warsawDate = (d = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(d);
const clean = (s, n) => (typeof s === 'string' ? s : '').replace(/\s+/g, ' ').trim().slice(0, n);

// Trudność rośnie z liczbą zadanych pytań: najpierw łatwe, potem mieszanka, na końcu głównie trudne.
function levelFor(n) {
  if (n < 5) return 1;
  if (n < 15) return n % 2 ? 1 : 2;
  if (n < 25) return n % 3 === 2 ? 3 : 2;
  return n % 2 ? 3 : 2;
}
// Czas na pytanie w trybach do pierwszego błędu.
const secondsFor = n => (n < 5 ? 15 : n < 15 ? 12 : n < 25 ? 10 : 8);

export class Sprint {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.run = null;
    this.pools = null;
  }

  async fetch(req) {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    if (!this.run) this.run = (await this.ctx.storage.get('run')) || null;
    let out;
    if (url.pathname === '/start') out = await this.start(body);
    else if (!this.run) out = { error: 'Ten sprint już wygasł. Zacznij od nowa.', status: 404 };
    else if (url.pathname === '/answer') out = await this.answer(body);
    else if (url.pathname === '/joker') out = await this.joker(body);
    else out = { error: 'Nieznana akcja', status: 404 };
    if (this.run) await this.ctx.storage.put('run', this.run);
    const { status = 200, ...data } = out;
    return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
  }

  async alarm() { await this.ctx.storage.deleteAll(); this.run = null; }

  // Pule pytań per poziom; odtwarzane z ziarna, więc w storage trzymamy tylko kursory.
  getPools() {
    if (this.pools) return this.pools;
    const r = this.run, rand = rng(r.seed);
    const pick = ALL.filter(q => r.cats.includes(q.cat));
    this.pools = { 1: [], 2: [], 3: [] };
    for (const q of shuffle(pick.slice(), rand)) this.pools[q.lvl].push(q);
    return this.pools;
  }

  draw() {
    const r = this.run, pools = this.getPools();
    const want = levelFor(r.served);
    for (const lvl of [want, 2, 1, 3]) {
      if (r.cur[lvl] < pools[lvl].length) {
        const q = pools[lvl][r.cur[lvl]++];
        const rand = rng(r.seed + r.served * 7919);
        const opts = shuffle([q.ok, ...q.wrong], rand);
        const now = Date.now();
        r.q = { id: q.id, text: q.text, cat: CAT_NAME[q.cat], opts, ok: opts.indexOf(q.ok), start: now,
          deadline: now + secondsFor(r.served) * 1000, hidden: [] };
        r.served++;
        return true;
      }
    }
    return false; // pula się skończyła
  }

  publicQ() {
    const { q } = this.run;
    return { text: q.text, cat: q.cat, opts: q.opts, ms: Math.max(0, this.deadline() - Date.now()), hidden: q.hidden };
  }

  // W trybie 60 sekund kara za błąd przesuwa koniec całej gry, więc limit liczymy na bieżąco.
  deadline() {
    return this.run.mode === 'time' ? this.run.endsAt : this.run.q.deadline;
  }

  state() {
    const r = this.run;
    return { mode: r.mode, streak: r.streak, score: r.score, jokers: r.jokers, endsIn: r.mode === 'time' ? Math.max(0, r.endsAt - Date.now()) : null };
  }

  async start(b) {
    const mode = MODES.includes(b.mode) ? b.mode : 'streak';
    let cats = Array.isArray(b.cats) ? CATS.filter(c => b.cats.includes(c)) : [];
    if (!cats.length || mode === 'daily') cats = CATS.slice();
    const date = warsawDate();
    this.pools = null;
    this.run = {
      mode, cats, date,
      seed: mode === 'daily' ? hash('daily:' + date) : hash(crypto.randomUUID()),
      name: clean(b.name, 18) || 'Gracz', device: clean(b.device, 64),
      cur: { 1: 0, 2: 0, 3: 0 }, served: 0, streak: 0, best: 0, score: 0, answered: 0, okMs: 0,
      jokers: { fifty: true, skip: true }, over: false, endsAt: mode === 'time' ? Date.now() + TIME_MODE_MS : 0, q: null, missed: null,
    };
    await this.ctx.storage.setAlarm(Date.now() + RUN_TTL_MS);
    if (!this.draw()) return { error: 'Brak pytań w wybranych kategoriach.', status: 400 };
    return { ...this.state(), q: this.publicQ() };
  }

  async answer(b) {
    const r = this.run;
    if (r.over) return { over: true, result: r.result };
    const k = Number.isInteger(b.k) ? b.k : -1;
    const now = Date.now();
    const late = now > this.deadline() + GRACE_MS;
    const correct = !late && k === r.q.ok;
    const okIdx = r.q.ok;
    r.answered++;
    if (correct) {
      r.streak++; r.score++; r.okMs += now - r.q.start;
      r.best = Math.max(r.best, r.streak);
    } else if (r.mode === 'time') {
      r.streak = 0;
      r.endsAt -= TIME_PENALTY_MS;
    } else {
      r.missed = { text: r.q.text, ok: r.q.opts[okIdx] };
      return { correct: false, ok: okIdx, late, ...(await this.finish()) };
    }
    if (r.mode === 'time' && Date.now() >= r.endsAt) return { correct, ok: okIdx, ...(await this.finish()) };
    if (!this.draw()) return { correct, ok: okIdx, ...(await this.finish()) };
    return { correct, ok: okIdx, ...this.state(), q: this.publicQ() };
  }

  async joker(b) {
    const r = this.run;
    if (r.over) return { over: true, result: r.result };
    if (b.type === 'fifty' && r.jokers.fifty) {
      r.jokers.fifty = false;
      const wrong = [0, 1, 2, 3].filter(i => i !== r.q.ok);
      r.q.hidden = shuffle(wrong, rng(r.seed + r.served)).slice(0, 2);
      return { ...this.state(), q: this.publicQ() };
    }
    if (b.type === 'skip' && r.jokers.skip) {
      r.jokers.skip = false;
      if (!this.draw()) return await this.finish();
      return { ...this.state(), q: this.publicQ() };
    }
    return { error: 'Ten joker jest już wykorzystany.', status: 400 };
  }

  async finish() {
    const r = this.run;
    r.over = true;
    const result = {
      mode: r.mode, score: r.mode === 'time' ? r.score : r.best, answered: r.answered,
      avgMs: r.score ? Math.round(r.okMs / r.score) : null, best: r.best, missed: r.missed, date: r.date,
    };
    if (r.mode === 'daily') {
      // Wynik do rankingu wpisuje serwer, klient nie może go podać sam.
      const daily = this.env.DAILY.get(this.env.DAILY.idFromName(r.date));
      const res = await daily.fetch('https://daily/submit', { method: 'POST', body: JSON.stringify({ name: r.name, device: r.device, score: result.score, avgMs: result.avgMs }) });
      result.daily = await res.json();
    }
    r.result = result;
    return { over: true, ...this.state(), result };
  }
}

// Ranking jednego dnia. Pierwsza próba z danego urządzenia jest rankingowa, kolejne nie.
export class Daily {
  constructor(ctx) { this.ctx = ctx; }

  async fetch(req) {
    const url = new URL(req.url);
    const board = (await this.ctx.storage.get('board')) || [];
    const devices = new Set((await this.ctx.storage.get('devices')) || []);
    let players = (await this.ctx.storage.get('players')) || 0;
    const top = () => board.slice(0, 20).map(({ name, score }) => ({ name, score }));
    if (url.pathname === '/submit') {
      const b = await req.json();
      const ranked = !!b.device && !devices.has(b.device);
      const entry = { name: clean(b.name, 18) || 'Gracz', score: b.score | 0, avgMs: b.avgMs ?? 1e9, device: b.device };
      if (ranked) {
        devices.add(b.device);
        players++;
        board.push(entry);
        board.sort((x, y) => y.score - x.score || x.avgMs - y.avgMs);
        board.length = Math.min(board.length, 100);
        await this.ctx.storage.put({ board, devices: [...devices], players });
      }
      const rank = board.filter(e => e.score > entry.score || (e.score === entry.score && e.avgMs < entry.avgMs)).length + 1;
      return Response.json({ ranked, rank, players, top: top() });
    }
    return Response.json({ players, best: board[0]?.score ?? 0, top: top() }, { headers: { 'cache-control': 'no-store' } });
  }
}
