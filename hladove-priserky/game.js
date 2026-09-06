/* Hladové příšerky – akční hra na čtení. Vanilla JS, bez závislostí. */
'use strict';

// ---------- util ----------
const $ = (s, r = document) => r.querySelector(s);
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const cap1 = (s) => s[0].toLocaleUpperCase('cs') + s.slice(1);

// ---------- perzistence ----------
const KEY = 'hladove-priserky-v1';
const DEFAULTS = {
  settings: { syll: true, tts: true, sound: true, unlock: false, tempo: 1, target: 6 },
  progress: {},      // levelKey -> { wins: n }
  custom: [],        // { w, e }
};
let S = load();
function load() {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { raw = {}; }
  const s = Object.assign({}, DEFAULTS, raw);
  s.settings = Object.assign({}, DEFAULTS.settings, raw.settings || {});
  return s;
}
function save() { localStorage.setItem(KEY, JSON.stringify(S)); }

// ---------- světy a levely ----------
const WORLDS = [
  { name: 'VELKÁ PÍSMENA', sample: 'A B C', cls: 'font-upper', fmt: (t) => t.toLocaleUpperCase('cs') },
  { name: 'malá písmena', sample: 'a b c', cls: 'font-lower', fmt: (t) => t },
  { name: 'psací písmo', sample: 'a b c', cls: 'font-cursive', fmt: (t) => t },
];
// rivalMul = jak rychle rostou soupeřky, cap = kolik jich lítá naráz
const TIERS = [
  { name: 'Krátká', icon: '🐣', choices: 3, rivalMul: 1.0, cap: 4 },
  { name: 'Delší', icon: '🐥', choices: 4, rivalMul: 1.15, cap: 5 },
  { name: 'Dlouhá', icon: '🐔', choices: 4, rivalMul: 1.3, cap: 6 },
  { name: 'Věty', icon: '📖', choices: 4, rivalMul: 1.3, cap: 6 },
];
const levelKey = (w, t) => `${w}-${t}`;
const levelOrder = [];
WORLDS.forEach((_, w) => TIERS.forEach((_, t) => levelOrder.push(levelKey(w, t))));
function winsFor(k) { return (S.progress[k] || {}).wins || 0; }
function stars(k) { const c = winsFor(k); return c >= 6 ? 3 : c >= 3 ? 2 : c >= 1 ? 1 : 0; }
function isUnlocked(k) { if (S.settings.unlock) return true; const i = levelOrder.indexOf(k); return i === 0 || winsFor(levelOrder[i - 1]) >= 1; }

// ---------- slova ----------
const letters = (w) => w.replace(/-/g, '');
function allWords() { return WORDS.concat(S.custom); }
function tierOf(w) { const n = letters(w.w).length; return n <= 4 ? 0 : n <= 6 ? 1 : 2; }
function wordsOfTier(t) { const all = allWords(); if (t === 3) return all.filter((w) => tierOf(w) <= 1); return all.filter((w) => tierOf(w) === t); }
// Slovo lze dát do 4. pádu beze změny (není ženský rod na -a / -e).
const accSafe = (w) => !/a$/.test(letters(w.w)) && !['cibule', 'rýže'].includes(letters(w.w));
const NOM_TPL = ['to je {S}', 'kde je {S}?', 'tady je {S}', 'mňam, {S}!', 'tohle je {S}'];
const ACC_TPL = ['chci {S}', 'dej mi {S}', 'dnes jím {S}', 'já chci {S}', 'dej mi jen {S}'];

function renderWord(w, world, tpl) {
  const W = WORLDS[world];
  const syl = S.settings.syll && world !== 2; // u psacího nedělit, kazí to spojení písmen
  const parts = w.w.split('-').map((p) => W.fmt(p));
  const wordHtml = syl ? parts.join('<span class="syl">·</span>') : parts.join('');
  if (!tpl) return wordHtml;
  let sentence = W.fmt(tpl.replace('{S}', ' '));
  if (world !== 0) sentence = cap1(sentence);
  return sentence.replace(' ', wordHtml);
}
function plainText(w, tpl) { const t = letters(w.w); return tpl ? tpl.replace('{S}', t) : t; }

