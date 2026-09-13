# Robůtek

**Hraj online:** https://tynovsky.github.io/cteni/robutek/ (rozcestník: https://tynovsky.github.io/cteni/)

Hra pro začínající čtenáře (5–8 let). Kuličková dráha je rozbitá. Robůtek ji umí spravit,
ale **neumí číst** — a tak mu dítě musí povel z cedulky přečíst nahlas. Po každé opravě
se kulička pustí znovu a dojede o kus dál.

## Proč zrovna takhle

Starší hry v sérii měly skrytou vadu: slovo bylo jméno něčeho, co bylo vidět. V Barabizně
tvar díry po komíně prozradí „komín" dřív, než dítě přečte první písmeno. Čtení šlo obejít.

Tady ne. Na dráze je až osm dílů a **nic než text neřekne, který z nich**. Robůtek je
k písmu slepý: jediná cesta, jak se informace z cedulky dostane do dráhy, vede přes dětský
hlas. Čtení není kontrola, ale mechanismus.

Vzor je *Keep Talking and Nobody Explodes*, obrácený: dítě drží manuál, robot má ruce.

## Pravidla

- ⚪ Kulička se pustí shora a dojede **k prvnímu rozbitému dílu**. Tam spadne z dráhy.
- 🎫 Vyjede cedulka s povelem: `PŘEHOĎ ČERVENOU VÝHYBKU`.
- 🤖 Dítě přečte **celý povel nahlas**. Robůtek dojde k dílu a spraví ho.
- 🔁 Kulička se hned pustí znovu a dostane se dál než minule. **Postup je vzdálenost,
  ne číslo na liště** — proto chodí cedulky v pořadí dráhy, aby každá oprava byla vidět.
- ✏️ **Přečtená slova se podtrhávají.** Jak dítě mluví, každé slovo, které robůtek
  zachytil, dostane zelenou linku. Je tak vidět, co už zaznělo — a hlavně co ne.
- 🤷 **Nedořečený povel = pokrčení rameny.** Když dítě řekne jen „červenou" a červené
  díly jsou dva, robůtek rozhodí rukama: *„Který? Je jich víc."* Nic se nepokazí, ale
  dítě musí dočíst do konce. Spolu s podtrháváním je hned vidět, které slovo chybí.
  Tohle je celý zámek hry.

**Co tu schválně není:** tlačítko s reproduktorem a dělení slov na slabiky.
Předčítání by cedulku přečetlo za dítě a to by ji jen zopakovalo — čtení by šlo
obejít, a přitom na něm celá hra stojí. Slabiky s tečkami zase brání vidět slovo vcelku.
- 💨 **Robůtek udělá, co slyšel, ne co je správně.** Sykne pára, odpadne šroubek a ten
  se musí vrátit (`VRAŤ ŠROUBEK`). Hádání stojí práci, kolo ale nikdy neskončí špatně.
- 🔔 Když kulička projede až dolů, zazvoní na zvonek a z koše vyleze příšerka.

Vedlejší efekt téhle fikce: **přeslechnutí mikrofonu je součástí příběhu.** Robot slyší
špatně, tak udělá hloupost — dítě se směje místo toho, aby se vztekalo na aplikaci.

## Díly dráhy

Každý díl je brána: dokud je rozbitý, kulička se přes něj nedostane.

| díl | co je špatně | povel |
|---|---|---|
| výhybka | ukazuje do slepé větve | `PŘEHOĎ ČERVENOU VÝHYBKU` |
| klapka | zavřená | `OTEVŘI MODROU KLAPKU` |
| most | zvednutý, díra v trase | `SKLOP ZELENÝ MOST` |
| žlab | pootočený, kulička padá vedle | `SROVNEJ ŽLUTÝ ŽLAB` |
| kolečko | stojí, nevynese kuličku dál | `ROZTOČ MALÉ ČERVENÉ KOLEČKO` |

