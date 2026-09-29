# printerr

Preisschilder für erzgebirgische Holzkunst. Läuft komplett im Browser:
Produkte pflegen, Schilder auswählen, über den normalen Druckdialog auf A4
drucken.

**→ <https://badsgahhl.github.io/printerr/>**

Wie viele Schilder auf einen A4-Bogen kommen, ist einstellbar — von einem
(ganzes A4) bis vierundsechzig (A10). Voreingestellt sind vier, also ein
Viertel-A4 pro Schild (**105 × 148,5 mm**, hoch). Die Schnittlinien werden
mitgedruckt.

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
- Ein **Name ist nicht nötig**, wenn ein Preis dasteht: manche Regale brauchen
  nur die Zahl, das Stück steht ja davor. Das Schild gibt den freien Platz dann
  dem Preis. Nur ganz ohne Namen _und_ ohne Preis lässt sich nichts anlegen.
- Was das Schild groß zeigen wird, steht live im Formular — bevor irgendetwas
  gedruckt ist.

**Drucken** ist die Auswahl mit der Bogenvorschau. `Cmd+P` liefert immer die
Schilder, auch aus dem Daten-Bereich heraus.

Unter **Bogen & Schild** wird die Aufteilung gewählt: 1, 2, 4, 6, 8, 9, 12,
16, 32 oder 64 pro Bogen, oder frei als Spalten × Zeilen. Jede Aufteilung teilt
A4 ohne Rest, damit die Schnittlinien nicht wandern. Die Reihe halbiert sich der
Länge nach weiter: 64 pro Bogen ist das 16er-Schild noch einmal geviertelt,
26,25 × 37,125 mm. Viel kleiner geht nicht — dort setzt die Automatik einen
Preis wie 1.148,00 € noch gut vier Millimeter groß und den Produktnamen zwei,
während Untertitel, Artikelnummer und Ladenname unter einen Millimeter geraten.

Die Typografie skaliert mit — die Größenregler gelten für ein Viertel-A4 und
werden auf das gewählte Format umgerechnet, sodass ein Wechsel das Design behält
statt die Schrift zu zertrümmern.

## Anhänger statt Schild

Zwei Regler machen aus dem Schild einen Anhänger, der am Bändchen hängt:

- **Loch oben fürs Bändchen** hält oben auf jedem Schild einen Streifen frei.
  Die Schrift rückt nach unten, das Loch geht also nicht mehr durch den
  Produktnamen. Der Streifen steht in echten Millimetern und wächst _nicht_ mit
  dem Format mit: eine Lochzange stanzt auf dem A10-Anhänger dasselbe Loch wie
  auf dem Viertel-A4.
- **Preis steht** schiebt den Preis in dem Platz, den er ohnehin hat — mittig
  wie bisher, ganz unten, oder irgendwo dazwischen. Der Platz ändert sich dabei
  nicht, der Preis wird also verschoben und nicht kleiner.

Beides ist ab Werk aus: Loch 0 mm, Preis mittig. Ein Schild, das niemand
aufhängt, sieht damit aus wie zuvor — Pixel für Pixel, auch das mit Preiszusatz
und Aufschlüsselung.

Damit der Streifen ein kleines Format nicht auffrisst, nimmt er höchstens ein
Drittel der Schildhöhe. Auf dem 64er-Bogen sind das 12,4 der eingestellten 20 mm
— und die App sagt das, statt stillschweigend weniger zu nehmen. Was darunter
bleibt, verteilt die Automatik wie immer: alle Schriftgrößen sind Obergrenzen,
der Preis behält seinen Mindestplatz.

Unter **Schriftgrößen** hat jeder Text des Schilds einen eigenen Regler, von oben
nach unten: Produktname, Untertitel, Artikelnummer, Preis, Preiszusatz, Zusätze,
Hinweis am Fuß, Ladenname. Jeder Wert ist eine Obergrenze. Passt ein Text nicht
in die Breite, wird er kleiner gesetzt und beansprucht dann auch nur die Höhe,
die er wirklich braucht; den Rest bekommt der Preis.

## Wie groß der Preis wird

