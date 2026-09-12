/* Barabizna – dům se rozpadá, čtení nahlas vrací díly na místo. Vanilla JS, bez závislostí. */
'use strict';

// ---------- util ----------
const $ = (s, r = document) => r.querySelector(s);
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cap1 = (s) => s[0].toLocaleUpperCase('cs') + s.slice(1);
const SVGNS = 'http://www.w3.org/2000/svg';

// ---------- perzistence ----------
const KEY = 'barabizna-v1';
const DEFAULTS = {
  settings: { syll: true, tts: true, sound: true, unlock: false, goal: 8, speed: 1, mic: true, strict: 1 },
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
// every = za kolik sekund v průměru spadne další díl, maxOut = kolik děr smí být naráz
const TIERS = [
  { name: 'Krátká', icon: '🐣', every: 9, maxOut: 3 },
  { name: 'Delší', icon: '🐥', every: 8, maxOut: 3 },
  { name: 'Dlouhá', icon: '🐔', every: 7, maxOut: 4 },
  { name: 'Věty', icon: '📖', every: 7, maxOut: 4 },
];
const levelKey = (w, t) => `${w}-${t}`;
const levelOrder = [];
WORLDS.forEach((_, w) => TIERS.forEach((_, t) => levelOrder.push(levelKey(w, t))));
function winsFor(k) { return (S.progress[k] || {}).wins || 0; }
function stars(k) { const c = winsFor(k); return c >= 6 ? 3 : c >= 3 ? 2 : c >= 1 ? 1 : 0; }
function isUnlocked(k) { if (S.settings.unlock) return true; const i = levelOrder.indexOf(k); return i === 0 || winsFor(levelOrder[i - 1]) >= 1; }

// ---------- jména dílů ----------
const letters = (w) => w.replace(/-/g, '');
function tierOfWord(w) { const n = letters(w).length; return n <= 4 ? 0 : n <= 6 ? 1 : 2; }
// Level neurčuje slovník, ale KTERÉ díly smí spadnout. Ostatní zůstanou stát.
function eligible(tier) {
  return SCENE.parts.filter((p) => (tier === 3 ? tierOfWord(p.w) <= 1 : tierOfWord(p.w) === tier));
}
function renderName(w, world, tpl) {
  const W = WORLDS[world];
  const syl = S.settings.syll && world !== 2;   // u psacího nedělit, kazí to spojení písmen
  const parts = w.split('-').map((p) => W.fmt(p));
  const nameHtml = syl ? parts.join('<span class="syl">·</span>') : parts.join('');
  if (!tpl) return nameHtml;
  let sentence = W.fmt(tpl.replace('{S}', ' '));
  if (world !== 0) sentence = cap1(sentence);
  return sentence.replace(' ', nameHtml);
}
function plainText(w, tpl) { const t = letters(w); return tpl ? tpl.replace('{S}', t) : t; }

// ---------- porovnání slyšeného ----------
// Nehodnotíme výslovnost (rozpoznávač to neumí a začátečník čte po slabikách),
// ale to, které ze jmen dílů je přepisu nejblíž.
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
function heardForms(text) {
  const out = new Set();
  const full = norm(text);
  if (full) out.add(full);
  for (const tok of String(text || '').split(/\s+/)) { const n = norm(tok); if (n) out.add(n); }
  return [...out];
}
const allNames = () => [...new Set(SCENE.parts.map((p) => norm(letters(p.w))))];
function nearestName(forms) {
  let bw = null, bd = Infinity;
  for (const nw of allNames()) for (const h of forms) { const d = lev(h, nw); if (d < bd) { bd = d; bw = nw; } }
  return { w: bw, d: bd };
}
// Čte se kterákoli viditelná díra – porovnáváme se všemi naráz.
function judgeAll(text, out) {
  const forms = heardForms(text);
  if (!forms.length) return {};
  const best = nearestName(forms);
  let hit = null, hitD = Infinity;
  for (const p of out) {
    const nw = norm(letters(p.def.w));
    let d = Infinity;
    for (const h of forms) d = Math.min(d, lev(h, nw));
    if (p.tpl && nw.length >= 3 && forms.some((h) => h.includes(nw))) d = 0;
    if (d <= tol(nw.length) && d <= best.d && d < hitD) { hit = p; hitD = d; }
  }
  if (hit) return { hit };
  // rozečtené jméno („ko“ z „komín“) není chyba, jen se ještě čte
  for (const p of out) {
    const nw = norm(letters(p.def.w));
    if (forms.some((h) => h && h !== nw && (nw.startsWith(h) || h.startsWith(nw)))) return { partial: true };
  }
  // slyšeli jsme jiný díl, který ale nikam nechybí
  if (best.w && best.d <= tol(best.w.length)) return { elsewhere: best.w };
  return {};
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
  fall: () => { beep(200, .12, 'sawtooth', .1); beep(120, .18, 'square', .09, .1); beep(80, .2, 'sine', .08, .22); },
  back: () => { beep(523, .1, 'triangle', .14); beep(784, .12, 'triangle', .16, .09); beep(1047, .18, 'sine', .14, .19); },
  nope: () => beep(180, .2, 'square', .07),
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
// Mikrofon si NEOTVÍRÁME sami (getUserMedia). Vlastní stream rozpoznávači v Chrome
// zvuk sebere – jen se pořád dokola restartuje a pípá.
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
    if (MIC.want && A.running && MIC.fails < 8) { setTimeout(() => { if (MIC.want) tryStart(); }, 400); return; }
    if (MIC.fails >= 8) { MIC.want = false; A.parts.forEach((p) => { if (p.out) makeTappable(p); }); }
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
    A.parts.forEach((p) => { if (p.out) makeTappable(p); });   // bez mikrofonu se ťuká
  }
}
function applyPhrases(rec) {
  if (MIC.noPhrases || typeof SpeechRecognitionPhrase === 'undefined' || !('phrases' in rec)) return;
  try {
    const list = A.parts.filter((p) => p.out).map((p) => new SpeechRecognitionPhrase(letters(p.def.w), 2.0));
    if (!list.length) return;
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
  if (!texts.length || !A.running) return;
  if (!res.isFinal) { showHeard(texts[0].trim(), true); return; }
  showHeard(texts[0].trim(), false);
  const out = A.parts.filter((p) => p.out);
  if (!out.length) return;
  let elsewhere = null, partial = false;
  for (const t of texts) {
    const v = judgeAll(t, out);
    if (v.hit) { restore(v.hit, true); return; }
    if (v.partial) partial = true;
    if (v.elsewhere && !elsewhere) elsewhere = v.elsewhere;
  }
  if (partial) { showHeard('…pokračuj', false); return; }
  if (elsewhere) {
    showHeard(`slyším: ${elsewhere} – ten tam je 🤔`, false);
    sfx.nope();
    out.forEach((p) => { p.wrong++; if (p.wrong >= 2) makeTappable(p); });
  }
}

// ---------- obrazovky ----------
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id)); }

