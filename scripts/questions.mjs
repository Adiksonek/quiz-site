// Baza pytań: walidacja i generowanie src/questions/index.js.
//   node scripts/questions.mjs check [--min 100] [--only slug,slug]
//   node scripts/questions.mjs build
//   node scripts/questions.mjs stats
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'questions');
const MAX_Q = 120, MAX_A = 30, MIN_Q = 10;
const DATED = /\b(obecn\w*|aktualn\w*|dzisiaj|dziś|w tym roku|ostatni(?:m|ego)? sezon\w*|najnowsz\w*)\b/i;

const args = process.argv.slice(2);
const cmd = args[0] || 'check';
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : args[i + 1]; };
const MIN = Number(opt('min', 100));
const ONLY = opt('only', '') ? opt('only', '').split(',') : null;

const cats = JSON.parse(readFileSync(join(DIR, 'categories.json'), 'utf8'));
const norm = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, ' ').trim();

function load(slug) {
  const f = join(DIR, slug + '.json');
  if (!existsSync(f)) return null;
  return JSON.parse(readFileSync(f, 'utf8'));
}

function check() {
  const errors = [], warns = [];
  const seen = new Map();
  let total = 0;
  for (const c of cats) {
    const data = load(c.slug);
    const where = c.slug + '.json';
    if (!data) { if (!ONLY || ONLY.includes(c.slug)) errors.push(`${where}: brak pliku`); continue; }
    if (data.slug !== c.slug) errors.push(`${where}: slug "${data.slug}" nie zgadza się z nazwą pliku`);
    const qs = Array.isArray(data.questions) ? data.questions : [];
    total += qs.length;
    qs.forEach((x, i) => {
      const at = `${where}#${i + 1}`;
      if (typeof x.q !== 'string' || x.q.trim().length < MIN_Q) errors.push(`${at}: za krótkie pytanie`);
      else if (x.q.length > MAX_Q) errors.push(`${at}: pytanie ma ${x.q.length} znaków (max ${MAX_Q})`);
      if (typeof x.ok !== 'string' || !x.ok.trim()) errors.push(`${at}: brak poprawnej odpowiedzi`);
      if (!Array.isArray(x.bad) || x.bad.length !== 3) errors.push(`${at}: wymagane dokładnie 3 błędne odpowiedzi`);
      const all = [x.ok, ...(x.bad || [])];
      all.forEach(a => { if (typeof a !== 'string' || !a.trim()) errors.push(`${at}: pusta odpowiedź`); else if (a.length > MAX_A) errors.push(`${at}: odpowiedź "${a}" ma ${a.length} znaków (max ${MAX_A})`); });
      if (new Set(all.map(norm)).size !== all.length) errors.push(`${at}: odpowiedzi się powtarzają`);
      if (x.lvl !== undefined && ![1, 2, 3].includes(x.lvl)) errors.push(`${at}: lvl musi być 1, 2 albo 3`);
      if (typeof x.q === 'string') {
        const k = norm(x.q);
        if (seen.has(k)) errors.push(`${at}: duplikat pytania z ${seen.get(k)}`);
        else seen.set(k, at);
        if (DATED.test(x.q)) warns.push(`${at}: pytanie może się zdezaktualizować: "${x.q}"`);
        if (/[–—]/.test(x.q + all.join(''))) warns.push(`${at}: długi myślnik, użyj "-"`);
      }
    });
    if ((!ONLY || ONLY.includes(c.slug)) && qs.length < MIN) errors.push(`${where}: ${qs.length} pytań (min ${MIN})`);
  }
  warns.forEach(w => console.warn('uwaga: ' + w));
  errors.forEach(e => console.error('błąd:  ' + e));
  console.log(`\n${cats.length} kategorii, ${total} pytań, ${errors.length} błędów, ${warns.length} uwag`);
  process.exit(errors.length ? 1 : 0);
}

function build() {
  const present = cats.filter(c => load(c.slug));
  const lines = [
    '// Plik generowany przez `npm run build:questions`. Nie edytuj ręcznie.',
    "import CATEGORIES from './categories.json';",
    ...present.map((c, i) => `import q${i} from './${c.slug}.json';`),
    '',
    'export { CATEGORIES };',
    `export const BANK = { ${present.map((c, i) => `'${c.slug}': q${i}.questions`).join(', ')} };`,
    '',
  ];
  writeFileSync(join(DIR, 'index.js'), lines.join('\n'));
  console.log(`index.js: ${present.length} z ${cats.length} kategorii`);
}

function stats() {
  let total = 0;
  for (const c of cats) {
    const d = load(c.slug); const n = d ? d.questions.length : 0; total += n;
    const lv = d ? [1, 2, 3].map(l => d.questions.filter(q => q.lvl === l).length).join('/') : '-';
    console.log(`${String(n).padStart(4)}  ${c.slug.padEnd(22)} lvl ${lv}`);
  }
  console.log(`${String(total).padStart(4)}  razem`);
}

const run = { check, build, stats }[cmd];
if (!run) { console.error('Nieznana komenda: ' + cmd); process.exit(2); }
run();