Der Preis-Regler reicht bis 220 px (58 mm auf einem Viertel-A4), doppelt so weit
wie vorher. Das ist keine Willkür, sondern gemessen: bei einem Schild wie
_159,00 €_ war die alte Obergrenze auf jedem Raster, dessen Schild breiter als
hoch ist, die eigentliche Bremse — auf einem Achtel-Bogen etwa blieb der Preis
bei 55 px stehen, obwohl über und unter ihm zwei Drittel des Platzes leer waren.
Mit der neuen Grenze sind daraus 93 px.

Auf quadratischeren Formaten bremst dagegen die Breite, nicht der Regler: dort
hilft nur weniger Text. Deshalb steht unter _Preis_ zur Wahl, wie ein glatter
Betrag geschrieben wird:

| Schreibweise | Beispiel | Preisgröße auf dem 16er-Bogen |
| ------------ | -------- | ----------------------------- |
| nicht kürzen | 139,00 € | 42 px                         |
| lang         | 139,– €  | 50 px                         |
| kurz         | 139 €    | 66,5 px                       |

Jede Stufe ist kürzer als die vorige, und kürzer heißt größer, solange die
Breite die Bremse ist — vom ausgeschriebenen Betrag zur kurzen Form sind das
gut 58 %. Preise mit echten Cent bleiben unangetastet, _249,50 €_ bleibt
_249,50 €_, und die Aufschlüsselung darunter wird mitgekürzt, damit das Schild
aus einem Guss ist. Ab Werk wird nicht gekürzt.

Die Zusätze teilen sich eine Größe, damit die Liste ruhig aussieht. Eine lange
Beschreibung wie „Komplettset (Stern + Außenbeleuchtung)" bricht dafür in eine
zweite Zeile um, statt alle Zeilen klein zu halten, und die Spalten für
Artikelnummer und Betrag sind nur so breit wie ihr Inhalt.

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

Der Rand ist die einzige Einstellung, die wirklich weh tut: ein Bogen ist so hoch
wie das Blatt, also passt er mit Rand nicht mehr auf eine Seite und hinter jedem
folgt eine fast leere. Firefox nennt das unter „Ränder" genauso wie Chrome.

**Hintergrundgrafiken** (Chrome) bzw. **Hintergrund drucken** (Firefox) müssen
_nicht_ angehakt werden. Die Schnittlinien sind Rahmen und keine Flächen, und
Rahmen druckt jeder Browser ohne Rückfrage.

Die Schnittlinien werden mitgedruckt. Sollte der Dialog doch verkleinern, werden
alle Schilder gleichmäßig kleiner und bleiben schnittgenau — geschnitten wird
nach gedruckter Linie, nicht nach Lineal. Wer es genau wissen will, schaltet
„Maßstab-Lineal mitdrucken" ein und misst den 100-mm-Balken nach.

## Entwickeln

```sh
pnpm install
pnpm dev              # http://localhost:4300

pnpm test:unit        # Vitest (watch); "pnpm test:unit run" für einen Durchlauf
pnpm test:browser     # dasselbe im echten Chromium, mit Screenshots
pnpm type-check
pnpm lint
pnpm format
pnpm beispiele        # erzeugt die Beispieltabellen neu
```

`pnpm build` schreibt nach `dist/`; jeder Push auf `main` veröffentlicht das über
GitHub Pages.

### Was der Browser prüft und jsdom nicht

`pnpm test:unit` läuft in jsdom, und jsdom misst nichts: jede Breite und jede
Höhe ist dort null. Genau das Ergebnis, um das es hier geht — wie groß die
Schrift am Ende gesetzt wird —, kann diese Suite also nie sehen.

`pnpm test:browser` rendert dieselben Komponenten in einem echten Chromium, lässt
die richtige Mess-Sandbox messen und hält von jedem Beispiel zweierlei fest:

- **einen Schnappschuss der eingepassten Schriftgrößen** (`__snapshots__/`) — die
  Zahlen, die erklären, _warum_ ein Schild so aussieht;
- **einen Screenshot** (`__screenshots__/`) — der auffällt, wenn es aufhört, so
  auszusehen. Aufgenommen wird in **Druck-Medien**: dort sind die Schnittlinien
  ein Viertelmillimeter statt ein Bildschirmpixel, der Schatten der Vorschau ist
  weg und der Bogen ist die Haaresbreite unter A4.

Abgelichtet ist, was das Geschäft druckt: elf Schilder (von „nur Name und Preis"
bis Ausstellungspreis mit Aufschlüsselung), jede Aufteilung von 1 bis 64 pro
Bogen, der angebrochene Bogen, das Maßstab-Lineal, Loch und Preis-Position,
gekürzte Preise — und die **Beispieltabelle selbst**, einmal komplett durch
Import und Katalog hindurch aufs Papier.