function renderHome() {
  const warn = $('#mic-warn');
  if (!SR) { warn.hidden = false; warn.textContent = '🎤 Tenhle prohlížeč neumí rozpoznávat řeč. Díly se budou vracet ťuknutím na slovo. Nejlíp funguje Chrome.'; }
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

// ---------- scéna ----------
const FIRST_FALL = 3.5;     // s klidu na začátku, ať je vidět celý barák
const TAP_AFTER = 20;       // s s dírou → slovo jde vrátit ťuknutím, ať dítě neuvízne
const G = { world: 0, tier: 0 };
const A = { parts: [], t: 0, restored: 0, raf: 0, last: 0, running: false, nextFall: 0, every: 9, maxOut: 3 };

function buildScene() {
  const svg = $('#svg');
  svg.setAttribute('viewBox', SCENE.view);
  svg.innerHTML = SCENE.base;
  A.parts = SCENE.parts.map((def) => {
    const hole = document.createElementNS(SVGNS, 'rect');
    hole.setAttribute('x', def.box[0]); hole.setAttribute('y', def.box[1]);
    hole.setAttribute('width', def.box[2]); hole.setAttribute('height', def.box[3]);
    hole.setAttribute('rx', '8');
    hole.setAttribute('class', 'hole');
    hole.style.display = 'none';
    svg.appendChild(hole);
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'part');
    g.innerHTML = def.svg;
    svg.appendChild(g);
    return { def, g, hole, el: null, out: false, wrong: 0, tappable: false, tpl: null, fellAt: 0 };
  });
  $('#labels').innerHTML = '';
}

function labelFor(p) {
  const b = document.createElement('button');
  b.className = 'word ' + WORLDS[G.world].cls;
  b.innerHTML = renderName(p.def.w, G.world, p.tpl);
  const [x, y, w, h] = p.def.box;
  b.style.left = clamp(((x + w / 2) / 400) * 100, 13, 87) + '%';
  b.style.top = clamp(((y + h / 2) / 340) * 100, 6, 94) + '%';
  b.onclick = () => tapWord(p);
  return b;
}
function tapWord(p) {
  if (!p.out) return;
  if (p.tappable || !micUsable()) { restore(p, false); return; }
  if (S.settings.tts) speak(plainText(p.def.w, p.tpl));
}
function makeTappable(p) {
  if (!p.out || p.tappable) return;
  p.tappable = true;
  if (p.el) p.el.classList.add('hearable');
}

function dropPart() {
  const pool = A.parts.filter((p) => !p.out && eligible(G.tier).includes(p.def));
  if (!pool.length) return;
  const p = pick(pool);
  p.out = true; p.wrong = 0; p.tappable = false; p.fellAt = A.t;
  p.tpl = G.tier === 3 ? pick(PART_TPL) : null;
  sfx.fall();
  p.g.classList.remove('back');
  p.g.classList.add('falling');
  p.hole.style.display = '';
  setTimeout(() => {
    if (!p.out) return;
    p.g.classList.remove('falling');
    p.g.style.display = 'none';
    p.el = labelFor(p);
    $('#labels').appendChild(p.el);
    if (!micUsable()) makeTappable(p);
  }, 1000);
}

