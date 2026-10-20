import { CATEGORIES, BANK } from './questions/index.js';

export const ALL = CATEGORIES.flatMap(c => (BANK[c.slug] || []).map((q, i) => ({ id: c.slug + ':' + i, text: q.q, cat: c.slug, ok: q.ok, wrong: q.bad, lvl: q.lvl || 2 })));
// Kategorie widoczne w grze: kolejność i grupy z categories.json, tylko te z pytaniami.
export const CAT_INFO = CATEGORIES.map(c => ({ ...c, n: (BANK[c.slug] || []).length })).filter(c => c.n > 0);
export const CATS = CAT_INFO.map(c => c.slug);
export const CAT_NAME = Object.fromEntries(CATEGORIES.map(c => [c.slug, c.name]));

export const shuffle = (a, rnd = Math.random) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Powtarzalny generator liczb losowych (mulberry32) - ta sama kolejność pytań dla tego samego ziarna.
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.codePointAt(0), 16777619); return h >>> 0; };