// ---------- emoji ikony (Twemoji přes CDN, fallback nativní emoji) ----------
function emojiUrl(e) {
  let cps = []; for (const ch of e) cps.push(ch.codePointAt(0).toString(16));
  if (!cps.includes('200d')) cps = cps.filter((c) => c !== 'fe0f');
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${cps.join('-')}.svg`;
}
function emojiEl(e) {
  const img = document.createElement('img');
  img.alt = ''; img.draggable = false; img.src = emojiUrl(e);
  img.onerror = () => { const s = document.createElement('span'); s.className = 'emo'; s.textContent = e; img.replaceWith(s); };
  return img;
}

// ---------- příšerka (SVG ze seedu) ----------
const PALETTE = [['#ff8fab', '#e0527a'], ['#8ed6ff', '#3b9edb'], ['#b6e388', '#6db33f'], ['#ffd166', '#e0a020'], ['#c8a2ff', '#8d5be0'], ['#ffb26b', '#e07b2a'], ['#7fe3d6', '#2ab5a5']];
function monsterSVG(seed, mood = 'idle') {
  const r = mulberry32(seed);
  const [c1, c2] = PALETTE[Math.floor(r() * PALETTE.length)];
  // tělo – blob z kvadratických křivek přes středy hran
  const N = 8, pts = [];
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; const rad = 70 + r() * 18; pts.push([100 + Math.cos(a) * rad, 105 + Math.sin(a) * rad * 0.95]); }
  const mid = (i) => { const p = pts[i % N], q = pts[(i + 1) % N]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; };
  let d = `M${mid(0)[0]},${mid(0)[1]}`;
  for (let i = 1; i <= N; i++) { const q = pts[i % N], m = mid(i); d += ` Q${q[0]},${q[1]} ${m[0]},${m[1]}`; }
  d += 'Z';
  const eyes = 1 + Math.floor(r() * 3);
  const horn = Math.floor(r() * 4); // 0 nic, 1 rohy, 2 tykadla, 3 uši
  const spots = Math.floor(r() * 4);
  let extras = '';
  if (horn === 1) extras += `<path d="M62,45 L70,12 L88,42 Z M138,45 L130,12 L112,42 Z" fill="${c2}"/>`;
  if (horn === 2) extras += `<path d="M80,40 C70,20 60,20 55,8 M120,40 C130,20 140,20 145,8" stroke="${c2}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="55" cy="8" r="8" fill="${c2}"/><circle cx="145" cy="8" r="8" fill="${c2}"/>`;
  if (horn === 3) extras += `<ellipse cx="45" cy="55" rx="16" ry="26" fill="${c1}" stroke="${c2}" stroke-width="4"/><ellipse cx="155" cy="55" rx="16" ry="26" fill="${c1}" stroke="${c2}" stroke-width="4"/>`;
  let spotSvg = '';
  for (let i = 0; i < spots; i++) spotSvg += `<circle cx="${60 + r() * 80}" cy="${120 + r() * 50}" r="${5 + r() * 7}" fill="${c2}" opacity=".45"/>`;
  // křídla (lítající příšerky)
  const wings = `<path class="wing wl" d="M45,95 C0,50 -40,100 5,132 C25,146 45,128 45,95 Z" fill="#fff" fill-opacity=".9" stroke="${c2}" stroke-width="3"/>` +
                `<path class="wing wr" d="M155,95 C200,50 240,100 195,132 C175,146 155,128 155,95 Z" fill="#fff" fill-opacity=".9" stroke="${c2}" stroke-width="3"/>`;
  // oči
  let eyeSvg = '';
  const eyeR = eyes === 1 ? 22 : eyes === 2 ? 15 : 12;
  const xs = eyes === 1 ? [100] : eyes === 2 ? [78, 122] : [70, 100, 130];
  xs.forEach((x, i) => {
    const y = eyes === 3 && i === 1 ? 62 : 78;
    eyeSvg += `<circle cx="${x}" cy="${y}" r="${eyeR}" fill="#fff"/><circle cx="${x + 3}" cy="${y + 3}" r="${eyeR * 0.5}" fill="#2b2137"/><circle cx="${x + 6}" cy="${y - 4}" r="${eyeR * 0.18}" fill="#fff"/>`;
    if (mood === 'angry') {
      const dir = x < 100 ? 1 : x > 100 ? -1 : 0;
      if (dir === 0) eyeSvg += `<path d="M${x - eyeR - 4},${y - eyeR - 10} L${x},${y - eyeR + 2} L${x + eyeR + 4},${y - eyeR - 10}" stroke="#2b2137" stroke-width="6" fill="none" stroke-linecap="round"/>`;
      else eyeSvg += `<path d="M${x - dir * eyeR},${y - eyeR - 8} L${x + dir * eyeR * 0.8},${y - eyeR + 2}" stroke="#2b2137" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    }
  });
  // pusa
  let mouth = '';
  if (mood === 'happy') mouth = `<path d="M70,118 Q100,160 130,118 Z" fill="#5a1f3a"/><ellipse cx="100" cy="140" rx="14" ry="8" fill="#ff7b9c"/>`;
  else if (mood === 'sad') mouth = `<path d="M75,140 Q100,118 125,140" stroke="#5a1f3a" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  else if (mood === 'munch') mouth = `<ellipse cx="100" cy="132" rx="18" ry="14" fill="#5a1f3a"/>`;
  else if (mood === 'angry') mouth = `<path d="M70,120 Q100,152 130,120 Z" fill="#5a1f3a"/><path d="M78,122 l6,11 l6,-11 l6,11 l6,-11 l6,11 l6,-11 l6,11 l6,-11" fill="#fff"/>`;
  else mouth = `<path d="M75,122 Q100,148 125,122" stroke="#5a1f3a" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M92,128 l4,8 l4,-8" fill="#fff"/>`;
  const cheeks = `<circle cx="58" cy="112" r="9" fill="#ff7b9c" opacity=".5"/><circle cx="142" cy="112" r="9" fill="#ff7b9c" opacity=".5"/>`;
  const feet = `<ellipse cx="78" cy="182" rx="18" ry="9" fill="${c2}"/><ellipse cx="122" cy="182" rx="18" ry="9" fill="${c2}"/>`;
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${wings}${feet}${extras}<path d="${d}" fill="${c1}" stroke="${c2}" stroke-width="5"/>${spotSvg}${cheeks}${eyeSvg}${mouth}</svg>`;
}
const randomName = () => cap1(pick(NAME_SYLLABLES) + pick(NAME_SYLLABLES));

// ---------- zvuk ----------
let actx = null;
function beep(freq, dur = 0.12, type = 'sine', vol = 0.2, when = 0) {
  if (!S.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    o.connect(g); g.connect(actx.destination);
    const t = actx.currentTime + when; o.start(t); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.stop(t + dur);
  } catch { /* bez zvuku */ }
}
const sfx = {
  ok: () => { beep(523, .12); beep(659, .12, 'sine', .2, .1); beep(784, .2, 'sine', .2, .2); },
  bad: () => beep(160, .25, 'square', .08),
  munch: () => { beep(220, .06, 'triangle', .15); beep(180, .06, 'triangle', .15, .08); },
  chomp: () => { beep(140, .1, 'sawtooth', .18); beep(90, .18, 'sawtooth', .18, .1); beep(330, .1, 'triangle', .12, .28); },
  chompFar: () => { beep(120, .08, 'triangle', .06); beep(80, .12, 'triangle', .06, .08); },
  lose: () => [392, 330, 262, 196].forEach((f, i) => beep(f, .3, 'square', .08, i * .18)),
  fanfare: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, .25, 'sine', .2, i * .12)),
};
let czVoice = null;
function loadVoices() { const v = speechSynthesis.getVoices(); czVoice = v.find((x) => /^cs/i.test(x.lang)) || null; }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'cs-CZ'; u.rate = 0.85; if (czVoice) u.voice = czVoice;
  speechSynthesis.speak(u);
}

// ---------- obrazovky ----------
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id)); }

function renderHome() {
  const box = $('#worlds'); box.innerHTML = '';
  WORLDS.forEach((W, w) => {
    const div = document.createElement('div'); div.className = 'world';
    div.innerHTML = `<h3><span class="sample ${W.cls}">${W.sample}</span> ${W.name}</h3><div class="levels"></div>`;
    const lv = $('.levels', div);
    TIERS.forEach((T, t) => {
      const k = levelKey(w, t), b = document.createElement('button');
      const un = isUnlocked(k), st = stars(k);
      b.className = 'level' + (un ? '' : ' locked') + (st >= 2 ? ' done' : '');
      b.innerHTML = `<span>${un ? T.icon : '🔒'}</span><span>${T.name}</span><span class="stars">${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span>`;
      if (un) b.onclick = () => startLevel(w, t);
      lv.appendChild(b);
    });
    box.appendChild(div);
  });
}

// ---------- aréna ----------
const arenaEl = $('#arena');
// Model v poměrech (jako agar.io): záleží jen na tom, kolikrát je kdo větší než kdo.
// Správná odpověď násobí naši hmotu, soupeřky rostou jako podíl NAŠÍ hmoty za sekundu.
// Zobrazení se normalizuje na průměrnou hmotu v aréně, takže růst nemá strop.
const MASS_ME = 1000;       // startovní hmota naší příšerky
let FOOD_MUL = 1.25;        // správná odpověď: naše hmota × 1.25
let WRONG_MUL = 0.92;       // špatná odpověď: naše hmota × 0.92
const EAT_RATIO = 1.4;      // o kolik musí být větší, aby mohla sežrat
let EAT_GAIN = 0.1;         // kolik hmoty sežrané příšerky získá ta, co ji sežrala
let RIVAL_GROW = 0.010;     // soupeřka za sekundu přibere 1 % naší hmoty (× rivalMul × tempo × vlastní 0.8–1.2)
let SPAWN_Q = [0.8, 1.2];   // nová soupeřka: podíl naší hmoty (nejde sežrat hned, musíš ji přerůst)
let START_Q = [0.8, 1.15];  // startovní soupeřky: podíl naší hmoty
const GRACE = 3;            // sekundy na začátku: nikdo neroste a nikdo nežere
const R0 = 30;              // poloměr (px při k=1) příšerky s průměrnou hmotou
const IDLE_AFTER = 10;      // po kolika sekundách bez správné odpovědi začne tlak
const IDLE_MAX = 1.5;       // o kolik nejvýš (×) tlak zrychlí růst soupeřek (1 + IDLE_MAX)
let uid = 0;
const A = { list: [], me: null, w: 0, h: 0, k: 1, mref: MASS_ME, raf: 0, last: 0, running: false, eaten: 0, spawnT: 0, t: 0, lastFeed: 0, tempo: 1, rivalMul: 1, cap: 5, target: 6, keys: {} };
const rivals = () => A.list.filter((o) => !o.me && !o.dead);
const radius = (o) => R0 * Math.sqrt(o.m / A.mref) * A.k;
function updateRef() {
  const alive = A.list.filter((o) => !o.dead);
  if (!alive.length) return;
  // geometrický průměr, ať jeden obr nezmenší všechny ostatní na tečky
  A.mref = Math.exp(alive.reduce((s, o) => s + Math.log(o.m), 0) / alive.length);
}

function measureArena() {
  const r = arenaEl.getBoundingClientRect();
  A.w = r.width; A.h = r.height;
  A.k = clamp(Math.min(A.w, A.h) / 420, 0.55, 1.1);
}

function makeMon(opts) {
  const o = Object.assign({ id: ++uid, seed: rnd(1e9), name: randomName(), m: 400, x: 0, y: 0, vx: 0, vy: 0, mood: 'idle', moodUntil: 0, me: false, rate: 20, dead: false, wanderT: 0, wx: 0, wy: 0, target: null, svgKey: '' }, opts);
  const el = document.createElement('div');
  el.className = 'mon bob';
  el.innerHTML = (o.me ? '<div class="ring"></div>' : '') + '<div class="svg"></div>' + (o.me ? `<div class="tag">${o.name}</div>` : '');
  o.el = el; o.svgEl = $('.svg', el);
  arenaEl.appendChild(el);
  A.list.push(o);
  return o;
}
function spawnRival(initial) {
  const q = initial ? START_Q : SPAWN_Q;
  const m = A.me.m * (q[0] + Math.random() * (q[1] - q[0]));
  let x, y;
  if (initial) {
    // rozmístit dál od středu (tam startuje naše)
    for (let i = 0; i < 30; i++) {
      x = 40 + Math.random() * (A.w - 80); y = 40 + Math.random() * (A.h - 80);
      const far = A.list.every((o) => Math.hypot(x - o.x, y - o.y) > (o.me ? 0.3 : 0.2) * Math.min(A.w, A.h));
      if (far) break;
    }
  } else {
    const side = rnd(4);
    x = side === 0 ? -30 : side === 1 ? A.w + 30 : Math.random() * A.w;
    y = side === 2 ? -30 : side === 3 ? A.h + 30 : Math.random() * A.h;
  }
  const o = makeMon({ m, x, y, rate: (0.8 + Math.random() * 0.4) * A.rivalMul });
  o.wanderT = 0;
  return o;
}

function setMood(o, mood, ms) { o.mood = mood; o.moodUntil = A.t + ms / 1000; }
function baseMood(o) {
  if (o.me) return 'idle';
  return A.me && !A.me.dead && o.m >= EAT_RATIO * A.me.m ? 'angry' : 'idle';
}
function renderMon(o) {
  const mood = A.t < o.moodUntil ? o.mood : baseMood(o);
  const key = o.seed + ':' + mood;
  if (key !== o.svgKey) { o.svgKey = key; o.svgEl.innerHTML = monsterSVG(o.seed, mood); }
  const s = (radius(o) * 2.5) / 200;
  o.el.style.transform = `translate(${o.x - 100}px, ${o.y - 100}px) scale(${s})`;
}
function updateScore() { $('#score').textContent = `😋 ${A.eaten} / ${A.target}   ·   👾 ${rivals().length}`; }
function flash(text) { const f = $('#flash'); f.textContent = text; f.classList.remove('show'); void f.offsetWidth; f.classList.add('show'); }

function step(dt) {
  A.t += dt;
  const me = A.me;
  const grow = A.t > GRACE;
  // tlak: kdo dlouho nečte, tomu soupeřky rostou rychleji
  const idle = A.t - A.lastFeed;
  const press = 1 + clamp((idle - IDLE_AFTER) / 6, 0, IDLE_MAX);
  $('#bubble').classList.toggle('hurry', grow && idle > IDLE_AFTER);
  // spawn nových soupeřek
  A.spawnT -= dt;
  if (A.spawnT <= 0) { const n = rivals().length; A.spawnT = n < A.cap / 2 ? 1.2 : 3 + Math.random() * 2; if (n < A.cap) spawnRival(false); }

  for (const o of A.list) {
    if (o.dead) continue;
    if (grow && !o.me) o.m += RIVAL_GROW * press * o.rate * A.tempo * me.m * dt;
    const r = radius(o);
    const maxV = (o.me ? clamp(200 - r * 1.0, 70, 170) : clamp(150 - r * 1.1, 45, 130)) * A.k;
    let ax = 0, ay = 0;
    if (o.me) {
      const k = A.keys;
      const kx = (k.right ? 1 : 0) - (k.left ? 1 : 0), ky = (k.down ? 1 : 0) - (k.up ? 1 : 0);
      if (kx || ky) { o.target = null; ax = kx; ay = ky; }
      else if (o.target) {
        const dx = o.target.x - o.x, dy = o.target.y - o.y, d = Math.hypot(dx, dy);
        if (d < 6 * A.k) o.target = null; else { ax = dx / d; ay = dy / d; }
      } else {
        // bez povelu: sama loví nejbližší menší a couvá před většími (pomoc malým dětem)
        let prey = null, pd = Infinity;
        for (const p of A.list) {
          if (p === o || p.dead) continue;
          const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1;
          if (p.m >= EAT_RATIO * o.m) {
            const R = 170 * A.k;
            if (d < R) { const w = 1.0 * (1 - d / R); ax -= dx / d * w; ay -= dy / d * w; }
          } else if (o.m >= EAT_RATIO * p.m && d < pd && p.x > 0 && p.x < A.w && p.y > 0 && p.y < A.h) { prey = p; pd = d; }
        }
        if (prey) { ax += (prey.x - o.x) / pd * 0.7; ay += (prey.y - o.y) / pd * 0.7; }
      }
    } else {
      o.wanderT -= dt;
      if (o.wanderT <= 0) { o.wanderT = 1 + Math.random() * 2; const a = Math.random() * Math.PI * 2; o.wx = Math.cos(a); o.wy = Math.sin(a); }
      ax = o.wx * 0.5; ay = o.wy * 0.5;
      // lov menších, útěk před většími
      for (const p of A.list) {
        if (p === o || p.dead) continue;
        const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1;
        const RS = 260 * A.k, RF = 200 * A.k;
        if (o.m >= EAT_RATIO * p.m && d < RS) { const w = 1.2 * (1 - d / RS); ax += dx / d * w; ay += dy / d * w; }
        else if (p.m >= EAT_RATIO * o.m && d < RF) { const w = 1.6 * (1 - d / RF); ax -= dx / d * w; ay -= dy / d * w; }
      }
      // mírné odpuzování od stěn
      const M = 60 * A.k;
      if (o.x < M) ax += 0.8; if (o.x > A.w - M) ax -= 0.8;
      if (o.y < M) ay += 0.8; if (o.y > A.h - M) ay -= 0.8;
    }
    const al = Math.hypot(ax, ay);
    const blend = Math.min(1, dt * 3);
    if (al > 0.001) { o.vx += (ax / al * maxV - o.vx) * blend; o.vy += (ay / al * maxV - o.vy) * blend; }
    else { const f = Math.pow(0.15, dt); o.vx *= f; o.vy *= f; }
    o.x += o.vx * dt; o.y += o.vy * dt;
    // stěny – tvrdý odraz
    const rr = r * 1.1;
    if (o.x < rr) { o.x = rr; o.vx = Math.abs(o.vx) * 0.5; o.wx = Math.abs(o.wx); }
    if (o.x > A.w - rr) { o.x = A.w - rr; o.vx = -Math.abs(o.vx) * 0.5; o.wx = -Math.abs(o.wx); }
    if (o.y < rr) { o.y = rr; o.vy = Math.abs(o.vy) * 0.5; o.wy = Math.abs(o.wy); }
    if (o.y > A.h - rr) { o.y = A.h - rr; o.vy = -Math.abs(o.vy) * 0.5; o.wy = -Math.abs(o.wy); }
  }

  // srážky: větší žere menší, jinak se odstrčí
  const canEat = A.t > GRACE;
  const alive = A.list.filter((o) => !o.dead);
  for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
    const a = alive[i], b = alive[j];
    if (a.dead || b.dead) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.001;
    const touch = (radius(a) + radius(b)) * 0.8;
    if (d >= touch) continue;
    if (canEat && a.m >= EAT_RATIO * b.m) eat(a, b);
    else if (canEat && b.m >= EAT_RATIO * a.m) eat(b, a);
    else {
      const push = (touch - d) / 2, nx = dx / d, ny = dy / d;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
    }
    if (!A.running) return;
  }
  // hmoty rostou bez stropu – čas od času vše vydělit, ať čísla neutečou
  if (me.m > 1e9) for (const o of A.list) o.m /= 1e6;
  updateRef();
  for (const o of A.list) if (!o.dead) renderMon(o);
}

function eat(a, b) {
  b.dead = true;
  a.m += EAT_GAIN * b.m;
  b.el.classList.remove('bob'); b.el.classList.add('eaten');
  b.el.style.transform = `translate(${a.x - 100}px, ${a.y - 100}px) scale(0.03)`;
  setTimeout(() => { b.el.remove(); A.list = A.list.filter((o) => o !== b); }, 500);
  if (b.me) { lose(a); return; }
  setMood(a, 'munch', 500);
  if (a.me) {
    A.eaten++; sfx.chomp(); updateScore();
    if (A.eaten >= A.target) win();
  } else { sfx.chompFar(); updateScore(); }
}

function loop(ts) {
  if (!A.running) return;
  const dt = Math.min(0.05, (ts - A.last) / 1000 || 0);
  A.last = ts;
  step(dt);
  A.raf = requestAnimationFrame(loop);
}
function pause() { A.running = false; cancelAnimationFrame(A.raf); }
function resume() { if (A.running || !A.me || A.me.dead) return; A.running = true; A.last = performance.now(); A.raf = requestAnimationFrame(loop); }
function clearArena() {
  pause();
  A.list.forEach((o) => o.el.remove()); A.list = []; A.me = null;
  arenaEl.querySelectorAll('.target').forEach((t) => t.remove());
}

// ovládání: ťuknutí / tažení v aréně, šipky / WASD
let dragging = false;
function setTarget(e) {
  if (!A.me || !A.running) return;
  const r = arenaEl.getBoundingClientRect();
  const x = clamp(e.clientX - r.left, 10, A.w - 10), y = clamp(e.clientY - r.top, 10, A.h - 10);
  A.me.target = { x, y };
  if (e.type === 'pointerdown') {
    const t = document.createElement('div'); t.className = 'target'; t.style.left = x + 'px'; t.style.top = y + 'px';
    arenaEl.appendChild(t); setTimeout(() => t.remove(), 800);
  }
}
arenaEl.addEventListener('pointerdown', (e) => { dragging = true; arenaEl.setPointerCapture(e.pointerId); setTarget(e); e.preventDefault(); });
arenaEl.addEventListener('pointermove', (e) => { if (dragging) setTarget(e); });
arenaEl.addEventListener('pointerup', () => { dragging = false; });
arenaEl.addEventListener('pointercancel', () => { dragging = false; });
const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
document.addEventListener('keydown', (e) => { const k = KEYMAP[e.key]; if (k && !$('#modal-parent').classList.contains('open')) { A.keys[k] = true; e.preventDefault(); } });
document.addEventListener('keyup', (e) => { const k = KEYMAP[e.key]; if (k) A.keys[k] = false; });
window.addEventListener('resize', () => { if (A.me) measureArena(); });

// ---------- kolo ----------
const G = { world: 0, tier: 0, word: null, tpl: null, wrong: 0, busy: false };

function startLevel(w, t) {
  G.world = w; G.tier = t;
  clearArena();
  show('game');
  measureArena();
  A.t = 0; A.lastFeed = 0; A.eaten = 0; A.spawnT = 4; A.keys = {};
  A.tempo = S.settings.tempo; A.target = S.settings.target;
  A.rivalMul = TIERS[t].rivalMul; A.cap = TIERS[t].cap;
  A.me = makeMon({ me: true, m: MASS_ME, x: A.w / 2, y: A.h / 2 });
  for (let i = 0; i < A.cap - 1; i++) spawnRival(true);
  updateRef(); A.list.forEach(renderMon);
  updateScore();
  flash('Start!');
  nextWord();
  A.running = false; resume();
}

function nextWord() {
  const pool = wordsOfTier(G.tier);
  const cand = pool.filter((w) => w !== G.word);
  G.wrong = 0; G.busy = false; G.tpl = null;
  G.word = pick(cand.length ? cand : pool);
  if (G.tier === 3) G.tpl = pick(accSafe(G.word) ? NOM_TPL.concat(ACC_TPL) : NOM_TPL);

  // distraktory: půlka času preferuj stejné počáteční písmeno (nutí číst dál než 1. písmeno)
  const n = TIERS[G.tier].choices - 1;
  const others = shuffle(allWords().filter((w) => w !== G.word && w.e !== G.word.e));
  const first = letters(G.word.w)[0];
  const sameStart = others.filter((w) => letters(w.w)[0] === first);
  const picked = [];
  if (Math.random() < 0.5 && sameStart.length) picked.push(sameStart[0]);
  const sameTier = others.filter((w) => !picked.includes(w) && (G.tier === 3 ? tierOf(w) <= 1 : tierOf(w) === G.tier));
  for (const w of sameTier) { if (picked.length >= n) break; picked.push(w); }
  for (const w of others) { if (picked.length >= n) break; if (!picked.includes(w)) picked.push(w); }
  const choices = shuffle(picked.concat([G.word]));

  const bubble = $('#bubble'); bubble.className = 'bubble ' + WORLDS[G.world].cls;
  $('#who').textContent = A.me.name + ' chce:';
  $('#word').innerHTML = renderWord(G.word, G.world, G.tpl);
  bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');

  const box = $('#choices'); box.innerHTML = '';
  choices.forEach((w) => {
    const b = document.createElement('button'); b.className = 'choice'; b.dataset.e = w.e;
    b.appendChild(emojiEl(w.e));
    b.onclick = () => answer(b, w);
    box.appendChild(b);
  });
}
function flashMon(o, cls) { o.el.classList.remove(cls); void o.el.offsetWidth; o.el.classList.add(cls); setTimeout(() => o.el.classList.remove(cls), 700); }

function answer(btn, w) {
  if (G.busy || !A.running) return;
  const me = A.me;
  if (w !== G.word) {
    G.wrong++; sfx.bad();
    btn.classList.add('wrong');
    me.m *= WRONG_MUL;
    setMood(me, 'sad', 800); flashMon(me, 'sad');
    if (G.wrong >= 2) {
      if (S.settings.tts) speak(plainText(G.word, G.tpl));
      document.querySelectorAll('.choice').forEach((c) => { if (c.dataset.e === G.word.e) c.classList.add('hint'); });
    }
    return;
  }
  G.busy = true; sfx.ok();
  btn.classList.add('right');
  // jídlo letí do pusy
  const fly = document.createElement('div'); fly.className = 'fly';
  fly.appendChild(emojiEl(w.e));
  const from = btn.getBoundingClientRect(), ar = arenaEl.getBoundingClientRect();
  fly.style.left = (from.left + from.width / 2 - 30) + 'px'; fly.style.top = (from.top + from.height / 2 - 30) + 'px';
  document.body.appendChild(fly);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    fly.style.left = (ar.left + me.x - 30) + 'px'; fly.style.top = (ar.top + me.y - 30) + 'px';
    fly.style.transform = 'scale(.4)'; fly.style.opacity = '.2';
  }));
  setTimeout(() => {
    fly.remove();
    if (me.dead) return;
    sfx.munch();
    me.m *= FOOD_MUL; A.lastFeed = A.t;
    setMood(me, 'happy', 600); flashMon(me, 'happy');
    nextWord();
  }, 600);
}

function endRound() { pause(); A.keys = {}; dragging = false; }
function win() {
  endRound(); sfx.fanfare();
  const k = levelKey(G.world, G.tier);
  const prev = winsFor(k);
  S.progress[k] = { wins: prev + 1 }; save();
  const i = levelOrder.indexOf(k);
  const unlockedNext = !S.settings.unlock && prev === 0 && i + 1 < levelOrder.length;
  $('#done-icon').textContent = '🏆';
  $('#done-title').textContent = `${A.me.name} vyhrála!`;
  $('#done-text').textContent = (unlockedNext ? '🔓 Odemkl se další level! ' : '') + `Sežrala ${A.eaten} příšerek a je největší v aréně.`;
  $('#btn-again').textContent = 'Ještě jednou';
  setTimeout(() => $('#modal-done').classList.add('open'), 700);
}
function lose(eater) {
  endRound(); sfx.lose();
  $('#done-icon').textContent = '😵';
  $('#done-title').textContent = 'Au!';
  $('#done-text').textContent = `${eater.name} sežrala tvoji příšerku ${A.me.name}. ` + (A.eaten ? `Stihla sežrat ${A.eaten} příšerek. ` : '') + 'Čti rychleji a uteč velkým!';
  $('#btn-again').textContent = 'Znovu';
  setTimeout(() => $('#modal-done').classList.add('open'), 900);
}
$('#btn-again').onclick = () => { $('#modal-done').classList.remove('open'); startLevel(G.world, G.tier); };
$('#btn-home').onclick = () => { $('#modal-done').classList.remove('open'); clearArena(); renderHome(); show('home'); };
$('#btn-back').onclick = () => { clearArena(); renderHome(); show('home'); };
$('#btn-speak').onclick = () => { if (G.word) speak(plainText(G.word, G.tpl)); };
$('#bubble').onclick = () => { if (G.word && S.settings.tts) speak(plainText(G.word, G.tpl)); };
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else if (!$('#modal-done').classList.contains('open') && !$('#modal-parent').classList.contains('open') && $('#game').classList.contains('active')) resume(); });

// ---------- nápověda ----------
$('#btn-help').onclick = () => $('#modal-help').classList.add('open');
$('#help-close').onclick = () => $('#modal-help').classList.remove('open');

// ---------- rodič ----------
let gateAnswer = 0;
$('#btn-parent').onclick = () => {
  const a = 3 + rnd(7), b = 3 + rnd(7); gateAnswer = a + b;
  $('#gate-q').textContent = `${a} + ${b}`; $('#gate-a').value = '';
  $('#parent-gate').hidden = false; $('#parent-panel').hidden = true;
  $('#modal-parent').classList.add('open'); setTimeout(() => $('#gate-a').focus(), 50);
};
$('#gate-cancel').onclick = () => $('#modal-parent').classList.remove('open');
$('#gate-ok').onclick = () => { if (+$('#gate-a').value === gateAnswer) openParent(); else { $('#gate-a').value = ''; sfx.bad(); } };
$('#gate-a').onkeydown = (e) => { if (e.key === 'Enter') $('#gate-ok').click(); };
function openParent() {
  $('#parent-gate').hidden = true; $('#parent-panel').hidden = false;
  $('#opt-syll').checked = S.settings.syll; $('#opt-tts').checked = S.settings.tts;
  $('#opt-sound').checked = S.settings.sound; $('#opt-unlock').checked = S.settings.unlock;
  $('#opt-tempo').value = String(S.settings.tempo); $('#opt-target').value = S.settings.target;
  renderCustom();
}
function renderCustom() {
  const ul = $('#cw-list'); ul.innerHTML = '';
  S.custom.forEach((w, i) => {
    const li = document.createElement('li'); li.textContent = `${w.e} ${w.w} `;
    const b = document.createElement('button'); b.textContent = '✕';
    b.onclick = () => { S.custom.splice(i, 1); save(); renderCustom(); };
    li.appendChild(b); ul.appendChild(li);
  });
}
$('#cw-add').onclick = () => {
  const w = $('#cw-word').value.trim().toLocaleLowerCase('cs'), e = $('#cw-emoji').value.trim();
  if (!w || !e) return;
  S.custom.push({ w, e }); save(); $('#cw-word').value = ''; $('#cw-emoji').value = ''; renderCustom();
};
$('#parent-close').onclick = () => {
  S.settings = {
    syll: $('#opt-syll').checked, tts: $('#opt-tts').checked, sound: $('#opt-sound').checked, unlock: $('#opt-unlock').checked,
    tempo: +$('#opt-tempo').value || 1, target: clamp(+$('#opt-target').value || 6, 3, 20),
  };
  save(); $('#modal-parent').classList.remove('open'); renderHome();
};
$('#btn-reset').onclick = () => { if (confirm('Opravdu smazat všechen postup?')) { localStorage.removeItem(KEY); S = load(); $('#modal-parent').classList.remove('open'); renderHome(); } };

// ---------- start ----------
renderHome();
// Ochrana proti zoomu dvojklikem na iOS
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
