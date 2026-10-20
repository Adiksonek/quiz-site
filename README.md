# Quiz party

Quiz wiedzy ogólnej na żywo: jedna osoba zakłada pokój, reszta dołącza z linku, kodu QR albo 4-literowego kodu. Każdy odpowiada na swoim telefonie, a punkty i ranking aktualizują się na bieżąco.

## Jak to działa

- `public/index.html` - cała strona (front).
- `src/index.js` - Worker + Durable Object `Room`. Każdy pokój to osobny obiekt, który trzyma graczy, pytania, timer i punkty, a z telefonami rozmawia po WebSocketach.
- `src/questions/` - baza pytań, jeden plik JSON na kategorię. Lista kategorii, ich nazwy i grupy są w `categories.json`.
- `docs/DESIGN_RULES.md` - zasady designu (Liquid Glass, bez AI-slopu).

Poprawne odpowiedzi są tylko na serwerze, więc nie da się ich podejrzeć w przeglądarce.

## Baza pytań

Plik kategorii, np. `src/questions/geografia.json`:

```json
{
  "slug": "geografia",
  "name": "Geografia",
  "questions": [
    { "q": "Która rzeka jest najdłuższa w Europie?", "ok": "Wołga", "bad": ["Dunaj", "Ren", "Dniepr"], "lvl": 2 }
  ]
}
```

- `ok` - poprawna odpowiedź, `bad` - dokładnie 3 błędne, `lvl` - trudność 1-3.
- Pytanie max 120 znaków, odpowiedź max 30 (mieści się na telefonie 360 px).
- Każda kategoria ma min. 100 pytań.

Komendy:

```bash
npm run check:questions   # walidacja: długości, duplikaty, liczba pytań w kategorii
npm run stats:questions   # liczba pytań i rozkład trudności w każdej kategorii
npm run build:questions   # generuje src/questions/index.js (dev i deploy robią to same)
```

Nowa kategoria: dopisz ją do `categories.json`, dodaj plik `<slug>.json` i uruchom `npm run check:questions`.

## Wdrożenie (Cloudflare, darmowy plan wystarczy)

Wymagany Node.js 18+.

```bash
npm install
npx wrangler login
npm run deploy
```

Po deployu dostaniesz adres w stylu `https://quiz-party.<twoja-subdomena>.workers.dev`. Własną domenę możesz podpiąć w panelu Cloudflare w ustawieniach Workera.

Alternatywnie: wrzuć folder do repo na GitHubie i podłącz je w panelu Cloudflare jako Worker z buildem z repozytorium - każdy push zrobi deploy.

## Lokalnie

```bash
npm run dev
```

Strona będzie pod `http://localhost:8787`.

## Zasady punktacji

Poprawna odpowiedź daje od 500 do 1000 punktów - im szybciej, tym więcej. Zła albo brak odpowiedzi: 0.
Pytanie kończy się, gdy odpowiedzą wszyscy podłączeni gracze albo gdy skończy się czas. Host przechodzi dalej przyciskiem.