Die Referenzbilder liegen im Repository. Nach einer gewollten Änderung am Layout
werden sie mit `pnpm test:browser:update` neu aufgenommen; der Diff im Pull
Request zeigt dann Bild für Bild, was sich am Druck geändert hat. Beim
Fehlschlag legt Vitest das Ist-Bild und ein Differenzbild unter `.vitest/` ab.

Ein Wort zur Vorsicht: Screenshots hängen an der Schriftrasterung der Maschine,
die sie aufnimmt. Deshalb läuft diese Suite bewusst **nicht** in CI — ein
anderer Runner würde Unterschiede melden, die keine sind. Wer sie dort haben
will, fixiert dafür ein Container-Image (z. B. `mcr.microsoft.com/playwright`)
und nimmt die Referenzen darin neu auf.

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
- **Im Druck darf nichts neben den Bögen stehen.** Ein Bogen ist so hoch wie das
  Blatt; schon ein paar Millimeter Abstand aus dem Bildschirmlayout schieben ihn
  über die Seite und hinterlassen eine fast leere Folgeseite.
- **Der Bogen ist im Druck ein viertel Millimeter kleiner als A4.** Druckertreiber
  geben A4 gern als 8,27 × 11,69 Zoll aus — 296,9 mm, eine Spur weniger als die
  297 mm, aus denen der Bogen gebaut ist. Was höher ist als die Seite, landet
  nicht etwa abgeschnitten darauf, sondern auf einer eigenen und lässt die davor
  leer. Abgegeben wird der Viertelmillimeter an der untersten Blattkante, die
  ohnehin kein Drucker erreicht; jede Schnittlinie misst von oben, also wandert
  keine.
- **Der Seitenumbruch sitzt auf `.sheet-scaler`, nicht auf `.sheet`.** Jeder Bogen
  ist einziges Kind seines Wrappers, `:last-child` träfe also auf alle zu.
- **Umbrochen wird _vor_ jedem weiteren Bogen, nicht nach jedem.** Beides sagt
  dasselbe über den Seitenanfang, aber ein Umbruch hinter dem letzten Bogen sagt
  zusätzlich etwas über das Dokumentende — und Firefox antwortet darauf mit einer
  leeren Seite.
- **Gemessen wird in einer Sandbox**, nicht im sichtbaren Etikett. Die Vorschau
  ist per `transform: scale()` verkleinert, und eine Transform verfälscht jede
  Messung.
- **Gemessen wird beim Rendern, nicht beim Druckknopf.** `beforeprint` kann nicht
  warten, also muss das Layout jederzeit stimmen - auch wenn jemand Cmd+P drückt.
- **Keine CSS-Hintergrundfarben, auch nicht für die Schnittlinien.** Browser
  drucken Flächen standardmäßig nicht — der Haken dafür ist in jedem Dialog
  woanders und wird vergessen. Gestaltet wird mit Typografie und Rahmen, die
  drucken immer. Der Bogen setzt zusätzlich `print-color-adjust: exact`, damit
  auch Farbe, die doch einmal eine Fläche ist, nicht vom Haken abhängt.
- **Ein Text bekommt nur die Höhe, die er gedruckt braucht.** Was ein Schild
  nicht druckt (kein Untertitel, kein Ladenname), bekommt keinen Platz, und ein
  Text, der für die Breite verkleinert werden musste, gibt die Höhe seiner
  Maximalgröße zurück. Sonst verschöbe ein Regler Schilder, auf denen sich an
  diesem Text sichtbar nichts ändert. Deshalb wird der Reihe nach gemessen:
  erst die einzeiligen Texte und die Spalten der Zusätze, dann die
  Beschreibungen in der Breite, die übrig bleibt, zuletzt der Preis in der
  Höhe, die übrig bleibt.
- **`document.fonts.ready` allein reicht nicht zum Neumessen.** Es löst auf,
  sobald gerade keine Schrift lädt, und das kann sein, bevor die Schildschrift
  überhaupt angefordert wurde. Die erste Messung fordert sie dann erst an und
  bekommt die Maße der Ersatzschrift. Deshalb wird nach jeder fertig geladenen
  Schrift (`loadingdone`) neu gemessen.
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
