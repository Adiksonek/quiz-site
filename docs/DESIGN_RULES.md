# Quiz Party — reguły designu (anti AI-slop)

Cel: premium, spokojnie, przyjemnie dla oka. Poziom referencyjny: aplikacje systemowe iOS 26 (Liquid Glass), Things, Linear, Arc.

## Zakazane (sygnały „robiło AI”)
1. Rozmyte kolorowe plamy (blobs), mesh gradienty i tęczowe tła.
2. Gradienty fiolet→indygo na przyciskach, kolorowe poświaty (glow) i kolorowe cienie.
3. Ozdobne fonty „z charakterem” (Bricolage, Space Grotesk, Syne itd.) i więcej niż jedna rodzina.
4. Emoji jako ikony, ikonki „sparkles”, wykrzykniki w copy, frazy typu „Kto z was wie więcej?”.
5. Sekcje-wypełniacze: „Jak to działa: 1-2-3”, statystyki, testimoniale.
6. Szkło na wszystkim. Karta w karcie w karcie.
7. Losowe promienie zaokrągleń i odstępy spoza siatki.

## Zasady
- **Kolor:** neutralna baza (grafit albo ciepła biel) i jeden akcent. Kolory graczy tylko jako małe kropki/awatary, nigdy jako tło ekranu.
- **Typografia:** jedna rodzina neo-grotesk (Geist / Inter), 3 grubości (400/500/600), skala 13/15/17/22/28/40, cyfry tabelaryczne przy punktach i timerze, ciasny tracking na dużych rozmiarach. Inputy ≥16 px (iOS nie zoomuje).
- **Szkło (Liquid Glass) tylko dla warstw pływających:** dolny pasek akcji, górna belka, arkusze (sheets), przyciski odpowiedzi. Treść leży na zwykłej powierzchni. Szkło musi mieć coś pod sobą (treść przewijana pod spodem albo jedna stonowana fotografia lub tekstura), a nie kolorowe plamy.
- **Materiał szkła:** blur 20–30 px z lekką saturacją, krawędź 0.5–1 px z jaśniejszym górnym brzegiem (refleks), bez kolorowych cieni. Cień najwyżej neutralny, miękki i niski.
- **Geometria:** siatka 4/8 px, margines boczny 20 px, promienie koncentryczne (zewnętrzny = wewnętrzny + padding), tap target ≥ 44 px, kciuk: główna akcja na dole.
- **Ikony:** jeden zestaw (styl Lucide/SF), stała grubość linii 1.75.
- **Copy:** krótko i rzeczowo, po polsku, bez marketingu.
- **Ruch:** tylko funkcjonalny (timer, zaznaczenie, przejście), spring 200–300 ms, bez dekoracyjnych animacji.
- **Dostępność:** kontrast tekstu ≥ 4.5:1 także na szkle. Poprawne/błędne rozróżniane ikoną, nie samym kolorem.

## Test przed oddaniem
Czy ekran wyglądałby na miejscu obok aplikacji systemowych Apple? Jeśli jakiś element jest tylko „dla efektu”, usuń go.
