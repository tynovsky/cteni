# Čtení

Hry na procvičování čtení pro začínající čtenáře (5–8 let). Statické soubory, žádný build.

**Rozcestník online:** https://tynovsky.github.io/cteni/

| Hra | Složka | Charakter |
|---|---|---|
| 🍳 [Kouzelná kuchařka](kouzelna-kucharka/) | `kouzelna-kucharka/` | klidná – nakrm příšerku, sbírej příšerky do sbírky |
| 👾 [Hladové příšerky](hladove-priserky/) | `hladove-priserky/` | akční – soupeřky rostou samy, větší žere menší |
| 🪄 [Kouzelná slova](kouzelna-slova/) | `kouzelna-slova/` | hlasová – slovo se čte nahlas do mikrofonu |
| 🔧 [Porucha](porucha/) | `porucha/` | opravárenská – hra se rozpadá a čtení ji spravuje |
| 🏠 [Barabizna](barabizna/) | `barabizna/` | stavitelská – dům se rozpadá, čtení vrací díly na místo |
| 🤖 [Robůtek](robutek/) | `robutek/` | povelová – robot neumí číst, dítě mu diktuje povel ze stroje |

První tři hry stojí na stejné bázi: příšerka chce slovo z bubliny. V prvních dvou ho dítě
přečte a vybere správný obrázek, ve třetí ho přečte nahlas. Čtvrtá obrací zadání — slovo
je poškozené a dítě ho skládá zpátky (chybějící písmeno, rozsypané slabiky, rozbité
kódování). Všechny sdílejí slovník (`words.js`), světy (velká / malá / psací písmena),
levely podle délky slov a rodičovské nastavení. Podrobnosti v README každé hry.

Kouzelná slova navíc potřebují **https (nebo localhost) a internet** — rozpoznávání řeči
běží na serveru prohlížeče. Bez toho se hra sama přepne na ťukání do obrázků.

## Spuštění lokálně

```bash
python3 -m http.server 8765
# http://localhost:8765  → rozcestník
```