function restore(p, byVoice) {
  if (!p.out) return;
  p.out = false; p.tappable = false;
  if (p.el) { p.el.classList.add('done'); const el = p.el; setTimeout(() => el.remove(), 380); p.el = null; }
  p.hole.style.display = 'none';
  p.g.style.display = '';
  p.g.classList.remove('falling', 'back'); void p.g.getBBox;
  p.g.classList.add('back');
  sfx.back();
  showHeard('', false);
  A.restored++;
  updateBar();
  if (byVoice) MIC.fails = 0;
  if (A.restored >= S.settings.goal) win();
}

function updateBar() {
  const goal = S.settings.goal;
  $('#bar').style.width = (100 * A.restored / goal) + '%';
  $('#bar-text').textContent = `🔨 ${A.restored} / ${goal}`;
}

function startLevel(w, t) {
  G.world = w; G.tier = t;
  A.t = 0; A.restored = 0;
  A.every = TIERS[t].every / (S.settings.speed || 1);
  A.maxOut = TIERS[t].maxOut;
  A.nextFall = FIRST_FALL;
  buildScene();
  updateBar();
  showHeard('', false);
  show('game');
  $('#micbar').hidden = !micUsable();
  A.running = false; resume();
  if (micUsable()) startMic();
}

function loop(ts) {
  if (!A.running) return;
  const dt = Math.min(0.25, (ts - A.last) / 1000 || 0);
  A.last = ts; A.t += dt;
  const out = A.parts.filter((p) => p.out);
  if (A.t >= A.nextFall) {
    A.nextFall = A.t + A.every * (0.8 + Math.random() * 0.4);
    if (out.length < A.maxOut) dropPart();
  }
  // dlouho visící slovo jde vrátit ťuknutím
  for (const p of out) if (!p.tappable && A.t - p.fellAt > TAP_AFTER) makeTappable(p);
  if (A.running) A.raf = requestAnimationFrame(loop);
}
function pause() { A.running = false; cancelAnimationFrame(A.raf); stopMic(); }
function resume() {
  if (A.running) return;
  A.running = true; A.last = performance.now(); A.raf = requestAnimationFrame(loop);
  if (micUsable()) startMic();
}

function win() {
  pause(); sfx.fanfare();
  const k = levelKey(G.world, G.tier);
  const prev = winsFor(k);
  S.progress[k] = { wins: prev + 1 }; save();
  const i = levelOrder.indexOf(k);
  const unlockedNext = !S.settings.unlock && prev === 0 && i + 1 < levelOrder.length;
  $('#done-title').textContent = 'Barabizna stojí!';
  $('#done-text').textContent = (unlockedNext ? '🔓 Odemkl se další level! ' : '') + `Vrátil jsi ${A.restored} dílů na místo.`;
  setTimeout(() => $('#modal-done').classList.add('open'), 500);
}

// ---------- ovládání ----------
$('#btn-mic').onclick = () => {
  if (MIC.dead) { A.parts.forEach((p) => { if (p.out) makeTappable(p); }); return; }
  if (MIC.want) stopMic(); else startMic();
};
$('#btn-next').onclick = () => { $('#modal-done').classList.remove('open'); startLevel(G.world, G.tier); };
$('#btn-home').onclick = () => { $('#modal-done').classList.remove('open'); leaveGame(); };
$('#btn-back').onclick = () => leaveGame();
$('#btn-speak').onclick = () => {
  const p = A.parts.filter((x) => x.out)[0];
  if (p) speak(plainText(p.def.w, p.tpl));
};
function leaveGame() {
  pause();
  try { speechSynthesis.cancel(); } catch { /* nic */ }
  renderHome(); show('home');
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
  else if ($('#game').classList.contains('active') && !document.querySelector('.modal.open')) resume();
});

// ---------- nápověda ----------
$('#btn-help').onclick = () => { if ($('#game').classList.contains('active')) pause(); $('#modal-help').classList.add('open'); };
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
$('#gate-ok').onclick = () => { if (+$('#gate-a').value === gateAnswer) openParent(); else { $('#gate-a').value = ''; sfx.nope(); } };
$('#gate-a').onkeydown = (e) => { if (e.key === 'Enter') $('#gate-ok').click(); };
function openParent() {
  $('#parent-gate').hidden = true; $('#parent-panel').hidden = false;
  $('#opt-mic').checked = S.settings.mic; $('#opt-strict').value = String(S.settings.strict);
  $('#opt-speed').value = String(S.settings.speed); $('#opt-goal').value = S.settings.goal;
  $('#opt-syll').checked = S.settings.syll; $('#opt-tts').checked = S.settings.tts;
  $('#opt-sound').checked = S.settings.sound; $('#opt-unlock').checked = S.settings.unlock;
}
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
