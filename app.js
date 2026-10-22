'use strict';

/* ---------- Hilfsfunktionen ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = k => `<svg class="i" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${ICONS[k] || ''}</svg>`;
const nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const n0 = x => nf0.format(Math.round(x || 0));
const n1 = x => nf1.format(x || 0);
const num = v => { const x = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : NaN; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const kdate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = kdate(k); d.setDate(d.getDate() + n); return dkey(d); };
const todayKey = () => dkey(new Date());
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WDL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MON = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
const shortDate = k => { const d = kdate(k); return `${WD[d.getDay()]}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`; };
const longDate = k => { const d = kdate(k); return `${WDL[d.getDay()]}, ${d.getDate()}. ${MON[d.getMonth()]}`; };
const dayTitle = k => { const t = todayKey(); if (k === t) return 'Heute'; if (k === addDays(t, -1)) return 'Gestern'; if (k === addDays(t, 1)) return 'Morgen'; return WDL[kdate(k).getDay()]; };

/* ---------- Daten ---------- */
const KEY = 'kalorien.v1';
const DEFAULTS = () => ({ v: 1, setup: false, name: '', greeted: false, goals: { kcal: 2500, c: 280, p: 150, f: 80 }, weightKg: 80, days: {}, foods: {}, weights: [], lastBackup: null });
let S = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const o = JSON.parse(raw); const d = DEFAULTS(); return { ...d, ...o, goals: { ...d.goals, ...(o.goals || {}) } }; }
  } catch (e) { /* leer starten */ }
  return DEFAULTS();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Speichern fehlgeschlagen. Ist der Speicher voll?'); }
}
const getDay = k => S.days[k] || { food: [], sport: [] };
const ensureDay = k => (S.days[k] ||= { food: [], sport: [] });
function cleanDay(k) { const d = S.days[k]; if (d && !d.food.length && !d.sport.length) delete S.days[k]; }
function totals(k) {
  const d = getDay(k), t = { kcal: 0, c: 0, p: 0, f: 0, burned: 0 };
  for (const e of d.food) { t.kcal += e.kcal; t.c += e.c; t.p += e.p; t.f += e.f; }
  for (const s of d.sport) t.burned += s.kcal;
  return t;
}
const calc = (food, g) => ({ kcal: food.kcal * g / 100, c: (food.c || 0) * g / 100, p: (food.p || 0) * g / 100, f: (food.f || 0) * g / 100 });

const MEALS = [
  { id: 'b', name: 'Frühstück', icon: 'sun', g: ['#ffb340', '#ff8a00'] },
  { id: 'l', name: 'Mittagessen', icon: 'bowl', g: ['#4ee37a', '#24b34b'] },
  { id: 'd', name: 'Abendessen', icon: 'moon', g: ['#7d7bff', '#4b49d1'] },
  { id: 's', name: 'Snacks', icon: 'cookie', g: ['#e0a96d', '#b5763a'] },
];
/* Eingebaute Lebensmittel (foods.js) */
const norm = s => String(s || '').toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const BASE = {};
for (const [cat, rows] of Object.entries(typeof FOOD_LIST !== 'undefined' ? FOOD_LIST : {})) {
  for (const [name, kcal, c, p, f, pg, pl] of rows) {
    const id = 'base:' + slug(name);
    BASE[id] = { id, src: 'base', cat, name, brand: '', kcal, c, p, f, portion: pg ? { g: pg, label: `${pl} (${n0(pg)} g)` } : null };
  }
}
const getFood = id => S.foods[id] || BASE[id];
const POPULAR = ['Ei', 'Banane', 'Haferflocken', 'Skyr natur', 'Magerquark', 'Hähnchenbrust roh', 'Reis gekocht', 'Nudeln gekocht', 'Vollkornbrot', 'Apfel', 'Milch 1,5 %', 'Kartoffeln gekocht'].map(n => 'base:' + slug(n));

const mealOf = id => MEALS.find(m => m.id === id) || MEALS[3];
const tile = (ic, g) => `<span class="ic" style="background:linear-gradient(180deg,${g[0]},${g[1]})">${icon(ic)}</span>`;
function mealByTime() { const h = new Date().getHours(); return h < 11 ? 'b' : h < 15 ? 'l' : h < 18 ? 's' : h < 22 ? 'd' : 's'; }

const SPORTS = [
  { id: 'kraft', name: 'Krafttraining', icon: 'barbell', met: 5 },
  { id: 'lauf', name: 'Laufen', icon: 'run', met: 9.5 },
  { id: 'rad', name: 'Radfahren', icon: 'bike', met: 7 },
  { id: 'geh', name: 'Gehen', icon: 'walk', met: 3.5 },
  { id: 'schwimm', name: 'Schwimmen', icon: 'swim', met: 7 },
  { id: 'ball', name: 'Ballsport', icon: 'ball', met: 7 },
  { id: 'sonst', name: 'Sonstiges', icon: 'bolt', met: 5 },
];

/* ---------- Zustand der Oberfläche ---------- */
let tab = 'today';
let cur = todayKey();
let histRange = 7;

/* ---------- Toast ---------- */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
}
const buzz = () => { try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} };

