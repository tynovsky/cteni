/* Robůtek – kuličková dráha. Kulička dojede k zaseknuté sestavě, robůtek k ní dojde,
   obraz se přiblíží a dítě mu nahlas přečte, co má udělat. */
'use strict';

// ---------- util ----------
const $ = (s, r = document) => r.querySelector(s);
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const SVGNS = 'http://www.w3.org/2000/svg';
const letters = (w) => w.replace(/-/g, '');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- perzistence ----------
const KEY = 'robutek-v1';
const DEFAULTS = { settings: { sound: true, unlock: false, goal: 5, mic: true, strict: 1 }, progress: {} };
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
// Level přidává rodinu povelů, ne delší slova.
const TIERS = [
  { name: 'Barva', icon: '🐣', kinds: ['levers'], fams: ['color'] },
  { name: 'Poloha', icon: '🐥', kinds: ['levers'], fams: ['color', 'pos'] },
  { name: 'Počet', icon: '🐔', kinds: ['levers', 'wheel'], fams: ['color', 'pos', 'count'] },
  { name: 'Směr', icon: '📖', kinds: ['levers', 'wheel', 'points'], fams: ['color', 'pos', 'count', 'dir'] },
];
const levelKey = (w, t) => `${w}-${t}`;
const levelOrder = [];
WORLDS.forEach((_, w) => TIERS.forEach((_, t) => levelOrder.push(levelKey(w, t))));
function winsFor(k) { return (S.progress[k] || {}).wins || 0; }
function stars(k) { const c = winsFor(k); return c >= 6 ? 3 : c >= 3 ? 2 : c >= 1 ? 1 : 0; }
function isUnlocked(k) { if (S.settings.unlock) return true; const i = levelOrder.indexOf(k); return i === 0 || winsFor(levelOrder[i - 1]) >= 1; }

// ---------- úloha zblízka ----------
// Kandidáti musí být rovnocenní: žádný ovladač nesmí být v obrázku zvýhodněný,
// jinak jde úloha vyřešit bez čtení. Porouchaná je celá sestava, ne ovladač.
//  color – ovladače se liší barvou, žádný není označený
//  pos   – ovladače jsou STEJNÉ barvy, rozhoduje jedině pořadí
//  count – kolik otáček; číslo v obrázku není
//  dir   – kam přehodit; obě větve vypadají stejně schůdně
function makeTask(kind, fams) {
  const R = RIGS[kind];
  const by = pick(R.by.filter((f) => fams.includes(f))) || R.by[0];
  const cols = Object.keys(ADJ.colors);
  if (by === 'color') {
    const c = shuffle(cols).slice(0, R.slots.length);
    const i = rnd(c.length);
    return { kind, by, colors: c, target: i, cue: { cat: 'color', key: c[i] } };
  }
  if (by === 'pos') {
    const one = pick(cols);
    const keys = ['first', 'middle', 'last'];
    const i = rnd(R.slots.length);
    return { kind, by, colors: R.slots.map(() => one), target: i, cue: { cat: 'pos', key: keys[i] } };
  }
  if (by === 'count') {
    const keys = ['one', 'two', 'three'];
    const i = rnd(keys.length);
    return { kind, by, colors: [pick(cols)], target: 0, need: i + 1, turns: 0, cue: { cat: 'count', key: keys[i] } };
  }
  const keys = ['left', 'right'];
  const i = rnd(keys.length);
  return { kind, by, colors: [pick(cols)], target: 0, cue: { cat: 'dir', key: keys[i] } };
}

