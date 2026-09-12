# Porucha

**Hraj online:** https://tynovsky.github.io/cteni/porucha/ (rozcestník: https://tynovsky.github.io/cteni/)

Čtvrtá hra ze série pro začínající čtenáře (5–8 let). Motivací je oprava:
**hra se rozpadá a čtení nahlas ji spravuje.**

## Pravidla

- 📦 Nahoře je sklad příšerkárny — šest beden, každá má obrázek a nápis.
- ⏱️ Kolo začíná v pořádku. Po čtyřech vteřinách se první bedna porouchá, pak další.
- 🔧 Ťuknutí na rozbitou bednu ji otevře. Dítě **přečte nahlas**, co má na nápisu být,
  a bedna se spraví.
- 👆 Když se čtení nedaří (dvě přeslechnutí, 20 s, nebo mikrofon nejde), objeví se dole
  kachličky k ťuknutí. Dítě nikdy neuvízne.
- 🏆 Výhra: spravit N beden (výchozí 8).
- 💥 Prohra: všech šest beden rozbitých naráz — sklad spadne a kolo se opakuje.

## Čtyři druhy poruch

Rozbije se vždy ta část bedny, kterou pak dítě obnovuje. Nahlas se čte vždycky totéž —
celé slovo. Liší se, jak těžké je přijít na to, co říct:

| porucha | nápis vypadá takhle | co musí dítě udělat |
|---|---|---|
| chybí písmeno | `ČOKO▯ÁDA` | doplnit si písmeno v hlavě a přečíst celé slovo |
| rozsypané slabiky | `LÁ ČO KO DA` | poskládat slabiky ve správném pořadí a přečíst |
| rozbité kódování | `Äokolï¿½da` | rozpoznat slovo pod poškozenými znaky |
| chybí obrázek | `ČOKOLÁDA` | přečíst nápis (nejsnazší varianta) |

Ťukací záchrana se každé poruše přizpůsobí: u chybějícího písmene nabídne písmena,
u slabik se řadí kachličky, u kódování se vybírá správný nápis ze tří, u obrázku obrázek.

## Jak se posuzuje čtení

Stejné jádro jako v [Kouzelných slovech](../kouzelna-slova): nehodnotí se výslovnost,
ale to, **které ze známých slov je přepisu nejblíž**. Přepis se normalizuje (malá písmena,
pryč diakritika a mezery — „ma so“ se spojí na „maso“), spočítá se editační vzdálenost ke
všem slovům ve slovníku a uzná se, když je cílové slovo jedno z nejbližších.

Útržky („ma“ z „maso“) se neberou jako chyba, jen jako rozečtené slovo. Za přeslechnutí
se počítá jen případ, kdy je přepisu jasně blíž jiné známé slovo — pak se objeví
„slyším: máslo 🤔“ a dítě čte znovu.

## Jak se dělá „rozbité"

Rozsypaná diakritika se negeneruje z tabulky, ale doopravdy: slovo se zakóduje do UTF-8
a bajty se přečtou jako CP1252 — přesně ta chyba, která v praxi dělá z `čokoláda`
řetězec `Äokolï¿½da`. Proto to vypadá jako skutečná porucha, ne jako ozdoba.

Distraktory u chybějícího písmene se vybírají ze záměn, které dělají prvňáci
(b↔d↔p, m↔n, ě↔e, š↔s, č↔c, ř↔r, u↔ů). Generátor ověří, že žádná z nabízených možností
nedá jiné existující slovo ze slovníku — jinak by úloha měla dvě správné odpovědi.

**Co hra nedělá:** nepředstírá chyby prohlížeče ani systému (žádná falešná hláška o pádu,
žádný falešný systémový dialog). Rodič nemá mít pocit, že je rozbité zařízení, a dítě se
nemá učit ignorovat skutečná hlášení. Porucha zůstává uvnitř plátna hry a v nápovědě je
to napsané.

## Požadavky na mikrofon

| co | stav |
|---|---|
| Chrome (Android, PC) | ✅ funguje |
| Safari / iOS | ⚠️ česky nespolehlivě — nutno vyzkoušet |
| Firefox | ❌ rozpoznávání řeči nemá → hra spadne do ťukacího režimu |
| https nebo localhost | **nutné** — na `http://<ip>:8765` prohlížeč mikrofon nedá |
| internet | **nutný** — rozpoznávání běží na serveru prohlížeče, ne v zařízení |

Když cokoli z toho chybí, hra to pozná, napíše to na úvodní obrazovce a bedny se
opravují ťukáním.

## Spuštění

```bash
python3 -m http.server 8765
# http://localhost:8765/porucha/   → mikrofon funguje (localhost je „secure context")
```

## Struktura

- `index.html` – obrazovky (domů, hra, modály: konec kola, nápověda, rodič)
- `style.css` – vzhled, sklad, glitch animace, mikrofon, opravárenské kachličky
- `game.js` – logika, rozpad skladu, generátory čtyř poruch, rozpoznávání řeči
  a porovnávání, generátor příšerek (SVG ze seedu), zvuky (WebAudio)
- `words.js` – slovník, stejný jako v ostatních hrách

## Světy a levely

3 světy (VELKÁ PÍSMENA, malá písmena, psací písmo) × 4 levely (Krátká ≤4, Delší 5–6,
Dlouhá 7+, Věty). Vyšší level = delší slova a rychlejší rozpad. Další level se odemkne
první výhrou v předchozím. Hvězdy: 1 / 3 / 6 výher.

## Rodičovské nastavení (⚙️ Rodič, brána = jednoduchý příklad)

- opravovat hlasem zap/vyp (vypnuté = čistě ťukací hra)
- přísnost rozpoznávání (shovívavá / normální / přísná)
- jak rychle se kazí (pomalu / normálně / rychle)
- oprav na kolo (3–20)
- dělení slabik, předčítání, zvuky, odemknout vše
- vlastní slova, smazání postupu