/* ---------- Ringe ---------- */
function ring(pct, color, { size = 140, stroke = 18, track } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  const tr = track || `color-mix(in srgb, ${color} 22%, transparent)`;
  return `<svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:${tr}" stroke-width="${stroke}"/>` +
    (p > 0 ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>` : '') + `</svg>`;
}

/* ---------- Tab-Leiste ---------- */
function renderTabbar() {
  const t = [['today', 'Heute', 'donut', 'donutF'], ['history', 'Verlauf', 'bars', 'barsF'], ['goals', 'Ziele', 'target', 'targetF']];
  $('#tabbar').innerHTML = t.map(([id, l, i, iF]) => `<button class="tb ${tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}">${icon(tab === id ? iF : i)}${l}</button>`).join('');
}

function render() {
  renderTabbar();
  const app = $('#app');
  app.innerHTML = tab === 'today' ? viewToday() : tab === 'history' ? viewHistory() : viewGoals();
}

/* ---------- Heute ---------- */
function viewToday() {
  const t = totals(cur), g = S.goals, d = getDay(cur);
  const left = g.kcal - t.kcal + t.burned;
  const avail = g.kcal + t.burned;
  const over = left < 0;
  const isToday = cur === todayKey();
  const prev = addDays(cur, -1), next = addDays(cur, 1);
  const macro = (v, goal, col, name) => `<div class="mc">${ring(goal ? v / goal : 0, col, { size: 46, stroke: 7 })}<div class="v num">${n0(v)}<em> / ${n0(goal)} g</em></div><div class="k">${name}</div></div>`;
  const meals = MEALS.map(m => {
    const es = d.food.filter(e => e.meal === m.id);
    const kc = es.reduce((a, e) => a + e.kcal, 0);
    const sub = es.length ? esc([...new Set(es.map(e => e.name))].join(', ')) : 'Noch nichts eingetragen';
    return `<div class="it tap" data-act="${es.length ? 'meal' : 'add'}" data-meal="${m.id}" role="button">${tile(m.icon, m.g)}<div class="n"><b>${m.name}</b><span>${sub}</span></div>` +
      (es.length ? `<span class="k num">${n0(kc)}</span><button class="plus" data-act="add" data-meal="${m.id}" aria-label="${m.name}: Lebensmittel hinzufügen">${icon('plus')}</button>` : `<span class="plus">${icon('plus')}</span>`) + `</div>`;
  }).join('');
  const sportSub = d.sport.length ? esc(d.sport.map(s => s.min ? `${s.name} · ${n0(s.min)} min` : s.name).join(', ')) : 'Verbrannte Kalorien eintragen';
  return `
  <header class="nav">
    <button class="navbtn" data-act="day" data-k="${prev}">${icon('left')}${WD[kdate(prev).getDay()]}</button>
    <div class="grp">
      ${isToday ? '' : `<button class="pillbtn" data-act="day" data-k="${todayKey()}">Heute</button><button class="navbtn" data-act="day" data-k="${next}">${WD[kdate(next).getDay()]}${icon('right')}</button>`}
      <button class="circle" data-act="add" aria-label="Lebensmittel hinzufügen">${icon('plus')}</button>
    </div>
  </header>
  <h1 class="lt"><small>${longDate(cur)}</small>${dayTitle(cur)}</h1>
  ${isToday && S.name ? `<p class="greet">${greeting()}</p>` : ''}
  <section class="card hero">
    <div class="ringwrap">${ring(over ? 1 : (avail ? t.kcal / avail : 0), over ? 'var(--org)' : 'var(--tint)', { size: 140, stroke: 18 })}
      <div class="ringlabel"><b class="num">${n0(Math.abs(left))}</b><span>${over ? 'kcal zu viel' : 'kcal übrig'}</span></div></div>
    <div class="stats">
      <div class="st"><span>${icon('fork')}Gegessen</span><b class="num">${n0(t.kcal)}<em>kcal</em></b></div>
      <div class="st"><span style="--x:0">${icon('flame')}Verbrannt</span><b class="num" style="color:var(--grn)">${n0(t.burned)}<em>kcal</em></b></div>
      <div class="st"><span>${icon('target')}Ziel</span><b class="num">${n0(g.kcal)}<em>kcal</em></b></div>
    </div>
  </section>
  <section class="mac">
    ${macro(t.c, g.c, 'var(--org)', 'Kohlenhydrate')}${macro(t.p, g.p, 'var(--grn)', 'Eiweiß')}${macro(t.f, g.f, 'var(--blu)', 'Fett')}
  </section>
  <div class="hdr"><span>Mahlzeiten</span></div>
  <section class="list icons">
    ${meals}
    <div class="it tap" data-act="sport" role="button">${tile('barbell', ['#ff5c7c', '#e8264d'])}<div class="n"><b>Sport</b><span>${sportSub}</span></div>
      ${t.burned ? `<span class="k good num">−${n0(t.burned)}</span>` : ''}<span class="${t.burned ? 'chev' : 'plus'}">${icon(t.burned ? 'right' : 'plus')}</span></div>
  </section>`;
}

function greeting() {
  const h = new Date().getHours(), n = esc(S.name);
  if (h < 5) return `Noch wach, ${n}? 🌙`;
  if (h < 11) return `Guten Morgen, ${n} ☀️`;
  if (h < 17) return `Hey ${n}, läuft bei dir 💪`;
  if (h < 22) return `Guten Abend, ${n} 👋`;
  return `Gute Nacht, ${n} 😴`;
}

/* ---------- Verlauf ---------- */
function viewHistory() {
  const t = todayKey(), N = histRange;
  const keys = []; for (let i = N - 1; i >= 0; i--) keys.push(addDays(t, -i));
  const rows = keys.map(k => ({ k, ...totals(k), has: !!S.days[k] && getDay(k).food.length > 0 }));
  const withData = rows.filter(r => r.has && r.k !== t);
  const base = withData.length ? withData : rows.filter(r => r.has);
  const avg = f => base.length ? base.reduce((a, r) => a + r[f], 0) / base.length : 0;
  const goal = S.goals.kcal;
  const max = Math.max(goal * 1.15, ...rows.map(r => r.kcal)) || 1;
  const label = (r, i) => N === 7 ? WD[kdate(r.k).getDay()] : (N === 30 ? (i % 7 === 0 ? kdate(r.k).getDate() + '.' : '') : (i % 30 === 0 ? MON[kdate(r.k).getMonth()] : ''));
  const bars = rows.map((r, i) => {
    const h = r.has ? Math.max(2, r.kcal / max * 100) : 2;
    const cls = !r.has ? 'none' : (r.kcal > goal + r.burned ? 'over' : '') + (r.k === t ? ' today' : '');
    return `<div class="col" data-act="openday" data-k="${r.k}"><i class="${cls}" style="height:${h}%"></i><em>${label(r, i)}</em></div>`;
  }).join('');
  const goalTop = (1 - goal / max) * 130; // 150px Höhe minus 20px Beschriftung
  const days = rows.filter(r => r.has).reverse().slice(0, N === 7 ? 7 : 31).map(r =>
    `<button class="it" data-act="openday" data-k="${r.k}"><div class="n"><b>${shortDate(r.k)}${r.k === t ? ' · heute' : ''}</b></div><span class="k num">${n0(r.kcal)} kcal · ${n0(r.p)} g Eiweiß</span><span class="chev">${icon('right')}</span></button>`).join('');
  const lastW = S.weights.length ? S.weights[S.weights.length - 1] : null;
  const wDiff = weightDiff(30);
  const pAvg = avg('p');
  const backupAge = S.lastBackup ? Math.floor((Date.now() - S.lastBackup) / 864e5) : null;
  const hasAny = Object.keys(S.days).length > 0;
  const backupSub = S.lastBackup ? `Zuletzt gesichert am ${shortDate(dkey(new Date(S.lastBackup)))}` : 'Noch nie gesichert';
  return `
  <header class="nav"></header>
  <h1 class="lt">Verlauf</h1>
  <div class="seg" role="tablist">
    ${[[7, 'Woche'], [30, 'Monat'], [90, '3 Monate']].map(([n, l]) => `<button class="${N === n ? 'on' : ''}" data-act="range" data-n="${n}">${l}</button>`).join('')}
  </div>
  <section class="card">
    <div class="ctop">Durchschnitt</div>
    <div class="big"><b class="num">${base.length ? n0(avg('kcal')) : '–'}</b><span>kcal pro Tag</span></div>
    <div class="range">${shortDate(keys[0])} – ${shortDate(keys[keys.length - 1])}</div>
    <div class="chart" style="--gap:${N === 7 ? 10 : N === 30 ? 3 : 1}px">
      <div class="goal" style="top:${goalTop.toFixed(0)}px"><span>Ziel ${n0(goal)}</span></div>${bars}
    </div>
  </section>
  <section class="list icons">
    <div class="it">${tile('egg', ['#4ee37a', '#24b34b'])}<div class="n"><b>Eiweiß</b><span>${base.length ? `Ø ${n0(pAvg)} g · Ziel ${n0(S.goals.p)} g` : 'Noch keine Daten'}</span></div>${base.length && pAvg >= S.goals.p * .95 ? `<span style="color:var(--grn);font-size:22px">${icon('check')}</span>` : ''}</div>
    <div class="it"><span class="ic" style="background:linear-gradient(180deg,#ffb340,#ff8a00)">${icon('bolt')}</span><div class="n"><b>Makros im Schnitt</b><span>${base.length ? `${n0(avg('c'))} g KH · ${n0(pAvg)} g Eiweiß · ${n0(avg('f'))} g Fett` : 'Noch keine Daten'}</span></div></div>
    <button class="it" data-act="weight">${tile('scales', ['#40a0ff', '#0a6fe0'])}<div class="n"><b>Körpergewicht</b><span>${lastW ? `${n1(lastW.kg)} kg${wDiff !== null ? ` · ${wDiff > 0 ? '+' : wDiff < 0 ? '−' : '±'}${n1(Math.abs(wDiff))} kg in 30 Tagen` : ''}` : 'Gewicht eintragen'}</span></div><span class="chev">${icon('right')}</span></button>
    <button class="it" data-act="backup">${tile('cloud', backupAge !== null && backupAge < 30 || !hasAny ? ['#a1a1a6', '#6e6e73'] : ['#ffb340', '#ff8a00'])}<div class="n"><b>Backup</b><span>${backupSub}</span></div><span class="chev">${icon('right')}</span></button>
  </section>
  ${days ? `<div class="hdr"><span>Tage</span></div><section class="list">${days}</section>` : `<p class="empty">Hier erscheinen deine Tage, sobald du etwas eingetragen hast.</p>`}`;
}
function weightDiff(daysBack) {
  const w = S.weights; if (w.length < 2) return null;
  const last = w[w.length - 1], from = addDays(last.date, -daysBack);
  let ref = w.find(x => x.date >= from); if (!ref || ref === last) ref = w[w.length - 2];
  return last.kg - ref.kg;
}

/* ---------- Ziele ---------- */
function viewGoals() {
  const g = S.goals, macroKcal = g.c * 4 + g.p * 4 + g.f * 9;
  const inp = (id, label, val, unit) => `<div class="row-in"><label for="${id}">${label}</label><input id="${id}" inputmode="decimal" value="${val}" data-goal="${id}"><span class="u">${unit}</span></div>`;
  return `
  <header class="nav"></header>
  <h1 class="lt">Ziele</h1>
  <div class="hdr"><span>Tagesziele</span></div>
  <section class="list">
    ${inp('kcal', 'Kalorien', g.kcal, 'kcal')}
    ${inp('c', 'Kohlenhydrate', g.c, 'g')}
    ${inp('p', 'Eiweiß', g.p, 'g')}
    ${inp('f', 'Fett', g.f, 'g')}
  </section>
  <p class="foot" id="macrohint">Deine Makros ergeben zusammen ${n0(macroKcal)} kcal.${Math.abs(macroKcal - g.kcal) > 50 ? ` <button data-act="kcalFromMacros" style="color:var(--tint);font-weight:600">Als Kalorienziel übernehmen</button>` : ''}</p>
  <div class="hdr"><span>Für die Sport-Berechnung</span></div>
  <section class="list">${inp('weightKg', 'Körpergewicht', n1(S.weightKg), 'kg')}</section>
  <div class="hdr"><span>Profil</span></div>
  <section class="list"><div class="row-in"><label for="name">Dein Name</label><input id="name" class="wide" value="${esc(S.name)}" data-goal="name" autocapitalize="words" placeholder="Name"><span class="u"></span></div></section>
  <div class="hdr"><span>Daten</span></div>
  <section class="list icons">
    <button class="it" data-act="backup">${tile('cloud', ['#40a0ff', '#0a6fe0'])}<div class="n"><b>Backup erstellen oder laden</b><span>Sicherungsdatei, z. B. in iCloud Drive</span></div><span class="chev">${icon('right')}</span></button>
    <button class="it" data-act="healthHelp">${tile('heart', ['#ff5c7c', '#e8264d'])}<div class="n"><b>Apple Health verbinden</b><span>Verbrannte Kalorien per Kurzbefehl</span></div><span class="chev">${icon('right')}</span></button>
    <button class="it" data-act="ownFoods">${tile('pencil', ['#a1a1a6', '#6e6e73'])}<div class="n"><b>Eigene Lebensmittel</b><span>${Object.values(S.foods).length} gespeichert</span></div><span class="chev">${icon('right')}</span></button>
  </section>
  <p class="foot">Alle Daten bleiben auf diesem Gerät. Es gibt kein Konto und keine Werbung. Eingebaute Lebensmittel sind Richtwerte. Die Online-Suche und der Barcode-Scan nutzen Open Food Facts (offene Datenbank, ODbL).</p>
  <section class="list"><button class="it danger" data-act="wipe">Alle Daten löschen</button></section>`;
}

/* ---------- Ebenen (Sheets und Seiten) ---------- */
const stack = [];
function openLayer(kind, html, onMount) {
  const layer = $('#layer');
  const dim = document.createElement('div'); dim.className = 'dim';
  const el = document.createElement('div'); el.className = kind;
  el.innerHTML = kind === 'page' ? `<div class="inner">${html}</div>` : `<div class="grab"></div>${html}`;
  if (kind === 'sheet') { layer.appendChild(dim); dim.addEventListener('click', closeTop); }
  layer.appendChild(el);
  const entry = { el, dim: kind === 'sheet' ? dim : null, kind, cleanup: null };
  stack.push(entry);
  requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('in'); dim.classList.add('in'); }));
  if (onMount) entry.cleanup = onMount(el) || null;
  el.querySelectorAll('.amt input').forEach(fitAmt);
  if (kind === 'sheet') enableSwipeDown(el);
  return el;
}
function closeTop() {
  const e = stack.pop(); if (!e) return;
  if (e.cleanup) e.cleanup();
  e.el.classList.remove('in'); e.dim && e.dim.classList.remove('in');
  setTimeout(() => { e.el.remove(); e.dim && e.dim.remove(); }, 320);
}
function closeAll() { while (stack.length) closeTop(); }
function enableSwipeDown(el) {
  let y0 = null, dy = 0;
  el.addEventListener('touchstart', ev => { if (el.scrollTop <= 0 && !ev.target.closest('input')) { y0 = ev.touches[0].clientY; dy = 0; el.style.transition = 'none'; } }, { passive: true });
  el.addEventListener('touchmove', ev => { if (y0 === null) return; dy = Math.max(0, ev.touches[0].clientY - y0); el.style.transform = `translateY(${dy}px)`; }, { passive: true });
  el.addEventListener('touchend', () => {
    if (y0 === null) return; el.style.transition = ''; el.style.transform = '';
    if (dy > 110 && stack.length && stack[stack.length - 1].el === el) closeTop();
    y0 = null;
  });
}

/* ---------- Lebensmittel hinzufügen ---------- */
let addCtx = null;
function openAdd(meal) {
  addCtx = { meal: meal || mealByTime(), day: cur, filter: 'recent', q: '', online: null, loading: false };
  openLayer('page', `
    <div class="sticky">
      <div class="nav"><button class="navbtn" data-act="close">Fertig</button><button class="navtitle" data-act="pickMeal" id="addTitle"></button><span style="width:52px"></span></div>
      <div class="searchrow">
        <label class="srch">${icon('search')}<input id="q" type="search" enterkeyhint="search" placeholder="Lebensmittel suchen" autocomplete="off" autocorrect="off"></label>
        <button class="scanbtn" data-act="scan" aria-label="Barcode scannen">${icon('barcode')}</button>
      </div>
      <div class="seg" id="addSeg"></div>
    </div>
    <div id="addBody" style="display:flex;flex-direction:column;gap:12px"></div>`, el => {
    const q = $('#q', el);
    q.addEventListener('input', () => { addCtx.q = q.value.trim(); addCtx.online = null; renderAddBody(); });
    q.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); q.blur(); searchOnline(); } });
    renderAddHead(); renderAddBody();
  });
}
function renderAddHead() {
  const t = $('#addTitle'); if (!t) return;
  t.innerHTML = `${esc(mealOf(addCtx.meal).name)} <span style="color:var(--l2);font-size:13px">▾</span>`;
  $('#addSeg').innerHTML = [['recent', 'Zuletzt'], ['list', 'Liste'], ['fav', 'Favoriten'], ['own', 'Eigene']].map(([id, l]) => `<button class="${addCtx.filter === id ? 'on' : ''}" data-act="addFilter" data-f="${id}">${l}</button>`).join('');
}
const foodRow = (f, extra = '') => `<button class="it" data-act="pickFood" data-id="${esc(f.id)}"${extra}><div class="n"><b>${esc(f.name)}</b><span>${f.brand ? esc(f.brand) + ' · ' : ''}${f.portion ? `${esc(f.portion.label)} · ${n0(f.kcal * f.portion.g / 100)} kcal` : `${n0(f.kcal)} kcal pro 100 g`}</span></div><span class="plus">${icon('plus')}</span></button>`;
function renderAddBody() {
  const body = $('#addBody'); if (!body) return;
  const foods = Object.values(S.foods);
  let html = '';
  if (addCtx.q) {
    const words = norm(addCtx.q).split(/\s+/).filter(Boolean);
    const pool = [...foods, ...Object.values(BASE).filter(b => !S.foods[b.id])];
    const starts = f => norm(f.name).startsWith(words[0]) ? 0 : 1;
    const loc = pool.filter(f => { const h = norm(f.name + ' ' + (f.brand || '')); return words.every(w => h.includes(w)); })
      .sort((a, b) => (b.used || 0) - (a.used || 0) || starts(a) - starts(b) || a.name.length - b.name.length).slice(0, 30);
    if (loc.length) html += `<div class="hdr"><span>Lebensmittel</span></div><section class="list">${loc.map(f => foodRow(f)).join('')}</section>`;
    html += `<div class="hdr"><span>Open Food Facts</span></div>`;
    if (addCtx.loading) html += `<section class="list"><div class="empty"><div class="spin"></div></div></section>`;
    else if (addCtx.online === null) html += `<section class="list"><button class="it action" data-act="searchOnline">${icon('globe')}Online nach „${esc(addCtx.q)}“ suchen</button></section>`;
    else if (addCtx.online.error) html += `<section class="list"><div class="empty">${esc(addCtx.online.error)}</div><button class="it action" data-act="searchOnline">${icon('globe')}Nochmal versuchen</button></section>`;
    else if (!addCtx.online.items.length) html += `<section class="list"><div class="empty">Nichts gefunden. Probier einen anderen Begriff oder scanne den Barcode.</div></section>`;
    else html += `<section class="list">${addCtx.online.items.map((f, i) => `<button class="it" data-act="pickOnline" data-i="${i}"><div class="n"><b>${esc(f.name)}</b><span>${f.brand ? esc(f.brand) + ' · ' : ''}${n0(f.kcal)} kcal pro 100 g</span></div><span class="plus">${icon('plus')}</span></button>`).join('')}</section>`;
  } else {
    let list;
    if (addCtx.filter === 'list') {
      const cats = {};
      for (const b of Object.values(BASE)) (cats[b.cat] ||= []).push(getFood(b.id));
      body.innerHTML = Object.entries(cats).map(([c, fs]) => `<div class="hdr"><span>${esc(c)}</span></div><section class="list">${fs.map(f => foodRow(f)).join('')}</section>`).join('') +
        `<p class="foot">Die eingebauten Werte sind Richtwerte pro 100 g. Für genaue Werte einer Marke den Barcode scannen.</p>`;
      return;
    }
    if (addCtx.filter === 'fav') list = foods.filter(f => f.fav).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    else if (addCtx.filter === 'own') list = foods.filter(f => f.src === 'own').sort((a, b) => a.name.localeCompare(b.name, 'de'));
    else list = foods.filter(f => f.last).sort((a, b) => b.last - a.last).slice(0, 40);
    const empty = { recent: '', fav: 'Noch keine Favoriten. Tippe beim Eintragen auf den Stern, um ein Lebensmittel hier abzulegen.', own: 'Noch keine eigenen Lebensmittel. Leg eins an, wenn du es online nicht findest.' }[addCtx.filter];
    if (!list.length && addCtx.filter === 'recent') {
      html += `<div class="hdr"><span>Beliebt</span></div><section class="list">${POPULAR.map(getFood).filter(Boolean).map(f => foodRow(f)).join('')}</section>
        <p class="foot">Über ${Object.keys(BASE).length} Lebensmittel sind schon eingebaut, siehe „Liste“. Alles andere findest du über die Suche oder den Barcode.</p>`;
    } else html += list.length ? `<section class="list">${list.map(f => foodRow(f)).join('')}</section>` : `<p class="empty">${empty}</p>`;
  }
  html += `<section class="list icons">
    <button class="it" data-act="newFood">${tile('pencil', ['#a1a1a6', '#6e6e73'])}<div class="n"><b>Eigenes Lebensmittel anlegen</b><span>Werte von der Packung abtippen</span></div><span class="chev">${icon('right')}</span></button>
    <button class="it" data-act="quick">${tile('bolt', ['#ffb340', '#ff8a00'])}<div class="n"><b>Schnell eintragen</b><span>Nur Kalorien, z. B. beim Essen auswärts</span></div><span class="chev">${icon('right')}</span></button>
  </section>`;
  body.innerHTML = html;
}

/* ---------- Open Food Facts ---------- */
const OFF = 'https://world.openfoodfacts.org';
const OFF_FIELDS = 'code,product_name,product_name_de,generic_name_de,brands,nutriments,serving_quantity,serving_size,quantity,product_quantity';
function offToFood(p) {
  if (!p) return null;
  const n = p.nutriments || {};
  let kcal = n['energy-kcal_100g'];
  if (kcal == null && n.energy_100g != null) kcal = n.energy_100g / 4.184;
  if (kcal == null || isNaN(kcal)) return null;
  const name = (p.product_name_de || p.product_name || p.generic_name_de || '').trim();
  if (!name) return null;
  const sq = parseFloat(p.serving_quantity);
  const pq = parseFloat(p.product_quantity);
  return {
    id: 'off:' + p.code, code: String(p.code || ''), src: 'off', name,
    brand: (p.brands || '').split(',')[0].trim(),
    kcal: +kcal, c: +(n.carbohydrates_100g || 0), p: +(n.proteins_100g || 0), f: +(n.fat_100g || 0),
    portion: sq > 0 ? { g: sq, label: p.serving_size ? `Portion (${p.serving_size})` : `Portion (${n0(sq)} g)` } : null,
    pack: pq > 0 && pq < 5000 ? pq : null,
  };
}
async function fetchJSON(url, ms = 15000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
async function searchOnline() {
  if (!addCtx || !addCtx.q) return;
  if (!navigator.onLine) { addCtx.online = { error: 'Kein Internet. Gespeicherte Lebensmittel funktionieren trotzdem.' }; renderAddBody(); return; }
  const q = addCtx.q; addCtx.loading = true; renderAddBody();
  try {
    const url = `${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=30&lc=de&cc=de&sort_by=unique_scans_n&fields=${OFF_FIELDS}`;
    const data = await fetchJSON(url);
    if (!addCtx || addCtx.q !== q) return;
    const seen = new Set();
    addCtx.online = { items: (data.products || []).map(offToFood).filter(f => f && !seen.has(f.id) && seen.add(f.id)) };
  } catch (e) {
    if (!addCtx || addCtx.q !== q) return;
    addCtx.online = { error: 'Die Suche hat nicht geklappt. Open Food Facts ist manchmal langsam, versuch es gleich nochmal.' };
  }
  addCtx.loading = false; renderAddBody();
}
async function lookupBarcode(code) {
  const known = Object.values(S.foods).find(f => f.code === code);
  if (known) return known;
  const data = await fetchJSON(`${OFF}/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}&lc=de`);
  if (data.status !== 1 && data.status !== 'success') return null;
  const f = offToFood({ ...data.product, code: data.product?.code || code });
  return f;
}
function rememberFood(f) {
  const ex = S.foods[f.id];
  S.foods[f.id] = ex ? { ...f, fav: ex.fav, used: ex.used, last: ex.last, lastG: ex.lastG } : { ...f, used: 0 };
  return S.foods[f.id];
}

/* ---------- Menge wählen ---------- */
function openAmount(food, { entry = null, day = null, meal = null } = {}) {
  const f = food;
  const startG = entry ? entry.g : (f.lastG || (f.portion ? f.portion.g : 100));
  const opts = [];
  opts.push({ g: 100, l: '100 g' });
  if (f.portion) opts.push({ g: f.portion.g, l: f.portion.label.length > 22 ? `Portion ${n0(f.portion.g)} g` : f.portion.label });
  if (f.pack && f.pack !== 100 && (!f.portion || f.pack !== f.portion.g)) opts.push({ g: f.pack, l: `Packung ${n0(f.pack)} g` });
  if (f.lastG && !opts.some(o => o.g === f.lastG)) opts.push({ g: f.lastG, l: `Zuletzt ${n0(f.lastG)} g` });
  openLayer('sheet', `
    <div class="sh"><div class="t"><b>${esc(f.name)}</b><span>${f.brand ? esc(f.brand) + ' · ' : ''}${n0(f.kcal)} kcal pro 100 g</span></div>
      <div class="acts">${f.id && !f.quick ? `<button class="xb star" data-act="fav" data-id="${esc(f.id)}" aria-label="Favorit">${icon(S.foods[f.id]?.fav ? 'starF' : 'star')}</button>` : ''}<button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div></div>
    <div class="amt"><input id="grams" inputmode="decimal" value="${n1(startG)}" aria-label="Menge in Gramm"><span>g</span></div>
    <div class="pills">${opts.map(o => `<button class="pill" data-g="${o.g}">${esc(o.l)}</button>`).join('')}</div>
    <div class="nut" id="nut"></div>
    <button class="btn" id="amtOk">${entry ? 'Speichern' : `Zu ${esc(mealOf(meal || addCtx?.meal || mealByTime()).name)} hinzufügen`}</button>
    ${entry ? `<button class="btn del" id="amtDel">Eintrag löschen</button>` : ''}`, el => {
    const gi = $('#grams', el);
    const upd = () => {
      const g = num(gi.value), v = calc(f, isNaN(g) ? 0 : g);
      $('#nut', el).innerHTML = `<div><b class="num">${n0(v.kcal)}</b><span>kcal</span></div><div><b class="num" style="color:var(--org)">${n1(v.c)} g</b><span>KH</span></div><div><b class="num" style="color:var(--grn)">${n1(v.p)} g</b><span>Eiweiß</span></div><div><b class="num" style="color:var(--blu)">${n1(v.f)} g</b><span>Fett</span></div>`;
      el.querySelectorAll('.pill').forEach(p => p.classList.toggle('on', +p.dataset.g === g));
      $('#amtOk', el).disabled = !(g > 0);
    };
    gi.addEventListener('input', upd);
    gi.addEventListener('focus', () => gi.select());
    el.querySelectorAll('.pill').forEach(p => p.addEventListener('click', () => { gi.value = n1(+p.dataset.g); fitAmt(gi); upd(); }));
    $('#amtOk', el).addEventListener('click', () => {
      const g = num(gi.value); if (!(g > 0)) return;
      const v = calc(f, g);
      if (entry) {
        Object.assign(entry, { g, ...v });
      } else {
        const k = day || addCtx?.day || cur;
        ensureDay(k).food.push({ id: uid(), meal: meal || addCtx?.meal || mealByTime(), foodId: f.quick ? null : f.id, name: f.name, g, ...v, per: { kcal: f.kcal, c: f.c, p: f.p, f: f.f }, t: Date.now() });
        if (!f.quick) { const sf = S.foods[f.id] || rememberFood(f); sf.used = (sf.used || 0) + 1; sf.last = Date.now(); sf.lastG = g; }
      }
      save(); buzz(); closeTop();
      toast(entry ? 'Gespeichert' : `${n0(v.kcal)} kcal eingetragen`);
      render(); renderAddBody(); refreshMealSheet();
    });
    if (entry) $('#amtDel', el).addEventListener('click', () => deleteEntry(entry, day));
    upd();
  });
}
function deleteEntry(entry, k) {
  const d = getDay(k); d.food = d.food.filter(e => e !== entry); cleanDay(k); save(); closeTop(); toast('Eintrag gelöscht'); render(); refreshMealSheet();
}

/* ---------- Mahlzeit ansehen ---------- */
let mealSheet = null;
function openMeal(mealId) {
  mealSheet = { meal: mealId, day: cur };
  openLayer('sheet', `<div id="mealBody" style="display:flex;flex-direction:column;gap:14px"></div>`, () => { refreshMealSheet(); return () => { mealSheet = null; }; });
}
function refreshMealSheet() {
  const b = $('#mealBody'); if (!b || !mealSheet) return;
  const m = mealOf(mealSheet.meal), es = getDay(mealSheet.day).food.filter(e => e.meal === m.id);
  const sum = es.reduce((a, e) => ({ kcal: a.kcal + e.kcal, c: a.c + e.c, p: a.p + e.p, f: a.f + e.f }), { kcal: 0, c: 0, p: 0, f: 0 });
  b.innerHTML = `
    <div class="sh"><div class="t"><b>${m.name}</b><span>${dayTitle(mealSheet.day)} · ${n0(sum.kcal)} kcal</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
    <div class="nut"><div><b class="num">${n0(sum.kcal)}</b><span>kcal</span></div><div><b class="num" style="color:var(--org)">${n0(sum.c)} g</b><span>KH</span></div><div><b class="num" style="color:var(--grn)">${n0(sum.p)} g</b><span>Eiweiß</span></div><div><b class="num" style="color:var(--blu)">${n0(sum.f)} g</b><span>Fett</span></div></div>
    ${es.length ? `<section class="list">${es.map(e => `<button class="it" data-act="editEntry" data-id="${e.id}"><div class="n"><b>${esc(e.name)}</b><span>${e.foodId ? n0(e.g) + ' g' : 'Schnelleintrag'}</span></div><span class="k num">${n0(e.kcal)} kcal</span><span class="chev">${icon('right')}</span></button>`).join('')}</section>` : `<p class="empty">Keine Einträge mehr.</p>`}
    <button class="btn" data-act="add" data-meal="${m.id}">Lebensmittel hinzufügen</button>`;
}

/* ---------- Eigenes Lebensmittel / Schnelleintrag ---------- */
function openFoodForm({ code = '', food = null, note = '' } = {}) {
  const f = food || {};
  const row = (id, label, val, unit, wide) => `<div class="row-in"><label for="${id}">${label}</label><input id="${id}" ${wide ? 'class="wide" autocapitalize="sentences"' : 'inputmode="decimal"'} value="${val ?? ''}" placeholder="${wide ? 'Pflichtfeld' : '0'}"><span class="u">${unit}</span></div>`;
  openLayer('sheet', `
    <div class="sh"><div class="t"><b>${food ? 'Lebensmittel bearbeiten' : 'Eigenes Lebensmittel'}</b><span>Werte pro 100 g, wie auf der Packung</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
    ${note ? `<p class="note" style="text-align:left">${esc(note)}</p>` : ''}
    <section class="list">
      ${row('ff_name', 'Name', esc(f.name || ''), '', true)}
      ${row('ff_brand', 'Marke', esc(f.brand || ''), '', true).replace('Pflichtfeld', 'optional')}
    </section>
    <section class="list">
      ${row('ff_kcal', 'Kalorien', f.kcal != null ? n1(f.kcal) : '', 'kcal')}
      ${row('ff_c', 'Kohlenhydrate', f.c != null ? n1(f.c) : '', 'g')}
      ${row('ff_p', 'Eiweiß', f.p != null ? n1(f.p) : '', 'g')}
      ${row('ff_f', 'Fett', f.f != null ? n1(f.f) : '', 'g')}
    </section>
    <section class="list">${row('ff_portion', 'Portion (optional)', f.portion ? n1(f.portion.g) : '', 'g')}</section>
    ${code ? `<p class="note">Barcode ${esc(code)} wird mit gespeichert. Beim nächsten Scan kennt die App das Lebensmittel.</p>` : ''}
    <button class="btn" id="ffSave">Speichern</button>
    ${food ? `<button class="btn del" id="ffDel">Lebensmittel löschen</button>` : ''}`, el => {
    $('#ffSave', el).addEventListener('click', () => {
      const name = $('#ff_name', el).value.trim(), kcal = num($('#ff_kcal', el).value);
      if (!name) { toast('Bitte einen Namen eingeben'); $('#ff_name', el).focus(); return; }
      if (!(kcal >= 0)) { toast('Bitte die Kalorien pro 100 g eingeben'); $('#ff_kcal', el).focus(); return; }
      const pg = num($('#ff_portion', el).value);
      const nf = {
        ...(food || {}), id: food ? food.id : 'own:' + uid(), src: food ? food.src : 'own', code: code || f.code || '', name,
        brand: $('#ff_brand', el).value.trim(), kcal, c: num($('#ff_c', el).value) || 0, p: num($('#ff_p', el).value) || 0, f: num($('#ff_f', el).value) || 0,
        portion: pg > 0 ? { g: pg, label: `Portion (${n0(pg)} g)` } : null,
      };
      S.foods[nf.id] = { ...(S.foods[nf.id] || { used: 0 }), ...nf };
      save(); closeTop(); toast('Lebensmittel gespeichert');
      if (addCtx && $('#addBody')) { renderAddBody(); openAmount(S.foods[nf.id]); } else { render(); refreshOwnFoods(); }
    });
    if (food) $('#ffDel', el).addEventListener('click', ev => {
      const b = ev.currentTarget;
      if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Wirklich löschen? Nochmal tippen'; return; }
      delete S.foods[food.id]; save(); closeTop(); toast('Gelöscht'); render(); refreshOwnFoods();
    });
  });
}
function openQuick() {
  openLayer('sheet', `
    <div class="sh"><div class="t"><b>Schnell eintragen</b><span>${esc(mealOf(addCtx?.meal || mealByTime()).name)}</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
    <div class="amt"><input id="qk" inputmode="decimal" placeholder="0" aria-label="Kalorien"><span>kcal</span></div>
    <section class="list">
      <div class="row-in"><label for="qn">Bezeichnung</label><input id="qn" class="wide" placeholder="Schnelleintrag" autocapitalize="sentences"><span class="u"></span></div>
      <div class="row-in"><label for="qc">Kohlenhydrate</label><input id="qc" inputmode="decimal" placeholder="0"><span class="u">g</span></div>
      <div class="row-in"><label for="qp">Eiweiß</label><input id="qp" inputmode="decimal" placeholder="0"><span class="u">g</span></div>
      <div class="row-in"><label for="qf">Fett</label><input id="qf" inputmode="decimal" placeholder="0"><span class="u">g</span></div>
    </section>
    <button class="btn" id="qkOk">Eintragen</button>`, el => {
    setTimeout(() => $('#qk', el).focus(), 350);
    $('#qkOk', el).addEventListener('click', () => {
      const kcal = num($('#qk', el).value); if (!(kcal > 0)) { toast('Bitte Kalorien eingeben'); return; }
      const k = addCtx?.day || cur;
      ensureDay(k).food.push({ id: uid(), meal: addCtx?.meal || mealByTime(), foodId: null, name: $('#qn', el).value.trim() || 'Schnelleintrag', g: 0, kcal, c: num($('#qc', el).value) || 0, p: num($('#qp', el).value) || 0, f: num($('#qf', el).value) || 0, t: Date.now() });
      save(); buzz(); closeTop(); toast(`${n0(kcal)} kcal eingetragen`); render();
    });
  });
}
function openOwnFoods() {
  openLayer('sheet', `<div id="ownBody" style="display:flex;flex-direction:column;gap:14px"></div>`, () => { refreshOwnFoods(); });
}
function refreshOwnFoods() {
  const b = $('#ownBody'); if (!b) return;
  const list = Object.values(S.foods).sort((a, c) => a.name.localeCompare(c.name, 'de'));
  b.innerHTML = `<div class="sh"><div class="t"><b>Gespeicherte Lebensmittel</b><span>Tippen zum Bearbeiten</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
    ${list.length ? `<section class="list">${list.map(f => `<button class="it" data-act="editFood" data-id="${esc(f.id)}"><div class="n"><b>${f.fav ? '★ ' : ''}${esc(f.name)}</b><span>${f.brand ? esc(f.brand) + ' · ' : ''}${n0(f.kcal)} kcal pro 100 g</span></div><span class="chev">${icon('right')}</span></button>`).join('')}</section>` : '<p class="empty">Noch keine Lebensmittel gespeichert.</p>'}
    <button class="btn" data-act="newFood">Neues Lebensmittel</button>`;
}

/* ---------- Barcode-Scanner ---------- */
let scanner = null;
async function openScanner() {
  if (!navigator.mediaDevices?.getUserMedia) { manualBarcode(); return; }
  const el = document.createElement('div'); el.className = 'scanner';
  el.innerHTML = `<video playsinline muted autoplay></video><div class="scanframe"></div><div class="scantext">Barcode in den Rahmen halten</div>
    <button class="scanclose" aria-label="Schließen">${icon('x')}</button><button class="scanmanual">Nummer eintippen</button>`;
  document.body.appendChild(el);
  const video = $('video', el);
  const stop = () => {
    if (!scanner) return;
    try { scanner.reader && scanner.reader.reset(); } catch (e) {}
    try { video.srcObject && video.srcObject.getTracks().forEach(t => t.stop()); } catch (e) {}
    scanner = null; el.remove();
  };
  scanner = { stop, reader: null, done: false };
  $('.scanclose', el).addEventListener('click', stop);
  $('.scanmanual', el).addEventListener('click', () => { stop(); manualBarcode(); });
  try {
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E]);
    const reader = new ZXing.BrowserMultiFormatReader(hints, 250);
    scanner.reader = reader;
    await reader.decodeFromConstraints({ audio: false, video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } }, video, res => {
      if (!res || !scanner || scanner.done) return;
      scanner.done = true; buzz();
      const code = res.getText(); stop(); handleBarcode(code);
    });
  } catch (e) {
    stop();
    toast(e && e.name === 'NotAllowedError' ? 'Kein Kamerazugriff. Erlaube die Kamera in den Einstellungen.' : 'Kamera konnte nicht gestartet werden');
    manualBarcode();
  }
}
function manualBarcode() {
  openLayer('sheet', `
    <div class="sh"><div class="t"><b>Barcode eintippen</b><span>Die Zahl unter den Strichen</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
    <div class="amt"><input id="bc" inputmode="numeric" placeholder="4000000000000" style="font-size:30px;width:100%" aria-label="Barcode"></div>
    <button class="btn" id="bcOk">Suchen</button>`, el => {
    setTimeout(() => $('#bc', el).focus(), 350);
    $('#bcOk', el).addEventListener('click', () => { const c = $('#bc', el).value.replace(/\D/g, ''); if (c.length < 6) { toast('Bitte die ganze Nummer eingeben'); return; } closeTop(); handleBarcode(c); });
  });
}
async function handleBarcode(code) {
  toast('Suche Produkt …');
  try {
    const f = await lookupBarcode(code);
    if (f) { const sf = S.foods[f.id] ? S.foods[f.id] : f; openAmount(sf); }
    else openFoodForm({ code, note: 'Dieses Produkt kennt Open Food Facts noch nicht. Tipp die Werte einmal von der Packung ab.' });
  } catch (e) {
    toast(navigator.onLine ? 'Produkt konnte nicht geladen werden' : 'Kein Internet für die Produktsuche');
    openFoodForm({ code, note: 'Das Produkt konnte gerade nicht geladen werden. Du kannst die Werte auch selbst eintragen.' });
  }
}

/* ---------- Sport / Verbrannt ---------- */
function openSport() {
  let sel = SPORTS[0];
  openLayer('sheet', `<div id="sportBody" style="display:flex;flex-direction:column;gap:14px"></div>`, el => {
    const draw = () => {
      const d = getDay(cur), total = d.sport.reduce((a, s) => a + s.kcal, 0);
      $('#sportBody', el).innerHTML = `
        <div class="sh"><div class="t"><b>Sport</b><span>${dayTitle(cur)} · ${n0(total)} kcal verbrannt</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
        ${d.sport.length ? `<section class="list">${d.sport.map(s => `<div class="it"><div class="n"><b>${esc(s.name)}</b><span>${s.min ? n0(s.min) + ' min' : s.src === 'health' ? 'Aus Apple Health' : 'Direkt eingetragen'}</span></div><span class="k good num">−${n0(s.kcal)}</span><button class="xb" data-sdel="${s.id}" aria-label="Löschen" style="color:var(--red)">${icon('trash')}</button></div>`).join('')}</section>` : ''}
        <div class="chips">${SPORTS.map(s => `<button class="chip ${s === sel ? 'on' : ''}" data-sp="${s.id}">${icon(s.icon)}${s.name}</button>`).join('')}</div>
        <section class="list">
          <div class="row-in"><label for="spMin">Dauer</label><input id="spMin" inputmode="decimal" placeholder="0"><span class="u">min</span></div>
          <div class="row-in"><label for="spKcal">Verbrannt</label><input id="spKcal" inputmode="decimal" placeholder="0"><span class="u">kcal</span></div>
        </section>
        <p class="note">Die Kalorien werden aus Dauer und deinem Gewicht (${n1(S.weightKg)} kg) geschätzt. Du kannst den Wert auch direkt eintragen, z. B. von deiner Uhr.</p>
        <button class="btn" id="spOk">Eintragen</button>
        <button class="btn sec" id="spHealth">${'Aus Apple Health einfügen'}</button>
        <button class="note" data-act="healthHelp" style="color:var(--tint);font-weight:600">Wie richte ich Apple Health ein?</button>`;
      const mi = $('#spMin', el), ki = $('#spKcal', el);
      let manual = false;
      mi.addEventListener('input', () => { if (manual && ki.value) return; const m = num(mi.value); ki.value = m > 0 ? n0(sel.met * S.weightKg * m / 60) : ''; manual = false; });
      ki.addEventListener('input', () => { manual = !!ki.value; });
      el.querySelectorAll('[data-sp]').forEach(b => b.addEventListener('click', () => { sel = SPORTS.find(s => s.id === b.dataset.sp); draw(); }));
      el.querySelectorAll('[data-sdel]').forEach(b => b.addEventListener('click', () => { const dd = getDay(cur); dd.sport = dd.sport.filter(s => s.id !== b.dataset.sdel); cleanDay(cur); save(); render(); draw(); toast('Gelöscht'); }));
      $('#spOk', el).addEventListener('click', () => {
        const kcal = num(ki.value), min = num(mi.value);
        if (!(kcal > 0)) { toast('Bitte Dauer oder Kalorien eingeben'); return; }
        ensureDay(cur).sport.push({ id: uid(), name: sel.name, min: min > 0 ? min : 0, kcal, src: 'manual' });
        save(); buzz(); render(); draw(); toast(`${n0(kcal)} kcal verbrannt eingetragen`);
      });
      $('#spHealth', el).addEventListener('click', async () => {
        let txt = '';
        try { txt = await navigator.clipboard.readText(); } catch (e) { toast('Einfügen nicht erlaubt. Tippe auf „Einfügen“, wenn das iPhone fragt.'); return; }
        const v = num((txt || '').replace(/[^\d,.\-]/g, ''));
        if (!(v > 0)) { toast('Kein Wert in der Zwischenablage. Starte zuerst den Kurzbefehl.'); return; }
        const dd = ensureDay(cur); dd.sport = dd.sport.filter(s => s.src !== 'health');
        dd.sport.push({ id: uid(), name: 'Apple Health (aktive Energie)', min: 0, kcal: Math.round(v), src: 'health' });
        save(); buzz(); render(); draw(); toast(`${n0(v)} kcal aus Apple Health übernommen`);
      });
    };
    draw();
  });
}
function openHealthHelp() {
  openLayer('sheet', `
    <div class="sh"><div class="t"><b>Apple Health verbinden</b><span>Einmal einrichten, ca. 5 Minuten</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
    <section class="card"><ol class="steps">
      <li>Öffne die App <b>Kurzbefehle</b> und tippe oben rechts auf <b>+</b>.</li>
      <li>Nenne den Kurzbefehl <b>Verbrannt</b>.</li>
      <li>Füge die Aktion <b>Health-Samples suchen</b> hinzu. Tippe auf „Typ“ und wähle <b>Aktive Energie</b>. Stelle „Startdatum“ auf <b>ist heute</b>.</li>
      <li>Füge die Aktion <b>Statistik berechnen</b> hinzu und wähle <b>Summe</b>.</li>
      <li>Füge die Aktion <b>In Zwischenablage kopieren</b> hinzu.</li>
      <li>Fertig. Beim ersten Start fragt das iPhone, ob der Kurzbefehl Health lesen darf: <b>Erlauben</b>.</li>
    </ol></section>
    <section class="card"><ol class="steps" start="1" style="list-style:none;padding:0">
      <li><b>Im Alltag:</b> Kurzbefehl „Verbrannt“ starten (z. B. per Widget oder „Hey Siri, Verbrannt“), dann hier unter Sport auf <b>Aus Apple Health einfügen</b> tippen. Der Wert von heute wird übernommen bzw. aktualisiert.</li>
    </ol></section>
    <button class="btn" data-act="close">Verstanden</button>`);
}

/* ---------- Gewicht ---------- */
function openWeight() {
  openLayer('sheet', `<div id="wBody" style="display:flex;flex-direction:column;gap:14px"></div>`, el => {
    const draw = () => {
      const w = S.weights, last = w[w.length - 1];
      $('#wBody', el).innerHTML = `
        <div class="sh"><div class="t"><b>Körpergewicht</b><span>${last ? `Zuletzt ${n1(last.kg)} kg am ${shortDate(last.date)}` : 'Noch kein Eintrag'}</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
        <div class="amt"><input id="wk" inputmode="decimal" placeholder="${last ? n1(last.kg) : '80,0'}" aria-label="Gewicht in kg"><span>kg</span></div>
        <button class="btn" id="wOk">Für heute speichern</button>
        ${w.length >= 2 ? `<section class="card wchart">${weightChart(w.slice(-90))}</section>` : ''}
        ${w.length ? `<section class="list">${w.slice().reverse().slice(0, 30).map(x => `<div class="it"><div class="n"><b>${n1(x.kg)} kg</b><span>${shortDate(x.date)}</span></div><button class="xb" data-wdel="${x.date}" aria-label="Löschen" style="color:var(--red)">${icon('trash')}</button></div>`).join('')}</section>` : ''}`;
      fitAmt($('#wk', el));
      $('#wOk', el).addEventListener('click', () => {
        const kg = num($('#wk', el).value); if (!(kg > 20 && kg < 400)) { toast('Bitte ein gültiges Gewicht eingeben'); return; }
        const t = todayKey(); S.weights = S.weights.filter(x => x.date !== t); S.weights.push({ date: t, kg }); S.weights.sort((a, b) => a.date.localeCompare(b.date));
        S.weightKg = kg; save(); buzz(); render(); draw(); toast('Gewicht gespeichert');
      });
      el.querySelectorAll('[data-wdel]').forEach(b => b.addEventListener('click', () => { S.weights = S.weights.filter(x => x.date !== b.dataset.wdel); save(); render(); draw(); }));
    };
    draw();
  });
}
function weightChart(w) {
  const W = 320, H = 160, L = 34, R = 8, T = 10, B = 22;
  const xs = w.map(x => kdate(x.date).getTime()), ys = w.map(x => x.kg);
  let y0 = Math.min(...ys), y1 = Math.max(...ys); if (y1 - y0 < 2) { y0 -= 1; y1 += 1; }
  y0 = Math.floor(y0); y1 = Math.ceil(y1);
  const x0 = xs[0], x1 = xs[xs.length - 1] || x0 + 1;
  const X = t => L + (t - x0) / Math.max(1, x1 - x0) * (W - L - R), Y = v => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const pts = w.map((x, i) => `${X(xs[i]).toFixed(1)},${Y(x.kg).toFixed(1)}`);
  const ticks = [y0, (y0 + y1) / 2, y1];
  const lp = pts[pts.length - 1].split(',');
  return `<svg viewBox="0 0 ${W} ${H}" style="overflow:visible">
    ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--sep)" stroke-width="1"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="10" style="fill:var(--l2)">${n1(v)}</text>`).join('')}
    <path d="M${pts[0]} L${pts.join(' L')} L${X(x1)},${H - B} L${X(x0)},${H - B}Z" style="fill:color-mix(in srgb, var(--blu) 18%, transparent)"/>
    <polyline points="${pts.join(' ')}" fill="none" style="stroke:var(--blu)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${lp[0]}" cy="${lp[1]}" r="4.5" style="fill:var(--blu);stroke:var(--sheetcard)" stroke-width="2"/>
    <text x="${L}" y="${H - 5}" font-size="10" style="fill:var(--l2)">${shortDate(w[0].date)}</text>
    <text x="${W - R}" y="${H - 5}" font-size="10" text-anchor="end" style="fill:var(--l2)">${shortDate(w[w.length - 1].date)}</text></svg>`;
}

/* ---------- Backup ---------- */
function openBackup() {
  openLayer('sheet', `
    <div class="sh"><div class="t"><b>Backup</b><span>${S.lastBackup ? `Zuletzt gesichert am ${shortDate(dkey(new Date(S.lastBackup)))}` : 'Noch nie gesichert'}</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
    <p class="note" style="text-align:left">Deine Daten liegen nur auf diesem iPhone. Sichere sie ab und zu als Datei, z. B. in <b>iCloud Drive</b>. Wenn du die App löschst oder ein neues Handy hast, kannst du sie damit wiederherstellen.</p>
    <button class="btn" id="bkSave">Backup erstellen</button>
    <button class="btn sec" id="bkLoad">Backup wiederherstellen</button>
    <input type="file" id="bkFile" accept="application/json,.json" hidden>`, el => {
    $('#bkSave', el).addEventListener('click', exportBackup);
    $('#bkLoad', el).addEventListener('click', () => $('#bkFile', el).click());
    $('#bkFile', el).addEventListener('change', ev => { const file = ev.target.files[0]; if (file) importBackup(file); ev.target.value = ''; });
  });
}
async function exportBackup() {
  const name = `kalorien-backup-${todayKey()}.json`;
  const blob = new Blob([JSON.stringify({ app: 'kalorien', exported: new Date().toISOString(), data: S })], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }
    S.lastBackup = Date.now(); save(); render(); toast('Backup erstellt');
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    toast('Backup konnte nicht erstellt werden');
  }
}
function importBackup(file) {
  const r = new FileReader();
  r.onload = () => {
    let data;
    try { const o = JSON.parse(r.result); data = o.data || o; } catch (e) { toast('Die Datei ist kein gültiges Backup'); return; }
    if (!data || typeof data !== 'object' || !data.days || !data.goals) { toast('Die Datei ist kein gültiges Backup'); return; }
    const days = Object.keys(data.days).length;
    openLayer('sheet', `
      <div class="sh"><div class="t"><b>Backup wiederherstellen?</b><span>${days} Tage, ${Object.keys(data.foods || {}).length} Lebensmittel</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
      <p class="note">Die Daten auf diesem iPhone werden durch das Backup ersetzt.</p>
      <button class="btn" id="imOk">Ersetzen</button><button class="btn sec" data-act="close">Abbrechen</button>`, el => {
      $('#imOk', el).addEventListener('click', () => {
        const d = DEFAULTS(); S = { ...d, ...data, goals: { ...d.goals, ...data.goals }, setup: true }; save(); closeAll(); render(); toast('Backup wiederhergestellt');
      });
    });
  };
  r.readAsText(file);
}

/* ---------- Ersteinrichtung ---------- */
function openWelcome() {
  const firstSetup = !S.setup;
  const goals = !firstSetup ? '' : `
    <p class="note" style="text-align:left">Stell kurz deine Tagesziele ein. Alles bleibt auf deinem iPhone, und du kannst es später unter <b>Ziele</b> ändern.</p>
    <section class="list">
      <div class="row-in"><label for="w_kcal">Kalorien</label><input id="w_kcal" inputmode="decimal" value="${S.goals.kcal}"><span class="u">kcal</span></div>
      <div class="row-in"><label for="w_c">Kohlenhydrate</label><input id="w_c" inputmode="decimal" value="${S.goals.c}"><span class="u">g</span></div>
      <div class="row-in"><label for="w_p">Eiweiß</label><input id="w_p" inputmode="decimal" value="${S.goals.p}"><span class="u">g</span></div>
      <div class="row-in"><label for="w_f">Fett</label><input id="w_f" inputmode="decimal" value="${S.goals.f}"><span class="u">g</span></div>
      <div class="row-in"><label for="w_kg">Körpergewicht</label><input id="w_kg" inputmode="decimal" value="${n1(S.weightKg)}"><span class="u">kg</span></div>
    </section>`;
  // Nur ein einziges Mal zeigen, auch wenn das Fenster weggewischt wird
  S.greeted = true; S.setup = true; save();
  openLayer('sheet', `<div id="wcBody" style="display:flex;flex-direction:column;gap:14px"></div>`, el => {
    const body = $('#wcBody', el);
    const greet = () => {
      const n = esc(S.name);
      body.innerHTML = `<div class="hello">
          <img src="icons/icon-192.png" alt="" class="hello-ic">
          <h2>Hey ${n || 'du'}! 🎉</h2>
          <p>Viel Spaß mit deiner eigenen App! Kein Abo, keine Werbung, kein Schnickschnack. Nur du, dein Essen und deine Ziele.</p>
        </div>${goals}<button class="btn" id="wcOk">Los geht’s${n ? ', ' + n : ''}!</button>`;
      confetti();
      $('#wcOk', el).addEventListener('click', () => {
        if (firstSetup) {
          for (const k of ['kcal', 'c', 'p', 'f']) { const v = num($('#w_' + k, el).value); if (v > 0) S.goals[k] = Math.round(v); }
          const kg = num($('#w_kg', el).value); if (kg > 20 && kg < 400) S.weightKg = kg;
        }
        save(); closeTop(); render();
      });
    };
    if (S.name) { greet(); return; }
    body.innerHTML = `<div class="hello">
        <img src="icons/icon-192.png" alt="" class="hello-ic">
        <h2>Willkommen! 👋</h2>
        <p>Schön, dass du da bist. Wie heißt du?</p>
      </div>
      <section class="list"><div class="row-in"><input id="wcName" class="wide" style="text-align:left" placeholder="Dein Vorname" autocapitalize="words" autocomplete="given-name" enterkeyhint="next" aria-label="Dein Vorname"></div></section>
      <button class="btn" id="wcNext">Weiter</button>`;
    const inp = $('#wcName', el);
    const next = () => {
      const name = inp.value.trim().slice(0, 30);
      if (!name) { toast('Wie heißt du?'); inp.focus(); return; }
      S.name = name; save(); render(); greet();
    };
    $('#wcNext', el).addEventListener('click', next);
    inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); next(); } });
  });
}
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas'), x = c.getContext('2d'), dpr = devicePixelRatio || 1;
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:90';
  c.width = innerWidth * dpr; c.height = innerHeight * dpr; x.scale(dpr, dpr); document.body.appendChild(c);
  const cols = ['#ff375f', '#30d158', '#ff9f0a', '#0a84ff', '#ffd60a', '#bf5af2'];
  const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .35, vx: (Math.random() - .5) * 13, vy: -Math.random() * 13 - 4, r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3, w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, c: cols[Math.floor(Math.random() * cols.length)] }));
  const t0 = performance.now();
  (function frame(t) {
    x.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of ps) { p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); x.restore(); }
    if (t - t0 < 3500) requestAnimationFrame(frame); else c.remove();
  })(t0);
}

/* ---------- Aktionen ---------- */
const ACT = {
  tab: b => { tab = b.dataset.tab; if (tab === 'today') cur = cur || todayKey(); render(); window.scrollTo(0, 0); },
  day: b => { cur = b.dataset.k; render(); },
  openday: b => { cur = b.dataset.k; tab = 'today'; render(); window.scrollTo(0, 0); },
  add: b => { const m = b.dataset.meal; if (stack.length && mealSheet) closeTop(); openAdd(m); },
  meal: b => openMeal(b.dataset.meal),
  sport: () => openSport(),
  close: () => { if (addCtx && stack.length === 1 && $('#addBody')) addCtx = null; closeTop(); },
  pickMeal: () => {
    openLayer('sheet', `<div class="sh"><div class="t"><b>Mahlzeit wählen</b></div><button class="xb" data-act="close">${icon('x')}</button></div>
      <section class="list icons">${MEALS.map(m => `<button class="it" data-act="setMeal" data-meal="${m.id}">${tile(m.icon, m.g)}<div class="n"><b>${m.name}</b></div>${addCtx.meal === m.id ? `<span style="color:var(--tint);font-size:22px">${icon('check')}</span>` : ''}</button>`).join('')}</section>`);
  },
  setMeal: b => { addCtx.meal = b.dataset.meal; closeTop(); renderAddHead(); },
  addFilter: b => { addCtx.filter = b.dataset.f; renderAddHead(); renderAddBody(); },
  searchOnline: () => searchOnline(),
  pickFood: b => { const f = getFood(b.dataset.id); if (f) openAmount(f); },
  pickOnline: b => { const f = addCtx.online.items[+b.dataset.i]; if (f) openAmount(S.foods[f.id] ? { ...S.foods[f.id], ...f, fav: S.foods[f.id].fav, lastG: S.foods[f.id].lastG } : f); },
  fav: b => {
    const id = b.dataset.id; let f = S.foods[id];
    if (!f) { const on = BASE[id] || addCtx?.online?.items.find(x => x.id === id); if (!on) return; f = rememberFood(on); }
    f.fav = !f.fav; save(); b.innerHTML = icon(f.fav ? 'starF' : 'star'); toast(f.fav ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt'); renderAddBody();
  },
  scan: () => openScanner(),
  newFood: () => openFoodForm(),
  editFood: b => { const f = S.foods[b.dataset.id]; if (f) openFoodForm({ food: f }); },
  ownFoods: () => openOwnFoods(),
  quick: () => openQuick(),
  editEntry: b => {
    const e = getDay(mealSheet.day).food.find(x => x.id === b.dataset.id); if (!e) return;
    if (!e.foodId) { editQuick(e, mealSheet.day); return; }
    const f = S.foods[e.foodId] || { id: null, name: e.name, ...(e.per || { kcal: e.kcal / e.g * 100, c: e.c / e.g * 100, p: e.p / e.g * 100, f: e.f / e.g * 100 }) };
    openAmount({ ...f, ...(e.per || {}), name: e.name }, { entry: e, day: mealSheet.day });
  },
  weight: () => openWeight(),
  backup: () => openBackup(),
  healthHelp: () => openHealthHelp(),
  range: b => { histRange = +b.dataset.n; render(); },
  kcalFromMacros: () => { const g = S.goals; g.kcal = Math.round(g.c * 4 + g.p * 4 + g.f * 9); save(); render(); toast('Kalorienziel angepasst'); },
  wipe: b => {
    if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Wirklich alles löschen? Nochmal tippen'; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = 'Alle Daten löschen'; } }, 4000); return; }
    S = DEFAULTS(); save(); cur = todayKey(); tab = 'today'; render(); toast('Alle Daten gelöscht'); openWelcome();
  },
};
function editQuick(e, k) {
  openLayer('sheet', `
    <div class="sh"><div class="t"><b>${esc(e.name)}</b><span>Schnelleintrag</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
    <div class="amt"><input id="eq" inputmode="decimal" value="${n0(e.kcal)}" aria-label="Kalorien"><span>kcal</span></div>
    <button class="btn" id="eqOk">Speichern</button><button class="btn del" id="eqDel">Eintrag löschen</button>`, el => {
    $('#eqOk', el).addEventListener('click', () => { const v = num($('#eq', el).value); if (!(v > 0)) return; const r = v / e.kcal; e.kcal = v; e.c *= r; e.p *= r; e.f *= r; save(); closeTop(); render(); refreshMealSheet(); toast('Gespeichert'); });
    $('#eqDel', el).addEventListener('click', () => deleteEntry(e, k));
  });
}

document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]'); if (!b) return;
  const fn = ACT[b.dataset.act]; if (!fn) return;
  ev.preventDefault(); ev.stopPropagation(); fn(b, ev);
});

/* Große Zahleneingaben passen ihre Breite dem Inhalt an */
function fitAmt(i) { if (i.id === 'bc') return; const len = Math.max((i.value || i.placeholder || '0').length, 1); i.style.width = (len * 0.62 + 0.25) + 'em'; }

/* Ziele direkt beim Tippen speichern */
document.addEventListener('input', ev => {
  if (ev.target.matches && ev.target.matches('.amt input')) fitAmt(ev.target);
  const id = ev.target.dataset && ev.target.dataset.goal; if (!id) return;
  if (id === 'name') { S.name = ev.target.value.trim(); save(); return; }
  const v = num(ev.target.value);
  if (id === 'weightKg') { if (v > 20 && v < 400) S.weightKg = v; }
  else if (v > 0) S.goals[id] = Math.round(v);
  save();
  const g = S.goals, mk = g.c * 4 + g.p * 4 + g.f * 9, h = $('#macrohint');
  if (h) h.innerHTML = `Deine Makros ergeben zusammen ${n0(mk)} kcal.${Math.abs(mk - g.kcal) > 50 ? ` <button data-act="kcalFromMacros" style="color:var(--tint);font-weight:600">Als Kalorienziel übernehmen</button>` : ''}`;
});

/* Wischen zwischen Tagen auf „Heute“ */
(() => {
  let x0 = null, y0 = null;
  const app = $('#app');
  app.addEventListener('touchstart', e => { if (tab !== 'today' || stack.length) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  app.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50) {
      if (dx > 0) cur = addDays(cur, -1); else if (cur < todayKey()) cur = addDays(cur, 1); else return;
      render();
    }
  });
})();

/* Nach Mitternacht oder nach langer Pause auf heute springen */
let lastSeenDay = todayKey();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const t = todayKey();
  if (t !== lastSeenDay) { if (cur === lastSeenDay) cur = t; lastSeenDay = t; render(); }
});

/* ---------- Start ---------- */
render();
if (!S.setup || !S.greeted) openWelcome();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // Neue Version: Seite einmal neu laden, sobald der neue Service Worker übernimmt
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded && !stack.length) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') r.update().catch(() => {}); });
  }).catch(() => {});
}
