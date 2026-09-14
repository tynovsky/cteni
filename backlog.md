# Backlog

Věci, na které se při práci narazilo a odložily se. Zapsané tak, aby se daly vzít
bez dohadování — u každé je co, kde, proč a jak.

Stav k 14. 9. 2026.

---

## Chyby

### 1. Pád v Hladových příšerkách při odchodu domů
`hladove-priserky/game.js:489` (timeout v `answer()`)

**Repro:** odpověz správně a do 600 ms ťukni na „Domů".
`btn-back` volá `clearArena()`, ta nastaví `A.me = null`. Doběhne timeout letícího
jídla, zavolá `nextWord()` a ta sáhne na `A.me.name` → TypeError, hra ztuhne.

**Oprava:** na začátek timeoutu přidat `if (!A.me || me !== A.me || me.dead) return;`
Stejný vzor už používají ostatní hry (`clearTimeout` + kontrola stavu).

### 2. Kouzelná kuchařka hlásí odemčení levelu nespolehlivě
`kouzelna-kucharka/game.js:287`

`unlockedNext` počítá `c - done.fed < UNLOCK_AT`, jenže `S.current` (rozkrmená
příšerka) **přechází mezi levely**, zatímco `progress` je vedený per level. Když
dítě začne krmit v jednom levelu a dokončí v jiném, hláška „Odemkl se další level"
může chybět nebo bliknout navíc. Postup samotný se počítá správně, jde jen o hlášku.

**Oprava:** buď vázat příšerku na level, nebo si k ní poznamenat, kolik jídel padlo
do kterého levelu.

### 3. Komentáře ve slovníku neodpovídají obsahu
`words.js` (všechny hry sdílejí stejný soubor)

V sekci označené „krátká (<= 4 písmena)" jsou i `o-řech` (5) a `lí-zát-ko` (8).
Funkce `tierOf` počítá délku správně, takže **hra se chová dobře** — jen komentář lže
a při ručních úpravách mate.

---

## Dluh

### 4. shared/ — šest kopií téhož kódu
Po šesti hrách je `monsterSVG`, `beep`/`sfx`, generátor jmen a rodičovská brána
v **šesti** kopiích; jádro rozpoznávání řeči (`norm`, `lev`, `tol`, `heardForms`,
`judge`) ve **čtyřech**; `words.js` ve **čtyřech**.

Kopie se už rozešly: příšerky v aréně mají křídla a náladu `angry`, Kuchařka náladu
`full`, Kouzelná slova `listen` a `confused`. Sloučení tedy není mechanické.

**Návrh:** `shared/monster.js`, `shared/audio.js`, `shared/speech.js`, `shared/words.js`,
`shared/parent.js`. Nálady příšerek sjednotit do jedné sady (sjednocení je práce
navíc, ale jinak se to rozejde znovu).

**Kdy to dělat:** až bude sedmá hra, nebo až bude potřeba opravit něco v rozpoznávání
řeči — pak se oprava dneska musí přepsat na čtyřech místech.

### 5. Testy žijí v /tmp a se session umřou
Z celé série testů, které se během vývoje psaly (porovnávání slyšeného, generátory
poruch, geometrie scény, podtrhávání slov), přežil v repu **jen `tools/smoke.cjs`**.
Ostatní byly v `/tmp` a jsou pryč.

**Oprava:** přesunout je do `tools/` jako `test-<hra>.cjs` a přidat `tools/test-all.sh`,
který projede všechno naráz. Bez toho se každá další změna testuje znovu od nuly.

---

## Vizuál a ladění (Robůtek)

Tohle jsou věci, které **nikdo neviděl v prohlížeči** nebo jsou jen tušené.

### 6. Kulička jede konstantní rychlostí
Po křivce se veze rovnoměrně, takže do kopce nezpomalí a z kopce nezrychlí.
Nejspíš to působí jako posouvání, ne kutálení.
**Oprava:** rychlost odvodit ze sklonu trasy v daném bodě (`getPointAtLength`
o kousek dál, porovnat `dy`).

### 7. Otáčení dílů kolem správného bodu
`style.css` používá `transform-box: fill-box` s vlastním `transform-origin`
(klapka kolem spodního konce, most kolem levého). Je to nejkřehčí část celé
grafiky, hlavně na Safari. Když se chytne špatně, díly se otáčejí kolem středu.

### 8. Díra v trase je záplata barvou rámu
Kreslí se obdélník barvou pozadí. Pokud padne přes vodorovný pruh v pozadí rámu,
bude vypadat spíš jako světlá šmouha než jako díra.
**Lepší:** kreslit trasu po úsecích a rozbitý úsek vynechat.

### 9. Konfety a `calc(var(--rot) * .4)`
V půlce letu se násobí úhel uvnitř `calc()`. Platné CSS, ale přesně ten zápis,
který někde tiše selže — pak konfety místo plynulého vějíře cuknou.

### 10. Podtržení ukazuje, co slyšel mikrofon
Ne co dítě řeklo. Když je slovo vysloveno čistě a rozpoznávač ho přeslechne,
zůstane nepodtržené a dítě si to může vyložit jako „tohle jsem neřekl".
**Když bude vadit:** posunout přísnost rozpoznávání na „shovívavá", nebo podtrhávat
i slova, která sedí na cíl, i když je rozpoznávač vrátil jen v alternativě.

---

## Rozhodnutí k udělání

### 11. Co s Poruchou
Hra `porucha/` se nelíbila a nahradila ji Barabizna a pak Robůtek. Pořád visí
v rozcestníku. Buď ji z rozcestníku sundat, nebo nechat a nevracet se k ní.

### 12. Druhá scéna pro Barabiznu
`barabizna/parts.js` je psaný tak, aby druhá scéna byla jen seznam dílů, ne nový kód.
Rozpracovaný nápad: strašidlo, kterému se rozpadá oblečení (`knof-lík`, `kap-sa`,
`zip`, `tka-nič-ka`, `če-pi-ce`). Neudělané.

---

## Co je naopak hotové a ověřené

Aby se to nezkoumalo znovu:

- Rozpoznávání řeči: `continuous = true`, **žádný vlastní `getUserMedia`** (vlastní
  stream sebere rozpoznávači zvuk a ten se pak jen restartuje a pípá).
- Útržky („ma" z „maso") se nepočítají jako chyba a mají přednost před přeslechnutím.
- Mikrofon potřebuje https (nebo localhost) **a internet**.
- Generátory v Robůtkovi a Poruše mají ověřeno, že úloha má právě jedno řešení
  a že se žádné slovo nedá vynechat.
- Pádové vazby v Robůtkovi řeší data (`ADJ` má tvary pro tři rody), ne kód.
