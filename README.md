# Čtení

Hry na procvičování čtení pro začínající čtenáře (5–8 let). Statické soubory, žádný build.

**Rozcestník online:** https://tynovsky.github.io/cteni/

| Hra | Složka | Charakter |
|---|---|---|
| 🍳 [Kouzelná kuchařka](kouzelna-kucharka/) | `kouzelna-kucharka/` | klidná – nakrm příšerku, sbírej příšerky do sbírky |
| 👾 [Hladové příšerky](hladove-priserky/) | `hladove-priserky/` | akční – soupeřky rostou samy, větší žere menší |
| 🪄 [Kouzelná slova](kouzelna-slova/) | `kouzelna-slova/` | hlasová – slovo se čte nahlas do mikrofonu |

Všechny hry stojí na stejné bázi: příšerka chce slovo z bubliny. V prvních dvou ho dítě
přečte a vybere správný obrázek, ve třetí ho přečte nahlas. Sdílejí slovník (`words.js`),
světy (velká / malá / psací písmena), levely podle délky slov a rodičovské nastavení.
Podrobnosti v README každé hry.

Kouzelná slova navíc potřebují **https (nebo localhost) a internet** — rozpoznávání řeči
běží na serveru prohlížeče. Bez toho se hra sama přepne na ťukání do obrázků.

## Spuštění lokálně

```bash
python3 -m http.server 8765
# http://localhost:8765  → rozcestník
```
