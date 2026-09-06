# Čtení

Hry na procvičování čtení pro začínající čtenáře (5–8 let). Statické soubory, žádný build.

**Rozcestník online:** https://tynovsky.github.io/cteni/

| Hra | Složka | Charakter |
|---|---|---|
| 🍳 [Kouzelná kuchařka](kouzelna-kucharka/) | `kouzelna-kucharka/` | klidná – nakrm příšerku, sbírej příšerky do sbírky |
| 👾 [Hladové příšerky](hladove-priserky/) | `hladove-priserky/` | akční – soupeřky rostou samy, větší žere menší |

Obě hry stojí na stejné bázi: příšerka řekne, co chce jíst (slovo v bublině), dítě přečte
a vybere správný obrázek. Sdílejí slovník (`words.js`), světy (velká / malá / psací písmena),
levely podle délky slov a rodičovské nastavení. Podrobnosti v README každé hry.

## Spuštění lokálně

```bash
python3 -m http.server 8765
# http://localhost:8765  → rozcestník
```
