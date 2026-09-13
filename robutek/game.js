/* Robůtek – dítě čte povel nahlas, robot ho provede. Vanilla JS, bez závislostí. */
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
  settings: { syll: true, tts: true, sound: true, unlock: false, goal: 8, mic: true, strict: 1 },
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
  { name: 'Jedno slovo', icon: '🐣', nouns: ['button'], attrs: ['color'], n: 5, cmds: 1 },
  { name: 'Dvě slova', icon: '🐥', nouns: ['button'], attrs: ['color', 'size'], n: 6, cmds: 1 },
  { name: 'Víc věcí', icon: '🐔', nouns: ['button', 'wheel', 'lever', 'lamp', 'lid'], attrs: ['color', 'size'], n: 8, cmds: 1 },
  { name: 'Dva povely', icon: '📖', nouns: ['button', 'wheel', 'lever', 'lamp', 'lid'], attrs: ['color', 'size'], n: 8, cmds: 2 },
];
const levelKey = (w, t) => `${w}-${t}`;
const levelOrder = [];
WORLDS.forEach((_, w) => TIERS.forEach((_, t) => levelOrder.push(levelKey(w, t))));
function winsFor(k) { return (S.progress[k] || {}).wins || 0; }
function stars(k) { const c = winsFor(k); return c >= 6 ? 3 : c >= 3 ? 2 : c >= 1 ? 1 : 0; }
function isUnlocked(k) { if (S.settings.unlock) return true; const i = levelOrder.indexOf(k); return i === 0 || winsFor(levelOrder[i - 1]) >= 1; }

// ---------- generátor kola ----------
// Dvě podmínky, bez kterých by se dalo hádat místo čtení:
//   1. jednoznačnost – celému popisu vyhovuje právě jeden ovladač
//   2. každé slovo nosné – vyškrtnutím kteréhokoli slova vzniknou aspoň dva kandidáti
//      (tedy: k „MALÉ ČERVENÉ TLAČÍTKO“ je na stroji i velké červené a malé modré)
const COLORS = Object.keys(VOCAB.colors);
const SIZES = Object.keys(VOCAB.sizes);
const SHAPES = Object.keys(VOCAB.shapes);
const sameDesc = (a, b) => a.noun === b.noun && a.color === b.color && a.size === b.size && a.shape === b.shape;
function matches(c, desc) {
  for (const k of ['noun', 'color', 'size', 'shape']) if (desc[k] !== undefined && desc[k] !== null && c[k] !== desc[k]) return false;
  return true;
}
function countMatching(controls, desc) { return controls.filter((c) => matches(c, desc)).length; }

function randomDesc(T) {
  const noun = pick(T.nouns);
  const d = { noun, color: pick(COLORS), size: pick(SIZES), shape: null };
  if (VOCAB.nouns[noun].shapes) d.shape = pick(SHAPES);
  return d;
}
// popis = to, co bude na cedulce (podmnožina vlastností)
function descOf(c, T) {
  const d = { noun: c.noun, color: c.color };
  if (T.attrs.includes('size')) d.size = c.size;
  return d;
}
function flip(val, all) { const o = all.filter((x) => x !== val); return pick(o); }

function buildControls(T) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const target = randomDesc(T);
    const list = [target];
    // dvojče lišící se právě jednou vlastností z popisu → to slovo je nutné přečíst
    const push = (d) => { if (!list.some((x) => sameDesc(x, d))) list.push(d); };
    push({ ...target, color: flip(target.color, COLORS) });
    if (T.attrs.includes('size')) push({ ...target, size: flip(target.size, SIZES) });
    if (T.nouns.length > 1) {
      const n2 = flip(target.noun, T.nouns);
      push({ ...target, noun: n2, shape: VOCAB.nouns[n2].shapes ? pick(SHAPES) : null });
    }
    let guard = 0;
    while (list.length < T.n && guard++ < 200) push(randomDesc(T));
    if (list.length < T.n) continue;

    const desc = descOf(target, T);
    if (countMatching(list, desc) !== 1) continue;
    // každá vlastnost, která se na stroji liší, musí být v popisu nutná
    let ok = true;
    for (const k of Object.keys(desc)) {
      const values = new Set(list.map((c) => c[k]));
      if (values.size < 2) continue;
      const without = { ...desc }; delete without[k];
      if (countMatching(list, without) < 2) { ok = false; break; }
    }
    if (!ok) continue;
    return { controls: shuffle(list), target: list[0], desc };
  }
  return null;
}

