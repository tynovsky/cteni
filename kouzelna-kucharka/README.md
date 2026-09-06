# Kouzelná kuchařka

**Hraj online:** https://tynovsky.github.io/cteni/kouzelna-kucharka/ (rozcestník všech her: https://tynovsky.github.io/cteni/)

Hra na procvičování čtení pro začínající čtenáře (5–8 let). Příšerka řekne, co chce jíst
(napsané slovo v bublině), dítě přečte a vybere správný obrázek. Nakrmená příšerka
jde do sbírky, přijde nová.

## Spuštění

Statické soubory, žádný build. Otevři `index.html` v prohlížeči, nebo:

```bash
python3 -m http.server 8765
# http://localhost:8765
```

Na tabletu/mobilu: spusť server na PC a otevři `http://<ip-pc>:8765`, pak
„Přidat na plochu“. Postup se ukládá do localStorage daného prohlížeče.

Funguje i offline; bez internetu se jen místo Twemoji ikon zobrazí nativní emoji
a místo webových fontů systémové.

## Struktura

- `index.html` – obrazovky (domů, hra, sbírka, modály)
- `style.css` – vzhled, responzivita
- `game.js` – logika, generátor příšerek (SVG ze seedu), zvuky (WebAudio), TTS (Web Speech API, cs-CZ)
- `words.js` – slovník: `{ w: 'sla-bi-ky', e: '🍓' }`, věty, slabiky pro jména

## Světy a levely

| Svět | Písmo | Levely |
|---|---|---|
| VELKÁ PÍSMENA | Andika, verzálky | Krátká (≤4), Delší (5–6), Dlouhá (7+), Věty |
| malá písmena | Andika (jednopatrové a, g) | stejné |
| psací písmo | Dancing Script (přibližné) | stejné |

Další level se odemkne po 10 správných odpovědích v předchozím (nebo „Odemknout vše“ v nastavení).
Hvězdy: 5 / 10 / 20 správných.

## Rodičovské nastavení (⚙️ Rodič, brána = jednoduchý příklad)

- dělení slabik (MA·SO), předčítání, zvuky, odemknout vše
- počet jídel na příšerku (3–20)
- vlastní slova (jména, oblíbené věci) – slabiky oddělit pomlčkou, k tomu emoji
- smazání postupu

## Školní psací font

Dancing Script je jen přiblížení. Pro skutečné české školní psací písmo (Comenia Script,
Abeceda, …) je potřeba licence. Po získání `.ttf`:

1. soubor dej do složky, např. `fonts/psaci.ttf`
2. do `style.css` přidej `@font-face { font-family: 'Psaci'; src: url(fonts/psaci.ttf); }`
3. změň `--font-cursive: 'Psaci', cursive;`
