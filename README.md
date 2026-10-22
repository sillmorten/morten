# Kalorien

Kalorien- und Makro-Tracker fürs iPhone, ohne Abo, ohne Konto, ohne Werbung.
Alle Daten bleiben lokal auf dem Gerät (localStorage). Lebensmittel kommen von
[Open Food Facts](https://world.openfoodfacts.org) (ODbL).

## Funktionen
- Tagesübersicht: gegessen, verbrannt, übrig, Kohlenhydrate, Eiweiß, Fett
- Über 180 eingebaute Alltags-Lebensmittel mit Portionsgrößen (funktionieren offline)
- Eintragen per Suche, Barcode-Scan, eigene Lebensmittel oder Schnelleintrag
- Sport eintragen (Schätzung über Dauer und Gewicht) oder Wert aus Apple Health per Kurzbefehl einfügen
- Verlauf (Woche, Monat, 3 Monate), Körpergewicht, Backup als Datei

## Installation auf dem iPhone
1. Seite in **Safari** öffnen.
2. **Teilen** → **Zum Home-Bildschirm**.
3. App über das neue Icon starten. Sie funktioniert danach auch offline.

## Technik
Reines HTML/CSS/JavaScript ohne Build-Schritt. `sw.js` cached die App für den Offline-Betrieb.
Nach Änderungen die `VERSION` in `sw.js` hochzählen, damit Geräte das Update laden.

Icons: [Phosphor Icons](https://phosphoricons.com) (MIT). Barcode: [ZXing](https://github.com/zxing-js/library) (Apache 2.0).
