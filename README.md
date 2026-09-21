# printerr

Preisschilder für erzgebirgische Holzkunst. Läuft komplett im Browser:
Produkte pflegen, Schilder auswählen, über den normalen Druckdialog auf A4
drucken.

**→ <https://badsgahhl.github.io/printerr/>**

Wie viele Schilder auf einen A4-Bogen kommen, ist einstellbar — von einem
(ganzes A4) bis sechzehn (A8). Voreingestellt sind vier, also ein Viertel-A4 pro
Schild (**105 × 148,5 mm**, hoch). Die Schnittlinien werden mitgedruckt.

## Der Sonderfall, um den es eigentlich geht

Eine Mühle kostet 890 €, steht in der Ausstellung aber mit Figuren. Markiert man
die Figuren als _ausgestellt_, druckt das Schild **1.148,00 €** groß — den Preis
dessen, was der Kunde tatsächlich sieht — und darunter klein, woraus er sich
zusammensetzt. Das ist auch die Vorgabe der PAngV: Das ausgestellte Stück trägt
seinen Endpreis.

## Zwei Arbeitsbereiche

Oben wird zwischen **Drucken** und **Daten** umgeschaltet.

**Daten** ist der Editor. Produkte und Teile werden getrennt geführt:

- Ein **Teil** (Figur, Zubehör, Ersatzstück) liegt einmal im Katalog und hängt an
  beliebig vielen Produkten. Ändert sich sein Preis, wirkt das sofort überall.
- Ein Produkt darf den Preis eines Teils **im Einzelfall überschreiben**, ohne
  das Teil für alle anderen zu ändern. Ein Rückstell-Knopf holt den
  Katalogpreis zurück.
- Was das Schild groß zeigen wird, steht live im Formular — bevor irgendetwas
  gedruckt ist.

**Drucken** ist die Auswahl mit der Bogenvorschau. `Cmd+P` liefert immer die
Schilder, auch aus dem Daten-Bereich heraus.

Unter **Bogen & Schildgröße** wird die Aufteilung gewählt: 1, 2, 4, 6, 8, 9, 12
oder 16 pro Bogen, oder frei als Spalten × Zeilen. Jede Aufteilung teilt A4 ohne
Rest, damit die Schnittlinien nicht wandern. Die Typografie skaliert mit — die
Größenregler gelten für ein Viertel-A4 und werden auf das gewählte Format
umgerechnet, sodass ein Wechsel das Design behält statt die Schrift zu
zertrümmern.

Ab acht pro Bogen wird der Rand schmaler als die 3–6 mm, die Drucker am
Blattrand nicht erreichen. Die App sagt das, statt es stillschweigend zu tun:
betroffen sind nur die äußeren Schilder, und der Rand-Regler kann es ausgleichen.

## Wo die Daten liegen

Im Browser des jeweiligen Rechners (IndexedDB, mit Rückfall auf localStorage).
Das heißt auch: **nicht** auf einem Netzlaufwerk und nicht geteilt. Ein geleerter
Browser nimmt sie mit.

Deshalb kann der Datenbereich zweierlei ausgeben:

- **Sicherung** (`.json`) — die vollständige Kopie samt Teile-Katalog und allen
  Überschreibungen. Gehört auf ein Netzlaufwerk oder einen Stick.
- **Tabelle** (`.ods`) — flach, für alles, was LibreOffice besser kann als jeder
  Editor: alle Preise auf einmal anheben, nach Hersteller sortieren, die Liste
  einem Kollegen mailen. Lässt sich verlustfrei wieder einlesen.

Eine vorhandene Tabelle wird beim Import zusammengefaltet: wiederholte
Zusatzzeilen werden zu einem Teil, und wo derselbe Artikel unterschiedliche
Preise hatte, entsteht daraus automatisch eine Überschreibung.

Das Spaltenformat steht in [`docs/tabellen-format.md`](docs/tabellen-format.md).

## Drucken

Einmalig im Druckdialog einstellen (Chrome merkt es sich pro Drucker):

- Ränder: **Keine**
- Kopf- und Fußzeilen: **aus**
- Skalierung: **Standard** (100 %)

Die Schnittlinien werden mitgedruckt. Sollte der Dialog doch verkleinern, werden
alle Schilder gleichmäßig kleiner und bleiben schnittgenau — geschnitten wird
nach gedruckter Linie, nicht nach Lineal. Wer es genau wissen will, schaltet
„Maßstab-Lineal mitdrucken" ein und misst den 100-mm-Balken nach.

