# Kouzelná slova

**Hraj online:** https://tynovsky.github.io/cteni/kouzelna-slova/ (rozcestník: https://tynovsky.github.io/cteni/)

Hra na **čtení nahlas** pro začínající čtenáře (5–8 let). Třetí sestra
[Kouzelné kuchařky](../kouzelna-kucharka) a [Hladových příšerek](../hladove-priserky).
Tady se ale nevybírá obrázek — dítě slovo **přečte do mikrofonu** a věc se zjeví v kotlíku.

## Pravidla

- 🪄 V bublině je slovo. Dítě ho přečte nahlas.
- 🍲 Když příšerka slovo pozná, věc se vykouzlí v kotlíku a přibude do počtu.
- 😵 Když přeslechne, **vykouzlí to, co slyšela** — řekneš „MASO“, objeví se máslo.
  Příšerka se tváří zmateně, dítě se zasměje a čte znovu.
- 👆 Po dvou přeslechnutích, po 25 s bez úspěchu (nebo když mikrofon nejde) se dole
  objeví obrázky k ťuknutí. Dítě nikdy neuvízne.

Za přeslechnutí se počítá **jen** situace, kdy je přepisu jasně blíž jiné známé slovo.
Rozpoznávač při souvislém poslechu posílá i útržky („ma“ z „maso“) — ty se berou jako
rozečtené slovo, ne jako chyba, jinak by ťukací záchrana vyskakovala i dětem, které
slovo nakonec přečtou správně.
- 🔊 Tlačítko nahoře slovo přečte.
- 🏆 Kolo končí po N kouzlech (výchozí 8).

## Jak se posuzuje výslovnost

Nijak — a je to schválně. Rozpoznávač řeči je trénovaný na plynulou dospělou řeč,
zatímco začátečník čte po slabikách („MA… SO“) a leccos zkomolí. Hodnotit přesnost
přepisu by znamenalo trestat dítě za chyby stroje.

Místo toho hra řeší jedinou otázku: **které ze známých slov je přepisu nejblíž?**

1. Přepis se normalizuje (malá písmena, pryč diakritika a mezery) — tím se „ma so“
   spojí na „maso“.
2. Spočítá se editační vzdálenost ke *všem* slovům ve slovníku.
3. Uzná se, když je cílové slovo **jedno z nejbližších** a vejde se do tolerance.
4. Když je jiné slovo výrazně blíž, je to „přeslechnutí“ → vykouzlí se ono.

Díky kroku 3 projde i nepřesný přepis, ale `MED` × `LED` se nespletou: „led“ sedí na
`led` přesně, takže `med` neuzná. Bere se 5 nejlepších alternativ rozpoznávače.
Tolerance se dá v rodičovském nastavení posunout (shovívavá / normální / přísná).

Pokud to prohlížeč umí, dostane rozpoznávač i nápovědu (`phrases`) s aktuálním slovem
a distraktory — zvyšuje šanci, že dětskou výslovnost trefí.

## Požadavky na mikrofon

| co | stav |
|---|---|
| Chrome (Android, PC) | ✅ funguje |
| Safari / iOS | ⚠️ `webkitSpeechRecognition` existuje, česky nespolehlivě — nutno vyzkoušet |
| Firefox | ❌ rozpoznávání řeči nemá → hra spadne do ťukacího režimu |
| https nebo localhost | **nutné** — na `http://<ip>:8765` prohlížeč mikrofon nedá |
| internet | **nutný** — rozpoznávání běží na serveru prohlížeče, ne v zařízení |

Když cokoli z toho chybí, hra to pozná, napíše to na úvodní obrazovce a hraje se
ťukáním na obrázky. Jediné, co se ztratí, je hlasové ovládání.

## Spuštění

```bash
python3 -m http.server 8765
# http://localhost:8765/kouzelna-slova/   → mikrofon funguje (localhost je „secure context“)
```

Na tabletu mikrofon přes `http://<ip-pc>:8765` **nepojede** — testuj z
`https://tynovsky.github.io/cteni/kouzelna-slova/`.

## Struktura

- `index.html` – obrazovky (domů, hra, modály: konec kola, nápověda, rodič)
- `style.css` – vzhled, kotlík, animace kouzlení, ukazatel hlasitosti
- `game.js` – logika, rozpoznávání řeči + porovnávání, generátor příšerek (SVG ze seedu),
  zvuky (WebAudio), předčítání (Web Speech API, cs-CZ)
- `words.js` – slovník, stejný jako v ostatních hrách

## Světy a levely

Stejné jako v sesterských hrách: 3 světy (VELKÁ PÍSMENA, malá písmena, psací písmo)
× 4 levely (Krátká ≤4, Delší 5–6, Dlouhá 7+, Věty). Další level se odemkne po 10
správných. Hvězdy: 5 / 10 / 20.

## Rodičovské nastavení (⚙️ Rodič, brána = jednoduchý příklad)

- ovládání hlasem zap/vyp (vypnuté = čistě ťukací hra)
- přísnost rozpoznávání (shovívavá / normální / přísná)
- dělení slabik (MA·SO), předčítání, zvuky, odemknout vše
- kouzel na kolo (3–20), vlastní slova, smazání postupu
