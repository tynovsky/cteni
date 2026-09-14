// Kuličková dráha: slovník a trasa. Všechno data – game.js z toho skládá cedulky,
// staví dráhu a vede po ní kuličku.
//
// PÁDY: cedulka je rozkaz, tedy 4. pád. Rody se tu míchají (výhybka je ženská,
// most mužský, kolečko střední), takže přídavné jméno má tři tvary:
//   přehoď červen[ou] výhybku · sklop červen[ý] most · roztoč červen[é] kolečko
// Tvar se bere podle rodu jména dílu. U mužských neživotných a středních je
// 4. pád stejný jako 1., u ženských je na -ou.

const ADJ = {
  colors: {
    red:    { m: 'čer-ve-ný', f: 'čer-ve-nou', n: 'čer-ve-né', hex: '#e0443a', dark: '#a82f27' },
    blue:   { m: 'mod-rý',    f: 'mod-rou',    n: 'mod-ré',    hex: '#3b82d6', dark: '#2a5e9e' },
    yellow: { m: 'žlu-tý',    f: 'žlu-tou',    n: 'žlu-té',    hex: '#f0c040', dark: '#b78f1e' },
    green:  { m: 'ze-le-ný',  f: 'ze-le-nou',  n: 'ze-le-né',  hex: '#4fae55', dark: '#37803c' },
  },
  sizes: {
    small: { m: 'ma-lý',  f: 'ma-lou',  n: 'ma-lé',  k: 0.78 },
    big:   { m: 'vel-ký', f: 'vel-kou', n: 'vel-ké', k: 1.15 },
  },
};

// Šroubek vypadne při špatném tahu; bez přívlastku, takže bez tvarů.
const SCREW = { verb: 'vrať', w: 'šrou-bek' };

// ---------- povely zblízka ----------
// PRAVIDLO, na kterém stojí celá hra: všichni kandidáti musí vypadat stejně
// přijatelně. Jakmile obrázek některého zvýhodní (třeba tím, že jen on je křivý),
// dá se úloha vyřešit bez čtení a text je ozdoba. Porouchaná je proto vždy celá
// SESTAVA, ne konkrétní ovladač — a který ovladač, řekne jedině cedulka.
//
// Gramatika tentokrát nezlobí: „prostřední“ je měkké přídavné jméno (jeden tvar
// pro všechny rody), „třikrát“ a „doleva“ jsou neměnné úplně. Žádná tabulka tvarů.
const CUES = {
  pos:   { first: 'prv-ní', middle: 'pro-střed-ní', last: 'po-sled-ní' },
  count: { one: 'jed-nou', two: 'dva-krát', three: 'tři-krát' },
  dir:   { left: 'do-le-va', right: 'do-pra-va' },
};

// Sestavy na trase. Kreslí se i v celku (malé), takže přiblížení je opravdu zoom
// téže kresby, ne výměna obrázku.
//   by    = čím se dá v téhle sestavě rozlišovat
//   slots = místa ovladačů v souřadnicích sestavy
const RIGS = {
  levers: {
    verb: 'str-hni',
    noun: { nom: 'pá-ka', acc: 'pá-ku', g: 'f' },
    by: ['color', 'pos'],
    slots: [{ x: -34, y: 0 }, { x: 0, y: 0 }, { x: 34, y: 0 }],
  },
  wheel: {
    verb: 'roz-toč',
    noun: { nom: 'ko-leč-ko', acc: 'ko-leč-ko', g: 'n' },
    by: ['count'],
    slots: [{ x: 0, y: 0 }],
  },
  points: {
    verb: 'pře-hoď',
    noun: { nom: 'vý-hyb-ka', acc: 'vý-hyb-ku', g: 'f' },
    by: ['dir'],
    slots: [{ x: 0, y: 0 }],
  },
};

// Trasa: jedna křivka shora dolů. Díly sedí na zlomku její délky, takže se
// jejich místo i natočení dopočítá z křivky – nemůžou skončit vedle dráhy.
const TRACK = {
  view: '0 0 440 500',
  floor: 468,          // nejnižší poloha robůtka, pod rámem dráhy
  home: { x: 70, y: 468 },   // kam se robůtek vrátí, než se pustí kulička
  d: 'M54,52 C130,44 292,56 372,96 C300,134 140,146 62,182 C140,218 300,228 374,266 C300,304 150,314 66,348 C150,382 278,392 346,404',
  slots: [0.09, 0.20, 0.31, 0.42, 0.53, 0.64, 0.75, 0.86],
  ballR: 11,
  start: { x: 54, y: 52 },
  basket: { x: 366, y: 404 },

  // pozadí: prkna, sloupky, koš na konci a zvonek
  frame: `
    <rect x="18" y="18" width="404" height="396" rx="20" fill="#f3e6d0" stroke="#d8c3a0" stroke-width="4"/>
    <path d="M40,26 v380 M400,26 v380" stroke="#e4d3b4" stroke-width="10" stroke-linecap="round"/>
    <g opacity=".5" stroke="#d8c3a0" stroke-width="3">
      <path d="M18,110 h404 M18,196 h404 M18,282 h404 M18,368 h404"/>
    </g>
    <g id="bell">
      <path d="M392,60 a14,14 0 0 1 28,0 v16 h-28 Z" fill="#f0c040" stroke="#b78f1e" stroke-width="3"/>
      <circle cx="406" cy="80" r="4" fill="#b78f1e"/>
    </g>
    <path d="M338,392 h56 v30 a10,10 0 0 1 -10,10 h-36 a10,10 0 0 1 -10,-10 Z" fill="#b9c6d6" stroke="#8b9bb0" stroke-width="3"/>
  `,
};

// Robůtek – neumí číst, umí poslouchat. Kreslí se kolem bodu [0,0], nohama na zemi.
const ROBOT = {
  svg: `
    <g class="rb-legs">
      <rect x="-16" y="-18" width="10" height="18" rx="3" fill="#6f7f94"/>
      <rect x="6" y="-18" width="10" height="18" rx="3" fill="#6f7f94"/>
    </g>
    <rect x="-24" y="-58" width="48" height="42" rx="10" fill="#f0c040" stroke="#b78f1e" stroke-width="3"/>
    <rect x="-19" y="-86" width="38" height="30" rx="9" fill="#ffd970" stroke="#b78f1e" stroke-width="3"/>
    <circle cx="-8" cy="-71" r="5" fill="#2b2137"/><circle cx="8" cy="-71" r="5" fill="#2b2137"/>
    <path d="M-19,-64 h38" stroke="#b78f1e" stroke-width="2"/>
    <path d="M0,-86 v-10" stroke="#b78f1e" stroke-width="3"/><circle cx="0" cy="-99" r="4" fill="#e0443a"/>
    <g class="rb-ear"><path d="M-19,-76 h-8 v14 h8" stroke="#b78f1e" stroke-width="3" fill="#ffd970"/></g>
    <g class="rb-arm"><rect x="22" y="-54" width="26" height="9" rx="4" fill="#6f7f94"/><circle cx="50" cy="-50" r="6" fill="#8b9bb0"/></g>
  `,
};