// Cedulka po slovech i s významem – podle něj se pozná, co dítě už přečetlo.
function taskWords(task) {
  const R = RIGS[task.kind], g = R.noun.g;
  const out = [{ w: R.verb, cat: 'verb', key: task.kind }];
  if (task.by === 'color') out.push({ w: ADJ.colors[task.cue.key][g], cat: 'color', key: task.cue.key });
  if (task.by === 'pos') out.push({ w: CUES.pos[task.cue.key], cat: 'pos', key: task.cue.key });
  out.push({ w: R.noun.acc, cat: 'noun', key: task.kind });
  if (task.by === 'count') out.push({ w: CUES.count[task.cue.key], cat: 'count', key: task.cue.key });
  if (task.by === 'dir') out.push({ w: CUES.dir[task.cue.key], cat: 'dir', key: task.cue.key });
  return out;
}
const screwWords = () => [{ w: SCREW.verb, cat: 'screwverb', key: 'vrat' }, { w: SCREW.w, cat: 'screw', key: 'screw' }];
function ticketWords(t) { return t.kind === 'screw' ? screwWords() : taskWords(t.task); }

// Slovo se ukazuje vcelku – žádné dělení na slabiky.
function wordHtml(w, world) { return WORLDS[world].fmt(letters(w)); }
function ticketHtml(t, world) {
  return ticketWords(t).map((x, i) => `<span class="tw" data-i="${i}">${wordHtml(x.w, world)}</span>`).join(' ');
}
function ticketPlain(t) { return ticketWords(t).map((x) => letters(x.w)).join(' '); }

// Podtrhává se, co rozpoznávač zachytil. Značky se jen přidávají, takže neblikají.
function markSpan(i) { const el = $(`#ticket-text .tw[data-i="${i}"]`); if (el) el.classList.add('read'); }
function markHeard(text) {
  if (!A.words || !A.words.length) return;
  for (const tok of String(text || '').split(/\s+/)) {
    const m = matchToken(tok);
    if (!m) continue;
    const i = A.words.findIndex((w, idx) => !A.marked.has(idx) && w.cat === m.cat && w.key === m.key);
    if (i >= 0) { A.marked.add(i); markSpan(i); }
  }
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
// Tvary téhož slova (modrý/modrou/modré) ukazují na stejný klíč, takže shoda mezi
// nimi není nejednoznačnost. Proto se při remíze porovnávají klíče, ne tvary.
const LEXICON = (() => {
  const out = [], seen = new Set();
  const add = (cat, key, w) => { const n = norm(letters(w)); const id = `${cat}:${key}:${n}`; if (n && !seen.has(id)) { seen.add(id); out.push({ cat, key, n }); } };
  for (const [k, v] of Object.entries(ADJ.colors)) for (const g of ['m', 'f', 'n']) add('color', k, v[g]);
  for (const [cat, table] of Object.entries(CUES)) for (const [k, w] of Object.entries(table)) add(cat, k, w);
  for (const [k, R] of Object.entries(RIGS)) { add('verb', k, R.verb); add('noun', k, R.noun.acc); add('noun', k, R.noun.nom); }
  add('screwverb', 'vrat', SCREW.verb);
  add('screw', 'screw', SCREW.w);
  return out;
})();
function matchToken(tok) {
  const h = norm(tok);
  if (!h) return null;
  let best = null, bd = Infinity, sd = Infinity;
  for (const e of LEXICON) {
    const d = lev(h, e.n);
    const sameAsBest = best && best.cat === e.cat && best.key === e.key;
    if (d < bd) { if (!sameAsBest) sd = bd; bd = d; best = e; }
    else if (!sameAsBest && d < sd) sd = d;
  }
  if (!best || bd > tol(best.n.length)) return null;
  if (sd === bd) return null;                     // dvě různá slova stejně blízko → radši nic
  return best;
}
function parseCommand(text) {
  const cmd = {};
  for (const tok of String(text || '').split(/\s+/)) {
    const m = matchToken(tok);
    if (!m) continue;
    if (m.cat === 'screwverb') { cmd.screw = true; continue; }
    if (m.cat === 'screw') { cmd.screw = true; continue; }
    if (cmd[m.cat] === undefined) cmd[m.cat] = m.key;
  }
  return cmd;
}
// Co robůtek z povelu pochopí. Rozhoduje JEN to slovo, které úlohu rozlišuje –
// sloveso a jméno dílu jsou v cedulce kvůli slovní zásobě, informaci nenesou
// (zblízka je vidět jen jedna sestava).
function resolve(cmd, task) {
  if (cmd.screw) return { screw: true };
  const cue = task.cue;
  const said = cmd[cue.cat];
  if (said === undefined) return { kind: Object.keys(cmd).length ? 'what' : 'none' };
  if (said === cue.key) return { kind: 'right' };
  return { kind: 'wrong', said };
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
  fix: () => { beep(420, .07, 'square', .12); beep(620, .09, 'square', .12, .07); beep(880, .16, 'triangle', .16, .15); },
  clack: () => beep(300, .06, 'square', .13),
  roll: () => beep(90, .3, 'triangle', .05),
  drop: () => { beep(240, .12, 'triangle', .12); beep(150, .2, 'sine', .1, .1); },
  bell: () => { beep(1320, .35, 'sine', .18); beep(1760, .3, 'sine', .12, .08); },
  pop: () => [0, 1, 2, 3].forEach((i) => beep(760 + i * 240, .09, 'triangle', .13, i * 0.055)),
  steam: () => { beep(1200, .5, 'sawtooth', .05); beep(900, .4, 'sawtooth', .04, .1); },
  shrug: () => { beep(400, .1, 'sine', .1); beep(300, .14, 'sine', .1, .1); },
  fanfare: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, .25, 'sine', .2, i * .12)),
};

