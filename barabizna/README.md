# Barabizna

**Hraj online:** https://tynovsky.github.io/cteni/barabizna/ (rozcestník: https://tynovsky.github.io/cteni/)

Pátá hra ze série pro začínající čtenáře (5–8 let). Barák se rozpadá a čtení nahlas
ho skládá zpátky.

## Pravidla

- 🏠 Na začátku je barabizna celá a **na obrazovce není jediné písmeno**.
- 🧱 Po chvíli něco spadne — komín, okno, plot. Zůstane po tom přerušovaná díra
  a **v díře se objeví jméno toho dílu**.
- 🗣️ Dítě slovo přečte nahlas a díl přiletí zpátky na místo.
- 🕳️ Děr může být víc naráz. Dítě čte, kterou chce — pořadí si volí samo.
- 👆 Ťuknutí na slovo ho předčítá. Když se čtení nedaří (dvě přeslechnutí nebo 20 s),
  ťuknutím se díl rovnou vrátí, aby dítě neuvízlo.
- 🏆 Kolo končí, když se vrátí N dílů (výchozí 8). **Prohrát se nedá** — barák se může
  rozpadnout skoro celý, jen se pak nemá co kazit.

## Proč zrovna takhle

Slovo tu není objekt, který se opravuje, ale **jméno chybějící věci**. Dítě čte `KOMÍN`,
protože komín spadl a má se vrátit — a vidí přesně to místo, kam patří. Obrázek nese
význam, takže se slovo spojuje s věcí, ne s nápisem.

Z toho plyne i jiná slovní zásoba než u ostatních her: nejsou to jídla z `words.js`,
ale části scény (`parts.js`), každá se svým tvarem, jménem a místem.

## Přidání další scény

`parts.js` je jen data: `SCENE` má `view`, `base` (co nikdy nespadne) a `parts`.
Každý díl je `{ id, w, svg, box }` — `w` je jméno rozdělené na slabiky, `svg` tvar
ve stejném viewBoxu a `box` obdélník, do kterého se kreslí díra a popisek.

Druhá scéna (například strašidlo, kterému se rozpadá oblečení: `knof-lík`, `kap-sa`,
`zip`, `tka-nič-ka`) je tedy seznam dílů, ne nový kód.

## Světy a levely

3 světy (VELKÁ PÍSMENA, malá písmena, psací písmo) × 4 levely. Level určuje, **které
díly můžou spadnout** — ostatní zůstanou stát:

| level | padají díly se jménem | příklad |
|---|---|---|
| Krátká | ≤ 4 písmena | okno, plot, keř |
| Delší | 5–6 písmen | komín, dveře, schody, cihla, lampa |
| Dlouhá | 7+ písmen | střecha, okenice, schránka, zahrádka |
| Věty | krátká a delší ve větě | „chybí komín“, „dej tam okno“ |

Další level se odemkne první výhrou v předchozím. Hvězdy: 1 / 3 / 6 výher.

## Jak se posuzuje čtení

Stejné jádro jako v [Kouzelných slovech](../kouzelna-slova): nehodnotí se výslovnost,
ale to, které ze jmen dílů je přepisu nejblíž. Útržky („ko“ z „komín“) se neberou jako
chyba. Čte se kterékoli viditelné slovo — rozpoznávač porovnává se všemi dírami naráz.

## Požadavky na mikrofon

| co | stav |
|---|---|
| Chrome (Android, PC) | ✅ funguje |
| Safari / iOS | ⚠️ česky nespolehlivě |
| Firefox | ❌ rozpoznávání řeči nemá → hraje se ťukáním |
| https nebo localhost | **nutné** |
| internet | **nutný** |

Bez mikrofonu se díly vracejí ťuknutím na slovo. Hra to pozná a napíše to na úvodní
obrazovce.

## Struktura

- `index.html` – obrazovky a modály
- `style.css` – vzhled, padání dílů, díry, popisky, mikrofon
- `game.js` – rozpad scény, rozpoznávání řeči a porovnávání, postup
- `parts.js` – scéna: podklad a díly (tvar, jméno, místo)

## Spuštění

```bash
python3 -m http.server 8765
# http://localhost:8765/barabizna/
```
