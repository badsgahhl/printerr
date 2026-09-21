# printerr

Preisschilder für erzgebirgische Holzkunst. Läuft komplett im Browser, ohne
Server und ohne Internet: LibreOffice-Tabelle hineinziehen, Schilder auswählen,
über den normalen Druckdialog auf A4 drucken.

Ein Schild ist ein Viertel A4 (**105 × 148,5 mm**, hoch), vier davon pro Bogen,
mit gedruckten Schnittlinien.

## Der Sonderfall, um den es eigentlich geht

Eine Mühle kostet 890 €, steht in der Ausstellung aber mit Figuren. Markiert man
die Figuren in der Tabelle als _ausgestellt_, druckt das Schild **1.148,00 €**
groß — den Preis dessen, was der Kunde tatsächlich sieht — und darunter klein,
woraus er sich zusammensetzt. Das ist auch die Vorgabe der PAngV: Das ausgestellte
Stück trägt seinen Endpreis.

Das Tabellenformat steht in [`docs/tabellen-format.md`](docs/tabellen-format.md).

## Ausprobieren

Im Browser, ohne Installation: <https://badsgahhl.github.io/printerr/>

Dort im Ablagefeld auf **Beispieltabelle herunterladen** klicken und die Datei
wieder ins Fenster ziehen — mehr braucht es nicht, um zu sehen, was gedruckt
wird. Die Seite rechnet trotzdem nur lokal: Es wird nichts hochgeladen.

## Loslegen

```sh
pnpm install
pnpm dev              # http://localhost:4300
```

Beispieldatei zum Ausprobieren: `beispiele/preisschilder-beispiel.ods`
(einfach ins Fenster ziehen) — dieselbe Datei steckt als Download in der
Oberfläche. Neu erzeugen lassen sie sich mit `pnpm beispiele`.

## Ausliefern

```sh
pnpm build            # erzeugt dist/index.html
```

Das ist **eine einzige Datei** — JavaScript, CSS und alles andere sind darin
eingebettet, auch die Beispieltabelle hinter dem Download-Link. Auf den
Laden-Rechner kopieren, doppelklicken, fertig. Keine Installation, kein Server,
kein Internet.

### GitHub Pages

Dieselbe Datei liegt unter <https://badsgahhl.github.io/printerr/>.
`.github/workflows/pages.yml` baut und veröffentlicht sie bei jedem Push auf
`main`. Einmalig nötig: in den Repository-Einstellungen unter **Pages** als
Quelle **GitHub Actions** wählen.

## Drucken

Einmalig im Druckdialog einstellen (Chrome merkt es sich pro Drucker):

- Ränder: **Keine**
- Kopf- und Fußzeilen: **aus**
- Skalierung: **Standard** (100 %)

Die Schnittlinien werden mitgedruckt. Sollte der Dialog doch verkleinern, werden
alle Schilder gleichmäßig kleiner und bleiben schnittgenau — geschnitten wird
nach gedruckter Linie, nicht nach Lineal. Wer es genau wissen will, schaltet
„Maßstab-Lineal mitdrucken" ein und misst den 100-mm-Balken nach.

## Schildgröße einstellen

In der Seitenleiste unter **Schildgröße** lassen sich vier Dinge verstellen:
Preis, Produktname, Kleintext und Rand.

Alle drei Größen sind **Obergrenzen**, keine festen Werte. Passt der Text nicht,
verkleinert die Automatik ihn weiter — bei „1.148,00 €" bleibt der Preis also
kleiner als eingestellt, während „89,00 €" die volle Größe bekommt. Genau
deshalb ist ein fester Wert keine Option: er würde bei langen Preisen über den
Rand laufen.

Die Einstellungen liegen im Browser des jeweiligen Rechners, nicht in der
Tabelle. „Zurücksetzen" stellt die Ausgangswerte wieder her.

## Entwickeln

```sh
pnpm test:unit        # Vitest (watch); "pnpm test:unit run" für einen Durchlauf
pnpm type-check
pnpm lint
pnpm format
```

### Aufbau

```
src/lib/          reine Logik - kein Vue, kein DOM, vollständig unit-getestet
  ods/            .ods lesen und schreiben
  schema/         Spaltenzuordnung, Zahlen, Tabelle -> Etiketten
  price.ts        Cent-Arithmetik und die Ausstellungspreis-Regel
  fit-text.ts     Schriftgrößen-Suche (das Messen wird hineingereicht)
  paginate.ts     Etiketten -> Bögen mit je vier Plätzen
src/infra/        Browser-Adapter: Mess-Sandbox, Speicher
src/composables/  dünne reaktive Hüllen um src/lib
src/print/        Etikett und Bogen, handgeschriebenes CSS in Millimetern
src/components/   Bedienoberfläche (Tailwind)
```

Die Logik liegt bewusst in reinen Funktionen: Preisregeln, Tabellenauswertung und
Seitenaufteilung lassen sich so ohne Browser prüfen.

### Dinge, die nicht offensichtlich sind

- **Seitenumbrüche macht JavaScript, nicht der Browser.** Grid und Flexbox haben
  dokumentierte Fehler mit `break-inside`; deshalb wird pro A4-Seite ein
  Block-Element mit genau vier Plätzen erzeugt.
- **Gemessen wird in einer Sandbox**, nicht im sichtbaren Etikett. Die Vorschau
  ist per `transform: scale()` verkleinert, und eine Transform verfälscht jede
  Messung.
- **Gemessen wird beim Rendern, nicht beim Druckknopf.** `beforeprint` kann nicht
  warten, also muss das Layout jederzeit stimmen - auch wenn jemand Cmd+P drückt.
- **Keine CSS-Hintergrundfarben im Etikett.** Browser drucken sie standardmäßig
  nicht. Gestaltet wird mit Typografie und Linien.
- **Im Druck darf nichts neben den Bögen stehen.** Ein Bogen ist exakt 297 mm
  hoch; schon ein paar Millimeter Abstand aus dem Bildschirmlayout schieben ihn
  über die Seite und hinterlassen eine fast leere Folgeseite. `.sheet-list` setzt
  deshalb Abstand und Innenabstand im Druck auf null.
- **Der Seitenumbruch sitzt auf `.sheet-scaler`, nicht auf `.sheet`.** Jeder Bogen
  ist einziges Kind seines Wrappers, `:last-child` träfe also auf alle zu — und
  ein Umbruch hinter dem letzten Bogen erzeugt eine leere Schlussseite.
- **Die Beispieltabelle steckt als Data-URL im Bundle.** Das `?inline` in
  `ImportDropZone.vue` ist kein Zufall: Der Laden kopiert nur `index.html`, eine
  zweite Datei daneben gäbe es dort nicht.
- **Geld ist immer Integer-Cent.** Preise werden nie als Fließkommazahl addiert.
- **105 × 148,5 mm, nicht ISO-A6.** A6 ist 105 × 148 mm; auf A4 blieben damit
  pro Bogen 1 mm Rest und die Schnittlinien würden wandern.

## Offen

- Größenvarianten (ein Schild, mehrere Größen mit eigenen Preisen). Die Spalte
  `Layout` hält den Platz dafür frei.