## Levely

Level neurčuje délku slov, ale **kolik informace musí dítě z cedulky vytáhnout**:

| level | cedulka | na dráze |
|---|---|---|
| Barva | `PŘEHOĎ ČERVENOU VÝHYBKU` | samé výhybky, liší se jen barvou |
| Barva a velikost | `PŘEHOĎ MALOU ČERVENOU VÝHYBKU` | červené jsou dvě, velká a malá |
| Víc dílů | `SKLOP MALÝ ZELENÝ MOST` | dva druhy dílů, takže rozhoduje i jméno |
| Dva povely | `SROVNEJ ŽLUTÝ ŽLAB A OTEVŘI MODROU KLAPKU` | dvě opravy za sebou |

## Jak se hlídá, že se nedá hádat

Díly na dráze netvoří náhodnou sbírku, ale **mřížku** (druhy × velikosti × barvy).
Ke každému dílu tak existuje jiný, který se od něj liší právě jedním slovem — a z toho
plynou dvě vlastnosti, které testy ověřují pro všechny levely a 3–8 dílů:

1. **Jednoznačnost** — celému popisu vyhovuje právě jeden díl.
2. **Každé slovo je nosné** — po vyškrtnutí kteréhokoli slova vyhovují aspoň dva.
   K `MALÉMU ZELENÉMU MOSTU` je na dráze vždy i velký zelený most a malý jiný barevný.

Kdyby se díly losovaly nezávisle, druhá vlastnost by padla a dalo by se přečíst první
slovo a zbytek uhodnout.

Sloveso se do hledání dílu záměrně **nepromítá**. „Přehoď" sice patří jen k výhybce, ale
kdyby z něj šel typ odvodit, dítě by mohlo poslední slovo na cedulce vynechat.

## Shoda rodu

Rozkaz je 4. pád a rody se na dráze míchají, takže přídavné jméno má tři tvary:

| rod | díl | povel |
|---|---|---|
| ženský | výhybka, klapka | přehoď červen**ou** výhybk**u** |
| mužský neživotný | most, žlab | sklop červen**ý** most |
| střední | kolečko | roztoč červen**é** kolečko |

Tvary jsou v `track.js` jako tabulka (`ADJ`), ne v kódu. Pro dítě je to čtení navíc:
koncovka přídavného jména musí sedět ke jménu dílu.

Rozpoznávač všechny tři tvary mapuje na stejný klíč, takže „červenou" i „červené"
znamenají červenou — ale tvary téhož slova si jsou blízko, a proto se shoda mezi nimi
nepočítá jako nejednoznačnost. (Nejbližší dvě *různá* slova ve slovníku jsou
`červený`/`zelený`, vzdálená tři úpravy.)

## Struktura

- `index.html` – obrazovky a modály
- `style.css` – vzhled, dráha, kulička, robůtek, cedulka
- `game.js` – generátor dráhy, rozbor povelu z řeči, jízda kuličky, robůtek
- `track.js` – slovník se třemi tvary, díly dráhy a trasa

Trasa je **jedna SVG křivka** a díly sedí na zlomku její délky — místo i natočení se
dopočítá z `getPointAtLength()`. Díl proto nemůže skončit vedle dráhy a kulička po ní
jede přesně. Další dráha je tedy jen jiné `d` a jiný seznam zlomků.

## Požadavky na mikrofon

| co | stav |
|---|---|
| Chrome (Android, PC) | ✅ funguje |
| Safari / iOS | ⚠️ česky nespolehlivě |
| Firefox | ❌ rozpoznávání řeči nemá |
| https nebo localhost | **nutné** |
| internet | **nutný** |

Bez mikrofonu se díly dají ťuknout přímo — dítě si povel přečte samo pro sebe. Hra to
pozná a napíše to na úvodní obrazovce.

## Spuštění

```bash
python3 -m http.server 8765
# http://localhost:8765/robutek/
```
