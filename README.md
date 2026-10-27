# Biss

Kalorien- und Makro-Tracker fürs iPhone, ohne Abo, ohne Konto, ohne Werbung.
Alle Daten bleiben lokal auf dem Gerät (localStorage). Lebensmittel kommen von
[Open Food Facts](https://world.openfoodfacts.org) (ODbL).

## Funktionen
- Tagesübersicht: gegessen, verbrannt, übrig, Kohlenhydrate, Eiweiß, Fett
- Ziel-Rechner: Kalorien und Makros aus Alter, Größe, Gewicht, Zielgewicht und Aktivität (Mifflin-St Jeor), mit Zieldatum
- Über 180 eingebaute Alltags-Lebensmittel mit Portionsgrößen (funktionieren offline)
- Eintragen per Suche, Barcode-Scan, eigene Lebensmittel oder Schnelleintrag
- Sport eintragen (Schätzung über Dauer und Gewicht) oder Wert aus Apple Health per Kurzbefehl einfügen
- Verlauf nach Woche, Monat, Jahr oder alles, beliebig weit zurückblättern, Kalender zum Springen auf jeden Tag
- Körpergewicht mit komplettem Verlauf
- Backup als Datei (z. B. iCloud Drive): Übersicht, was drin ist, Erinnerung (wöchentlich/monatlich), Wiederherstellen per Ersetzen oder Zusammenführen, letzte Wiederherstellung rückgängig machbar
- Streaks und Abzeichen (Tage im Ziel, Tage eingetragen, Eiweiß, Supplements)
- Körpermaße mit Verlauf und Fortschrittsfotos (verkleinert in IndexedDB, im Backup enthalten)
- Supplement-Tracker zum täglichen Abhaken, frei einstellbar
- Essensideen zum Abnehmen oder Zunehmen (`ideas.js`), sortiert nach den übrigen Kalorien und dem Eiweiß des Tages, mit einem Tipp eintragbar
- Verbesserungswünsche direkt aus der App an den Entwickler senden (Formspree)

## Installation auf dem iPhone
1. Seite in **Safari** öffnen.
2. **Teilen** → **Zum Home-Bildschirm**.
3. App über das neue Icon starten. Sie funktioniert danach auch offline.

## Technik
Reines HTML/CSS/JavaScript ohne Build-Schritt. `sw.js` cached die App für den Offline-Betrieb.
Nach Änderungen die `VERSION` in `sw.js` hochzählen, damit Geräte das Update laden, und `APP_VERSION` in `app.js` anpassen (wird unter „Ziele“ angezeigt).

Icons: [Phosphor Icons](https://phosphoricons.com) (MIT). Barcode: [ZXing](https://github.com/zxing-js/library) (Apache 2.0).

## App sperren
In `status.json` steuert `"gesperrt": true` einen Sperr-Bildschirm für alle Nutzer, `false` gibt die App wieder frei.
Titel und Text lassen sich dort ebenfalls ändern. Die Daten auf den Geräten bleiben unberührt.
Einen Zugangscode für Nutzer gibt es nicht. Der Entwickler kommt über „Ich bin Admin“ auf der Wartungs-Seite mit seinem Passwort rein (oder 7× auf „Biss · Wartung“ tippen). Das ist kein echter Schutz, da die App komplett im Browser läuft.
Auf dem eigenen Gerät hebt 7× Tippen auf „Biss · Wartung“ im Sperr-Bildschirm die Sperre dauerhaft auf.

