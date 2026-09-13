# Robůtek

**Hraj online:** https://tynovsky.github.io/cteni/robutek/ (rozcestník: https://tynovsky.github.io/cteni/)

Šestá hra ze série pro začínající čtenáře (5–8 let). Stroj se zasekne, vyjede z něj
cedulka s povelem — a **robůtek, který neumí číst, čeká, až mu ho dítě přečte nahlas.**

## Proč zrovna takhle

Předchozí hry měly skrytou vadu: slovo bylo jméno něčeho, co bylo vidět. V Barabizně
tvar díry po komíně prozradí „komín" dřív, než dítě přečte první písmeno. Čtení šlo
obejít.

Tady ne. Na stroji je devět ovladačů a **nic než text neřekne, který z nich**.
Robůtek je hluchý k obrázku a slepý k písmu: jediná cesta, jak se informace z cedulky
dostane do stroje, vede přes dětský hlas. Čtení není kontrola, ale mechanismus.

Vzor je *Keep Talking and Nobody Explodes*, obrácený: dítě drží manuál, robot má ruce.

## Pravidla

- 🎫 Ze stroje vyjede cedulka: `ZMÁČKNI ČERVENÉ TLAČÍTKO`.
- 🤖 Dítě přečte **celý povel nahlas**. Robůtek dojde k ovladači a provede to.
- 🤷 **Nedořečený povel = pokrčení rameny.** Když dítě řekne jen „červené" a červená
  jsou na stroji dvě, robůtek rozhodí rukama: *„kterou?"* Nic se nestane, nic se
  nepokazí — ale dítě musí dočíst do konce. Tohle je celý zámek hry.
- 💨 **Robůtek udělá, co slyšel, ne co je správně.** Když dítě řekne „modré" místo
  „červené", zmáčkne modré, sykne pára a odpadne šroubek. Ten se pak musí vrátit
  (`VRAŤ ŠROUBEK`) — hádání tedy stojí práci, ale kolo nikdy neskončí špatně.
- 🏆 Když stroj zase jede, vyrobí příšerku.

Vedlejší efekt téhle fikce: **přeslechnutí mikrofonu je součástí příběhu.** Robot slyší
špatně, tak udělá hloupost — dítě se směje místo toho, aby se vztekalo na aplikaci.

## Levely

Level neurčuje délku slov, ale **kolik informace musí dítě z cedulky vytáhnout**:

| level | cedulka | co je na stroji |
|---|---|---|
| Jedno slovo | `ZMÁČKNI ČERVENÉ TLAČÍTKO` | samá tlačítka, liší se jen barvou |
| Dvě slova | `ZMÁČKNI MALÉ ČERVENÉ TLAČÍTKO` | červená jsou dvě, velké a malé |
| Víc věcí | `ROZTOČ VELKÉ MODRÉ KOLEČKO` | tlačítka, kolečka, táhla, světla, víčka |
| Dva povely | `ZMÁČKNI ŽLUTÉ TLAČÍTKO A ROZSVIŤ MALÉ ZELENÉ SVĚTLO` | dvě věci za sebou, ve správném pořadí |

Ke každému světu (VELKÁ PÍSMENA, malá písmena, psací písmo) patří všechny čtyři.

## Jak se hlídá, že se nedá hádat

Devět ovladačů a náhodná cedulka by nestačily — dítě by tipovalo. Generátor kola proto
u každé cedulky ověří dvě věci:

1. **Jednoznačnost** — celému popisu vyhovuje právě jeden ovladač.
2. **Každé slovo je nosné** — když se z popisu kterékoli slovo vyškrtne, vyhovují
   aspoň dva. Tedy: k `MALÉ ČERVENÉ TLAČÍTKO` je na stroji vždy i velké červené
   tlačítko a malé modré tlačítko.

Bez druhé podmínky by šlo přečíst první slovo a zbytek uhodnout — přesně to, čemu se
tahle hra vyhýbá.

## Pádové vazby řešené návrhem dat

Rozkaz vyžaduje 4. pád a ten by u každého rodu vypadal jinak: *zmáčkni červen**é**
tlačítko*, *zatáhni za červen**ou** páku*, *otoč červen**ým** kolečkem*. Skloňovat v kódu
by byl nesmysl, a tak jsou **všechna jména ovladačů středního rodu** (tlačítko, kolečko,
táhlo, světlo, víčko) a **všechna slovesa berou 4. pád** (zmáčkni, roztoč, vytáhni,
rozsviť, otevři). Ve středním rodě je 4. pád stejný jako 1., takže `červené` je jediný
tvar, který kdy bude potřeba.

Kdo by chtěl přidat „páku" nebo „ventil", musí nejdřív přidat tvary přídavných jmen.

## Struktura

- `index.html` – obrazovky a modály
- `style.css` – vzhled, stroj, robůtek, cedulka, pára
- `game.js` – generátor cedulek, rozbor povelu z řeči, robůtek, postup
- `machine.js` – slovník (slovesa, barvy, velikosti, tvary, jména) a stroj (tělo, devět míst)

## Požadavky na mikrofon

| co | stav |
|---|---|
| Chrome (Android, PC) | ✅ funguje |
| Safari / iOS | ⚠️ česky nespolehlivě |
| Firefox | ❌ rozpoznávání řeči nemá |
| https nebo localhost | **nutné** |
| internet | **nutný** |

Bez mikrofonu se ovladače dají ťuknout přímo — dítě si povel přečte samo pro sebe.
Hra to pozná a napíše to na úvodní obrazovce.

## Spuštění

```bash
python3 -m http.server 8765
# http://localhost:8765/robutek/
```
