// Scéna = pevný podklad + odnímatelné díly.
// Každý díl: id, w = jméno rozdělené na slabiky, svg = tvar (stejný viewBox jako scéna),
// box = [x, y, šířka, výška] – kreslí se do něj díra a doprostřed popisek.
// Přidat další scénu znamená přidat data, ne kód.

const SCENE = {
  id: 'barabizna',
  name: 'Barabizna',
  view: '0 0 400 340',

  // podklad: obloha, tráva, zdivo domu – tyhle části nikdy nespadnou
  base: `
    <rect x="0" y="296" width="400" height="44" fill="#9bd47a"/>
    <path d="M0,300 q60,-14 120,-2 t120,-2 t160,4 v42 H0 Z" fill="#8ac96a"/>
    <rect x="100" y="150" width="180" height="148" fill="#e8d3b0" stroke="#b99c72" stroke-width="3"/>
    <rect x="100" y="150" width="180" height="10" fill="#d9c09a"/>
  `,

  parts: [
    { id: 'strecha', w: 'stře-cha', box: [82, 98, 216, 56],
      svg: `<path d="M86,152 L118,104 L262,104 L294,152 Z" fill="#b5533f" stroke="#8e3d2d" stroke-width="3" stroke-linejoin="round"/>
            <path d="M86,152 L294,152" stroke="#8e3d2d" stroke-width="4"/>` },

    { id: 'komin', w: 'ko-mín', box: [232, 66, 34, 44],
      svg: `<rect x="236" y="70" width="26" height="38" fill="#a8574a" stroke="#7f3c33" stroke-width="3"/>
            <rect x="232" y="66" width="34" height="8" rx="2" fill="#7f3c33"/>` },

    { id: 'antena', w: 'an-té-na', box: [142, 54, 40, 52],
      svg: `<path d="M162,104 L162,60" stroke="#6b6b7a" stroke-width="4" stroke-linecap="round"/>
            <path d="M146,72 L178,64 M148,84 L176,77" stroke="#6b6b7a" stroke-width="4" stroke-linecap="round"/>
            <circle cx="162" cy="57" r="4" fill="#6b6b7a"/>` },

    { id: 'okno1', w: 'ok-no', box: [117, 177, 50, 46],
      svg: `<rect x="120" y="180" width="44" height="40" fill="#bfe6ff" stroke="#7a9db5" stroke-width="3"/>
            <path d="M142,180 L142,220 M120,200 L164,200" stroke="#7a9db5" stroke-width="3"/>` },

    { id: 'okno2', w: 'ok-no', box: [214, 177, 50, 46],
      svg: `<rect x="217" y="180" width="44" height="40" fill="#bfe6ff" stroke="#7a9db5" stroke-width="3"/>
            <path d="M239,180 L239,220 M217,200 L261,200" stroke="#7a9db5" stroke-width="3"/>` },

    { id: 'okno3', w: 'ok-no', box: [171, 108, 40, 36],
      svg: `<rect x="174" y="111" width="34" height="30" rx="3" fill="#bfe6ff" stroke="#7a9db5" stroke-width="3"/>
            <path d="M191,111 L191,141" stroke="#7a9db5" stroke-width="3"/>` },

    { id: 'okenice1', w: 'o-ke-ni-ce', box: [101, 177, 18, 46],
      svg: `<rect x="104" y="180" width="13" height="40" fill="#7fae6b" stroke="#4f7d43" stroke-width="2"/>
            <path d="M104,190 h13 M104,200 h13 M104,210 h13" stroke="#4f7d43" stroke-width="2"/>` },

    { id: 'okenice2', w: 'o-ke-ni-ce', box: [262, 177, 18, 46],
      svg: `<rect x="265" y="180" width="13" height="40" fill="#7fae6b" stroke="#4f7d43" stroke-width="2"/>
            <path d="M265,190 h13 M265,200 h13 M265,210 h13" stroke="#4f7d43" stroke-width="2"/>` },

    { id: 'dvere', w: 'dve-ře', box: [164, 222, 52, 78],
      svg: `<rect x="168" y="226" width="44" height="72" rx="3" fill="#7a4a2b" stroke="#5b3520" stroke-width="3"/>
            <circle cx="203" cy="264" r="4" fill="#ffd166"/>` },

    { id: 'schody', w: 'scho-dy', box: [152, 296, 76, 26],
      svg: `<rect x="156" y="298" width="68" height="9" rx="2" fill="#cbbfae" stroke="#a2957f" stroke-width="2"/>
            <rect x="164" y="307" width="52" height="9" rx="2" fill="#cbbfae" stroke="#a2957f" stroke-width="2"/>` },

    { id: 'trubka', w: 'trub-ka', box: [280, 146, 18, 156],
      svg: `<rect x="285" y="150" width="8" height="148" fill="#b8b3a8" stroke="#918c81" stroke-width="2"/>
            <rect x="282" y="146" width="14" height="8" rx="2" fill="#918c81"/>` },

    { id: 'cihla1', w: 'cih-la', box: [124, 254, 32, 20],
      svg: `<rect x="127" y="257" width="26" height="14" rx="2" fill="#c2695a" stroke="#93483c" stroke-width="2"/>` },

    { id: 'cihla2', w: 'cih-la', box: [224, 254, 32, 20],
      svg: `<rect x="227" y="257" width="26" height="14" rx="2" fill="#c2695a" stroke="#93483c" stroke-width="2"/>` },

    // kočka sedí na levé straně střechy – u komína by se jí popisek kryl s popiskem komína
    { id: 'kocka', w: 'koč-ka', box: [104, 110, 46, 32],
      svg: `<ellipse cx="126" cy="132" rx="20" ry="9" fill="#5b5560"/>
            <circle cx="110" cy="124" r="8" fill="#5b5560"/>
            <path d="M105,118 l-2,-7 l7,3 Z M115,118 l3,-7 l3,6 Z" fill="#5b5560"/>
            <path d="M146,132 q8,-10 2,-16" stroke="#5b5560" stroke-width="4" fill="none" stroke-linecap="round"/>` },

    { id: 'plot1', w: 'plot', box: [4, 246, 82, 56],
      svg: `<path d="M10,258 h70 M10,276 h70" stroke="#c99a5b" stroke-width="5"/>
            <path d="M14,250 v50 M32,250 v50 M50,250 v50 M68,250 v50" stroke="#a87c42" stroke-width="7" stroke-linecap="round"/>` },

    { id: 'plot2', w: 'plot', box: [306, 246, 88, 56],
      svg: `<path d="M312,258 h76 M312,276 h76" stroke="#c99a5b" stroke-width="5"/>
            <path d="M316,250 v50 M334,250 v50 M352,250 v50 M370,250 v50 M388,250 v50" stroke="#a87c42" stroke-width="7" stroke-linecap="round"/>` },

    { id: 'ker1', w: 'keř', box: [74, 262, 42, 42],
      svg: `<circle cx="88" cy="288" r="13" fill="#5fa845"/><circle cx="101" cy="284" r="15" fill="#6db33f"/><circle cx="95" cy="295" r="12" fill="#79c24a"/>` },

    { id: 'ker2', w: 'keř', box: [286, 262, 42, 42],
      svg: `<circle cx="300" cy="288" r="13" fill="#5fa845"/><circle cx="313" cy="284" r="15" fill="#6db33f"/><circle cx="307" cy="295" r="12" fill="#79c24a"/>` },

    { id: 'strom', w: 'strom', box: [322, 166, 74, 136],
      svg: `<rect x="352" y="232" width="14" height="66" fill="#8a5a2b"/>
            <circle cx="359" cy="206" r="33" fill="#6db33f"/>
            <circle cx="338" cy="220" r="20" fill="#5fa845"/>
            <circle cx="380" cy="220" r="20" fill="#79c24a"/>` },

    { id: 'lampa', w: 'lam-pa', box: [16, 188, 30, 114],
      svg: `<rect x="28" y="206" width="7" height="92" fill="#6b6b7a"/>
            <rect x="22" y="294" width="19" height="6" rx="2" fill="#6b6b7a"/>
            <path d="M23,206 h18 l-4,-14 h-10 Z" fill="#ffd166" stroke="#6b6b7a" stroke-width="3"/>` },

    // schránka na pravém plotě – vlevo by se kryla s praporkem
    { id: 'schranka', w: 'schrán-ka', box: [326, 228, 40, 30],
      svg: `<rect x="330" y="232" width="32" height="20" rx="5" fill="#4f88c4" stroke="#2f5f8f" stroke-width="2"/>
            <path d="M330,240 h32" stroke="#2f5f8f" stroke-width="3"/>
            <rect x="358" y="234" width="5" height="10" rx="2" fill="#e0527a"/>` },

    { id: 'praporek', w: 'pra-po-rek', box: [40, 170, 44, 132],
      svg: `<path d="M52,298 L52,176" stroke="#8a7f6b" stroke-width="4" stroke-linecap="round"/>
            <path d="M52,180 L80,188 L52,198 Z" fill="#e0527a"/>` },

    { id: 'zahradka', w: 'za-hrád-ka', box: [104, 288, 56, 34],
      svg: `<path d="M112,314 v-12 M128,316 v-14 M144,314 v-12" stroke="#4f7d43" stroke-width="3"/>
            <circle cx="112" cy="300" r="6" fill="#ff8fab"/>
            <circle cx="128" cy="298" r="6" fill="#ffd166"/>
            <circle cx="144" cy="300" r="6" fill="#c8a2ff"/>` },
  ],
};

// Šablony vět pro nejvyšší level. {S} = jméno dílu.
// Jen vazby s 1. pádem: „dej tam {S}“ by u ženských jmen dalo „dej tam střecha“.
const PART_TPL = ['chybí {S}', 'tady patří {S}', 'kde je {S}?'];
