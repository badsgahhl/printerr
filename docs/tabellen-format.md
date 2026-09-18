# Tabellenformat

So muss die LibreOffice-Datei aufgebaut sein, damit die App sie lesen kann.
Zum Ausdrucken und Danebenlegen gedacht.

**Vorlage zum Loslegen:** `beispiele/preisschilder-vorlage.ods`
**Ausgefülltes Beispiel:** `beispiele/preisschilder-beispiel.ods`

---

## Zwei Blätter

Die Datei braucht zwei Tabellenblätter: **Produkte** (ein Schild pro Zeile) und
**Zusätze** (die Teile und Zubehörstücke dazu). Das Blatt _Zusätze_ darf fehlen,
wenn es nur einfache Schilder gibt.

Die Kopfzeile muss in einer der ersten zehn Zeilen stehen — eine Überschrift
darüber stört nicht.

---

## Blatt „Produkte"

| Spalte      | Pflicht | Bedeutung                                                                           |
| ----------- | ------- | ----------------------------------------------------------------------------------- |
| **ID**      | ja      | Eindeutige Kennung, z. B. `M-01`. Darüber werden die Zusätze zugeordnet.            |
| **Name**    | ja      | Die große Zeile oben auf dem Schild.                                                |
| Untertitel  | –       | Hersteller, Holzart, Größe — freier Text, z. B. `KWO · Erle, handbemalt`.           |
| ArtNr       | –       | Artikelnummer.                                                                      |
| **Preis**   | ja      | Preis des Produkts allein. Am besten als Zahl formatieren.                          |
| Preiszusatz | –       | Kleine Zeile unter dem Preis, z. B. `ohne Figuren` oder `je Stück`.                 |
| Hinweis     | –       | Kleingedrucktes am Fuß, z. B. `Handarbeit aus dem Erzgebirge`.                      |
| Anzahl      | –       | Wie oft dieses Schild gedruckt wird. Ohne Angabe: 1.                                |
| Drucken     | –       | `ja` / `nein` — ob das Schild nach dem Import gleich angehakt ist. Ohne Angabe: ja. |
| Layout      | –       | Bleibt vorerst leer, reserviert für Größenvarianten.                                |

## Blatt „Zusätze"

| Spalte          | Pflicht | Bedeutung                                                     |
| --------------- | ------- | ------------------------------------------------------------- |
| **ProduktID**   | ja      | Muss genau einer **ID** aus dem Blatt _Produkte_ entsprechen. |
| **Bezeichnung** | ja      | Name des Teils, z. B. `Bergmann`.                             |
| ArtNr           | –       | Artikelnummer des Teils.                                      |
| Preis           | –¹      | Preis als Zahl.                                               |
| Preistext       | –¹      | Freie Angabe statt einer Zahl, z. B. `ab 90,00 €`.            |
| Ausgestellt     | –       | `ja`, wenn das Teil in der Ausstellung beim Produkt steht.    |

¹ Entweder **Preis** oder **Preistext** muss ausgefüllt sein.

---

## Die wichtigste Regel

**Steht mindestens ein Zusatz auf `Ausgestellt = ja`**, druckt das Schild den
Preis des _ausgestellten Stücks_ groß:

```
Preis des Produkts + alle ausgestellten Zusätze mit Preis
```

Darunter erscheint klein, woraus sich das zusammensetzt. Ohne ausgestellte
Zusätze steht schlicht der Produktpreis groß auf dem Schild.

### Beispiel: Mühle mit Figuren

_Produkte_

| ID   | Name            | Preis  | Preiszusatz  |
| ---- | --------------- | ------ | ------------ |
| M-01 | Mühle „Seiffen" | 890,00 | ohne Figuren |

_Zusätze_

| ProduktID | Bezeichnung     | ArtNr | Preis  | Preistext  | Ausgestellt |
| --------- | --------------- | ----- | ------ | ---------- | ----------- |
| M-01      | Bergmann        | 4712  | 129,00 |            | ja          |
| M-01      | Engel           | 4713  | 129,00 |            | ja          |
| M-01      | weitere Figuren |       |        | ab 90,00 € | nein        |

Ergibt ein Schild mit **1.148,00 €** groß und „wie ausgestellt" darunter; die
Mühle allein, die beiden Figuren und der Hinweis auf weitere Figuren stehen klein
in der Aufschlüsselung.

> **Wichtig:** Ein Zusatz mit `Ausgestellt = ja` **muss** einen Preis als Zahl
> haben. Sonst lässt sich der Preis des ausgestellten Stücks nicht ausweisen —
> die App meldet das als Fehler und hakt das Schild nicht an. Das ist keine
> Schikane: Preisangabenverordnung.

---

## Was die App verzeiht

- **Schreibweise der Überschriften.** Groß/klein, Leerzeichen und Punkte sind
  egal: `ArtNr`, `Art.-Nr.` und `Artikelnummer` werden alle erkannt, ebenso
  `Zusätze` und `Zusaetze`.
- **Andere Bezeichnungen.** `Bezeichnung` statt `Name`, `VK` statt `Preis`,
  `In Ausstellung` statt `Ausgestellt` und einige mehr.
- **Preise als Text.** `12,50`, `1.148,00 €`, `12.50` werden verstanden. Eine
  Zahlenspalte ist trotzdem besser — sie kann man summieren.
- **Leere Zeilen** mitten in der Tabelle.

## Was schiefgeht

Alles davon meldet die App mit Blatt, Zeile und Spalte:

- zwei Zeilen mit derselben **ID**
- eine Zeile ohne **ID** oder ohne **Name**
- ein Preis, der keiner ist (`auf Anfrage` gehört nicht in die Preisspalte)
- eine **ProduktID** im Blatt _Zusätze_, die es im Blatt _Produkte_ nicht gibt
- ein ausgestellter Zusatz ohne Preis

Zum Ausprobieren: `beispiele/preisschilder-fehlerbeispiel.ods` enthält jeden
dieser Fälle genau einmal.
