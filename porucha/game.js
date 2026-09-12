/* Porucha – sklad se rozpadá, čtení nahlas ho spravuje. Vanilla JS, bez závislostí. */
'use strict';

// ---------- util ----------
const $ = (s, r = document) => r.querySelector(s);
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const cap1 = (s) => s[0].toLocaleUpperCase('cs') + s.slice(1);
const low = (s) => s.toLocaleLowerCase('cs');

// ---------- perzistence ----------
const KEY = 'porucha-v1';
const DEFAULTS = {
  settings: { syll: true, tts: true, sound: true, unlock: false, goal: 8, speed: 1, mic: true, strict: 1 },
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
// every = za kolik sekund se v průměru porouchá další bedna
const TIERS = [
  { name: 'Krátká', icon: '🐣', choices: 3, every: 9 },
  { name: 'Delší', icon: '🐥', choices: 3, every: 8 },
  { name: 'Dlouhá', icon: '🐔', choices: 4, every: 7 },
  { name: 'Věty', icon: '📖', choices: 4, every: 6.5 },
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
const NOM_TPL = ['to je {S}', 'tady je {S}', 'tohle je {S}'];
const ACC_TPL = ['chci {S}', 'dej mi {S}', 'dnes jím {S}'];
function plainText(w, tpl) { const t = letters(w.w); return tpl ? tpl.replace('{S}', t) : t; }

// ---------- porovnání slyšeného ----------
// Rozpoznávač neumí hodnotit výslovnost a začátečník čte po slabikách („MA… SO“).
// Neřešíme tedy přesnost přepisu, ale to, KTERÉ ze známých slov je přepisu nejblíž.
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
// kratší slovo = menší tolerance, jinak by „med“ prošlo jako „led“
function tol(n) {
  const s = S.settings.strict;
  if (s === 2) return 0;
  const base = n <= 4 ? 1 : n <= 7 ? 2 : 3;
  return s === 0 ? base + 1 : base;
}
function heardForms(text) {
  const out = new Set();
  const full = norm(text);
  if (full) out.add(full);
  for (const tok of String(text || '').split(/\s+/)) { const n = norm(tok); if (n) out.add(n); }
  return [...out];
}
function nearestWord(forms) {
  let bw = null, bd = Infinity;
  for (const w of allWords()) {
    const nw = norm(letters(w.w));
    for (const h of forms) { const d = lev(h, nw); if (d < bd) { bd = d; bw = w; } }
  }
  return { w: bw, d: bd };
}
function judge(text, s) {
  const forms = heardForms(text);
  if (!forms.length) return { ok: false, other: null };
  const nw = norm(letters(s.w.w));
  if (s.tpl && nw.length >= 3 && forms.some((h) => h.includes(nw))) return { ok: true, other: null };
  let dT = Infinity;
  for (const h of forms) dT = Math.min(dT, lev(h, nw));
  const best = nearestWord(forms);
  if (dT <= tol(nw.length) && dT <= best.d) return { ok: true, other: null };
  const other = best.w && best.w !== s.w && best.d <= tol(norm(letters(best.w.w)).length) ? best.w : null;
  return { ok: false, other };
}
// „ma“ z „maso“: dítě čte po slabikách a rozpoznávač pošle útržek. Není to chyba.
function isPartial(text, s) {
  const nw = norm(letters(s.w.w));
  return heardForms(text).some((h) => h && h !== nw && (nw.startsWith(h) || h.startsWith(nw)));
}

// ---------- rozbité kódování ----------
// Neděláme tabulku „jak to asi vypadá“, ale skutečnou chybu: slovo se zakóduje do UTF-8
// a bajty se přečtou jako CP1252. Přesně tohle dělá z „čokoláda“ řetězec „Äokolï¿½da“.
const CP1252 = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰',
  0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•',
  0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};
function mojibake(s) {
  const bytes = new TextEncoder().encode(s);
  let out = '';
  for (const b of bytes) {
    if (b < 0x80) out += String.fromCharCode(b);
    else if (CP1252[b]) out += CP1252[b];
    else if (b >= 0xa0) out += String.fromCharCode(b);   // Latin-1 část je v CP1252 stejná
    else out += '�';                                // 0x81, 0x8d, 0x8f, 0x90, 0x9d znak nemají
  }
  return out;
}

// ---------- generátory poruch ----------
// Záměny, které dělají začínající čtenáři. Distraktor pro ťukací záchranu se bere odsud.
const CONFUSE = {
  b: ['d', 'p'], d: ['b', 'p'], p: ['b', 'd'], m: ['n'], n: ['m'], t: ['ť'], 'ť': ['t'],
  s: ['š'], 'š': ['s'], c: ['č'], 'č': ['c'], r: ['ř'], 'ř': ['r'], z: ['ž'], 'ž': ['z'],
  e: ['ě', 'é'], 'ě': ['e'], 'é': ['e'], a: ['á'], 'á': ['a'], i: ['í', 'y'], 'í': ['i'],
  y: ['ý', 'i'], 'ý': ['y'], u: ['ů', 'ú'], 'ů': ['u'], 'ú': ['u'], o: ['ó'], 'ó': ['o'],
};
// Když má písmeno jen jednoho zaměnitelného partnera, dorovná se nabídka odsud.
const FILLER = 'aeiouybdpmnstrklvhz'.split('');
function isRealWord(s) { const t = low(s); return allWords().some((w) => low(letters(w.w)) === t); }

// Vrátí { pos, correct, choices } – vždy právě jedna správná možnost, nebo null.
function letterTask(text, n) {
  const withPartners = [];
  for (let i = 0; i < text.length; i++) if ((CONFUSE[low(text[i])] || []).length) withPartners.push(i);
  const order = shuffle(withPartners.length ? withPartners : [...text].map((_, i) => i));
  for (const pos of order) {
    const correct = text[pos];
    const bad = [];
    for (const p of shuffle(CONFUSE[low(correct)] || [])) {
      if (bad.length >= n - 1) break;
      if (p === low(correct)) continue;
      // Kdyby záměna dala jiné existující slovo, úloha má dvě správné odpovědi.
      if (!isRealWord(text.slice(0, pos) + p + text.slice(pos + 1))) bad.push(p);
    }
    // Krátká slova mají často jen jednoho partnera („maso“: m↔n). Nabídku dorovnáme,
    // ať i na ně zbude úloha „chybí písmeno“. Pozice je pořád ta zaměnitelná.
    for (const p of shuffle(FILLER)) {
      if (bad.length >= n - 1) break;
      if (p === low(correct) || bad.includes(p)) continue;
      if (!isRealWord(text.slice(0, pos) + p + text.slice(pos + 1))) bad.push(p);
    }
    if (bad.length >= n - 1) return { pos, correct, choices: shuffle([correct, ...bad.slice(0, n - 1)]) };
  }
  return null;
}
function syllTask(w) {
  const parts = w.w.split('-');
  if (parts.length < 2) return null;
  // „bon-bon“: všechny slabiky stejné. Přeházet je nejde a nevadí – každé pořadí je správné.
  if (new Set(parts).size === 1) return { parts, mix: parts.slice(), done: 0, placed: [] };
  const same = (a) => a.join('|') === parts.join('|');
  let mix = shuffle(parts);
  for (let i = 0; i < 10 && same(mix); i++) mix = shuffle(parts);
  return same(mix) ? null : { parts, mix, done: 0, placed: [] };
}
function otherWords(w, tier, n) {
  const same = shuffle(allWords().filter((x) => x !== w && x.e !== w.e && (tier === 3 ? tierOf(x) <= 1 : tierOf(x) === tier)));
  const any = shuffle(allWords().filter((x) => x !== w && x.e !== w.e));
  const out = same.slice(0, n - 1);
  for (const x of any) { if (out.length >= n - 1) break; if (!out.includes(x)) out.push(x); }
  return out.length >= n - 1 ? out : null;
}
function mojiTask(w, tier, n) { const bad = otherWords(w, tier, n); return bad ? { choices: shuffle([w, ...bad]) } : null; }
function picTask(w, tier, n) { const bad = otherWords(w, tier, n); return bad ? { choices: shuffle([w, ...bad]) } : null; }

// Porouchá bednu jedním ze čtyř způsobů (jen těmi, které pro dané slovo dávají smysl).
function makeBreak(s, tier, n) {
  const kinds = [];
  const lt = letterTask(letters(s.w.w), n); if (lt) kinds.push(['letter', lt]);
  const st = syllTask(s.w); if (st) kinds.push(['syll', st]);
  const mt = mojiTask(s.w, tier, n); if (mt) kinds.push(['moji', mt]);
  const pt = picTask(s.w, tier, n); if (pt) kinds.push(['pic', pt]);
  if (!kinds.length) return false;
  const [kind, task] = pick(kinds);
  s.kind = kind; s.task = task; s.broken = true; s.wrong = 0; s.rescue = false;
  return true;
}

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
  const N = 8, pts = [];
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; const rad = 70 + r() * 18; pts.push([100 + Math.cos(a) * rad, 105 + Math.sin(a) * rad * 0.95]); }
  const mid = (i) => { const p = pts[i % N], q = pts[(i + 1) % N]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; };
  let d = `M${mid(0)[0]},${mid(0)[1]}`;
  for (let i = 1; i <= N; i++) { const q = pts[i % N], m = mid(i); d += ` Q${q[0]},${q[1]} ${m[0]},${m[1]}`; }
  d += 'Z';
  const eyes = 1 + Math.floor(r() * 3);
  const horn = Math.floor(r() * 4);
  const spots = Math.floor(r() * 4);
  let extras = '';
  if (horn === 1) extras += `<path d="M62,45 L70,12 L88,42 Z M138,45 L130,12 L112,42 Z" fill="${c2}"/>`;
  if (horn === 2) extras += `<path d="M80,40 C70,20 60,20 55,8 M120,40 C130,20 140,20 145,8" stroke="${c2}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="55" cy="8" r="8" fill="${c2}"/><circle cx="145" cy="8" r="8" fill="${c2}"/>`;
  if (horn === 3) extras += `<ellipse cx="45" cy="55" rx="16" ry="26" fill="${c1}" stroke="${c2}" stroke-width="4"/><ellipse cx="155" cy="55" rx="16" ry="26" fill="${c1}" stroke="${c2}" stroke-width="4"/>`;
  let spotSvg = '';
  for (let i = 0; i < spots; i++) spotSvg += `<circle cx="${60 + r() * 80}" cy="${120 + r() * 50}" r="${5 + r() * 7}" fill="${c2}" opacity=".45"/>`;
  let eyeSvg = '';
  const eyeR = eyes === 1 ? 22 : eyes === 2 ? 15 : 12;
  const xs = eyes === 1 ? [100] : eyes === 2 ? [78, 122] : [70, 100, 130];
  xs.forEach((x, i) => {
    const y = eyes === 3 && i === 1 ? 62 : 78;
    const rr = mood === 'listen' ? eyeR * 1.12 : eyeR;
    eyeSvg += `<circle cx="${x}" cy="${y}" r="${rr}" fill="#fff"/><circle cx="${x + 3}" cy="${y + 3}" r="${rr * 0.5}" fill="#2b2137"/><circle cx="${x + 6}" cy="${y - 4}" r="${rr * 0.18}" fill="#fff"/>`;
    if (mood === 'worry') eyeSvg += `<path d="M${x - eyeR},${y - eyeR - 9} L${x + eyeR},${y - eyeR - 3}" stroke="#2b2137" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  });
  let mouth = '';
  if (mood === 'happy') mouth = `<path d="M70,118 Q100,160 130,118 Z" fill="#5a1f3a"/><ellipse cx="100" cy="140" rx="14" ry="8" fill="#ff7b9c"/>`;
  else if (mood === 'sad') mouth = `<path d="M75,140 Q100,118 125,140" stroke="#5a1f3a" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  else if (mood === 'listen') mouth = `<ellipse cx="100" cy="132" rx="13" ry="16" fill="#5a1f3a"/>`;
  else if (mood === 'worry') mouth = `<path d="M74,134 q13,-10 26,0 q13,10 26,0" stroke="#5a1f3a" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  else mouth = `<path d="M75,122 Q100,148 125,122" stroke="#5a1f3a" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M92,128 l4,8 l4,-8" fill="#fff"/>`;
  const cheeks = `<circle cx="58" cy="112" r="9" fill="#ff7b9c" opacity=".5"/><circle cx="142" cy="112" r="9" fill="#ff7b9c" opacity=".5"/>`;
  const feet = `<ellipse cx="78" cy="182" rx="18" ry="9" fill="${c2}"/><ellipse cx="122" cy="182" rx="18" ry="9" fill="${c2}"/>`;
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${feet}${extras}<path d="${d}" fill="${c1}" stroke="${c2}" stroke-width="5"/>${spotSvg}${cheeks}${eyeSvg}${mouth}</svg>`;
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
  fix: () => { beep(420, .07, 'square', .12); beep(620, .09, 'square', .12, .07); beep(880, .16, 'triangle', .16, .15); },
  bad: () => beep(160, .25, 'square', .08),
  glitch: () => { beep(110, .07, 'sawtooth', .1); beep(90, .05, 'square', .1, .06); beep(150, .06, 'sawtooth', .08, .11); },
  alarm: () => { beep(740, .12, 'square', .1); beep(560, .14, 'square', .1, .14); },
  crash: () => [300, 240, 180, 120, 80].forEach((f, i) => beep(f, .3, 'sawtooth', .1, i * .12)),
  fanfare: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, .25, 'sine', .2, i * .12)),
};

// ---------- předčítání ----------
let czVoice = null;
function loadVoices() { const v = speechSynthesis.getVoices(); czVoice = v.find((x) => /^cs/i.test(x.lang)) || null; }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const wasOn = MIC.want;
  stopMic();                                  // ať rozpoznávač neslyší sám sebe
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'cs-CZ'; u.rate = 0.85; if (czVoice) u.voice = czVoice;
  u.onend = u.onerror = () => { if (wasOn && A.running) setTimeout(startMic, 250); };
  speechSynthesis.speak(u);
}

// ---------- mikrofon ----------
// Mikrofon si NEOTVÍRÁME sami (getUserMedia). Když běží vlastní stream, rozpoznávač
// v Chrome zvuk nedostane – jen se pořád dokola restartuje a pípá.
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
  rec.onstart = () => { MIC.live = true; setMic('live', 'Poslouchám…'); };
  rec.onspeechstart = () => setMic('live hears', 'Slyším tě…');
  rec.onspeechend = () => setMic('live', 'Poslouchám…');
  rec.onnomatch = () => { MIC.fails++; };
  rec.onend = () => {
    MIC.live = false;
    const playing = A.running && $('#game').classList.contains('active');
    if (MIC.want && playing && MIC.fails < 8) { setTimeout(() => { if (MIC.want) tryStart(); }, 400); return; }
    if (MIC.fails >= 8) { MIC.want = false; const s = A.slots[A.sel]; if (s) showTiles(s); }
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
    MIC.dead = true; MIC.want = false;
    setMic('dead', micDeadLabel());
    const s = A.slots[A.sel]; if (s) showTiles(s);      // bez mikrofonu se opravuje ťukáním
  }
}
// Nakloníme rozpoznávač k očekávanému slovu (když to prohlížeč umí).
function applyPhrases(rec) {
  if (MIC.noPhrases || typeof SpeechRecognitionPhrase === 'undefined' || !('phrases' in rec)) return;
  const s = A.slots[A.sel];
  if (!s) return;
  try {
    const words = [s.w].concat((s.task && s.task.choices) || []).filter((x) => x && x.w);
    const list = words.map((w) => new SpeechRecognitionPhrase(letters(w.w), 2.0));
    try { rec.phrases = list; }
    catch { while (rec.phrases.length) rec.phrases.pop(); list.forEach((p) => rec.phrases.push(p)); }
  } catch { MIC.noPhrases = true; }
}
function tryStart() {
  const s = A.slots[A.sel];
  if (!micUsable() || MIC.live || !A.running || !s || !s.broken) return;
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
  if (!texts.length) return;
  const s = A.slots[A.sel];
  if (!s || !s.broken || !A.running) return;
  if (!res.isFinal) { showHeard(texts[0].trim(), true); return; }
  showHeard(texts[0].trim(), false);
  let other = null, partial = false;
  for (const t of texts) {
    const v = judge(t, s);
    if (v.ok) { fixSlot(s); return; }
    if (v.other && !other) other = v.other;
    if (isPartial(t, s)) partial = true;
  }
  // Rozečtené slovo má přednost: útržek může být náhodou blízko jinému slovu.
  if (partial) showHeard('…pokračuj', false);
  else if (other) voiceMiss(s, other);
}
function voiceMiss(s, other) {
  sfx.bad();
  s.wrong++;
  showHeard(`slyším: ${letters(other.w)} 🤔`, false);
  const wb = $('.word-big', $('#repair-stage'));
  if (wb) { wb.classList.remove('shake'); void wb.offsetWidth; wb.classList.add('shake'); }
  if (s.wrong >= 2) showTiles(s);
}

// ---------- obrazovky ----------
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id)); }

function renderHome() {
  const warn = $('#mic-warn');
  if (!SR) { warn.hidden = false; warn.textContent = '🎤 Tenhle prohlížeč neumí rozpoznávat řeč. Bedny půjde spravovat ťukáním. Nejlíp funguje Chrome.'; }
  else if (!window.isSecureContext) { warn.hidden = false; warn.textContent = '🎤 Mikrofon funguje jen na zabezpečené stránce (https) nebo na localhost. Tady se opravuje ťukáním.'; }
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

// ---------- sklad ----------
const SLOTS = 6;
const FIRST_BREAK = 4;      // s klidu na začátku, ať je vidět, že sklad byl v pořádku
const RESCUE_AFTER = 20;    // s na jedné bedně → nabídnout ťukání, ať dítě neuvízne
const G = { world: 0, tier: 0 };
const A = { slots: [], t: 0, fixed: 0, broken: 0, sel: -1, raf: 0, last: 0, running: false, nextBreak: 0, every: 9, seed: 0, name: '', rescueT: 0 };

function startLevel(w, t) {
  G.world = w; G.tier = t;
  A.slots = []; A.t = 0; A.fixed = 0; A.broken = 0; A.sel = -1;
  A.every = TIERS[t].every / (S.settings.speed || 1);
  A.nextBreak = FIRST_BREAK;
  A.seed = rnd(1e9); A.name = randomName();
  clearTimeout(A.rescueT);
  const pool = shuffle(wordsOfTier(t));
  const panel = $('#panel'); panel.innerHTML = '';
  for (let i = 0; i < SLOTS; i++) {
    const w0 = pool[i % pool.length];
    const s = { i, w: w0, tpl: null, broken: false, kind: null, task: null, wrong: 0, rescue: false };
    if (t === 3) s.tpl = pick(accSafe(w0) ? NOM_TPL.concat(ACC_TPL) : NOM_TPL);
    const el = document.createElement('button');
    el.className = 'slot';
    el.innerHTML = '<div class="pic"></div><div class="lbl"></div>';
    el.onclick = () => { if (s.broken) selectSlot(s.i); };
    s.el = el; panel.appendChild(el); A.slots.push(s);
  }
  A.slots.forEach(renderSlot);
  errbar('', false);
  showHeard('', false);
  updateBar();
  show('game');
  renderRepair();
  A.running = false; resume();
}

function labelFor(s) {
  const W = WORLDS[G.world];
  const word = letters(s.w.w);
  if (!s.broken || s.kind === 'pic') return W.fmt(plainText(s.w, s.tpl));
  if (s.kind === 'moji') return mojibake(W.fmt(plainText(s.w, s.tpl)));
  if (s.kind === 'letter') {
    const t = word.slice(0, s.task.pos) + '▯' + word.slice(s.task.pos + 1);
    return W.fmt(s.tpl ? s.tpl.replace('{S}', t) : t);
  }
  if (s.kind === 'syll') return W.fmt(s.task.mix.join(' '));
  return W.fmt(word);
}
function renderSlot(s) {
  s.el.className = 'slot' + (s.broken ? ' broken' : '') + (A.sel === s.i ? ' sel' : '');
  const pic = $('.pic', s.el), lbl = $('.lbl', s.el);
  const picGone = s.broken && s.kind === 'pic';
  pic.className = 'pic' + (picGone ? ' gone' : '');
  pic.innerHTML = '';
  if (!picGone) pic.appendChild(emojiEl(s.w.e));
  lbl.className = 'lbl ' + WORLDS[G.world].cls + (s.broken && s.kind !== 'pic' ? ' gone' : '');
  lbl.textContent = labelFor(s);
}
function updateBar() {
  const goal = S.settings.goal;
  $('#bar').style.width = (100 * A.fixed / goal) + '%';
  $('#bar-text').textContent = `🔧 ${A.fixed} / ${goal}`;
}
function errbar(text, crit) {
  const e = $('#errbar');
  e.textContent = text;
  e.className = 'errbar' + (text ? ' show' : '') + (crit ? ' crit' : '');
}
function errFor(s) {
  const f = low(letters(s.w.w)).normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (s.kind === 'pic') return `⚠ nelze načíst ${f}.png`;
  if (s.kind === 'moji') return `⚠ chybné kódování (UTF-8): bedna ${s.i + 1}`;
  if (s.kind === 'syll') return `⚠ rozsypaný zápis: bedna ${s.i + 1}`;
  return `⚠ poškozený zápis: bedna ${s.i + 1}`;
}

// ---------- rozpad ----------
function scheduleNext() { A.nextBreak = A.t + A.every * (0.8 + Math.random() * 0.4); }
function breakSlot() {
  const intact = A.slots.filter((s) => !s.broken);
  if (!intact.length) return;
  const s = pick(intact);
  if (!makeBreak(s, G.tier, TIERS[G.tier].choices)) return;
  A.broken++;
  renderSlot(s);
  s.el.classList.remove('glitch'); void s.el.offsetWidth; s.el.classList.add('glitch');
  sfx.glitch();
  const crit = A.broken >= SLOTS - 1;
  errbar(crit ? '⚠ sklad se hroutí' : errFor(s), crit);
  if (crit && A.broken < SLOTS) sfx.alarm();
  if (A.broken >= SLOTS) { lose(); return; }
  if (A.sel < 0) selectSlot(s.i);
}
function loop(ts) {
  if (!A.running) return;
  const dt = Math.min(0.25, (ts - A.last) / 1000 || 0);
  A.last = ts; A.t += dt;
  if (A.t >= A.nextBreak) { scheduleNext(); breakSlot(); }
  if (A.running) A.raf = requestAnimationFrame(loop);
}
function pause() { A.running = false; cancelAnimationFrame(A.raf); stopMic(); }
function resume() {
  if (A.running) return;
  A.running = true; A.last = performance.now(); A.raf = requestAnimationFrame(loop);
  if (A.sel >= 0 && micUsable()) startMic();
}

// ---------- oprava ----------
function selectSlot(i) {
  A.sel = i;
  A.slots.forEach(renderSlot);
  renderRepair();
  clearTimeout(A.rescueT);
  const s = A.slots[i];
  if (s && s.broken && !s.rescue) A.rescueT = setTimeout(() => showTiles(s), RESCUE_AFTER * 1000);
  if (micUsable()) startMic(); else if (s) showTiles(s);
}
function showTiles(s) {
  if (!s || !s.broken || s.rescue) return;
  s.rescue = true;
  if (A.sel === s.i) renderRepair();
}

function wordBig(html, cls) {
  const d = document.createElement('div');
  d.className = 'word-big ' + WORLDS[G.world].cls + (cls ? ' ' + cls : '');
  d.innerHTML = html;
  return d;
}
function clueEl(emoji) {
  const d = document.createElement('div'); d.className = 'clue';
  d.appendChild(emojiEl(emoji));
  return d;
}
function gapHTML(s) {
  const W = WORLDS[G.world];
  const word = letters(s.w.w);
  const core = `${W.fmt(word.slice(0, s.task.pos))}<span class="gap">?</span>${W.fmt(word.slice(s.task.pos + 1))}`;
  if (!s.tpl) return core;
  let sent = W.fmt(s.tpl.replace('{S}', ' '));
  if (G.world !== 0) sent = cap1(sent);
  return sent.replace(' ', core);
}
function syllHTML(s) {
  const W = WORLDS[G.world];
  const done = s.task.parts.slice(0, s.task.done).map((p) => `<span class="part">${W.fmt(p)}</span>`).join('');
  const rest = s.task.parts.slice(s.task.done).map(() => '<span class="slotline"></span>').join('');
  return done + rest;
}

const TITLES = {
  letter: 'Chybí písmeno. Přečti nahlas, co tam má být.',
  syll: 'Slabiky se rozsypaly. Přečti slovo nahlas.',
  moji: 'Nápis se rozsypal. Přečti nahlas, co tam má být.',
  pic: 'Chybí obrázek. Přečti nápis nahlas.',
};
function renderRepair() {
  const title = $('#repair-title'), stage = $('#repair-stage'), choices = $('#repair-choices');
  stage.innerHTML = ''; choices.innerHTML = '';
  const s = A.slots[A.sel];
  const bar = $('#micbar');
  if (!s || !s.broken) {
    if (bar) bar.hidden = true;
    title.textContent = A.broken ? 'Ťukni na rozbitou bednu.' : 'Sklad je v pořádku… zatím.';
    const mech = document.createElement('div'); mech.className = 'mech';
    mech.innerHTML = `<div class="monster">${monsterSVG(A.seed, A.broken > 2 ? 'worry' : 'idle')}</div><div class="nm">${A.name}</div>`;
    stage.appendChild(mech);
    showHeard('', false);
    return;
  }
  if (bar) bar.hidden = !micUsable();
  title.textContent = TITLES[s.kind] || '';

  if (s.kind === 'letter') {
    stage.appendChild(clueEl(s.w.e));
    stage.appendChild(wordBig(gapHTML(s)));
  } else if (s.kind === 'syll') {
    stage.appendChild(clueEl(s.w.e));
    const built = document.createElement('div'); built.className = 'built'; built.innerHTML = syllHTML(s);
    stage.appendChild(wordBig(WORLDS[G.world].fmt(s.task.mix.join(' ')), 'mix'));
    stage.appendChild(built);
  } else if (s.kind === 'moji') {
    stage.appendChild(clueEl(s.w.e));
    stage.appendChild(wordBig(mojibake(WORLDS[G.world].fmt(plainText(s.w, s.tpl))), 'mojibake'));
  } else {
    stage.appendChild(wordBig(WORLDS[G.world].fmt(plainText(s.w, s.tpl))));
  }
  if (s.rescue || !micUsable()) renderTiles(s, choices);
}
function renderTiles(s, choices) {
  const W = WORLDS[G.world];
  if (s.kind === 'letter') {
    s.task.choices.forEach((ch) => {
      const b = document.createElement('button'); b.className = 'tile'; b.textContent = W.fmt(ch); b.dataset.v = ch;
      b.onclick = () => answer(b, ch === s.task.correct, s);
      choices.appendChild(b);
    });
  } else if (s.kind === 'syll') {
    s.task.mix.forEach((p, idx) => {
      const b = document.createElement('button');
      b.className = 'tile' + (s.task.placed.includes(idx) ? ' used' : '');
      b.textContent = W.fmt(p); b.dataset.v = p;
      b.onclick = () => answerSyll(b, idx, p, s);
      choices.appendChild(b);
    });
  } else if (s.kind === 'moji') {
    s.task.choices.forEach((w) => {
      const b = document.createElement('button'); b.className = 'tile word ' + W.cls;
      b.textContent = W.fmt(plainText(w, s.tpl)); b.dataset.v = letters(w.w);
      b.onclick = () => answer(b, w === s.w, s);
      choices.appendChild(b);
    });
  } else {
    s.task.choices.forEach((w) => {
      const b = document.createElement('button'); b.className = 'tile pic'; b.dataset.v = w.e;
      b.appendChild(emojiEl(w.e));
      b.onclick = () => answer(b, w === s.w, s);
      choices.appendChild(b);
    });
  }
}

function answer(btn, ok, s) {
  if (!A.running || !s.broken) return;
  if (!ok) { wrongTap(btn, s); return; }
  btn.classList.add('right');
  setTimeout(() => fixSlot(s), 280);
}
function answerSyll(btn, idx, part, s) {
  if (!A.running || !s.broken) return;
  if (part !== s.task.parts[s.task.done]) { wrongTap(btn, s); return; }
  s.task.placed.push(idx);
  s.task.done++;
  btn.classList.add('used');
  const built = $('.built', $('#repair-stage'));
  if (built) built.innerHTML = syllHTML(s);
  sfx.fix();
  if (s.task.done >= s.task.parts.length) setTimeout(() => fixSlot(s), 280);
}
function wrongTap(btn, s) {
  sfx.bad();
  btn.classList.add('wrong');
  s.wrong++;
  if (s.wrong >= 3) {
    if (S.settings.tts) speak(plainText(s.w, s.tpl));
    const want = s.kind === 'letter' ? s.task.correct : s.kind === 'syll' ? s.task.parts[s.task.done] : s.kind === 'pic' ? s.w.e : letters(s.w.w);
    document.querySelectorAll('#repair-choices .tile').forEach((t) => { if (t.dataset.v === want && !t.classList.contains('used')) t.classList.add('hint'); });
  }
}
function fixSlot(s) {
  if (!s.broken) return;
  clearTimeout(A.rescueT);
  stopMic();
  s.broken = false; s.kind = null; s.task = null; s.wrong = 0; s.rescue = false;
  A.broken--; A.fixed++;
  sfx.fix();
  A.sel = -1;
  A.slots.forEach(renderSlot);
  s.el.classList.remove('fixed'); void s.el.offsetWidth; s.el.classList.add('fixed');
  updateBar();
  showHeard('', false);
  errbar(A.broken ? `⚠ zbývá opravit: ${A.broken}` : '✓ sklad v pořádku', false);
  if (A.fixed >= S.settings.goal) { win(); return; }
  const next = A.slots.find((x) => x.broken);
  if (next) selectSlot(next.i); else renderRepair();
}

// ---------- konec kola ----------
function win() {
  pause(); sfx.fanfare();
  const k = levelKey(G.world, G.tier);
  const prev = winsFor(k);
  S.progress[k] = { wins: prev + 1 }; save();
  const i = levelOrder.indexOf(k);
  const unlockedNext = !S.settings.unlock && prev === 0 && i + 1 < levelOrder.length;
  $('#done-icon').textContent = '🔧';
  $('#done-title').textContent = 'Sklad je zase v pořádku!';
  $('#done-text').textContent = (unlockedNext ? '🔓 Odemkl se další level! ' : '') + `${A.name} spravila ${A.fixed} beden.`;
  $('#btn-next').textContent = 'Ještě jednou';
  setTimeout(() => $('#modal-done').classList.add('open'), 500);
}
function lose() {
  pause(); sfx.crash();
  errbar('⚠ sklad spadl', true);
  $('#done-icon').textContent = '💥';
  $('#done-title').textContent = 'Sklad spadl!';
  $('#done-text').textContent = (A.fixed ? `Stihla jsi spravit ${A.fixed} beden. ` : '') + 'Rozbily se všechny naráz. Zkus to znovu a oprav je dřív.';
  $('#btn-next').textContent = 'Znovu';
  setTimeout(() => $('#modal-done').classList.add('open'), 700);
}

// ---------- ovládání ----------
$('#btn-mic').onclick = () => {
  if (MIC.dead) { const s = A.slots[A.sel]; if (s) showTiles(s); return; }
  if (MIC.want) stopMic(); else startMic();
};
$('#btn-next').onclick = () => { $('#modal-done').classList.remove('open'); startLevel(G.world, G.tier); };
$('#btn-home').onclick = () => { $('#modal-done').classList.remove('open'); leaveGame(); };
$('#btn-back').onclick = () => leaveGame();
$('#btn-speak').onclick = () => { const s = A.slots[A.sel]; if (s) speak(plainText(s.w, s.tpl)); };
function leaveGame() {
  pause();
  clearTimeout(A.rescueT);
  try { speechSynthesis.cancel(); } catch { /* nic */ }
  renderHome(); show('home');
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
  else if ($('#game').classList.contains('active') && !document.querySelector('.modal.open')) resume();
});

// ---------- nápověda ----------
$('#btn-help').onclick = () => { pause(); $('#modal-help').classList.add('open'); };
$('#help-close').onclick = () => { $('#modal-help').classList.remove('open'); if ($('#game').classList.contains('active')) resume(); };

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
  $('#opt-mic').checked = S.settings.mic; $('#opt-strict').value = String(S.settings.strict);
  $('#opt-speed').value = String(S.settings.speed); $('#opt-goal').value = S.settings.goal;
  $('#opt-syll').checked = S.settings.syll; $('#opt-tts').checked = S.settings.tts;
  $('#opt-sound').checked = S.settings.sound; $('#opt-unlock').checked = S.settings.unlock;
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
    mic: $('#opt-mic').checked, strict: clamp(+$('#opt-strict').value || 0, 0, 2),
    speed: +$('#opt-speed').value || 1, goal: clamp(+$('#opt-goal').value || 8, 3, 20),
    syll: $('#opt-syll').checked, tts: $('#opt-tts').checked, sound: $('#opt-sound').checked, unlock: $('#opt-unlock').checked,
  };
  save();
  $('#modal-parent').classList.remove('open');
  if (!S.settings.mic) stopMic();
  renderHome();
};
$('#btn-reset').onclick = () => { if (confirm('Opravdu smazat všechen postup?')) { localStorage.removeItem(KEY); S = load(); $('#modal-parent').classList.remove('open'); renderHome(); } };

// ---------- start ----------
renderHome();
// Ochrana proti zoomu dvojklikem na iOS
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