// Předčítání tu schválně NENÍ. Tlačítko s reproduktorem by cedulku přečetlo za dítě
// a to by ji jen zopakovalo – čtení by šlo obejít, a na tom celá hra stojí.

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
  rec.continuous = true;          // jedna dlouhá relace; s false Chrome při každém startu pípne
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
  if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported'].includes(err)) {
    micDeadReason = (err === 'service-not-allowed' || err === 'audio-capture') ? 'not-allowed' : err;
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
  markHeard(texts[0]);
  if (!res.isFinal) { showHeard(texts[0].trim(), true); return; }
  showHeard(texts[0].trim(), false);
  for (const t of texts) {
    const cmd = parseCommand(t);
    if (Object.keys(cmd).length) { obey(cmd); return; }
  }
}

// ---------- stavba dráhy ----------
const G = { world: 0, tier: 0 };
const A = { rigs: [], cur: null, ticket: null, done: 0, reach: 0, busy: true, running: false, tapOk: false, seed: 0, len: 1, words: [], marked: new Set() };

// Sestava se kreslí stejně v celku i zblízka – přiblížení je zoom téže kresby.
function rigShape(rig) {
  const R = RIGS[rig.kind], t = rig.task;
  let inner = '';
  if (rig.kind === 'levers') {
    inner = R.slots.map((s, i) => {
      const c = ADJ.colors[t.colors[i]];
      return `<g class="sub" data-i="${i}"><rect x="${s.x - 4}" y="-30" width="8" height="30" rx="4" fill="${c.hex}" stroke="${c.dark}" stroke-width="2"/>
              <circle cx="${s.x}" cy="-32" r="6" fill="${c.hex}" stroke="${c.dark}" stroke-width="2"/></g>`;
    }).join('');
    inner += `<rect x="-52" y="-2" width="104" height="8" rx="4" fill="#8b9bb0"/>`;
  } else if (rig.kind === 'wheel') {
    const c = ADJ.colors[t.colors[0]];
    inner = `<g class="sub" data-i="0"><circle r="24" fill="none" stroke="${c.hex}" stroke-width="7"/>
             <path d="M0,-24 V24 M-24,0 H24" stroke="${c.hex}" stroke-width="5"/><circle r="4" fill="${c.dark}"/></g>`;
    // tečky ukazují PROVEDENÉ otáčky, ne požadované – jinak by číslo šlo opsat z obrázku
    inner += [0, 1, 2].map((i) => `<circle class="turn" data-t="${i}" cx="${-14 + i * 14}" cy="36" r="4" fill="#4fae55"/>`).join('');
  } else {
    const c = ADJ.colors[t.colors[0]];
    inner = `<path d="M-36,10 L0,0 L36,-10 M0,0 L36,14" stroke="#b08a5a" stroke-width="6" fill="none" stroke-linecap="round"/>
             <g class="sub" data-i="0"><rect x="-3" y="-22" width="6" height="24" rx="3" fill="${c.hex}" stroke="${c.dark}" stroke-width="2"/>
             <circle cy="-24" r="6" fill="${c.hex}" stroke="${c.dark}" stroke-width="2"/></g><circle r="4" fill="#8b9bb0"/>`;
  }
  return `<rect class="rigbox" x="-54" y="-46" width="108" height="92" rx="10" fill="none" stroke="#e0443a" stroke-width="3"/>` + inner;
}

