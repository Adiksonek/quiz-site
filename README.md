# Quiz party

Quiz wiedzy ogólnej na żywo: jedna osoba zakłada pokój, reszta dołącza z linku, kodu QR albo 4-literowego kodu. Każdy odpowiada na swoim telefonie, a punkty i ranking aktualizują się na bieżąco.

## Jak to działa

- `public/index.html` - cała strona (front).
- `src/index.js` - Worker + Durable Object `Room`. Każdy pokój to osobny obiekt, który trzyma graczy, pytania, timer i punkty, a z telefonami rozmawia po WebSocketach.
- `src/questions.js` - baza pytań: `[pytanie, kategoria, poprawna, błędna, błędna, błędna]`.

Poprawne odpowiedzi są tylko na serwerze, więc nie da się ich podejrzeć w przeglądarce.

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
