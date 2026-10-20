import { ALL, CAT_INFO, CATS, CAT_NAME, shuffle } from './bank.js';
import { Sprint, Daily, warsawDate } from './sprint.js';

export { Sprint, Daily };

const COLORS = ['#FF6B5B', '#13A89C', '#8A5CF6', '#E9A100', '#2F8CFF', '#E0479E', '#5FAE2E', '#FF8A1F',
  '#00A3C4', '#B5651D', '#7C83FD', '#D9415B', '#2BB673', '#C05CE0', '#F2C230', '#4A90A4'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MAX_PLAYERS = 40;
const COUNTS = [5, 10, 15, 20, 30];
const TIMES = [10, 15, 20, 30];
const IDLE_MS = 10 * 60 * 1000;

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const RUN_ID = /^[0-9a-f-]{36}$/;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/api/cats') return json(CAT_INFO);
    if (url.pathname === '/api/daily') return env.DAILY.get(env.DAILY.idFromName(warsawDate())).fetch('https://daily/top');
    const sp = url.pathname.match(/^\/api\/sprint\/(start|answer|joker)$/);
    if (sp) {
      if (req.method !== 'POST') return json({ error: 'POST' }, 405);
      const body = await req.json().catch(() => ({}));
      const run = sp[1] === 'start' ? crypto.randomUUID() : String(body.run || '');
      if (!RUN_ID.test(run)) return json({ error: 'Brak identyfikatora sprintu.' }, 400);
      const res = await env.SPRINTS.get(env.SPRINTS.idFromName(run)).fetch('https://sprint/' + sp[1], { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json();
      return json(sp[1] === 'start' && res.ok ? { run, ...data } : data, res.status);
    }
    if (url.pathname === '/api/new') {
      for (let i = 0; i < 10; i++) {
        const code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const r = await stub.fetch('https://room/claim');
        if (r.ok) return json({ code });
      }
      return json({ error: 'Brak wolnych pokoi, spróbuj ponownie.' }, 503);
    }
    const m = url.pathname.match(/^\/api\/ws\/([A-Z]{4})$/);
    if (m) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
      return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
    }
    return env.ASSETS.fetch(req);
  },
};

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.sockets = new Map(); // ws -> playerId
    this.lastActivity = 0;
    this.claimed = false;
    this.used = new Set();
    this.resetRoom();
  }

  resetRoom() {
    clearTimeout(this.timer);
    this.phase = 'lobby';
    this.players = new Map();
    this.order = [];
    this.hostId = null;
    this.settings = { cats: [...CATS], count: 10, time: 20 };
    this.deck = [];
    this.qi = 0;
    this.qStart = 0;
    this.colorIdx = 0;
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/claim') {
      const live = [...this.players.values()].some(p => p.connected);
      if (live || Date.now() - this.lastActivity < IDLE_MS) return new Response('taken', { status: 409 });
      this.resetRoom();
      this.used = new Set();
      this.claimed = true;
      this.lastActivity = Date.now();
      return new Response('ok');
    }
    this.code = url.pathname.split('/').pop();
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    server.addEventListener('message', e => this.onMessage(server, e.data));
    server.addEventListener('close', () => this.onClose(server));
    server.addEventListener('error', () => this.onClose(server));
    return new Response(null, { status: 101, webSocket: client });
  }

  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch (e) { } }

  onMessage(ws, raw) {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    this.lastActivity = Date.now();
    if (m.t === 'ping') return this.send(ws, { t: 'pong' });
    if (m.t === 'join') return this.join(ws, m);

    const id = this.sockets.get(ws);
    const p = id && this.players.get(id);
    if (!p) return;
    const isHost = id === this.hostId;

    switch (m.t) {
      case 'settings': {
        if (!isHost || this.phase !== 'lobby') return;
        if (Array.isArray(m.cats)) this.settings.cats = CATS.filter(c => m.cats.includes(c));
        if (COUNTS.includes(m.count)) this.settings.count = m.count;
        if (TIMES.includes(m.time)) this.settings.time = m.time;
        return this.broadcast();
      }
      case 'start': {
        if (!isHost || (this.phase !== 'lobby' && this.phase !== 'final')) return;
        if (!this.settings.cats.length) return;
        this.players.forEach(pl => { pl.score = 0; pl.gain = 0; pl.correct = 0; });
        this.buildDeck();
        this.qi = 0;
        return this.ask();
      }
      case 'answer': {
        if (this.phase !== 'question' || p.answer !== null) return;
        const k = m.k;
        if (!Number.isInteger(k) || k < 0 || k >= this.deck[this.qi].opts.length) return;
        p.answer = k;
        p.answerAt = Date.now();
        if (this.allAnswered()) return this.reveal();
        return this.broadcast();
      }
      case 'next': {
        if (!isHost || this.phase !== 'reveal') return;
        this.qi++;
        if (this.qi >= this.deck.length) { this.phase = 'final'; return this.broadcast(); }
        return this.ask();
      }
      case 'end': {
        if (!isHost || (this.phase !== 'question' && this.phase !== 'reveal')) return;
        clearTimeout(this.timer);
        this.phase = 'final';
        return this.broadcast();
      }
      case 'lobby': {
        if (!isHost || this.phase !== 'final') return;
        this.phase = 'lobby';
        this.players.forEach(pl => { pl.score = 0; pl.gain = 0; pl.correct = 0; pl.answer = null; });
        // drop players who left
        for (const pid of [...this.order]) if (!this.players.get(pid).connected) this.removePlayer(pid);
        return this.broadcast();
      }
      case 'kick': {
        if (!isHost || m.id === id || !this.players.has(m.id)) return;
        for (const [s, sid] of this.sockets) if (sid === m.id) { this.send(s, { t: 'kicked' }); this.sockets.delete(s); try { s.close(1000, 'kicked'); } catch (e) { } }
        this.removePlayer(m.id);
        if (this.phase === 'question' && this.allAnswered()) return this.reveal();
        return this.broadcast();
      }
    }
  }

  join(ws, m) {
    const id = typeof m.id === 'string' ? m.id.slice(0, 64) : '';
    if (!id) return;
    const name = (typeof m.name === 'string' ? m.name : '').replace(/\s+/g, ' ').trim().slice(0, 18) || 'Gracz';
    let p = this.players.get(id);
    if (p) {
      for (const [s, sid] of this.sockets) if (sid === id && s !== ws) { this.sockets.delete(s); try { s.close(1000, 'replaced'); } catch (e) { } }
      p.connected = true;
      p.name = name;
    } else {
      // Pokój nie założony przez /api/new: zły kod albo obiekt wygasły po bezczynności.
      if (!this.claimed && this.players.size === 0) return this.send(ws, { t: 'error', msg: 'Nie ma pokoju o kodzie ' + this.code + '. Sprawdź kod.' });
      if (this.players.size >= MAX_PLAYERS) return this.send(ws, { t: 'error', msg: 'Pokój jest pełny.' });
      p = { id, name, color: COLORS[this.colorIdx++ % COLORS.length], score: 0, gain: 0, correct: 0, connected: true, answer: null, answerAt: 0 };
      this.players.set(id, p);
      this.order.push(id);
    }
    this.sockets.set(ws, id);
    const host = this.hostId && this.players.get(this.hostId);
    if (!host || !host.connected) this.hostId = id;
    this.broadcast();
  }

  removePlayer(pid) {
    this.players.delete(pid);
    this.order = this.order.filter(x => x !== pid);
    if (this.hostId === pid) this.pickHost();
  }

  pickHost() {
    this.hostId = this.order.find(pid => this.players.get(pid)?.connected) || this.order[0] || null;
  }

  onClose(ws) {
    const id = this.sockets.get(ws);
    if (!id) return;
    this.sockets.delete(ws);
    if ([...this.sockets.values()].includes(id)) return;
    const p = this.players.get(id);
    if (!p) return;
    p.connected = false;
    if (this.hostId === id) this.pickHost();
    if (this.phase === 'question' && this.allAnswered()) return this.reveal();
    this.broadcast();
  }

  buildDeck() {
    const pool = ALL.filter(q => this.settings.cats.includes(q.cat));
    let fresh = shuffle(pool.filter(q => !this.used.has(q.id)));
    if (fresh.length < this.settings.count) { pool.forEach(q => this.used.delete(q.id)); fresh = shuffle(pool.slice()); }
    this.deck = fresh.slice(0, this.settings.count).map(q => {
      this.used.add(q.id);
      const opts = shuffle([q.ok, ...q.wrong]);
      return { text: q.text, cat: CAT_NAME[q.cat], opts, ok: opts.indexOf(q.ok) };
    });
  }

  ask() {
    this.phase = 'question';
    this.players.forEach(pl => { pl.answer = null; pl.gain = 0; });
    this.qStart = Date.now();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.reveal(), this.settings.time * 1000 + 400);
    this.broadcast();
  }

  allAnswered() {
    const live = [...this.players.values()].filter(p => p.connected);
    return live.length > 0 && live.every(p => p.answer !== null);
  }

  reveal() {
    if (this.phase !== 'question') return;
    clearTimeout(this.timer);
    this.phase = 'reveal';
    const q = this.deck[this.qi];
    const T = this.settings.time * 1000;
    this.players.forEach(p => {
      if (p.answer === q.ok) {
        const frac = Math.max(0, 1 - (p.answerAt - this.qStart) / T);
        p.gain = 500 + Math.round(500 * frac);
        p.score += p.gain;
        p.correct++;
      } else p.gain = 0;
    });
    this.broadcast();
  }

  view(me) {
    const inQ = this.phase === 'question' || this.phase === 'reveal';
    const q = inQ ? this.deck[this.qi] : null;
    const mine = this.players.get(me);
    return {
      t: 'state', code: this.code, me, hostId: this.hostId, phase: this.phase,
      settings: this.settings, cats: CAT_INFO,
      players: this.order.map(pid => {
        const p = this.players.get(pid);
        return {
          id: p.id, name: p.name, color: p.color, score: p.score, correct: p.correct, connected: p.connected,
          answered: p.answer !== null, gain: p.gain,
          choice: this.phase === 'reveal' ? p.answer : null,
          ms: this.phase === 'reveal' && p.answer !== null ? p.answerAt - this.qStart : null,
        };
      }),
      q: q && {
        i: this.qi + 1, total: this.deck.length, text: q.text, cat: q.cat, opts: q.opts, time: this.settings.time,
        remaining: this.phase === 'question' ? Math.max(0, this.qStart + this.settings.time * 1000 - Date.now()) : 0,
        ok: this.phase === 'reveal' ? q.ok : null,
      },
      myAnswer: mine ? mine.answer : null,
    };
  }

  broadcast() {
    for (const [ws, id] of this.sockets) this.send(ws, this.view(id));
  }
}