## Entwickeln

```sh
pnpm install
pnpm dev              # http://localhost:4300

pnpm test:unit        # Vitest (watch); "pnpm test:unit run" für einen Durchlauf
pnpm type-check
pnpm lint
pnpm format
pnpm beispiele        # erzeugt die Beispieltabellen neu
```

`pnpm build` schreibt nach `dist/`; jeder Push auf `main` veröffentlicht das über
GitHub Pages.

### Aufbau

```
src/lib/          reine Logik - kein Vue, kein DOM, vollständig unit-getestet
  catalog/        Produkte, Teile, Zuordnungen; Import, Sicherung, Tabellenexport
  ods/            .ods lesen und schreiben
  schema/         Spaltenzuordnung, Zahlen, Tabelle -> Etiketten
  price.ts        Cent-Arithmetik und die Ausstellungspreis-Regel
  fit-text.ts     Schriftgrößen-Suche (das Messen wird hineingereicht)
  paginate.ts     Etiketten -> Bögen mit je vier Plätzen
src/infra/        Browser-Adapter: IndexedDB, Mess-Sandbox, Speicher
src/composables/  dünne reaktive Hüllen um src/lib
src/print/        Etikett und Bogen, handgeschriebenes CSS in Millimetern
src/components/   Oberfläche; ui/ ist von shadcn-vue generiert und ungelintet
```

Die Logik liegt bewusst in reinen Funktionen: Preisregeln, Tabellenauswertung,
Katalogänderungen und Seitenaufteilung lassen sich so ohne Browser prüfen.

### Dinge, die nicht offensichtlich sind

- **Der Katalog darf keine Vue-Proxies enthalten.** IndexedDB serialisiert mit
  `structuredClone`, und das wirft an einem Proxy (`DataCloneError`). Alles, was
  aus einem Formular kommt, wird mit `toRaw` ausgepackt — die Zuordnungen extra,
  denn `toRaw` löst nur die oberste Ebene auf.
- **Seitenumbrüche macht JavaScript, nicht der Browser.** Grid und Flexbox haben
  dokumentierte Fehler mit `break-inside`; deshalb wird pro A4-Seite ein
  Block-Element mit genau vier Plätzen erzeugt.
- **Im Druck darf nichts neben den Bögen stehen.** Ein Bogen ist exakt 297 mm
  hoch; schon ein paar Millimeter Abstand aus dem Bildschirmlayout schieben ihn
  über die Seite und hinterlassen eine fast leere Folgeseite.
- **Der Seitenumbruch sitzt auf `.sheet-scaler`, nicht auf `.sheet`.** Jeder Bogen
  ist einziges Kind seines Wrappers, `:last-child` träfe also auf alle zu.
- **Gemessen wird in einer Sandbox**, nicht im sichtbaren Etikett. Die Vorschau
  ist per `transform: scale()` verkleinert, und eine Transform verfälscht jede
  Messung.
- **Gemessen wird beim Rendern, nicht beim Druckknopf.** `beforeprint` kann nicht
  warten, also muss das Layout jederzeit stimmen - auch wenn jemand Cmd+P drückt.
- **Keine CSS-Hintergrundfarben im Etikett.** Browser drucken sie standardmäßig
  nicht. Gestaltet wird mit Typografie und Linien.
- **Geld ist immer Integer-Cent.** Preise werden nie als Fließkommazahl addiert.
- **105 × 148,5 mm, nicht ISO-A6.** A6 ist 105 × 148 mm; auf A4 blieben damit
  pro Bogen 1 mm Rest und die Schnittlinien würden wandern. Dasselbe gilt für
  jede andere Aufteilung: sie leitet sich aus A4 ab, nie aus einer DIN-Tabelle.
- **Alle Etikettmaße sind Vielfache des Referenzformats.** Ein Viertel-A4 ist
  kalibriert, jedes andere Raster skaliert davon — waagerecht mit der Breite,
  senkrecht mit der Höhe, die Schrift mit der kleineren von beiden. Sonst würde
  ein breites, flaches Schild senkrecht überlaufen.

## Offen

- Produkte lassen sich noch nicht von Hand umsortieren; die Funktion dafür liegt
  bereit, nur die Bedienung fehlt.
- Größenvarianten (ein Schild, mehrere Größen mit eigenen Preisen). Die Spalte
  `Layout` hält den Platz dafür frei.
