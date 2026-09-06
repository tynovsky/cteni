# Hladové příšerky

**Hraj online:** https://tynovsky.github.io/cteni/hladove-priserky/ (rozcestník: https://tynovsky.github.io/cteni/)

Akční hra na procvičování čtení pro začínající čtenáře (5–8 let). Sestřička
[Kouzelné kuchařky](../kouzelna-kucharka) na stejné bázi: příšerka řekne, co chce jíst
(napsané slovo v bublině), dítě přečte a vybere správný obrázek. Tentokrát ale v aréně
lítají další příšerky, které rostou samy od sebe. Kdo nečte, toho přerostou a sežerou.

## Pravidla

- 🍎 Správně přečtené slovo = jídlo, naše příšerka vyroste (×1,25).
- 👾 Soupeřky rostou samy. Po 10 s bez správné odpovědi rostou rychleji (bublina bliká).
- 😋 Kdo je aspoň 1,4× větší a dotkne se menší, sežere ji. Platí pro všechny, soupeřky se
  žerou i navzájem.
- 👆 Ťuknutí (nebo tažení) do arény = naše příšerka tam plave. Šipky / WASD na PC.
  Bez povelu sama loví menší a couvá před většími.
- 🏆 Výhra: sežrat N soupeřek (výchozí 6). Prohra: sežere nás větší soupeřka.

## Spuštění

Statické soubory, žádný build. Otevři `index.html` v prohlížeči, nebo:

```bash
python3 -m http.server 8765
# http://localhost:8765
```

Funguje i offline; bez internetu se jen místo Twemoji ikon zobrazí nativní emoji
a místo webových fontů systémové. Postup se ukládá do localStorage.

## Struktura

- `index.html` – obrazovky (domů, hra, modály: konec kola, nápověda, rodič)
- `style.css` – vzhled, aréna, animace (křídla, žraní, tlak)
- `game.js` – logika, simulace arény (pohyb, lov/útěk, srážky), generátor příšerek (SVG ze seedu),
  zvuky (WebAudio), TTS (Web Speech API, cs-CZ)
- `words.js` – slovník, stejný jako v Kouzelné kuchařce

## Světy a levely

Stejné jako v Kuchařce: 3 světy (VELKÁ PÍSMENA, malá písmena, psací písmo) × 4 levely
(Krátká ≤4, Delší 5–6, Dlouhá 7+, Věty). Vyšší level = soupeřky rostou rychleji a je jich víc.
Další level se odemkne první výhrou v předchozím. Hvězdy: 1 / 3 / 6 výher.

## Rodičovské nastavení (⚙️ Rodič, brána = jednoduchý příklad)

- dělení slabik (MA·SO), předčítání, zvuky, odemknout vše
- tempo hry (pomalé / normální / rychlé) – násobí růst soupeřek
- kolik soupeřek sežrat na výhru (3–20)
- vlastní slova, smazání postupu

## Ladění obtížnosti

Model je v poměrech (jako agar.io): záleží jen na tom, kolikrát je kdo větší. Klíčové
konstanty na začátku sekce `aréna` v `game.js`:

| konstanta | výchozí | význam |
|---|---|---|
| `FOOD_MUL` | 1.25 | správná odpověď násobí naši hmotu |
| `WRONG_MUL` | 0.92 | špatná odpověď |
| `RIVAL_GROW` | 0.010 | soupeřka za sekundu přibere 1 % *naší* hmoty |
| `IDLE_AFTER`, `IDLE_MAX` | 10 s, 1.5 | po 10 s bez odpovědi tlak roste až na 2,5× |
| `EAT_RATIO` | 1.4 | kolikrát větší musí být žrout |
| `EAT_GAIN` | 0.1 | podíl hmoty sežrané příšerky, který žrout získá |
| `SPAWN_Q` | 0.8–1.2 | velikost nové soupeřky jako podíl naší |

Orientačně (simulace, normální tempo, level Krátká): odpověď každých 10 s → výhra za ~1 min,
12–14 s → 1–3 min, 16 s → prohra (v pomalém tempu výhra), bez čtení → prohra do 30 s.
