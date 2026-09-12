/* Kouzelná slova – čtení nahlas, ovládání mikrofonem. Vanilla JS, bez závislostí. */
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
const KEY = 'kouzelna-slova-v1';
const DEFAULTS = {
  settings: { syll: true, tts: true, sound: true, unlock: false, goal: 8, mic: true, strict: 1 },
  progress: {},      // levelKey -> { correct: n }
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
const TIERS = [
  { name: 'Krátká', icon: '🐣', choices: 3 },
  { name: 'Delší', icon: '🐥', choices: 4 },
  { name: 'Dlouhá', icon: '🐔', choices: 4 },
  { name: 'Věty', icon: '📖', choices: 4 },
];
const UNLOCK_AT = 10;
const levelKey = (w, t) => `${w}-${t}`;
const levelOrder = [];
WORLDS.forEach((_, w) => TIERS.forEach((_, t) => levelOrder.push(levelKey(w, t))));
function correctFor(k) { return (S.progress[k] || {}).correct || 0; }
function stars(k) { const c = correctFor(k); return c >= 20 ? 3 : c >= 10 ? 2 : c >= 5 ? 1 : 0; }
function isUnlocked(k) { if (S.settings.unlock) return true; const i = levelOrder.indexOf(k); return i === 0 || correctFor(levelOrder[i - 1]) >= UNLOCK_AT; }

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

// ---------- porovnání slyšeného ----------
// Rozpoznávač neumí hodnotit výslovnost a začátečník čte po slabikách („MA… SO“).
// Proto neřešíme přesnost přepisu, ale jen to, KTERÉ ze známých slov je přepisu nejblíž.
const norm = (s) => (s || '').toLocaleLowerCase('cs').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
function lev(a, b) {
  if (a === b) return 0;
  if (!a.length || !b.length) return a.length + b.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}
// kolik písmen smíme minout; kratší slovo = menší tolerance (jinak „med“ projde jako „led“)
function tol(n) {
  const s = S.settings.strict;
  if (s === 2) return 0;
  const base = n <= 4 ? 1 : n <= 7 ? 2 : 3;
  return s === 0 ? base + 1 : base;
}
// Z přepisu uděláme kandidáty: celek bez mezer (spojí slabiky) + jednotlivá slova.
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
// ok = uznáno; other = co příšerka slyšela místo toho (vykouzlí to jako vtip)
function judge(text) {
  const forms = heardForms(text);
  if (!forms.length) return { ok: false, other: null };
  const nw = norm(letters(G.word.w));
  // ve větě stačí, když se slovo v přepisu objeví
  if (G.tpl && nw.length >= 3 && forms.some((h) => h.includes(nw))) return { ok: true, other: null };
  let dT = Infinity;
  for (const h of forms) dT = Math.min(dT, lev(h, nw));
  const best = nearestWord(forms);
  // uznáme, když je cílové slovo jedno z nejbližších (shoda nerozhoduje v neprospěch dítěte)
  if (dT <= tol(nw.length) && dT <= best.d) return { ok: true, other: null };
  const other = best.w && best.w !== G.word && best.d <= tol(norm(letters(best.w.w)).length) ? best.w : null;
  return { ok: false, other };
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
  const horn = Math.floor(r() * 4); // 0 nic, 1 rohy, 2 tykadla, 3 uši
  const spots = Math.floor(r() * 4);
  let extras = '';
  if (horn === 1) extras += `<path d="M62,45 L70,12 L88,42 Z M138,45 L130,12 L112,42 Z" fill="${c2}"/>`;
  if (horn === 2) extras += `<path d="M80,40 C70,20 60,20 55,8 M120,40 C130,20 140,20 145,8" stroke="${c2}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="55" cy="8" r="8" fill="${c2}"/><circle cx="145" cy="8" r="8" fill="${c2}"/>`;
  if (horn === 3) extras += `<ellipse cx="45" cy="55" rx="16" ry="26" fill="${c1}" stroke="${c2}" stroke-width="4"/><ellipse cx="155" cy="55" rx="16" ry="26" fill="${c1}" stroke="${c2}" stroke-width="4"/>`;
  let spotSvg = '';
  for (let i = 0; i < spots; i++) spotSvg += `<circle cx="${60 + r() * 80}" cy="${120 + r() * 50}" r="${5 + r() * 7}" fill="${c2}" opacity=".45"/>`;
  // oči
  let eyeSvg = '';
  const eyeR = eyes === 1 ? 22 : eyes === 2 ? 15 : 12;
  const xs = eyes === 1 ? [100] : eyes === 2 ? [78, 122] : [70, 100, 130];
  xs.forEach((x, i) => {
    const y = eyes === 3 && i === 1 ? 62 : 78;
    // při poslouchání oči doširoka, při zmatku jedno přimhouřené
    const rr = mood === 'listen' ? eyeR * 1.12 : mood === 'confused' && i === 0 ? eyeR * 0.7 : eyeR;
    eyeSvg += `<circle cx="${x}" cy="${y}" r="${rr}" fill="#fff"/><circle cx="${x + 3}" cy="${y + 3}" r="${rr * 0.5}" fill="#2b2137"/><circle cx="${x + 6}" cy="${y - 4}" r="${rr * 0.18}" fill="#fff"/>`;
  });
  // pusa
  let mouth = '';
  if (mood === 'happy') mouth = `<path d="M70,118 Q100,160 130,118 Z" fill="#5a1f3a"/><ellipse cx="100" cy="140" rx="14" ry="8" fill="#ff7b9c"/>`;
  else if (mood === 'sad') mouth = `<path d="M75,140 Q100,118 125,140" stroke="#5a1f3a" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  else if (mood === 'listen') mouth = `<ellipse cx="100" cy="132" rx="13" ry="16" fill="#5a1f3a"/>`;
  else if (mood === 'confused') mouth = `<path d="M74,132 q13,-11 26,0 q13,11 26,0" stroke="#5a1f3a" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  else mouth = `<path d="M75,122 Q100,148 125,122" stroke="#5a1f3a" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M92,128 l4,8 l4,-8" fill="#fff"/>`;
  const wonder = mood === 'confused' ? `<text x="150" y="46" font-size="52" font-family="sans-serif" font-weight="bold" fill="${c2}">?</text>` : '';
  const cheeks = `<circle cx="58" cy="112" r="9" fill="#ff7b9c" opacity=".5"/><circle cx="142" cy="112" r="9" fill="#ff7b9c" opacity=".5"/>`;
  const feet = `<ellipse cx="78" cy="182" rx="18" ry="9" fill="${c2}"/><ellipse cx="122" cy="182" rx="18" ry="9" fill="${c2}"/>`;
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${feet}${extras}<path d="${d}" fill="${c1}" stroke="${c2}" stroke-width="5"/>${spotSvg}${cheeks}${eyeSvg}${mouth}${wonder}</svg>`;
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
  ok: () => { beep(523, .12); beep(659, .12, 'sine', .2, .1); beep(784, .2, 'sine', .2, .2); },
  bad: () => beep(160, .25, 'square', .08),
  puf: () => { beep(300, .1, 'triangle', .12); beep(190, .18, 'triangle', .1, .08); },
  magic: () => [660, 880, 1175].forEach((f, i) => beep(f, .18, 'triangle', .14, i * .07)),
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
  u.onend = u.onerror = () => { if (wasOn && !G.busy) setTimeout(startMic, 250); };
  speechSynthesis.speak(u);
}

// ---------- mikrofon ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const MIC = { rec: null, want: false, live: false, dead: false, noPhrases: false, stream: null, ac: null, an: null, raf: 0, quiet: 0 };

function micUsable() { return !!SR && S.settings.mic && !MIC.dead; }
function setMic(cls, label) {
  const b = $('#btn-mic');
  if (b) b.className = 'mic ' + cls;
  const l = $('#mic-label');
  if (l) l.textContent = label;
}
function showHeard(text, interim) {
  const h = $('#heard');
  h.innerHTML = '';
  if (!text) return;
  h.textContent = (interim ? '… ' : '') + text;
}

function buildRec() {
  const rec = new SR();
  rec.lang = 'cs-CZ';
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 5;
  rec.onstart = () => { MIC.live = true; setMic('live', 'Poslouchám…'); startMeter(); };
  rec.onend = () => {
    MIC.live = false;
    if (MIC.want && !G.busy && $('#game').classList.contains('active')) setTimeout(() => { if (MIC.want) tryStart(); }, 250);
    else setMic(MIC.dead ? 'dead' : 'off', MIC.dead ? micDeadLabel() : 'Ťukni a mluv');
  };
  rec.onerror = (e) => onMicError(e.error);
  rec.onresult = onMicResult;
  return rec;
}
let micDeadReason = '';
function micDeadLabel() {
  if (micDeadReason === 'not-allowed') return 'Mikrofon nepovolen';
  if (micDeadReason === 'network') return 'Bez internetu neslyším';
  if (micDeadReason === 'language-not-supported') return 'Čeština tu nejde';
  return 'Mikrofon nejde';
}
function onMicError(err) {
  if (err === 'aborted' || err === 'no-speech') return;               // onend to restartuje
  if (err === 'phrases-not-supported') { MIC.noPhrases = true; return; }
  if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture' || err === 'network' || err === 'language-not-supported') {
    micDeadReason = err === 'service-not-allowed' || err === 'audio-capture' ? 'not-allowed' : err;
    MIC.dead = true; MIC.want = false;
    setMic('dead', micDeadLabel());
    showRescue();                                                     // bez mikrofonu se hraje ťukáním
  }
}
// Nakloníme rozpoznávač k aktuálnímu slovu a k distraktorům (když to prohlížeč umí).
function applyPhrases(rec) {
  if (MIC.noPhrases || typeof SpeechRecognitionPhrase === 'undefined' || !('phrases' in rec)) return;
  try {
    const list = [G.word].concat(G.distract).filter(Boolean).map((w) => new SpeechRecognitionPhrase(letters(w.w), 2.0));
    try { rec.phrases = list; }
    catch { while (rec.phrases.length) rec.phrases.pop(); list.forEach((p) => rec.phrases.push(p)); }
  } catch { MIC.noPhrases = true; }
}
function tryStart() {
  if (!micUsable() || MIC.live || G.busy || !G.word) return;
  if (!MIC.rec) MIC.rec = buildRec();
  applyPhrases(MIC.rec);
  try { MIC.rec.start(); } catch { /* už běží */ }
}
function startMic() { if (!micUsable()) { setMic(SR ? 'dead' : 'dead', SR ? micDeadLabel() : 'Mikrofon nejde'); return; } MIC.want = true; tryStart(); }
function stopMic() {
  MIC.want = false;
  try { MIC.rec && MIC.rec.abort(); } catch { /* nic */ }
  MIC.live = false;
  setMic(MIC.dead ? 'dead' : 'off', MIC.dead ? micDeadLabel() : 'Ťukni a mluv');
}
function onMicResult(e) {
  const res = e.results[e.results.length - 1];
  const texts = [];
  for (let i = 0; i < res.length; i++) texts.push(res[i].transcript);
  if (!texts.length) return;
  if (!res.isFinal) { showHeard(texts[0].trim(), true); return; }
  showHeard(texts[0].trim(), false);
  if (G.busy) return;
  let other = null;
  for (const t of texts) {
    const v = judge(t);
    if (v.ok) { success(); return; }
    if (!other) other = v.other;
  }
  misheard(other);
}

// ukazatel hlasitosti – dítě hned vidí „slyším tě“, než doběhne rozpoznávání (~1 s)
async function startMeter() {
  if (MIC.an || !navigator.mediaDevices) return;
  try {
    MIC.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    MIC.ac = new (window.AudioContext || window.webkitAudioContext)();
    const src = MIC.ac.createMediaStreamSource(MIC.stream);
    MIC.an = MIC.ac.createAnalyser(); MIC.an.fftSize = 512;
    src.connect(MIC.an);
    tickMeter();
  } catch { /* ukazatel je bonus, hra jede i bez něj */ }
}
function tickMeter() {
  if (!MIC.an) return;
  const buf = new Uint8Array(MIC.an.frequencyBinCount);
  MIC.an.getByteTimeDomainData(buf);
  let sum = 0;
  for (const v of buf) { const d = (v - 128) / 128; sum += d * d; }
  const lvl = MIC.live ? clamp(Math.sqrt(sum / buf.length) * 4, 0, 1) : 0;
  document.documentElement.style.setProperty('--lvl', lvl.toFixed(3));
  MIC.raf = requestAnimationFrame(tickMeter);
}
function stopMeter() {
  cancelAnimationFrame(MIC.raf); MIC.raf = 0;
  if (MIC.stream) { MIC.stream.getTracks().forEach((t) => t.stop()); MIC.stream = null; }
  if (MIC.ac) { try { MIC.ac.close(); } catch { /* nic */ } MIC.ac = null; }
  MIC.an = null;
  document.documentElement.style.setProperty('--lvl', '0');
}

// ---------- obrazovky ----------
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id)); }

function renderHome() {
  const warn = $('#mic-warn');
  if (!SR) { warn.hidden = false; warn.textContent = '🎤 Tenhle prohlížeč neumí rozpoznávat řeč. Hra půjde hrát ťukáním na obrázky. Nejlíp funguje Chrome.'; }
  else if (!window.isSecureContext) { warn.hidden = false; warn.textContent = '🎤 Mikrofon funguje jen na zabezpečené stránce (https) nebo na localhost. Tady půjde hrát ťukáním.'; }
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

// ---------- kolo ----------
const G = { world: 0, tier: 0, word: null, tpl: null, distract: [], fed: 0, ate: [], misses: 0, taps: 0, busy: false, seed: 0, name: '' };

function startLevel(w, t) {
  G.world = w; G.tier = t; G.fed = 0; G.ate = []; G.busy = false;
  G.seed = rnd(1e9); G.name = cap1(pick(NAME_SYLLABLES) + pick(NAME_SYLLABLES));
  show('game');
  drawMonster('idle');
  updateBar();
  nextWord();
}
function drawMonster(mood) {
  $('#monster').innerHTML = monsterSVG(G.seed, mood);
  $('#monster-name').textContent = WORLDS[G.world].fmt(G.name);
  $('#monster-name').className = 'monster-name ' + WORLDS[G.world].cls;
}
function poseMonster(mood, cls, ms) {
  drawMonster(mood);
  const m = $('#monster');
  if (cls) { m.classList.remove(cls); void m.offsetWidth; m.classList.add(cls); }
  if (ms) setTimeout(() => { m.classList.remove(cls); if (!G.busy) drawMonster(MIC.live ? 'listen' : 'idle'); }, ms);
}
function updateBar() {
  const goal = S.settings.goal;
  $('#bar').style.width = (100 * G.fed / goal) + '%';
  $('#bar-text').textContent = `${G.fed} / ${goal}`;
}

function nextWord() {
  const pool = wordsOfTier(G.tier);
  const cand = pool.filter((w) => w !== G.word);
  G.misses = 0; G.taps = 0; G.busy = false; G.tpl = null;
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
  G.distract = picked;

  const bubble = $('#bubble'); bubble.className = 'bubble ' + WORLDS[G.world].cls;
  $('#word').innerHTML = renderWord(G.word, G.world, G.tpl);
  bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');

  // ťukací záchrana se schová a předpřipraví
  const box = $('#choices'); box.hidden = true; box.innerHTML = '';
  shuffle(picked.concat([G.word])).forEach((w) => {
    const b = document.createElement('button'); b.className = 'choice'; b.dataset.e = w.e;
    b.appendChild(emojiEl(w.e));
    b.onclick = () => tapAnswer(b, w);
    box.appendChild(b);
  });
  showHeard('', false);
  $('#conjure').className = 'conjure';
  if (MIC.dead || !micUsable()) showRescue();
  if (MIC.want) tryStart(); else setMic(MIC.dead ? 'dead' : 'off', MIC.dead ? micDeadLabel() : 'Ťukni a mluv');
  drawMonster(MIC.live ? 'listen' : 'idle');
}

function showRescue() { $('#choices').hidden = false; }

function conjure(emoji, good) {
  const c = $('#conjure');
  c.innerHTML = ''; c.appendChild(emojiEl(emoji));
  c.className = 'conjure'; void c.offsetWidth;
  c.classList.add(good ? 'good' : 'bad');
  $('.cauldron').classList.toggle('magic', !!good);
}

function success() {
  if (G.busy) return;
  G.busy = true;
  stopMic();
  sfx.ok(); sfx.magic();
  conjure(G.word.e, true);
  poseMonster('happy', 'happy', 900);
  G.ate.push(G.word.e);
  const k = levelKey(G.world, G.tier);
  S.progress[k] = { correct: correctFor(k) + 1 };
  G.fed++; save(); updateBar();
  setTimeout(() => {
    $('.cauldron').classList.remove('magic');
    if (!$('#game').classList.contains('active')) return;
    if (G.fed >= S.settings.goal) done();
    else { nextWord(); if (micUsable() && !MIC.dead) startMic(); }
  }, 1200);
}

function misheard(other) {
  G.misses++;
  sfx.puf();
  if (other) {
    conjure(other.e, false);
    showHeard(`slyším: ${letters(other.w)} 🤔`, false);
  }
  poseMonster('confused', 'confused', 1300);
  if (G.misses >= 2) showRescue();
}

function tapAnswer(btn, w) {
  if (G.busy) return;
  if (w !== G.word) {
    G.taps++; sfx.bad();
    btn.classList.add('wrong');
    poseMonster('sad', 'sad', 900);
    if (G.taps >= 2) {
      if (S.settings.tts) speak(plainText(G.word, G.tpl));
      document.querySelectorAll('.choice').forEach((c) => { if (c.dataset.e === G.word.e) c.classList.add('hint'); });
    }
    return;
  }
  btn.classList.add('right');
  success();
}

function done() {
  stopMic();
  sfx.fanfare();
  const k = levelKey(G.world, G.tier);
  const c = correctFor(k);
  const i = levelOrder.indexOf(k);
  const unlockedNext = !S.settings.unlock && i + 1 < levelOrder.length && c >= UNLOCK_AT && c - G.fed < UNLOCK_AT;
  $('#done-title').textContent = `${WORLDS[G.world].fmt(G.name)} má plný kotlík!`;
  $('#done-text').textContent = (unlockedNext ? '🔓 Odemkl se další level! ' : '') + `Vykouzlili jste ${G.fed} věcí.`;
  $('#done-ate').textContent = G.ate.slice(0, 12).join(' ');
  $('#modal-done').classList.add('open');
}

// ---------- ovládání ----------
$('#btn-mic').onclick = () => {
  if (MIC.dead) { showRescue(); return; }
  if (MIC.want) stopMic(); else startMic();
};
$('#btn-next').onclick = () => { $('#modal-done').classList.remove('open'); startLevel(G.world, G.tier); if (micUsable()) startMic(); };
$('#btn-home').onclick = () => { $('#modal-done').classList.remove('open'); leaveGame(); };
$('#btn-back').onclick = () => leaveGame();
$('#btn-speak').onclick = () => { if (G.word) speak(plainText(G.word, G.tpl)); };
$('#bubble').onclick = () => { if (G.word && S.settings.tts) speak(plainText(G.word, G.tpl)); };
function leaveGame() {
  G.busy = true; G.word = null;
  stopMic(); stopMeter();
  try { speechSynthesis.cancel(); } catch { /* nic */ }
  renderHome(); show('home');
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { stopMic(); stopMeter(); } });

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
  $('#opt-mic').checked = S.settings.mic; $('#opt-strict').value = String(S.settings.strict);
  $('#opt-syll').checked = S.settings.syll; $('#opt-tts').checked = S.settings.tts;
  $('#opt-sound').checked = S.settings.sound; $('#opt-unlock').checked = S.settings.unlock;
  $('#opt-goal').value = S.settings.goal;
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
    syll: $('#opt-syll').checked, tts: $('#opt-tts').checked, sound: $('#opt-sound').checked, unlock: $('#opt-unlock').checked,
    goal: clamp(+$('#opt-goal').value || 8, 3, 20),
  };
  save();
  $('#modal-parent').classList.remove('open');
  if (!S.settings.mic) { stopMic(); stopMeter(); }
  renderHome();
};
$('#btn-reset').onclick = () => { if (confirm('Opravdu smazat všechen postup?')) { localStorage.removeItem(KEY); S = load(); $('#modal-parent').classList.remove('open'); renderHome(); } };

// ---------- start ----------
renderHome();
// Ochrana proti zoomu dvojklikem na iOS
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