function buildScene() {
  const svg = $('#svg');
  svg.setAttribute('viewBox', TRACK.view);
  CAM.cur = null;
  svg.innerHTML = TRACK.frame
    + `<path id="rail" class="rail" d="${TRACK.d}"/><path class="rail-in" d="${TRACK.d}"/>`
    + `<path id="rail-done" class="rail rail-done" d="${TRACK.d}" stroke-dasharray="0 99999"/>`;
  const rail = $('#rail');
  A.len = rail.getTotalLength();
  A.rigs.forEach((rig) => {
    const pt = rail.getPointAtLength(rig.at * A.len);
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'rig jam');
    g.setAttribute('transform', `translate(${pt.x},${pt.y - 8}) scale(.55)`);
    g.innerHTML = rigShape(rig);
    rig.el = g; rig.x = pt.x; rig.y = pt.y;
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

// ---------- kamera ----------
// Přiblížení je zoom, ne střih: je to pořád táž kresba, jen větší. viewBox nejde
// animovat přes CSS, takže se interpoluje ručně.
const CAM = { raf: 0, cur: null };
function parseView(s) { const [x, y, w, h] = String(s).split(/[\s,]+/).map(Number); return { x, y, w, h }; }
// Výřez se dopočítá podle poměru stran plochy, jinak by zoom obraz ořízl jinak,
// než by člověk čekal.
function fitBox(cx, cy, w, h) {
  const full = parseView(TRACK.view);
  const svg = $('#svg');
  const r = svg && svg.getBoundingClientRect ? svg.getBoundingClientRect() : null;
  const aspect = (r && r.width && r.height) ? r.width / r.height : full.w / full.h;
  let bw = w, bh = h;
  if (bw / bh > aspect) bh = bw / aspect; else bw = bh * aspect;
  bw = Math.min(bw, full.w); bh = Math.min(bh, full.h);
  return { x: clamp(cx - bw / 2, full.x, full.x + full.w - bw), y: clamp(cy - bh / 2, full.y, full.y + full.h - bh), w: bw, h: bh };
}
function camTo(box, ms = 620) {
  const svg = $('#svg');
  if (!svg) return Promise.resolve();
  const from = CAM.cur || parseView(TRACK.view);
  cancelAnimationFrame(CAM.raf);
  return new Promise((done) => {
    let fin = false;
    const set = (b) => { svg.setAttribute('viewBox', `${b.x.toFixed(2)} ${b.y.toFixed(2)} ${b.w.toFixed(2)} ${b.h.toFixed(2)}`); CAM.cur = b; };
    const finish = () => { if (fin) return; fin = true; set(box); done(); };
    const t0 = performance.now();
    const step = (ts) => {
      if (fin) return;
      const k = clamp((ts - t0) / ms, 0, 1);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      set({ x: from.x + (box.x - from.x) * e, y: from.y + (box.y - from.y) * e, w: from.w + (box.w - from.w) * e, h: from.h + (box.h - from.h) * e });
      if (k < 1) CAM.raf = requestAnimationFrame(step); else finish();
    };
    CAM.raf = requestAnimationFrame(step);
    setTimeout(finish, ms + 150);            // pojistka, když rAF neběží (skrytá záložka)
  });
}
const camWide = (ms) => { $('#game').classList.remove('zoomed'); return camTo(parseView(TRACK.view), ms === undefined ? 620 : ms); };
const camRig = (rig, ms) => { $('#game').classList.add('zoomed'); return camTo(fitBox(rig.x, rig.y - 10, 160, 140), ms === undefined ? 660 : ms); };

// ---------- jízda kuličky ----------
function ballRun() {
  return new Promise((done) => {
    const rail = $('#rail'), ball = $('#ball');
    if (!rail || !ball) { done(); return; }
    const stop = A.rigs.find((r) => !r.ok);
    const end = stop ? stop.at * A.len : A.len;
    ball.classList.remove('fall');
    const t0 = performance.now(), speed = 260;
    sfx.roll();
    // Slib se MUSÍ splnit vždycky: na něm visí celá smyčka jízda → oprava → jízda.
    // Když rAF přestane chodit uprostřed jízdy (skrytá záložka), hra by jinak ztuhla.
    let fin = false;
    const finish = () => { if (fin) return; fin = true; done(); };
    const step = (ts) => {
      if (fin) return;
      const l = Math.min(end, (ts - t0) / 1000 * speed);
      const pt = rail.getPointAtLength(l);
      ball.setAttribute('cx', pt.x); ball.setAttribute('cy', pt.y);
      $('#rail-done').setAttribute('stroke-dasharray', `${l} 99999`);
      A.reach = l / A.len; updateBar();
      if (l < end) { requestAnimationFrame(step); return; }
      if (stop) { ball.classList.add('fall'); sfx.drop(); setTimeout(finish, 900); }
      else arrive().then(finish);
    };
    requestAnimationFrame(step);
    setTimeout(finish, 9000);
  });
}
const CONFETTI_COLORS = ['#e0443a', '#3b82d6', '#f0c040', '#4fae55', '#ff8fab', '#8d5be0', '#2ab5a5'];
function confetti(x, y, n = 34) {
  const svg = $('#svg');
  if (!svg) return;
  for (let i = 0; i < n; i++) {
    const w = 5 + rnd(5), h = 7 + rnd(6);
    const c = document.createElementNS(SVGNS, 'rect');
    c.setAttribute('x', x - w / 2); c.setAttribute('y', y - h / 2);
    c.setAttribute('width', w); c.setAttribute('height', h); c.setAttribute('rx', 1.5);
    c.setAttribute('fill', pick(CONFETTI_COLORS));
    c.setAttribute('class', 'confetto');
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const dist = 55 + Math.random() * 120;
    c.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
    c.style.setProperty('--up', (-45 - Math.random() * 80).toFixed(1) + 'px');
    c.style.setProperty('--dy', (75 + Math.random() * 95).toFixed(1) + 'px');
    c.style.setProperty('--rot', (Math.random() * 1080 - 540).toFixed(0) + 'deg');
    c.style.animationDelay = (Math.random() * 0.28).toFixed(2) + 's';
    svg.appendChild(c);
    setTimeout(() => c.remove(), 2400);
  }
}
function arrive() {
  return new Promise((done) => {
    const bell = $('#bell');
    if (bell) { bell.classList.remove('ring'); bell.getBoundingClientRect(); bell.classList.add('ring'); }
    sfx.bell(); sfx.pop();
    confetti(TRACK.basket.x, TRACK.basket.y - 10);
    setTimeout(() => confetti(TRACK.basket.x, TRACK.basket.y - 10, 18), 320);
    setTimeout(done, 1200);
  });
}

// ---------- robůtek ----------
function say(text, ms = 1800) {
  const s = $('#say');
  if (!s) return;
  s.hidden = false; s.textContent = text;
  clearTimeout(say._t);
  say._t = setTimeout(() => { s.hidden = true; }, ms);
}
function moveTo(x, y) {
  const rb = $('#robot');
  if (!rb) return Promise.resolve();
  rb.classList.add('walk');
  rb.style.transform = `translate(${clamp(x, 42, 398)}px, ${clamp(y, 74, TRACK.floor)}px)`;
  return wait(520).then(() => rb.classList.remove('walk'));
}
const goHome = () => moveTo(TRACK.home.x, TRACK.home.y);
function poke() {
  const rb = $('#robot');
  if (!rb) return Promise.resolve();
  rb.classList.remove('poke'); rb.getBoundingClientRect(); rb.classList.add('poke');
  return wait(380);
}
function shrug() {
  const rb = $('#robot');
  if (!rb) return;
  rb.classList.remove('shrug'); rb.getBoundingClientRect(); rb.classList.add('shrug');
  sfx.shrug();
}
function steamAt(rig) {
  const svg = $('#svg');
  if (!svg) return;
  for (let i = 0; i < 3; i++) {
    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('cx', rig.x + (i - 1) * 10); c.setAttribute('cy', rig.y - 16);
    c.setAttribute('r', 8 + i * 2); c.setAttribute('fill', '#fff'); c.setAttribute('opacity', '.85');
    c.setAttribute('class', 'spark');
    c.style.animationDelay = i * 0.1 + 's';
    svg.appendChild(c);
    setTimeout(() => c.remove(), 1000);
  }
  sfx.steam();
}

// ---------- co robůtek udělá ----------
async function obey(cmd) {
  if (A.busy || !A.running || !A.cur) return;
  const t = A.ticket;
  A.busy = true;
  try {
    if (t.kind === 'screw') {
      if (!cmd.screw) { say('Napřed ten šroubek.'); shrug(); return; }
      await poke(); sfx.fix();
      A.ticket = { kind: 'cmd', task: A.cur.task };
      showTicket();
      return;
    }
    if (cmd.screw) { say('Šroubek? Žádný tu neleží.'); shrug(); return; }
    const r = resolve(cmd, A.cur.task);
    if (r.kind === 'none') { say('To neznám.'); shrug(); return; }
    if (r.kind === 'what') { say('A co? Řekni to celé.'); shrug(); return; }
    if (r.kind === 'right') { await doRight(); return; }
    await doWrong(r.said);
  } finally { if (A.ticket) A.busy = false; }
}

async function doRight() {
  const rig = A.cur, t = rig.task;
  await poke();
  if (t.by === 'count') {
    for (let i = 0; i < t.need; i++) {
      const dot = $(`#svg .rig .turn[data-t="${i}"]`);
      if (dot) dot.classList.add('on');
      sfx.clack();
      await wait(260);
    }
  } else {
    const sub = rig.el.querySelector(`.sub[data-i="${t.target}"]`);
    if (sub) sub.classList.add('done');
  }
  sfx.fix();
  rig.ok = true; A.done++;
  rig.el.classList.remove('jam');
  await wait(500);
  await camWide();
  await goHome();
  await ballRun();
  beginRig();
}
async function doWrong(said) {
  const rig = A.cur;
  await poke();
  if (rig.task.by === 'count') {
    const n = { one: 1, two: 2, three: 3 }[said] || 1;
    for (let i = 0; i < n; i++) { const d = $(`#svg .rig .turn[data-t="${i}"]`); if (d) d.classList.add('on'); sfx.clack(); await wait(220); }
    await wait(200);
    [0, 1, 2].forEach((i) => { const d = $(`#svg .rig .turn[data-t="${i}"]`); if (d) d.classList.remove('on'); });
  }
  steamAt(rig);
  say('Jejda!');
  A.ticket = { kind: 'screw' };
  showTicket();
}

// ---------- kolo ----------
function updateBar() {
  $('#bar').style.width = (100 * A.reach) + '%';
  const left = A.rigs.filter((r) => !r.ok).length;
  $('#bar-text').textContent = left ? `zbývá sestav: ${left}` : 'projela!';
}
function showTicket() {
  const t = A.ticket;
  if (!t) return;
  const el = $('#ticket');
  el.className = 'ticket ' + WORLDS[G.world].cls;
  A.words = ticketWords(t); A.marked = new Set();
  $('#ticket-text').innerHTML = ticketHtml(t, G.world);
  el.getBoundingClientRect(); el.classList.add('out');
  sfx.print();
}
async function beginRig() {
  A.busy = true;
  A.cur = A.rigs.find((r) => !r.ok) || null;
  if (!A.cur) { win(); return; }
  await moveTo(A.cur.x - 30, A.cur.y + 40);
  await camRig(A.cur);
  A.ticket = { kind: 'cmd', task: A.cur.task };
  showTicket();
  A.busy = false;
}
function startLevel(w, t) {
  G.world = w; G.tier = t;
  const T = TIERS[t];
  A.seed = rnd(1e9); A.done = 0; A.reach = 0; A.busy = true; A.tapOk = !micUsable(); A.cur = null; A.ticket = null;
  const n = clamp(+S.settings.goal || 5, 3, TRACK.slots.length);
  A.rigs = TRACK.slots.slice(0, n).map((at) => {
    const kind = pick(T.kinds);
    return { kind, at, ok: false, task: makeTask(kind, T.fams), el: null, x: 0, y: 0 };
  });
  show('game');
  buildScene();
  updateBar();
  showHeard('', false);
  $('#say').hidden = true;
  $('#micbar').hidden = false;
  A.running = true;
  if (micUsable()) startMic();
  ballRun().then(beginRig);
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
  $('#done-text').textContent = (unlockedNext ? '🔓 Odemkl se další level! ' : '') + `Robůtek spravil ${A.done} sestav a z koše vylezla tahle:`;
  $('#done-made').innerHTML = monsterSVG(A.seed);
  setTimeout(() => $('#modal-done').classList.add('open'), 500);
}

// ---------- obrazovky ----------
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id)); }
function renderHome() {
  const warn = $('#mic-warn');
  if (!SR) { warn.hidden = false; warn.textContent = '🎤 Tenhle prohlížeč neumí rozpoznávat řeč, takže robůtek neuslyší. Nejlíp funguje Chrome.'; }
  else if (!window.isSecureContext) { warn.hidden = false; warn.textContent = '🎤 Mikrofon funguje jen na zabezpečené stránce (https) nebo na localhost.'; }
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
  if (MIC.dead) { A.tapOk = true; say('Mikrofon nejde.'); return; }
  if (MIC.want) stopMic(); else startMic();
};
$('#btn-next').onclick = () => { $('#modal-done').classList.remove('open'); startLevel(G.world, G.tier); };
$('#btn-home').onclick = () => { $('#modal-done').classList.remove('open'); leaveGame(); };
$('#btn-back').onclick = () => leaveGame();
function leaveGame() {
  A.running = false; A.busy = true; stopMic();
  $('#game').classList.remove('zoomed');
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
  $('#opt-sound').checked = S.settings.sound; $('#opt-unlock').checked = S.settings.unlock;
}
$('#parent-close').onclick = () => {
  S.settings = {
    mic: $('#opt-mic').checked, strict: clamp(+$('#opt-strict').value || 0, 0, 2),
    goal: clamp(+$('#opt-goal').value || 5, 3, 8),
    sound: $('#opt-sound').checked, unlock: $('#opt-unlock').checked,
  };
  save();
  $('#modal-parent').classList.remove('open');
  if (!S.settings.mic) { stopMic(); A.tapOk = true; }
  renderHome();
};
$('#btn-reset').onclick = () => { if (confirm('Opravdu smazat všechen postup?')) { localStorage.removeItem(KEY); S = load(); $('#modal-parent').classList.remove('open'); renderHome(); } };

// ---------- start ----------
renderHome();
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
