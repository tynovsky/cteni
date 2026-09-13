// Slovník a stroj. Všechno je data – game.js z toho skládá cedulky i ovladače.
//
// PÁDY: robůtkovi se poroučí, takže každá cedulka je rozkaz. Aby nebylo potřeba
// skloňovat, jsou všechna jména ovladačů STŘEDNÍHO RODU a všechna slovesa berou
// 4. pád. Ve středním rodě je 4. pád stejný jako 1., takže „červené“ je červené
// pořád – u tlačítka, kolečka i víčka. Kdyby byla v sadě „páka“ nebo „ventil“,
// musely by přibýt tvary „červenou“ a „červený“.

const VOCAB = {
  verbs: {
    press: { w: 'zmáčk-ni' },
    spin:  { w: 'roz-toč' },
    pull:  { w: 'vy-táh-ni' },
    light: { w: 'roz-sviť' },
    open:  { w: 'o-tev-ři' },
  },

  colors: {
    red:    { w: 'čer-ve-né', hex: '#e0443a', dark: '#a82f27' },
    blue:   { w: 'mod-ré',    hex: '#3b82d6', dark: '#2a5e9e' },
    yellow: { w: 'žlu-té',    hex: '#f0c040', dark: '#b78f1e' },
    green:  { w: 'ze-le-né',  hex: '#4fae55', dark: '#37803c' },
  },

  sizes: {
    small: { w: 'ma-lé',  k: 0.72 },
    big:   { w: 'vel-ké', k: 1.18 },
  },

  // tvar se používá jen u tlačítek – jinak by vznikla „hranatá světla“
  shapes: {
    round:  { w: 'ku-la-té' },
    square: { w: 'hra-na-té' },
  },

  nouns: {
    button: { w: 'tla-čít-ko', verb: 'press', shapes: true },
    wheel:  { w: 'ko-leč-ko',  verb: 'spin' },
    lever:  { w: 'tá-hlo',     verb: 'pull' },
    lamp:   { w: 'svět-lo',    verb: 'light' },
    lid:    { w: 'víč-ko',     verb: 'open' },
  },
};

// Šroubek vypadne při špatném tahu. Nemá přívlastek, takže nepotřebuje tvary.
const SCREW = { verb: 'vrať', w: 'šrou-bek' };

// Stroj: plátno, tělo a devět míst pro ovladače (3 × 3).
const MACHINE = {
  view: '0 0 440 330',
  floor: 292,          // po téhle lince chodí robůtek
  slots: [
    { x: 130, y: 96 }, { x: 225, y: 96 }, { x: 320, y: 96 },
    { x: 130, y: 158 }, { x: 225, y: 158 }, { x: 320, y: 158 },
    { x: 130, y: 220 }, { x: 225, y: 220 }, { x: 320, y: 220 },
  ],
  body: `
    <rect x="74" y="56" width="302" height="200" rx="18" fill="#cfd8e3" stroke="#8b9bb0" stroke-width="4"/>
    <rect x="88" y="70" width="274" height="172" rx="12" fill="#e7edf5" stroke="#a8b6c8" stroke-width="3"/>
    <rect x="150" y="256" width="150" height="14" rx="4" fill="#8b9bb0"/>
    <rect x="120" y="270" width="210" height="22" rx="6" fill="#6f7f94"/>
    <circle cx="96" cy="66" r="5" fill="#8b9bb0"/><circle cx="354" cy="66" r="5" fill="#8b9bb0"/>
    <circle cx="96" cy="246" r="5" fill="#8b9bb0"/><circle cx="354" cy="246" r="5" fill="#8b9bb0"/>
    <rect x="376" y="96" width="34" height="60" rx="6" fill="#b9c6d6" stroke="#8b9bb0" stroke-width="3"/>
    <rect x="384" y="150" width="18" height="10" rx="2" fill="#6f7f94"/>
    <path d="M60,140 q-22,-30 -4,-58" stroke="#b9c6d6" stroke-width="10" fill="none" stroke-linecap="round"/>
  `,
};

// Robůtek – neumí číst, umí poslouchat. Kreslí se kolem bodu [0,0], nohama na zemi.
const ROBOT = {
  w: 64,
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
