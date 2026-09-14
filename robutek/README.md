# Robůtek

**Hraj online:** https://tynovsky.github.io/cteni/robutek/ (rozcestník: https://tynovsky.github.io/cteni/)

Hra pro začínající čtenáře (5–8 let). Kuličková dráha je zaseknutá. Robůtek ji umí
spravit, ale **neumí číst** — a tak mu dítě musí nahlas přečíst, co má udělat.
Po každé opravě se kulička pustí znovu a dojede o kus dál.

## Smyčka hry

1. **Celek** — kulička se pustí shora a zastaví se u zaseknuté sestavy.
2. **Chůze** — robůtek k ní dojde.
3. **Přiblížení** — obraz najede na sestavu. Je to *zoom*, ne střih: pořád táž kresba,
   jen větší. Dítě nemusí chápat „jiná obrazovka", jen „koukáme se zblízka".
4. **Úloha** — zblízka je cedulka s povelem. Dítě ho přečte, robůtek jedná.
5. **Oddálení** — kamera couvne a kulička jede dál.

Odměna je vzdálenost, ne číslo na liště: po každé opravě je vidět, že kulička dojela dál.
Když projede celá, zazvoní zvonek, vyletí konfety a z koše vyleze příšerka.

## Pravidlo, na kterém všechno stojí

> **Všichni kandidáti musí vypadat stejně přijatelně. Rozdíl smí být jen v textu.**

Dřívější verze měla skrytou vadu: rozbitý díl byl nápadný, takže stačilo spravit ten
křivý a slova přeskočit. Text byl ozdoba. Proto je teď porouchaná vždycky **celá
sestava**, ne konkrétní ovladač — zblízka jsou tři páky, které vypadají naprosto
rovnocenně, a **která je ta pravá, řekne jedině cedulka**.

Z toho plynou tři rodiny povelů. Každá říká něco, co v obrázku prostě není:

| rodina | povel | proč to nejde uhodnout |
|---|---|---|
| barva | `STRHNI ČERVENOU PÁKU` | tři páky, žádná není označená jako „ta rozbitá" |
| poloha | `STRHNI PROSTŘEDNÍ PÁKU` | páky jsou **všechny stejné barvy**, rozhoduje jedině pořadí |
| počet | `ROZTOČ KOLEČKO TŘIKRÁT` | číslo v obrázku není; tečky ukazují provedené otáčky, ne požadované |
| směr | `PŘEHOĎ VÝHYBKU DOLEVA` | obě větve vypadají stejně schůdně |

Testy to hlídají na 1600 vygenerovaných úlohách: u rodiny *poloha* musí mít všechny
ovladače stejnou barvu (jinak by barva napověděla a slovo „prostřední" by bylo
zbytečné), u rodiny *barva* musí být barvy různé (jinak by povel neurčoval jeden).

## Levely

Level nepřidává delší slova, ale další rodinu povelů:

| level | rodiny |
|---|---|
| Barva | barva |
| Poloha | barva, poloha |
| Počet | + počet (přibývá kolečko) |
| Směr | + směr (přibývá výhybka) |

Ke každému světu (VELKÁ PÍSMENA, malá písmena, psací písmo) patří všechny čtyři.
Další level se odemkne první výhrou v předchozím. Hvězdy: 1 / 3 / 6 výher.

## Zpětná vazba po slovech

Jak dítě mluví, **každé slovo, které robůtek zachytil, se podtrhne**. Značky se jen
přidávají, takže podtržení neblikají. Spolu s pokrčením rameny je hned vidět, které
slovo ještě chybí dočíst.

Pozor: podtržení ukazuje, co slyšel mikrofon, ne co dítě řeklo. Když se slovo často
přeslýchá, pomůže v rodičovském nastavení posunout přísnost na „shovívavá".

**Co tu schválně není:** tlačítko s reproduktorem a dělení slov na slabiky.
Předčítání by cedulku přečetlo za dítě a to by ji jen zopakovalo — čtení by šlo
obejít, a přitom na něm celá hra stojí.

## Gramatika řešená daty

Rozkaz je 4. pád a rody se míchají (páka je ženská, kolečko střední), takže barva má
tři tvary — tabulka `ADJ` v `track.js`, ne kód:

| rod | povel |
|---|---|
| ženský | strhni červen**ou** pák**u** |
| střední | roztoč červen**é** kolečko |

Slova pro polohu, počet a směr jsou naopak zadarmo: `prostřední` je měkké přídavné
jméno (jeden tvar pro všechny rody) a `třikrát`, `doleva` jsou neměnné úplně.

Sloveso a jméno dílu jsou v cedulce kvůli slovní zásobě, ale informaci nenesou —
zblízka je vidět jen jedna sestava. Rozhoduje vždycky to slovo, které kandidáty
rozlišuje.

## Struktura

- `index.html` – obrazovky a modály
- `style.css` – vzhled, dráha, sestavy, robůtek, cedulka, konfety
- `game.js` – generátor úloh, rozbor povelu z řeči, kamera, jízda kuličky, robůtek
- `track.js` – slovník (barvy ve třech rodech, polohy, počty, směry), sestavy a trasa

Trasa je **jedna SVG křivka** a sestavy sedí na zlomku její délky, takže místo
i natočení dopočítá `getPointAtLength()`. Přiblížení je animace `viewBox` (přes CSS
to nejde) a výřez se počítá z poměru stran plochy, aby obraz neořízlo jinak,
než by člověk čekal.

## Požadavky na mikrofon

| co | stav |
|---|---|
| Chrome (Android, PC) | ✅ funguje |
| Safari / iOS | ⚠️ česky nespolehlivě |
| Firefox | ❌ rozpoznávání řeči nemá |
| https nebo localhost | **nutné** |
| internet | **nutný** |

## Spuštění a testy

```bash
python3 -m http.server 8765          # http://localhost:8765/robutek/
node tools/smoke.cjs robutek robot ball rail
```
