/* Robůtek – kuličková dráha. Dítě čte povel nahlas, robot ho provede, kulička dojede dál. */
'use strict';

// ---------- util ----------
const $ = (s, r = document) => r.querySelector(s);
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const cap1 = (s) => s[0].toLocaleUpperCase('cs') + s.slice(1);
const SVGNS = 'http://www.w3.org/2000/svg';
const letters = (w) => w.replace(/-/g, '');

// ---------- perzistence ----------
const KEY = 'robutek-v1';
const DEFAULTS = {
  settings: { syll: true, tts: true, sound: true, unlock: false, goal: 6, mic: true, strict: 1 },
  progress: {},      // levelKey -> { wins: n }
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
// Level neurčuje délku slov, ale kolik informace musí dítě z cedulky vytáhnout.
const TIERS = [
  { name: 'Barva', icon: '🐣', types: 1, attrs: ['color'], cmds: 1 },
  { name: 'Barva a velikost', icon: '🐥', types: 1, attrs: ['color', 'size'], cmds: 1 },
  { name: 'Víc dílů', icon: '🐔', types: 2, attrs: ['color', 'size'], cmds: 1 },
  { name: 'Dva povely', icon: '📖', types: 2, attrs: ['color', 'size'], cmds: 2 },
];
const levelKey = (w, t) => `${w}-${t}`;
const levelOrder = [];
WORLDS.forEach((_, w) => TIERS.forEach((_, t) => levelOrder.push(levelKey(w, t))));
function winsFor(k) { return (S.progress[k] || {}).wins || 0; }
function stars(k) { const c = winsFor(k); return c >= 6 ? 3 : c >= 3 ? 2 : c >= 1 ? 1 : 0; }
function isUnlocked(k) { if (S.settings.unlock) return true; const i = levelOrder.indexOf(k); return i === 0 || winsFor(levelOrder[i - 1]) >= 1; }

// ---------- text cedulky (se shodou rodu) ----------
// „přehoď červenOU výhybkU“ × „sklop červenÝ most“ × „roztoč červenÉ kolečko“.
// Tvar se bere podle rodu dílu – proto má ADJ tři sloupce.
function partWords(d) {
  const P = PARTS[d.type], g = P.g;
  const out = [P.verb];
  if (d.size) out.push(ADJ.sizes[d.size][g]);
  out.push(ADJ.colors[d.color][g]);
  out.push(P.acc);
  return out;
}
function wordHtml(w, world) {
  const W = WORLDS[world];
  const syl = S.settings.syll && world !== 2;   // u psacího nedělit, kazí to spojení písmen
  const parts = w.split('-').map((p) => W.fmt(p));
  return syl ? parts.join('<span class="syl">·</span>') : parts.join('');
}
function ticketHtml(t, world) {
  if (t.kind === 'screw') return `<span class="screw">${wordHtml(SCREW.verb, world)} ${wordHtml(SCREW.w, world)}</span>`;
  return t.descs.map((d) => partWords(d).map((w) => wordHtml(w, world)).join(' ')).join(' <b>a</b> ');
}
function ticketPlain(t) {
  if (t.kind === 'screw') return `${SCREW.verb} ${letters(SCREW.w)}`;
  return t.descs.map((d) => partWords(d).map(letters).join(' ')).join(' a ');
}

// ---------- rozbor povelu z řeči ----------
const norm = (s) => (s || '').toLocaleLowerCase('cs').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
function lev(a, b) {
  if (a === b) return 0;
  if (!a.length || !b.length) return a.length + b.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
function tol(n) {
  const s = S.settings.strict;
  if (s === 2) return 0;
  const base = n <= 4 ? 1 : n <= 7 ? 2 : 3;
  return s === 0 ? base + 1 : base;
}
// Slovník je uzavřený, zato má od každého přídavného jména tři tvary. Tvary téhož
// slova si jsou blízko (modrý/modré), ale ukazují na stejný klíč – shoda mezi nimi
// tedy není nejednoznačnost.
const LEXICON = (() => {
  const out = [], seen = new Set();
  const add = (cat, key, w) => { const n = norm(letters(w)); const id = cat + ':' + key + ':' + n; if (n && !seen.has(id)) { seen.add(id); out.push({ cat, key, n }); } };
  for (const [k, v] of Object.entries(ADJ.colors)) for (const g of ['m', 'f', 'n']) add('color', k, v[g]);
  for (const [k, v] of Object.entries(ADJ.sizes)) for (const g of ['m', 'f', 'n']) add('size', k, v[g]);
  for (const [k, v] of Object.entries(PARTS)) { add('verb', k, v.verb); add('type', k, v.acc); add('type', k, v.nom); }
  add('screwverb', 'vrat', SCREW.verb);
  add('screw', 'screw', SCREW.w);
  return out;
})();
function matchToken(tok) {
  const h = norm(tok);
  if (!h) return null;
  let best = null, bd = Infinity, secondKey = null, sd = Infinity;
  for (const e of LEXICON) {
    const d = lev(h, e.n);
    if (d < bd) { if (!best || best.cat + best.key !== e.cat + e.key) { sd = bd; secondKey = best; } bd = d; best = e; }
    else if (d < sd && (!best || e.cat + e.key !== best.cat + best.key)) { sd = d; secondKey = e; }
  }
  if (!best || bd > tol(best.n.length)) return null;
  if (secondKey && sd === bd) return null;      // dvě různá slova stejně blízko → radši nic
  return best;
}
// Vrátí povely v pořadí, jak zazněly. Nový povel začíná slovesem.
// Sloveso se ale do popisu NEPROMÍTÁ: „přehoď“ sice patří jen k výhybce, ale kdyby
// z něj šel odvodit díl, dítě by mohlo poslední slovo na cedulce vynechat.
function parseCommand(text) {
  const cmds = [];
  let cur = null;
  for (const tok of String(text || '').split(/\s+/)) {
    const m = matchToken(tok);
    if (!m) continue;
    if (m.cat === 'verb' || m.cat === 'screwverb') { cur = { verb: m.key, screw: m.cat === 'screwverb' }; cmds.push(cur); continue; }
    if (!cur) { cur = {}; cmds.push(cur); }
    if (m.cat === 'screw') cur.screw = true;
    else cur[m.cat] = m.key;
  }
  return cmds.filter((c) => Object.keys(c).length);
}
const matches = (p, desc) => ['type', 'color', 'size'].every((k) => desc[k] === undefined || p[k] === desc[k]);
const countMatching = (parts, desc) => parts.filter((p) => matches(p, desc)).length;

function resolve(cmd, parts) {
  if (cmd.screw) return { screw: true };
  const desc = {};
  for (const k of ['type', 'color', 'size']) if (cmd[k]) desc[k] = cmd[k];
  // Samotné sloveso: dítě řeklo „přehoď“ a dost. Robůtek neví CO.
  if (!Object.keys(desc).length) return { kind: cmd.verb ? 'what' : 'none' };
  const hits = parts.filter((p) => matches(p, desc));
  if (!hits.length) return { kind: 'none' };
  if (hits.length > 1) return { kind: 'many' };
  return { kind: 'one', part: hits[0] };
}

// ---------- generátor dráhy ----------
// Díly tvoří mřížku (typy × velikosti × barvy). Ke každému dílu tak existuje jiný,
// který se od něj liší právě jedním slovem – proto se žádné slovo na cedulce nedá
// vynechat ani uhodnout. Kdyby se díly losovaly nezávisle, tahle vlastnost by padla.
function gridSizes(K, T) {
  const types = Math.min(T.types, Object.keys(PARTS).length);
  const sizes = T.attrs.includes('size') ? 2 : 1;
  let colors = Math.round(K / (types * sizes));
  colors = clamp(colors, 2, Object.keys(ADJ.colors).length);
  return { types, sizes, colors };
}
function buildParts(T, K) {
  const g = gridSizes(K, T);
  const types = shuffle(Object.keys(PARTS)).slice(0, g.types);
  const sizes = g.sizes === 2 ? Object.keys(ADJ.sizes) : [pick(Object.keys(ADJ.sizes))];
  const colors = shuffle(Object.keys(ADJ.colors)).slice(0, g.colors);
  const out = [];
  for (const type of types) for (const size of sizes) for (const color of colors) out.push({ type, color, size });
  return shuffle(out);
}
function descOf(p, T) {
  const d = { type: p.type, color: p.color };
  if (T.attrs.includes('size')) d.size = p.size;
  return d;
}

// ---------- příšerka z koše ----------
const PALETTE = [['#ff8fab', '#e0527a'], ['#8ed6ff', '#3b9edb'], ['#b6e388', '#6db33f'], ['#ffd166', '#e0a020'], ['#c8a2ff', '#8d5be0'], ['#ffb26b', '#e07b2a'], ['#7fe3d6', '#2ab5a5']];
function monsterSVG(seed) {
  const r = mulberry32(seed);
  const [c1, c2] = PALETTE[Math.floor(r() * PALETTE.length)];
  const N = 8, pts = [];
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; const rad = 70 + r() * 18; pts.push([100 + Math.cos(a) * rad, 105 + Math.sin(a) * rad * 0.95]); }
  const mid = (i) => { const p = pts[i % N], q = pts[(i + 1) % N]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; };
  let d = `M${mid(0)[0]},${mid(0)[1]}`;
  for (let i = 1; i <= N; i++) { const q = pts[i % N], m = mid(i); d += ` Q${q[0]},${q[1]} ${m[0]},${m[1]}`; }
  d += 'Z';
  const eyes = 1 + Math.floor(r() * 3);
  const horn = Math.floor(r() * 4);
  let extras = '';
  if (horn === 1) extras += `<path d="M62,45 L70,12 L88,42 Z M138,45 L130,12 L112,42 Z" fill="${c2}"/>`;
  if (horn === 2) extras += `<path d="M80,40 C70,20 60,20 55,8 M120,40 C130,20 140,20 145,8" stroke="${c2}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="55" cy="8" r="8" fill="${c2}"/><circle cx="145" cy="8" r="8" fill="${c2}"/>`;
  if (horn === 3) extras += `<ellipse cx="45" cy="55" rx="16" ry="26" fill="${c1}" stroke="${c2}" stroke-width="4"/><ellipse cx="155" cy="55" rx="16" ry="26" fill="${c1}" stroke="${c2}" stroke-width="4"/>`;
  let eyeSvg = '';
  const eyeR = eyes === 1 ? 22 : eyes === 2 ? 15 : 12;
  const xs = eyes === 1 ? [100] : eyes === 2 ? [78, 122] : [70, 100, 130];
  xs.forEach((x, i) => {
    const y = eyes === 3 && i === 1 ? 62 : 78;
    eyeSvg += `<circle cx="${x}" cy="${y}" r="${eyeR}" fill="#fff"/><circle cx="${x + 3}" cy="${y + 3}" r="${eyeR * 0.5}" fill="#2b2137"/>`;
  });
  const mouth = `<path d="M70,118 Q100,160 130,118 Z" fill="#5a1f3a"/><ellipse cx="100" cy="140" rx="14" ry="8" fill="#ff7b9c"/>`;
  const feet = `<ellipse cx="78" cy="182" rx="18" ry="9" fill="${c2}"/><ellipse cx="122" cy="182" rx="18" ry="9" fill="${c2}"/>`;
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${feet}${extras}<path d="${d}" fill="${c1}" stroke="${c2}" stroke-width="5"/>${eyeSvg}${mouth}</svg>`;
}

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
  print: () => { beep(300, .05, 'square', .08); beep(340, .05, 'square', .08, .06); beep(300, .05, 'square', .08, .12); },
  fix: () => { beep(520, .06, 'square', .14); beep(700, .1, 'triangle', .12, .05); },
  roll: () => beep(90, .3, 'triangle', .05),
  drop: () => { beep(240, .12, 'triangle', .12); beep(150, .2, 'sine', .1, .1); },
  bell: () => { beep(1320, .35, 'sine', .18); beep(1760, .3, 'sine', .12, .08); },
  steam: () => { beep(1200, .5, 'sawtooth', .05); beep(900, .4, 'sawtooth', .04, .1); },
  shrug: () => { beep(400, .1, 'sine', .1); beep(300, .14, 'sine', .1, .1); },
  fanfare: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, .25, 'sine', .2, i * .12)),
};

// ---------- předčítání ----------
let czVoice = null;
function loadVoices() { const v = speechSynthesis.getVoices(); czVoice = v.find((x) => /^cs/i.test(x.lang)) || null; }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const wasOn = MIC.want;
  stopMic();                                   // ať rozpoznávač neslyší sám sebe
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'cs-CZ'; u.rate = 0.85; if (czVoice) u.voice = czVoice;
  u.onend = u.onerror = () => { if (wasOn && A.running) setTimeout(startMic, 250); };
  speechSynthesis.speak(u);
}

// ---------- mikrofon ----------
// Mikrofon si NEOTVÍRÁME sami (getUserMedia) – vlastní stream by rozpoznávači v Chrome
// sebral zvuk a ten by se jen pořád restartoval a pípal.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const MIC = { rec: null, want: false, live: false, dead: false, noPhrases: false, fails: 0 };
let micDeadReason = '';

function micUsable() { return !!SR && S.settings.mic && !MIC.dead; }
function micDeadLabel() {
  if (!SR) return 'Mikrofon tu nejde';
  if (micDeadReason === 'not-allowed') return 'Mikrofon nepovolen';
  if (micDeadReason === 'network') return 'Bez internetu neslyším';
  if (micDeadReason === 'language-not-supported') return 'Čeština tu nejde';
  return 'Mikrofon nejde';
}
function setMic(cls, label) {
  const b = $('#btn-mic'); if (b) b.className = 'mic ' + cls;
  const l = $('#mic-label'); if (l) l.textContent = label;
  const r = $('#robot'); if (r) r.classList.toggle('hears', cls.includes('live'));
}
function showHeard(text, interim) {
  const h = $('#heard'); if (!h) return;
  h.textContent = text ? (interim ? '… ' + text : text) : '';
}
function buildRec() {
  const rec = new SR();
  rec.lang = 'cs-CZ';
  // continuous: jedna dlouhá relace. S false se relace po každé pauze ukončí,
  // Chrome při každém dalším startu pípne a mezi starty je hluchý.
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 5;
  rec.onstart = () => { MIC.live = true; setMic('live', 'Robůtek poslouchá…'); };
  rec.onspeechstart = () => setMic('live hears', 'Slyší tě…');
  rec.onspeechend = () => setMic('live', 'Robůtek poslouchá…');
  rec.onnomatch = () => { MIC.fails++; };
  rec.onend = () => {
    MIC.live = false;
    if (MIC.want && A.running && MIC.fails < 8) { setTimeout(() => { if (MIC.want) tryStart(); }, 400); return; }
    if (MIC.fails >= 8) { MIC.want = false; A.tapOk = true; }
    setMic(MIC.dead ? 'dead' : 'off', MIC.dead ? micDeadLabel() : 'Ťukni a mluv');
  };
  rec.onerror = (e) => onMicError(e.error);
  rec.onresult = onMicResult;
  return rec;
}
function onMicError(err) {
  if (err === 'aborted') return;
  if (err === 'no-speech') { MIC.fails++; return; }
  if (err === 'phrases-not-supported') { MIC.noPhrases = true; return; }
  if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture' || err === 'network' || err === 'language-not-supported') {
    micDeadReason = err === 'service-not-allowed' || err === 'audio-capture' ? 'not-allowed' : err;
    MIC.dead = true; MIC.want = false; A.tapOk = true;
    setMic('dead', micDeadLabel());
  }
}
function applyPhrases(rec) {
  if (MIC.noPhrases || typeof SpeechRecognitionPhrase === 'undefined' || !('phrases' in rec)) return;
  try {
    const list = LEXICON.map((e) => new SpeechRecognitionPhrase(e.n, 2.0));
    try { rec.phrases = list; }
    catch { while (rec.phrases.length) rec.phrases.pop(); list.forEach((p) => rec.phrases.push(p)); }
  } catch { MIC.noPhrases = true; }
}
function tryStart() {
  if (!micUsable() || MIC.live || !A.running) return;
  if (!MIC.rec) MIC.rec = buildRec();
  applyPhrases(MIC.rec);
  try { MIC.rec.start(); } catch { /* už běží */ }
}
function startMic() { if (!micUsable()) { setMic('dead', micDeadLabel()); return; } MIC.want = true; MIC.fails = 0; tryStart(); }
function stopMic() {
  MIC.want = false;
  try { MIC.rec && MIC.rec.abort(); } catch { /* nic */ }
  MIC.live = false;
  setMic(MIC.dead ? 'dead' : 'off', MIC.dead ? micDeadLabel() : 'Ťukni a mluv');
}
function onMicResult(e) {
  const res = e.results[e.results.length - 1];
  MIC.fails = 0;
  const texts = [];
  for (let i = 0; i < res.length; i++) texts.push(res[i].transcript);
  if (!texts.length || !A.running || A.busy) return;
  if (!res.isFinal) { showHeard(texts[0].trim(), true); return; }
  showHeard(texts[0].trim(), false);
  for (const t of texts) {
    const cmds = parseCommand(t);
    if (cmds.length) { obey(cmds); return; }
  }
}

// ---------- stavba dráhy ----------
const G = { world: 0, tier: 0 };
const A = { parts: [], queue: [], step: 0, busy: false, running: false, tapOk: false, seed: 0, reach: 0 };

// Rozbitý díl musí být poznat z druhé strany pokoje. Nedělá to ztmavení, ale poloha:
// pohyblivý kus je v <g class="pmove"> a natáčí ho CSS podle tříd t-<typ> a part-broken.
// K tomu je v trase vidět díra – ta říká „tudy kulička neprojede“ líp než jakýkoli symbol.
function partShape(p) {
  const c = ADJ.colors[p.color], k = ADJ.sizes[p.size].k, r = 18 * k;
  const gap = `<g class="pgap"><rect x="${-r * 0.85}" y="-9" width="${r * 1.7}" height="18" fill="#f3e6d0"/>
      <path d="M${-r * 0.85},-9 l7,5 l-7,5 l7,5 M${r * 0.85},-9 l-7,5 l7,5 l-7,5" stroke="#c8b291" stroke-width="3" fill="none"/></g>`;
  const warn = `<g class="pwarn"><circle cy="${-r - 15}" r="11" fill="#fff" stroke="#e0443a" stroke-width="3"/>
      <path d="M0,${-r - 21} v7" stroke="#e0443a" stroke-width="3.5" stroke-linecap="round"/>
      <circle cy="${-r - 10.5}" r="2" fill="#e0443a"/></g>`;
  let move;
  if (p.type === 'switch') {
    move = `<rect x="${-r}" y="-4" width="${r * 2}" height="8" rx="4" fill="${c.hex}" stroke="${c.dark}" stroke-width="2"/>
            <path d="M${r * 0.5},0 L${r},0" stroke="${c.dark}" stroke-width="3"/>`;
  } else if (p.type === 'flap') {
    move = `<rect x="-4" y="${-r * 1.7}" width="8" height="${r * 1.7}" rx="4" fill="${c.hex}" stroke="${c.dark}" stroke-width="2"/>`;
  } else if (p.type === 'bridge') {
    move = `<rect x="${-r}" y="-5" width="${r * 2}" height="10" rx="3" fill="${c.hex}" stroke="${c.dark}" stroke-width="2"/>
            <path d="M${-r * 0.4},-5 v10 M${r * 0.4},-5 v10" stroke="${c.dark}" stroke-width="2"/>`;
  } else if (p.type === 'chute') {
    move = `<path d="M${-r},${-r * 0.6} L${-r * 0.6},7 L${r * 0.6},7 L${r},${-r * 0.6}" fill="none" stroke="${c.hex}" stroke-width="6" stroke-linejoin="round"/>`;
  } else {
    move = `<circle r="${r * 0.85}" fill="none" stroke="${c.hex}" stroke-width="6"/>
            <path d="M0,${-r * 0.85} V${r * 0.85} M${-r * 0.85},0 H${r * 0.85}" stroke="${c.hex}" stroke-width="4"/>`;
  }
  const pivot = p.type === 'wheel' ? `<circle r="3.5" fill="${c.dark}"/>` : `<circle r="5" fill="${c.dark}"/>`;
  return gap + `<g class="pmove">${move}</g>` + pivot + warn;
}

function buildScene() {
  const svg = $('#svg');
  svg.setAttribute('viewBox', TRACK.view);
  svg.innerHTML = TRACK.frame
    + `<path id="rail" class="rail" d="${TRACK.d}"/><path class="rail-in" d="${TRACK.d}"/>`
    + `<path id="rail-done" class="rail rail-done" d="${TRACK.d}" stroke-dasharray="0 99999"/>`;
  const rail = $('#rail'), len = rail.getTotalLength();
  A.len = len;
  A.parts.forEach((p) => {
    const pt = rail.getPointAtLength(p.at * len);
    const pt2 = rail.getPointAtLength(Math.min(len, p.at * len + 3));
    const ang = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180 / Math.PI;
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', `ctrl t-${p.type} part-broken`);
    g.setAttribute('transform', `translate(${pt.x},${pt.y}) rotate(${ang})`);
    g.innerHTML = partShape(p) + '<circle class="hit" r="26" fill="transparent"/>';
    g.onclick = () => { if (A.tapOk && !A.busy && A.running) obeyPart(p); };
    p.el = g; p.x = pt.x; p.y = pt.y;
    svg.appendChild(g);
  });
  const ball = document.createElementNS(SVGNS, 'circle');
  ball.setAttribute('id', 'ball'); ball.setAttribute('class', 'ball'); ball.setAttribute('r', TRACK.ballR);
  ball.setAttribute('cx', TRACK.start.x); ball.setAttribute('cy', TRACK.start.y);
  svg.appendChild(ball);
  const rb = document.createElementNS(SVGNS, 'g');
  rb.setAttribute('class', 'robot'); rb.setAttribute('id', 'robot');
  rb.innerHTML = ROBOT.svg;
  rb.style.transform = `translate(${TRACK.home.x}px, ${TRACK.home.y}px)`;
  svg.appendChild(rb);
}

// ---------- jízda kuličky ----------
function firstBroken() { return A.parts.find((p) => !p.ok) || null; }
function ballRun() {
  return new Promise((done) => {
    const rail = $('#rail'), ball = $('#ball');
    if (!rail || !ball) { done(); return; }
    const len = A.len;
    const stop = firstBroken();
    const end = stop ? stop.at * len : len;
    ball.classList.remove('fall');
    ball.style.transform = '';
    const t0 = performance.now(), speed = 260;      // px za sekundu
    sfx.roll();
    const stepFn = (ts) => {
      const l = Math.min(end, (ts - t0) / 1000 * speed);
      const pt = rail.getPointAtLength(l);
      ball.setAttribute('cx', pt.x); ball.setAttribute('cy', pt.y);
      $('#rail-done').setAttribute('stroke-dasharray', `${l} 99999`);
      A.reach = l / len;
      updateBar();
      if (l < end) { requestAnimationFrame(stepFn); return; }
      if (stop) { ball.classList.add('fall'); sfx.drop(); setTimeout(done, 900); }
      else { arrive().then(done); }
    };
    requestAnimationFrame(stepFn);
  });
}
function arrive() {
  return new Promise((done) => {
    const bell = $('#bell');
    if (bell) { bell.classList.remove('ring'); bell.getBoundingClientRect(); bell.classList.add('ring'); }
    sfx.bell();
    setTimeout(done, 700);
  });
}

// ---------- co robůtek udělá ----------
function say(text, ms = 1800) {
  const s = $('#say');
  s.hidden = false; s.textContent = text;
  clearTimeout(say._t);
  say._t = setTimeout(() => { s.hidden = true; }, ms);
}
// Robůtek jde přímo k dílu, ne po podlaze pod rámem – u dílu nahoře by jinak mával
// o tři sta pixelů níž a nebylo by poznat, co vlastně spravuje.
function moveTo(x, y) {
  const rb = $('#robot');
  rb.classList.add('walk');
  rb.style.transform = `translate(${clamp(x, 42, 398)}px, ${clamp(y, 74, TRACK.floor)}px)`;
  return new Promise((res) => setTimeout(() => { rb.classList.remove('walk'); res(); }, 520));
}
const goHome = () => moveTo(TRACK.home.x, TRACK.home.y);
function poke() {
  const rb = $('#robot');
  rb.classList.remove('poke'); rb.getBoundingClientRect(); rb.classList.add('poke');
  return new Promise((res) => setTimeout(res, 380));
}
function shrug() {
  const rb = $('#robot');
  rb.classList.remove('shrug'); rb.getBoundingClientRect(); rb.classList.add('shrug');
  sfx.shrug();
}
function steamAt(p) {
  const svg = $('#svg');
  for (let i = 0; i < 3; i++) {
    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('cx', p.x + (i - 1) * 10); c.setAttribute('cy', p.y - 16);
    c.setAttribute('r', 8 + i * 2); c.setAttribute('fill', '#fff'); c.setAttribute('opacity', '.85');
    c.setAttribute('class', 'spark');
    c.style.animationDelay = i * 0.1 + 's';
    svg.appendChild(c);
    setTimeout(() => c.remove(), 1000);
  }
  sfx.steam();
}

async function obey(cmds) {
  if (A.busy || !A.running) return;
  A.busy = true;
  try {
    const t = A.queue[0];
    for (const cmd of cmds) {
      const r = resolve(cmd, A.parts);
      if (r.screw) {
        if (t.kind === 'screw') { await fixScrew(); return; }
        say('Šroubek? Žádný tu neleží.'); shrug(); return;
      }
      if (t.kind === 'screw') { say('Napřed ten šroubek.'); shrug(); return; }
      if (r.kind === 'what') { say('A co? Řekni to celé.'); shrug(); return; }
      if (r.kind === 'none') { say('To tu nemám.'); shrug(); return; }
      if (r.kind === 'many') { say('Který? Je jich víc.'); shrug(); return; }
      const ok = await act(r.part);
      if (!ok) return;
      if (A.step >= t.descs.length) { await finishTicket(); return; }
    }
  } finally { A.busy = false; }
}
function obeyPart(p) {                           // ťuknutí místo hlasu (bez mikrofonu)
  if (A.busy || !A.running) return;
  const t = A.queue[0];
  if (t.kind === 'screw') { fixScrew(); return; }
  A.busy = true;
  act(p).then((ok) => { if (ok && A.step >= t.descs.length) return finishTicket(); }).finally(() => { A.busy = false; });
}

async function act(p) {
  await moveTo(p.x - 26, p.y + 32);      // postavit se k dílu, ne pod něj
  await poke();
  const t = A.queue[0];
  const want = t.descs[A.step];
  if (want && matches(p, want) && !p.ok) {
    p.ok = true;
    p.el.classList.remove('part-broken');
    p.el.classList.add('part-ok');
    sfx.fix();
    A.step++;
    return true;
  }
  steamAt(p);
  A.queue.unshift({ kind: 'screw' });            // šroubek se musí vrátit
  A.step = 0;
  say('Jejda!');
  setTimeout(showTicket, 600);
  return false;
}
async function fixScrew() {
  A.busy = true;
  await goHome();
  await poke();
  sfx.fix();
  A.queue.shift();
  A.step = 0;
  A.busy = false;
  showTicket();
}
async function finishTicket() {
  A.queue.shift();
  A.step = 0;
  $('#ticket').classList.add('gone');
  await goHome();                         // uhnout z trasy, ať je kulička vidět
  await ballRun();
  if (!A.queue.length) { win(); return; }
  showTicket();
}

// ---------- kolo ----------
function updateBar() {
  $('#bar').style.width = (100 * A.reach) + '%';
  const left = A.parts.filter((p) => !p.ok).length;
  $('#bar-text').textContent = left ? `zbývá dílů: ${left}` : 'projela!';
}
function showTicket() {
  const t = A.queue[0];
  if (!t) return;
  const el = $('#ticket');
  el.className = 'ticket ' + WORLDS[G.world].cls;
  $('#ticket-text').innerHTML = ticketHtml(t, G.world);
  void el.offsetWidth; el.classList.add('out');
  sfx.print();
}
function makeQueue(T) {
  const broken = A.parts.filter((p) => !p.ok);
  const q = [];
  for (let i = 0; i < broken.length; i += T.cmds) {
    const descs = broken.slice(i, i + T.cmds).map((p) => descOf(p, T));
    q.push({ kind: 'cmd', descs });
  }
  return q;
}
function startLevel(w, t) {
  G.world = w; G.tier = t;
  const T = TIERS[t];
  A.seed = rnd(1e9); A.step = 0; A.busy = false; A.reach = 0; A.tapOk = !micUsable();
  const K = clamp(+S.settings.goal || 6, 3, 8);
  const combos = buildParts(T, K);
  const slots = TRACK.slots.slice(0, combos.length);
  A.parts = combos.slice(0, slots.length).map((c, i) => Object.assign({}, c, { at: slots[i], ok: false }));
  // cedulky chodí v pořadí dráhy, takže každá oprava kuličku posune dál
  A.parts.sort((a, b) => a.at - b.at);
  A.queue = makeQueue(T);
  show('game');
  buildScene();
  updateBar();
  showHeard('', false);
  $('#say').hidden = true;
  $('#micbar').hidden = false;
  A.running = true;
  showTicket();
  if (micUsable()) startMic();
}
function win() {
  A.running = false; stopMic(); sfx.fanfare();
  const k = levelKey(G.world, G.tier);
  const prev = winsFor(k);
  S.progress[k] = { wins: prev + 1 }; save();
  const i = levelOrder.indexOf(k);
  const unlockedNext = !S.settings.unlock && prev === 0 && i + 1 < levelOrder.length;
  $('#done-icon').textContent = '🔔';
  $('#done-title').textContent = 'Kulička projela!';
  $('#done-text').textContent = (unlockedNext ? '🔓 Odemkl se další level! ' : '') + `Robůtek spravil ${A.parts.length} dílů a z koše vylezla tahle:`;
  $('#done-made').innerHTML = monsterSVG(A.seed);
  setTimeout(() => $('#modal-done').classList.add('open'), 500);
}

// ---------- obrazovky ----------
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id)); }
function renderHome() {
  const warn = $('#mic-warn');
  if (!SR) { warn.hidden = false; warn.textContent = '🎤 Tenhle prohlížeč neumí rozpoznávat řeč, takže robůtek neuslyší. Díly půjde ťuknout. Nejlíp funguje Chrome.'; }
  else if (!window.isSecureContext) { warn.hidden = false; warn.textContent = '🎤 Mikrofon funguje jen na zabezpečené stránce (https) nebo na localhost. Tady se ťuká.'; }
  else warn.hidden = true;

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

// ---------- ovládání ----------
$('#btn-mic').onclick = () => {
  if (MIC.dead) { A.tapOk = true; say('Ťukni na díl sám.'); return; }
  if (MIC.want) stopMic(); else startMic();
};
$('#btn-next').onclick = () => { $('#modal-done').classList.remove('open'); startLevel(G.world, G.tier); };
$('#btn-home').onclick = () => { $('#modal-done').classList.remove('open'); leaveGame(); };
$('#btn-back').onclick = () => leaveGame();
$('#btn-speak').onclick = () => { const t = A.queue[0]; if (t) speak(ticketPlain(t)); };
$('#ticket').onclick = () => { const t = A.queue[0]; if (t && S.settings.tts) speak(ticketPlain(t)); };
function leaveGame() {
  A.running = false; stopMic();
  try { speechSynthesis.cancel(); } catch { /* nic */ }
  renderHome(); show('home');
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { A.running = false; stopMic(); }
  else if ($('#game').classList.contains('active') && !document.querySelector('.modal.open')) { A.running = true; if (micUsable()) startMic(); }
});

// ---------- nápověda ----------
$('#btn-help').onclick = () => { $('#modal-help').classList.add('open'); stopMic(); };
$('#help-close').onclick = () => { $('#modal-help').classList.remove('open'); if ($('#game').classList.contains('active') && micUsable()) startMic(); };

// ---------- rodič ----------
let gateAnswer = 0;
$('#btn-parent').onclick = () => {
  const a = 3 + rnd(7), b = 3 + rnd(7); gateAnswer = a + b;
  $('#gate-q').textContent = `${a} + ${b}`; $('#gate-a').value = '';
  $('#parent-gate').hidden = false; $('#parent-panel').hidden = true;
  $('#modal-parent').classList.add('open'); setTimeout(() => $('#gate-a').focus(), 50);
};
$('#gate-cancel').onclick = () => $('#modal-parent').classList.remove('open');
$('#gate-ok').onclick = () => { if (+$('#gate-a').value === gateAnswer) openParent(); else { $('#gate-a').value = ''; sfx.shrug(); } };
$('#gate-a').onkeydown = (e) => { if (e.key === 'Enter') $('#gate-ok').click(); };
function openParent() {
  $('#parent-gate').hidden = true; $('#parent-panel').hidden = false;
  $('#opt-mic').checked = S.settings.mic; $('#opt-strict').value = String(S.settings.strict);
  $('#opt-goal').value = S.settings.goal;
  $('#opt-syll').checked = S.settings.syll; $('#opt-tts').checked = S.settings.tts;
  $('#opt-sound').checked = S.settings.sound; $('#opt-unlock').checked = S.settings.unlock;
}
$('#parent-close').onclick = () => {
  S.settings = {
    mic: $('#opt-mic').checked, strict: clamp(+$('#opt-strict').value || 0, 0, 2),
    goal: clamp(+$('#opt-goal').value || 6, 3, 8),
    syll: $('#opt-syll').checked, tts: $('#opt-tts').checked, sound: $('#opt-sound').checked, unlock: $('#opt-unlock').checked,
  };
  save();
  $('#modal-parent').classList.remove('open');
  if (!S.settings.mic) { stopMic(); A.tapOk = true; }
  renderHome();
};
$('#btn-reset').onclick = () => { if (confirm('Opravdu smazat všechen postup?')) { localStorage.removeItem(KEY); S = load(); $('#modal-parent').classList.remove('open'); renderHome(); } };

// ---------- start ----------
renderHome();
// Ochrana proti zoomu dvojklikem na iOS
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
