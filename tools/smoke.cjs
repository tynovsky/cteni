#!/usr/bin/env node
/*
 * Smoke test pro hry v tomhle repu.
 *
 *   node tools/smoke.cjs robutek robot ball rail
 *   node tools/smoke.cjs barabizna
 *
 * Proč: ostatní testy zkoušejí jen čisté funkce (gramatika, generátory, parsery).
 * Kód, který staví scénu, se v nich nikdy nespustí – a právě tam vznikla chyba
 * „ROBOT is not defined“, po které nenaběhla ani cedulka a hra byla nehratelná.
 * Tenhle test hru opravdu spustí nad falešným DOM: layout nepočítá, ale pády,
 * překlepy v id a chybějící globály odhalí.
 *
 * Skripty se berou z index.html v pořadí, v jakém tam jsou, takže test platí
 * pro kteroukoli hru bez dalšího nastavování. Volitelné argumenty za názvem hry
 * jsou id, která musí po startu levelu existovat ve scéně.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const wantIds = process.argv.slice(3);
if (!dir) { console.log('použití: node tools/smoke.cjs <složka-hry> [id ...]'); process.exit(2); }
const root = path.resolve(__dirname, '..', dir);
if (!fs.existsSync(path.join(root, 'index.html'))) { console.log('nenalezeno: ' + root + '/index.html'); process.exit(2); }

// ---------- falešný DOM ----------
const REG = new Map();
function el(id) {
  const e = {
    id: id || null, children: [], dataset: {}, _html: '', hidden: false, textContent: '', value: '',
    // style musí umět setProperty – hry přes něj nastavují CSS proměnné (--s, --lvl)
    style: { setProperty() {}, removeProperty() {}, getPropertyValue() { return ''; } },
    classList: {
      _s: new Set(),
      add(...c) { c.forEach((x) => x && this._s.add(x)); },
      remove(...c) { c.forEach((x) => this._s.delete(x)); },
      toggle(c, f) { (f === undefined ? !this._s.has(c) : f) ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    setAttribute(k, v) { if (k === 'id') { this.id = v; REG.set('#' + v, this); } this['a_' + k] = v; },
    getAttribute(k) { return this['a_' + k]; },
    appendChild(c) { this.children.push(c); return c; },
    replaceWith() {}, remove() {}, focus() {},
    querySelector(sel) { return REG.has(sel) ? REG.get(sel) : el(null); },
    querySelectorAll() { return []; },
    addEventListener() {}, setPointerCapture() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; },
    getTotalLength() { return 1000; },
    getPointAtLength(l) { return { x: 40 + (l / 1000) * 360, y: 50 + (l / 1000) * 400 }; },
    getBBox() { return { x: 0, y: 0, width: 100, height: 100 }; },
    get offsetWidth() { return 100; },
    get innerHTML() { return this._html; },
    set innerHTML(v) {
      this._html = String(v);
      for (const m of this._html.matchAll(/id="([\w-]+)"/g)) if (!REG.has('#' + m[1])) REG.set('#' + m[1], el(m[1]));
    },
  };
  if (id) REG.set('#' + id, e);
  return e;
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const m of html.matchAll(/id="([\w-]+)"/g)) el(m[1]);      // id, která v HTML opravdu jsou

const missing = [];
const document = {
  querySelector(sel) {
    if (REG.has(sel)) return REG.get(sel);
    if (sel.startsWith('.')) return el(null);
    missing.push(sel);                                           // překlep v id nebo zapomenutý prvek
    return null;
  },
  querySelectorAll() { return []; },
  createElement() { return el(null); },
  createElementNS() { return el(null); },
  addEventListener() {},
  documentElement: el(null),
  get hidden() { return false; },
};
const store = {};
const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const window = { isSecureContext: true, addEventListener() {}, removeEventListener() {} };
const performance = { now: () => Date.now() };

// skripty ve stejném pořadí jako v index.html
const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
if (!srcs.length) { console.log('index.html nenačítá žádný skript'); process.exit(2); }
const code = srcs.map((s) => fs.readFileSync(path.join(root, s), 'utf8')).join('\n');
console.log(`     ${dir}: ${srcs.join(' + ')}`);

let api, fail = 0;
try {
  api = new Function('document', 'localStorage', 'window', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'confirm', 'alert',
    code + `
    return {
      startLevel: typeof startLevel === 'function' ? startLevel : null,
      TIERS: typeof TIERS !== 'undefined' ? TIERS : null,
      A: typeof A !== 'undefined' ? A : null,
    };`
  )(document, localStorage, window, performance, () => 0, () => {}, () => true, () => {});
} catch (e) {
  console.log('FAIL hra spadla při načtení: ' + e.message);
  process.exit(1);
}
console.log('ok   skripty se načetly bez pádu');

if (missing.length) { console.log('FAIL querySelector nenašel: ' + [...new Set(missing)].join(', ')); fail++; }

if (!api.startLevel) console.log('     (hra nemá startLevel, testuje se jen načtení)');
else {
  const tiers = api.TIERS ? api.TIERS.length : 1;
  for (let t = 0; t < tiers; t++) {
    const before = missing.length;
    try { api.startLevel(0, t); }
    catch (e) { console.log(`FAIL startLevel(0,${t}) spadl: ${e.message}`); fail++; continue; }
    const problems = wantIds.filter((id) => !REG.has('#' + id)).map((id) => 'chybí #' + id);
    if (missing.length > before) problems.push('nenalezená id: ' + missing.slice(before).join(', '));
    const name = api.TIERS ? api.TIERS[t].name : 'level ' + t;
    if (problems.length) { console.log(`FAIL ${name}: ${problems.join('; ')}`); fail++; }
    else console.log(`ok   ${String(name).padEnd(17)} scéna postavena, ${wantIds.length ? wantIds.map((i) => '#' + i).join(' ') + ' na místě' : 'bez pádu'}`);
  }
}

console.log(fail ? `\n${fail} FAILED` : '\nvše prošlo');
process.exit(fail ? 1 : 0);
