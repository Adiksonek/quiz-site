# Quiz Party na Androida - plan

Cel pierwszego etapu: działająca aplikacja na Androida instalowana z pliku APK, bez Google Play i bez podpisu wydawniczego. Ten sam kod ma później posłużyć do wydania w Google Play i na iOS.

## Decyzja: Capacitor

| Podejście | Za | Przeciw |
| --- | --- | --- |
| **Capacitor** (wybrane) | Ten sam frontend (`public/`), natywne wtyczki (wibracje, udostępnianie, skaner QR, ekran nie gaśnie), ten sam projekt da iOS | Trzeba przygotować frontend do działania poza domeną (adres API, CORS) |
| TWA (Trusted Web Activity) | Najmniej pracy, aktualizacje bez wydawania aplikacji | To tylko Chrome w ramce: bez natywnych funkcji, wymaga Chrome, bez weryfikacji domeny pokazuje pasek adresu |
| Przepisanie (React Native / Flutter) | Pełna kontrola nad natywnym UI | Drugi frontend do utrzymania, tygodnie pracy, dla quizu bez zysku |

Capacitor ładuje `public/index.html` z paczki w aplikacji, a gra łączy się z tym samym serwerem co strona (`quiz-party.adrianwolosz3.workers.dev`). Pytania i poprawne odpowiedzi zostają na serwerze, tak jak teraz.

### „Bez podpisu” w praktyce

Android nie zainstaluje całkowicie niepodpisanego APK. Na start wystarczy **APK debug**: Gradle podpisuje go automatycznie kluczem deweloperskim z `~/.android/debug.keystore`. Nie trzeba zakładać własnego klucza ani konta w Google Play. Instalacja: przesłać plik na telefon, zezwolić na instalację z nieznanych źródeł, zainstalować.

Ograniczenie: każdy komputer ma inny klucz debug, więc APK zbudowany na innej maszynie nie zainstaluje się jako aktualizacja i trzeba najpierw odinstalować poprzednią wersję. Dlatego APK budujemy w jednym miejscu (GitHub Actions ze stałym kluczem debug zapisanym w sekretach repo) i stamtąd go pobieramy.

## Środowisko na tym komputerze

Sprawdzone 2026-10-20:

- Android SDK: `D:\Android\Sdk` (platforma android-36, build-tools 35 i 36), `ANDROID_HOME` ustawione
- Android Studio: `D:\Android\android-studio`
- JDK 21: `D:\Android\Jdk\jdk-21.0.12+8`. Na `PATH` jest Java 8, więc przed budowaniem trzeba ustawić `JAVA_HOME` na JDK 21.
- Node 24

## Kroki

### 1. Frontend gotowy na aplikację

- Adres serwera w jednym miejscu: `API_BASE` (puste na stronie, pełny adres w aplikacji), używane przez `fetch` i WebSocket.
- Serwer: nagłówki CORS dla `/api/*` (origin aplikacji Capacitor to `https://localhost`) i zgoda na WebSocket z tego originu.
- Link do pokoju i kod QR zawsze z adresem strony, nie z originem aplikacji.
- Brak sieci: osobny ekran z przyciskiem „Spróbuj ponownie” zamiast pustej strony.

### 2. Projekt Capacitor

- `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` w repo, katalog `android/` w repo.
- `capacitor.config.json`: `appId` `pl.quizparty.app`, `appName` „Quiz Party”, `webDir` `public`.
- Ikona i ekran startowy z `@capacitor/assets` (znak „?” na limonkowym tle, jak favicon).

### 3. Natywne funkcje

| Funkcja | Wtyczka | Zastępuje |
| --- | --- | --- |
| Wibracja przy odpowiedzi | `@capacitor/haptics` | `navigator.vibrate` |
| Udostępnianie linku i wyniku | `@capacitor/share` | Web Share API |
| Ekran nie gaśnie w trakcie gry | `@capacitor-community/keep-awake` | Wake Lock API |
| Kolor paska statusu wg motywu | `@capacitor/status-bar` | `theme-color` |
| Przycisk wstecz: wyjście z arkusza, z pokoju, z gry | `@capacitor/app` | brak |
| Skan QR, żeby dołączyć do pokoju | `@capacitor-mlkit/barcode-scanning` | aparat systemowy |

Skaner QR w aplikacji ma sens (w przeglądarce go nie było, bo iOS Safari go nie obsługuje).

### 4. Linki do pokoju

- Na start: schemat `quizparty://join/ABCD` i obsługa `?r=ABCD` przekazanego przy otwarciu.
- Później (przy Google Play): App Links, czyli `https://quiz-party.../?r=ABCD` otwiera aplikację. Wymaga pliku `/.well-known/assetlinks.json` z odciskiem klucza wydawniczego.

### 5. Budowanie

- Lokalnie: `npm run build:questions && npx cap sync android && cd android && gradlew assembleDebug` z `JAVA_HOME` na JDK 21. Wynik: `android/app/build/outputs/apk/debug/app-debug.apk`.
- GitHub Actions: workflow budujący APK debug przy każdym pushu na `main`, plik jako artefakt i załącznik do GitHub Release. Stały klucz debug w sekretach repo, żeby aktualizacje instalowały się na starą wersję.

### 6. Testy

- Telefon z Androidem przez USB (`adb install`) i emulator z `D:\Android\Sdk\emulator`.
- Lista: start pokoju, dołączenie kodem i skanem QR, gra 3 osób (aplikacja + przeglądarka), Sprint we wszystkich trybach, utrata sieci i powrót, przycisk wstecz, jasny i ciemny motyw, Android 10 i najnowszy.

### 7. Później: Google Play

- Własny klucz wydawniczy (upload key), plik AAB zamiast APK.
- Konto Google Play Console (jednorazowa opłata), polityka prywatności, formularz bezpieczeństwa danych (zbieramy tylko imię w grze i anonimowy identyfikator urządzenia do rankingu Sprintu dnia).
- Wymagany aktualny `targetSdkVersion` i test zamknięty przed publikacją. Dla nowych kont prywatnych było to min. 12 testerów przez 14 dni (stan z 2025 roku, sprawdzić aktualne zasady przed startem).
- App Links z weryfikacją domeny.

## Ryzyka

- **WebSocket w tle:** Android usypia aplikację w tle, więc po powrocie trzeba się połączyć ponownie. Logika ponownego łączenia już działa przy `visibilitychange`.
- **Wydajność blura:** `backdrop-filter` w WebView na słabszych telefonach. Mamy już fallback przez `@supports`, w razie potrzeby wyłączymy blur na Androidzie poniżej określonej wersji.
- **Klucz debug:** bez stałego klucza aktualizacje wymagają odinstalowania (patrz wyżej).