// ---------- text cedulky ----------
function wordHtml(w, world) {
  const W = WORLDS[world];
  const syl = S.settings.syll && world !== 2;   // u psacího nedělit, kazí to spojení písmen
  const parts = w.split('-').map((p) => W.fmt(p));
  return syl ? parts.join('<span class="syl">·</span>') : parts.join('');
}
function descWords(desc) {
  const out = [VOCAB.verbs[VOCAB.nouns[desc.noun].verb].w];
  if (desc.size) out.push(VOCAB.sizes[desc.size].w);
  if (desc.shape) out.push(VOCAB.shapes[desc.shape].w);
  out.push(VOCAB.colors[desc.color].w);
  out.push(VOCAB.nouns[desc.noun].w);
  return out;
}
function ticketHtml(t, world) {
  if (t.kind === 'screw') return `<span class="screw">${wordHtml(SCREW.verb, world)} ${wordHtml(SCREW.w, world)}</span>`;
  return t.descs.map((d) => descWords(d).map((w) => wordHtml(w, world)).join(' ')).join(' <b>a</b> ');
}
function ticketPlain(t) {
  if (t.kind === 'screw') return `${SCREW.verb} ${letters(SCREW.w)}`;
  return t.descs.map((d) => descWords(d).map(letters).join(' ')).join(' a ');
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
// Slovník je uzavřený (~20 slov), takže rozpoznávání je řádově spolehlivější
// než u volných podstatných jmen. Token uznáme jen když je jeden kandidát jasně nejblíž.
const LEXICON = (() => {
  const out = [];
  for (const [k, v] of Object.entries(VOCAB.verbs)) out.push({ cat: 'verb', key: k, n: norm(letters(v.w)) });
  for (const [k, v] of Object.entries(VOCAB.colors)) out.push({ cat: 'color', key: k, n: norm(letters(v.w)) });
  for (const [k, v] of Object.entries(VOCAB.sizes)) out.push({ cat: 'size', key: k, n: norm(letters(v.w)) });
  for (const [k, v] of Object.entries(VOCAB.shapes)) out.push({ cat: 'shape', key: k, n: norm(letters(v.w)) });
  for (const [k, v] of Object.entries(VOCAB.nouns)) out.push({ cat: 'noun', key: k, n: norm(letters(v.w)) });
  out.push({ cat: 'screwverb', key: 'vrat', n: norm(SCREW.verb) });
  out.push({ cat: 'screw', key: 'screw', n: norm(letters(SCREW.w)) });
  return out;
})();
function matchToken(tok) {
  const h = norm(tok);
  if (!h) return null;
  let best = null, bd = Infinity, second = Infinity;
  for (const e of LEXICON) {
    const d = lev(h, e.n);
    if (d < bd) { second = bd; bd = d; best = e; }
    else if (d < second) second = d;
  }
  if (!best || bd > tol(best.n.length)) return null;
  if (bd === second) return null;             // dvě slova stejně blízko → radši nic
  return best;
}
// Vrátí pole povelů v pořadí, jak zazněly. Nový povel začíná slovesem.
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
// Co robůtek z povelu pochopí: 'none' nic, 'many' neví která, jinak konkrétní ovladač.
function resolve(cmd, controls) {
  if (cmd.screw) return { screw: true };
  const desc = {};
  for (const k of ['noun', 'color', 'size', 'shape']) if (cmd[k]) desc[k] = cmd[k];
  // Samotné sloveso: dítě řeklo „zmáčkni“ a dost. Robůtek neví CO – a není to
  // totéž jako „to tu nemám“, proto zvláštní odpověď.
  if (!Object.keys(desc).length) return { kind: cmd.verb ? 'what' : 'none' };
  const hits = controls.filter((c) => matches(c, desc));
  if (!hits.length) return { kind: 'none' };
  if (hits.length > 1) return { kind: 'many' };
  return { kind: 'one', control: hits[0] };
}

// ---------- příšerka do sbírky ----------
const PALETTE = [['#ff8fab', '#e0527a'], ['#8ed6ff', '#3b9edb'], ['#b6e388', '#6db33f'], ['#ffd166', '#e0a020'], ['#c8a2ff', '#8d5be0'], ['#ffb26b', '#e07b2a'], ['#7fe3d6', '#2ab5a5']];
function monsterSVG(seed, mood = 'happy') {
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
  const mouth = mood === 'happy'
    ? `<path d="M70,118 Q100,160 130,118 Z" fill="#5a1f3a"/><ellipse cx="100" cy="140" rx="14" ry="8" fill="#ff7b9c"/>`
    : `<path d="M75,122 Q100,148 125,122" stroke="#5a1f3a" stroke-width="6" fill="none" stroke-linecap="round"/>`;
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
  click: () => { beep(520, .06, 'square', .14); beep(700, .1, 'triangle', .12, .05); },
  good: () => { beep(523, .1, 'triangle', .16); beep(784, .14, 'triangle', .16, .09); },
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
// sebral zvuk a ten by se jen pořád restartoval.
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
    $('#micbar').hidden = false;
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

// ---------- stroj a robůtek ----------
const G = { world: 0, tier: 0 };
const A = { controls: [], queue: [], done: 0, pressure: 0, busy: false, running: false, step: 0, tapOk: false, seed: 0 };

function drawControl(c) {
  const col = VOCAB.colors[c.color], k = VOCAB.sizes[c.size].k;
  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('class', 'ctrl');
  g.setAttribute('transform', `translate(${c.x},${c.y})`);
  const r = 24 * k;
  let inner = '';
  if (c.noun === 'button') {
    inner = c.shape === 'square'
      ? `<rect x="${-r}" y="${-r}" width="${r * 2}" height="${r * 2}" rx="6" fill="${col.hex}" stroke="${col.dark}" stroke-width="4"/>
         <rect x="${-r + 6}" y="${-r + 5}" width="${r * 2 - 12}" height="${r * 0.7}" rx="4" fill="#fff" opacity=".25"/>`
      : `<circle r="${r}" fill="${col.hex}" stroke="${col.dark}" stroke-width="4"/>
         <ellipse cx="0" cy="${-r * 0.35}" rx="${r * 0.55}" ry="${r * 0.3}" fill="#fff" opacity=".3"/>`;
  } else if (c.noun === 'wheel') {
    inner = `<circle r="${r}" fill="none" stroke="${col.hex}" stroke-width="${7 * k}"/>
             <circle r="${r * 0.28}" fill="${col.dark}"/>
             <path d="M0,${-r} V${r} M${-r},0 H${r}" stroke="${col.hex}" stroke-width="${5 * k}"/>`;
  } else if (c.noun === 'lever') {
    inner = `<rect x="${-4 * k}" y="${-r}" width="${8 * k}" height="${r * 1.8}" rx="3" fill="${col.dark}"/>
             <circle cy="${-r}" r="${9 * k}" fill="${col.hex}" stroke="${col.dark}" stroke-width="3"/>
             <rect x="${-r * 0.6}" y="${r * 0.75}" width="${r * 1.2}" height="${8 * k}" rx="3" fill="#8b9bb0"/>`;
  } else if (c.noun === 'lamp') {
    inner = `<circle class="bulb" r="${r * 0.8}" fill="${col.hex}" stroke="${col.dark}" stroke-width="3" opacity=".55"/>
             <rect x="${-r * 0.45}" y="${r * 0.6}" width="${r * 0.9}" height="${7 * k}" rx="3" fill="#8b9bb0"/>`;
  } else {
    inner = `<rect x="${-r}" y="${-r * 0.75}" width="${r * 2}" height="${r * 1.5}" rx="7" fill="${col.hex}" stroke="${col.dark}" stroke-width="4"/>
             <path d="M${-r * 0.5},${-r * 0.75} h${r}" stroke="${col.dark}" stroke-width="5" stroke-linecap="round"/>`;
  }
  g.innerHTML = inner + `<circle class="hit" r="${Math.max(r, 22)}"/>`;
  g.onclick = () => { if (A.tapOk && !A.busy && A.running) obeyControl(c); };
  c.el = g;
  return g;
}

function buildMachine(round) {
  const svg = $('#svg');
  svg.setAttribute('viewBox', MACHINE.view);
  svg.innerHTML = MACHINE.body;
  const slots = shuffle(MACHINE.slots).slice(0, round.controls.length);
  A.controls = round.controls.map((d, i) => Object.assign({}, d, { x: slots[i].x, y: slots[i].y, id: 'c' + i }));
  A.controls.forEach((c) => svg.appendChild(drawControl(c)));
  const rb = document.createElementNS(SVGNS, 'g');
  rb.setAttribute('class', 'robot');
  rb.setAttribute('id', 'robot');
  rb.innerHTML = ROBOT.svg;
  rb.style.transform = `translate(90px, ${MACHINE.floor}px)`;
  svg.appendChild(rb);
}

function say(text, ms = 1600) {
  const s = $('#say');
  s.hidden = false; s.textContent = text;
  clearTimeout(say._t);
  say._t = setTimeout(() => { s.hidden = true; }, ms);
}

function walkTo(x) {
  const rb = $('#robot');
  rb.classList.add('walk');
  rb.style.transform = `translate(${x - 30}px, ${MACHINE.floor}px)`;
  return new Promise((res) => setTimeout(() => { rb.classList.remove('walk'); res(); }, 520));
}
function poke() {
  const rb = $('#robot');
  rb.classList.remove('poke'); void rb.offsetWidth; rb.classList.add('poke');
  return new Promise((res) => setTimeout(res, 380));
}
function shrug() {
  const rb = $('#robot');
  rb.classList.remove('shrug'); void rb.offsetWidth; rb.classList.add('shrug');
  sfx.shrug();
}

function steamAt(c) {
  const svg = $('#svg');
  for (let i = 0; i < 3; i++) {
    const p = document.createElementNS(SVGNS, 'circle');
    p.setAttribute('cx', c.x + (i - 1) * 12); p.setAttribute('cy', c.y - 18);
    p.setAttribute('r', 9 + i * 2); p.setAttribute('fill', '#ffffff'); p.setAttribute('opacity', '.8');
    p.setAttribute('class', 'steam');
    p.style.animationDelay = i * 0.12 + 's';
    svg.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }
  sfx.steam();
}
function dropScrew(c) {
  const svg = $('#svg');
  const s = document.createElementNS(SVGNS, 'g');
  s.setAttribute('class', 'screwfall');
  s.innerHTML = `<circle cx="${c.x + 18}" cy="${c.y + 14}" r="7" fill="#b9a06a" stroke="#8a7440" stroke-width="2"/>
                 <path d="M${c.x + 14},${c.y + 14} h8" stroke="#8a7440" stroke-width="2"/>`;
  svg.appendChild(s);
  setTimeout(() => s.remove(), 1100);
}

// ---------- co robůtek udělá ----------
async function obey(cmds) {
  if (A.busy || !A.running) return;
  const t = A.queue[0];
  A.busy = true;
  try {
    for (const cmd of cmds) {
      const r = resolve(cmd, A.controls);
      if (r.screw) {
        if (t.kind === 'screw') { await fixScrew(); return; }
        say('Šroubek? Žádný tu neleží.'); shrug(); return;
      }
      if (t.kind === 'screw') { say('Napřed ten šroubek.'); shrug(); return; }
      if (r.kind === 'what') { say('A co? Řekni to celé.'); shrug(); return; }
      if (r.kind === 'none') { say('To tu nemám.'); shrug(); return; }
      if (r.kind === 'many') { say('Kterou? Je jich víc.'); shrug(); return; }
      const okNow = await act(r.control);
      if (!okNow) return;                     // špatný ovladač – zbytek povelu se neprovádí
      if (A.step >= t.descs.length) { await finishTicket(); return; }
    }
  } finally { A.busy = false; }
}
function obeyControl(c) {                      // ťuknutí místo hlasu (bez mikrofonu)
  if (A.busy || !A.running) return;
  const t = A.queue[0];
  if (t.kind === 'screw') { fixScrew(); return; }
  A.busy = true;
  act(c).then((ok) => { if (ok && A.step >= t.descs.length) finishTicket(); }).finally(() => { A.busy = false; });
}

async function act(c) {
  await walkTo(c.x);
  await poke();
  const t = A.queue[0];
  const want = t.descs[A.step];
  const right = want && matches(c, want);
  c.el.classList.remove('acted', 'wrongact'); void c.el.offsetWidth;
  if (right) {
    c.el.classList.add('acted');
    if (c.noun === 'lamp') c.el.classList.add('lit');
    sfx.click(); sfx.good();
    A.step++;
    return true;
  }
  c.el.classList.add('wrongact');
  steamAt(c); dropScrew(c);
  A.pressure = clamp(A.pressure + 25, 0, 100);
  updatePressure();
  say('Jejda!');
  A.queue.unshift({ kind: 'screw' });          // šroubek se musí vrátit
  A.step = 0;
  setTimeout(showTicket, 700);
  return false;
}
async function fixScrew() {
  A.busy = true;
  await walkTo(160);
  await poke();
  sfx.click();
  A.queue.shift();
  A.pressure = clamp(A.pressure - 15, 0, 100);
  updatePressure();
  A.step = 0;
  A.busy = false;
  showTicket();
}
async function finishTicket() {
  sfx.good();
  A.done++;
  updateBar();
  A.queue.shift();
  A.step = 0;
  if (A.done >= S.settings.goal) { win(); return; }
  setTimeout(newTicket, 600);
}

// ---------- kolo ----------
function updateBar() {
  const goal = S.settings.goal;
  $('#bar').style.width = (100 * A.done / goal) + '%';
  $('#bar-text').textContent = `🎫 ${A.done} / ${goal}`;
}
function updatePressure() { $('#pressure').style.height = A.pressure + '%'; }

function showTicket() {
  const t = A.queue[0];
  if (!t) return;
  const el = $('#ticket');
  el.className = 'ticket ' + WORLDS[G.world].cls;
  $('#ticket-text').innerHTML = ticketHtml(t, G.world);
  el.classList.remove('out'); void el.offsetWidth; el.classList.add('out');
  sfx.print();
}
function newTicket() {
  const T = TIERS[G.tier];
  const round = buildControls(T);
  if (!round) return;
  buildMachine(round);
  const descs = [round.desc];
  if (T.cmds > 1) {
    const other = A.controls.filter((c) => !matches(c, round.desc));
    // druhý povel musí být taky jednoznačný
    for (const c of shuffle(other)) {
      const d = descOf(c, T);
      if (A.controls.filter((x) => matches(x, d)).length === 1) { descs.push(d); break; }
    }
  }
  A.queue = [{ kind: 'cmd', descs }];
  A.step = 0;
  showTicket();
}

function startLevel(w, t) {
  G.world = w; G.tier = t;
  A.done = 0; A.pressure = 0; A.step = 0; A.busy = false; A.tapOk = !micUsable();
  A.seed = rnd(1e9);
  updateBar(); updatePressure();
  showHeard('', false);
  $('#say').hidden = true;
  show('game');
  $('#micbar').hidden = false;
  A.running = true;
  newTicket();
  if (micUsable()) startMic();
}

function win() {
  A.running = false; stopMic(); sfx.fanfare();
  const k = levelKey(G.world, G.tier);
  const prev = winsFor(k);
  S.progress[k] = { wins: prev + 1 }; save();
  const i = levelOrder.indexOf(k);
  const unlockedNext = !S.settings.unlock && prev === 0 && i + 1 < levelOrder.length;
  $('#done-icon').textContent = '🎉';
  $('#done-title').textContent = 'Stroj zase jede!';
  $('#done-text').textContent = (unlockedNext ? '🔓 Odemkl se další level! ' : '') + `Robůtek splnil ${A.done} povelů a vyrobil tohle:`;
  $('#done-made').innerHTML = monsterSVG(A.seed);
  setTimeout(() => $('#modal-done').classList.add('open'), 400);
}

// ---------- obrazovky ----------
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id)); }
function renderHome() {
  const warn = $('#mic-warn');
  if (!SR) { warn.hidden = false; warn.textContent = '🎤 Tenhle prohlížeč neumí rozpoznávat řeč, takže robůtek neuslyší. Ovladače půjde ťuknout. Nejlíp funguje Chrome.'; }
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
  if (MIC.dead) { A.tapOk = true; say('Ťukni na ovladač sám.'); return; }
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
    goal: clamp(+$('#opt-goal').value || 8, 3, 20),
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
