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
// Ältere Jahre bekommen die Jahreszahl dazu, z. B. „Fr, 29.08.25“
const shortDate = k => { const d = kdate(k), y = d.getFullYear() !== new Date().getFullYear() ? String(d.getFullYear()).slice(2) : ''; return `${WD[d.getDay()]}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${y}`; };
const longDate = k => { const d = kdate(k); return `${WDL[d.getDay()]}, ${d.getDate()}. ${MON[d.getMonth()]}`; };
const dayTitle = k => { const t = todayKey(); if (k === t) return 'Heute'; if (k === addDays(t, -1)) return 'Gestern'; if (k === addDays(t, 1)) return 'Morgen'; return WDL[kdate(k).getDay()]; };

/* ---------- Daten ---------- */
// Spendenlink (PayPal.me). Leer lassen, um den Eintrag auszublenden.
const DONATE_URL = 'https://paypal.me/MortenUkena';
// Verbesserungswünsche gehen über Formspree direkt an den Entwickler. Leer lassen, um den Eintrag auszublenden.
const WISH_URL = 'https://formspree.io/f/xeepbyjn';
// Versionsnummer für die Anzeige in der App. Bei jedem Update zusammen mit VERSION in sw.js hochzählen.
const APP_VERSION = '1.6.0';
const KEY = 'kalorien.v1';
const DEFAULTS = () => ({
  v: 1, setup: false, name: '', greeted: false, goals: { kcal: 2500, c: 280, p: 150, f: 80 }, weightKg: 80, days: {}, foods: {}, weights: [], lastBackup: null,
  supps: [{ id: 'kreatin', name: 'Kreatin', dose: '5 g' }, { id: 'shake', name: 'Protein-Shake', dose: '' }, { id: 'vitamine', name: 'Vitamine', dose: '' }],
  suppLog: {}, body: [], photos: [], badges: null, profile: null,
});
// Ältere Speicherstände und Backups bekommen fehlende Felder mit Standardwerten
function normalize(o) {
  const d = DEFAULTS(), s = { ...d, ...o, goals: { ...d.goals, ...(o.goals || {}) } };
  for (const k of ['weights', 'supps', 'body', 'photos']) if (!Array.isArray(s[k])) s[k] = d[k];
  for (const k of ['days', 'foods', 'suppLog']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
  if (s.badges && typeof s.badges !== 'object') s.badges = null;
  return s;
}
let S = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { /* leer starten */ }
  return DEFAULTS();
}
let badgeT;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Speichern fehlgeschlagen. Ist der Speicher voll?'); }
  clearTimeout(badgeT); badgeT = setTimeout(checkBadges, 1600);
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
let histRange = 'week', histOff = 0;

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
      <button class="circle" data-act="calendar" aria-label="Kalender">${icon('calendar')}</button>
      <button class="circle" data-act="add" aria-label="Lebensmittel hinzufügen">${icon('plus')}</button>
    </div>
  </header>
  <h1 class="lt" data-act="calendar"><small>${longDate(cur)}${kdate(cur).getFullYear() !== new Date().getFullYear() ? ' ' + kdate(cur).getFullYear() : ''}</small>${dayTitle(cur)}</h1>
  ${isToday && S.name ? `<p class="greet">${greeting()}</p>` : ''}
  ${isToday ? streakPill() : ''}
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
  </section>
  ${suppSection()}`;
}
function suppSection() {
  if (!S.supps.length) return '';
  const taken = S.suppLog[cur] || [], done = S.supps.filter(s => taken.includes(s.id)).length;
  return `<div class="hdr"><span>Supplements · ${done} von ${S.supps.length}</span><button data-act="supps">Bearbeiten</button></div>
  <section class="list icons">${S.supps.map(s => { const on = taken.includes(s.id); return `<button class="it" data-act="suppToggle" data-id="${esc(s.id)}" aria-pressed="${on}">${tile('pill', ['#c77dff', '#9b4dde'])}<div class="n"><b>${esc(s.name)}</b><span>${on ? 'Erledigt' : s.dose ? esc(s.dose) : 'Antippen zum Abhaken'}</span></div><span class="chk${on ? ' on' : ''}">${icon('check')}</span></button>`; }).join('')}</section>`;
}
function streakPill() {
  if (!Object.keys(S.days).length) return '';
  const g = streakInfo(dayInGoal), l = streakInfo(dayLogged);
  const txt = g.cur ? `🔥 <b class="num">${g.cur}</b> ${g.cur === 1 ? 'Tag' : 'Tage'} im Ziel` : l.cur > 1 ? `📅 <b class="num">${l.cur}</b> Tage am Stück eingetragen` : '🔥 Heute im Ziel bleiben und Streak starten';
  return `<button class="streak" data-act="badges">${txt}${g.best > 1 ? `<span>Rekord ${g.best}</span>` : ''}${icon('right')}</button>`;
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
  const t = todayKey(), P = period(), r = histRange;
  const keys = []; for (let k = P.from; k <= P.to; k = addDays(k, 1)) keys.push(k);
  const rows = keys.map(k => ({ k, ...totals(k), has: !!S.days[k] && getDay(k).food.length > 0 }));
  const withData = rows.filter(r => r.has && r.k !== t);
  const base = withData.length ? withData : rows.filter(r => r.has);
  const avg = f => base.length ? base.reduce((a, r) => a + r[f], 0) / base.length : 0;
  const goal = S.goals.kcal;
  // Bis 31 Tage ein Balken pro Tag, darüber ein Balken pro Monat (Durchschnitt der eingetragenen Tage)
  let bars;
  if (keys.length <= 31) {
    bars = rows.map((x, i) => ({ act: 'openday', k: x.k, v: x.kcal, has: x.has, over: x.kcal > goal + x.burned, today: x.k === t,
      l: keys.length <= 7 ? WD[kdate(x.k).getDay()] : (i % 7 === 0 ? kdate(x.k).getDate() + '.' : '') }));
  } else {
    const ms = {};
    for (const x of rows) { const m = x.k.slice(0, 7); (ms[m] ||= { m, days: [] }); if (x.has && x.k !== t) ms[m].days.push(x); }
    const list = Object.values(ms), step = Math.ceil(list.length / 12);
    bars = list.map((g, i) => {
      const v = g.days.length ? g.days.reduce((a, x) => a + x.kcal, 0) / g.days.length : 0;
      const b = g.days.length ? g.days.reduce((a, x) => a + x.burned, 0) / g.days.length : 0;
      const [y, m] = g.m.split('-').map(Number);
      return { act: 'openmonth', k: g.m, v, has: g.days.length > 0, over: v > goal + b, today: false, l: i % step === 0 ? (list.length > 12 && m === 1 || i === 0 && list.length > 12 ? `${MON[m - 1]} ${String(y).slice(2)}` : MON[m - 1]) : '' };
    });
  }
  const max = Math.max(goal * 1.15, ...bars.map(b => b.v)) || 1;
  const barHtml = bars.map(b => `<div class="col" data-act="${b.act}" data-k="${b.k}"><i class="${!b.has ? 'none' : (b.over ? 'over' : '') + (b.today ? ' today' : '')}" style="height:${b.has ? Math.max(2, b.v / max * 100) : 2}%"></i><em>${b.l}</em></div>`).join('');
  const goalTop = (1 - goal / max) * 130; // 150px Höhe minus 20px Beschriftung
  const logged = rows.filter(r => r.has).reverse();
  let days = '';
  if (r === 'week') days = logged.length ? `<section class="list">${logged.map(dayRow).join('')}</section>` : '';
  else {
    const byM = {}; for (const x of logged) (byM[x.k.slice(0, 7)] ||= []).push(x);
    days = Object.entries(byM).map(([m, xs]) => { const [y, mm] = m.split('-').map(Number); return `<div class="hdr"><span>${MONL[mm - 1]} ${y}</span><span>${xs.length} ${xs.length === 1 ? 'Tag' : 'Tage'}</span></div><section class="list">${xs.map(dayRow).join('')}</section>`; }).join('');
  }
  const lastW = S.weights.length ? S.weights[S.weights.length - 1] : null;
  const wDiff = weightDiff(30);
  const pAvg = avg('p');
  const backupAge = S.lastBackup ? Math.floor((Date.now() - S.lastBackup) / 864e5) : null;
  const hasAny = Object.keys(S.days).length > 0;
  const backupSub = S.lastBackup ? `Zuletzt gesichert am ${shortDate(dkey(new Date(S.lastBackup)))}` : 'Noch nie gesichert';
  const canBack = r !== 'all' && P.from > firstDataKey(), canFwd = r !== 'all' && histOff > 0;
  return `
  <header class="nav"><span></span><button class="circle" data-act="calendar" aria-label="Kalender">${icon('calendar')}</button></header>
  <h1 class="lt">Verlauf</h1>
  <div class="seg" role="tablist">
    ${[['week', 'Woche'], ['month', 'Monat'], ['year', 'Jahr'], ['all', 'Alles']].map(([n, l]) => `<button class="${r === n ? 'on' : ''}" data-act="range" data-n="${n}">${l}</button>`).join('')}
  </div>
  <section class="card">
    <div class="pnav">
      <button class="xb" data-act="histStep" data-d="1" ${canBack ? '' : 'disabled'} aria-label="Zurück">${icon('left')}</button>
      <div><b>${P.label}</b><span>${P.sub}</span></div>
      <button class="xb" data-act="histStep" data-d="-1" ${canFwd ? '' : 'disabled'} aria-label="Weiter">${icon('right')}</button>
    </div>
    <div class="ctop" style="margin-top:12px">Durchschnitt</div>
    <div class="big"><b class="num">${base.length ? n0(avg('kcal')) : '–'}</b><span>kcal pro Tag${base.length ? ` · ${base.length} ${base.length === 1 ? 'Tag' : 'Tage'} eingetragen` : ''}</span></div>
    <div class="chart" style="--gap:${bars.length <= 7 ? 10 : bars.length <= 12 ? 6 : bars.length <= 31 ? 3 : 1}px">
      <div class="goal" style="top:${goalTop.toFixed(0)}px"><span>Ziel ${n0(goal)}</span></div>${barHtml}
    </div>
  </section>
  <section class="list icons">
    <div class="it">${tile('egg', ['#4ee37a', '#24b34b'])}<div class="n"><b>Eiweiß</b><span>${base.length ? `Ø ${n0(pAvg)} g · Ziel ${n0(S.goals.p)} g` : 'Keine Daten in diesem Zeitraum'}</span></div>${base.length && pAvg >= S.goals.p * .95 ? `<span style="color:var(--grn);font-size:22px">${icon('check')}</span>` : ''}</div>
    <div class="it"><span class="ic" style="background:linear-gradient(180deg,#ffb340,#ff8a00)">${icon('bolt')}</span><div class="n"><b>Makros im Schnitt</b><span>${base.length ? `${n0(avg('c'))} g KH · ${n0(pAvg)} g Eiweiß · ${n0(avg('f'))} g Fett` : 'Keine Daten in diesem Zeitraum'}</span></div></div>
    <button class="it" data-act="weight">${tile('scales', ['#40a0ff', '#0a6fe0'])}<div class="n"><b>Körpergewicht</b><span>${lastW ? `${n1(lastW.kg)} kg${wDiff !== null ? ` · ${wDiff > 0 ? '+' : wDiff < 0 ? '−' : '±'}${n1(Math.abs(wDiff))} kg in 30 Tagen` : ''}` : 'Gewicht eintragen'}</span></div><span class="chev">${icon('right')}</span></button>
    <button class="it" data-act="body">${tile('ruler', ['#5ac8fa', '#1a9bd7'])}<div class="n"><b>Körpermaße & Fotos</b><span>${bodySub()}</span></div><span class="chev">${icon('right')}</span></button>
    <button class="it" data-act="badges">${tile('trophy', ['#ffd60a', '#f5a300'])}<div class="n"><b>Streaks & Abzeichen</b><span>${earnedCount()} von ${BADGES.length} Abzeichen</span></div><span class="chev">${icon('right')}</span></button>
    <button class="it" data-act="backup">${tile('cloud', backupAge !== null && backupAge < 30 || !hasAny ? ['#a1a1a6', '#6e6e73'] : ['#ffb340', '#ff8a00'])}<div class="n"><b>Backup</b><span>${backupSub}</span></div><span class="chev">${icon('right')}</span></button>
  </section>
  ${days ? (r === 'week' ? `<div class="hdr"><span>Tage</span></div>` : '') + days : `<p class="empty">${hasAny ? 'In diesem Zeitraum ist nichts eingetragen.' : 'Hier erscheinen deine Tage, sobald du etwas eingetragen hast.'}</p>`}`;
}
const dayRow = r => `<button class="it" data-act="openday" data-k="${r.k}"><div class="n"><b>${shortDate(r.k)}${r.k === todayKey() ? ' · heute' : ''}</b></div><span class="k num">${n0(r.kcal)} kcal · ${n0(r.p)} g Eiweiß</span><span class="chev">${icon('right')}</span></button>`;
const MONL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
// Frühester Tag mit Daten (Essen, Gewicht, Maße), damit man nicht ins Leere zurückblättert
function firstDataKey() {
  const ks = [...Object.keys(S.days), ...S.weights.map(w => w.date), ...S.body.map(b => b.date)].sort();
  return ks[0] || todayKey();
}
const fmtD = k => { const d = kdate(k); return `${d.getDate()}.${d.getMonth() + 1}.`; };
function period() {
  const t = todayKey(), td = kdate(t), o = histOff;
  if (histRange === 'week') {
    const d = new Date(td); d.setDate(d.getDate() - (d.getDay() + 6) % 7 - 7 * o);
    const from = dkey(d), to = addDays(from, 6);
    const lbl = o === 0 ? 'Diese Woche' : o === 1 ? 'Letzte Woche' : `KW ${isoWeek(d)}`;
    return { from, to, label: lbl, sub: `${fmtD(from)} – ${fmtD(to)}${kdate(to).getFullYear()}` };
  }
  if (histRange === 'month') {
    const d = new Date(td.getFullYear(), td.getMonth() - o, 1), e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { from: dkey(d), to: dkey(e), label: `${MONL[d.getMonth()]} ${d.getFullYear()}`, sub: o === 0 ? 'Dieser Monat' : o === 1 ? 'Letzter Monat' : `${fmtD(dkey(d))} – ${fmtD(dkey(e))}` };
  }
  if (histRange === 'year') {
    const y = td.getFullYear() - o;
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y), sub: o === 0 ? 'Dieses Jahr' : o === 1 ? 'Letztes Jahr' : '1.1. – 31.12.' };
  }
  let from = firstDataKey(); if (from > addDays(t, -29)) from = addDays(t, -29);
  from = from.slice(0, 7) + '-01';
  return { from, to: t, label: 'Alles', sub: `Seit ${fmtD(from)}${kdate(from).getFullYear()}` };
}
function isoWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3 - (d.getDay() + 6) % 7);
  const w1 = new Date(x.getFullYear(), 0, 4);
  return 1 + Math.round(((x - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7);
}

/* ---------- Kalender ---------- */
let calM = null;
function openCalendar() {
  const c = kdate(cur || todayKey()); calM = new Date(c.getFullYear(), c.getMonth(), 1);
  openLayer('sheet', `<div id="calBody" style="display:flex;flex-direction:column;gap:14px"></div>`, el => {
    const draw = () => {
      const y = calM.getFullYear(), m = calM.getMonth(), t = todayKey();
      const first = (calM.getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
      const now = kdate(t), isNow = y === now.getFullYear() && m === now.getMonth();
      const back = dkey(new Date(y, m, 0)) >= firstDataKey().slice(0, 8) + '01';
      let cells = '', cnt = 0;
      for (let i = 0; i < first; i++) cells += '<span></span>';
      for (let d = 1; d <= n; d++) {
        const k = `${y}-${pad(m + 1)}-${pad(d)}`, has = dayLogged(k);
        if (has) cnt++;
        const st = has ? (dayInGoal(k) ? 'g' : 'o') : '';
        cells += `<button class="cd${k === t ? ' td' : ''}${k === cur ? ' sel' : ''}${k > t ? ' fut' : ''}" data-cal="${k}" ${k > t ? 'disabled' : ''}>${d}${st ? `<i class="${st}"></i>` : ''}</button>`;
      }
      $('#calBody', el).innerHTML = `
        <div class="sh"><div class="t"><b>Kalender</b><span>Tippe auf einen Tag, um ihn anzusehen</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
        <section class="card cal">
          <div class="pnav">
            <button class="xb" data-cm="-1" ${back ? '' : 'disabled'} aria-label="Vorheriger Monat">${icon('left')}</button>
            <div><b>${MONL[m]} ${y}</b><span>${cnt} ${cnt === 1 ? 'Tag' : 'Tage'} eingetragen</span></div>
            <button class="xb" data-cm="1" ${isNow ? 'disabled' : ''} aria-label="Nächster Monat">${icon('right')}</button>
          </div>
          <div class="cgrid">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(w => `<em>${w}</em>`).join('')}${cells}</div>
          <div class="clegend"><span><i class="g"></i>Im Ziel</span><span><i class="o"></i>Eingetragen</span></div>
        </section>
        ${isNow ? '' : `<button class="btn sec" data-cm="0">Zu heute</button>`}`;
      el.querySelectorAll('[data-cm]').forEach(b => b.addEventListener('click', () => {
        const d = +b.dataset.cm; calM = d === 0 ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(y, m + d, 1); draw();
      }));
      el.querySelectorAll('[data-cal]').forEach(b => b.addEventListener('click', () => { cur = b.dataset.cal; tab = 'today'; closeAll(); render(); window.scrollTo(0, 0); }));
    };
    draw();
  });
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
  <section class="list icons"><button class="it" data-act="calc">${tile('target', ['#ff5c7c', '#e8264d'])}<div class="n"><b>${S.profile ? 'Ziele neu berechnen' : 'Ziele berechnen lassen'}</b><span>${goalSub()}</span></div><span class="chev">${icon('right')}</span></button></section>
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
  <div class="hdr"><span>Tägliche Routine</span></div>
  <section class="list icons"><button class="it" data-act="supps">${tile('pill', ['#c77dff', '#9b4dde'])}<div class="n"><b>Supplements</b><span>${S.supps.length ? esc(S.supps.map(s => s.name).join(', ')) : 'Ausgeblendet, tippen zum Einrichten'}</span></div><span class="chev">${icon('right')}</span></button></section>
  <div class="hdr"><span>Daten</span></div>
  <section class="list icons">
    <button class="it" data-act="backup">${tile('cloud', ['#40a0ff', '#0a6fe0'])}<div class="n"><b>Backup erstellen oder laden</b><span>Sicherungsdatei, z. B. in iCloud Drive</span></div><span class="chev">${icon('right')}</span></button>
    <button class="it" data-act="healthHelp">${tile('heart', ['#ff5c7c', '#e8264d'])}<div class="n"><b>Apple Health verbinden</b><span>Verbrannte Kalorien per Kurzbefehl</span></div><span class="chev">${icon('right')}</span></button>
    <button class="it" data-act="ownFoods">${tile('pencil', ['#a1a1a6', '#6e6e73'])}<div class="n"><b>Eigene Lebensmittel</b><span>${Object.values(S.foods).length} gespeichert</span></div><span class="chev">${icon('right')}</span></button>
  </section>
  <div class="hdr"><span>Teilen</span></div>
  <section class="list icons"><button class="it" data-act="shareApp">${tile('share', ['#ff6b8a', '#e3123f'])}<div class="n"><b>App teilen</b><span>QR-Code zeigen, Punkte sammeln</span></div><span class="chev">${icon('right')}</span></button>
    ${WISH_URL ? (S.referredBy ? `<div class="it">${tile('trophy', ['#ffd60a', '#f5a300'])}<div class="n"><b>Geworben von</b><span>${esc(S.referredBy)}</span></div></div>` : `<button class="it" data-act="referral">${tile('trophy', ['#ffd60a', '#f5a300'])}<div class="n"><b>Wer hat dich geworben?</b><span>Die Person bekommt dafür Punkte</span></div><span class="chev">${icon('right')}</span></button>`) : ''}</section>
  ${WISH_URL ? `<div class="hdr"><span>Feedback</span></div>
  <section class="list icons"><button class="it" data-act="wish">${tile('sparkle', ['#ffd60a', '#f5a300'])}<div class="n"><b>Wunsch senden 💡</b><span>Was fehlt dir? Sag’s dem Entwickler</span></div><span class="chev">${icon('right')}</span></button></section>` : ''}
  ${DONATE_URL ? `<div class="hdr"><span>Unterstützen</span></div>
  <section class="list icons"><a class="it" href="${esc(DONATE_URL)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">${tile('paypal', ['#009cde', '#003087'])}<div class="n"><b>Entwickler unterstützen ☕</b><span>Freiwillige Spende per PayPal</span></div><span class="chev">${icon('right')}</span></a></section>` : ''}
  <p class="foot">Alle Daten bleiben auf diesem Gerät. Es gibt kein Konto und keine Werbung. Eingebaute Lebensmittel sind Richtwerte. Die Online-Suche und der Barcode-Scan nutzen Open Food Facts (offene Datenbank, ODbL).</p>
  <section class="list"><button class="it danger" data-act="wipe">Alle Daten löschen</button></section>
  <p class="ver">Biss · Version ${APP_VERSION}</p>`;
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
const APP_URL = 'https://sillmorten.github.io/morten/';
function openShare() {
  openLayer('sheet', `
    <div class="sh"><div class="t"><b>Biss teilen</b><span>Mit der iPhone-Kamera scannen</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
    <div class="qrbox"><img src="icons/qr.png" alt="QR-Code für ${APP_URL}" width="280" height="280"></div>
    <section class="card"><ol class="steps">
      <li>QR-Code mit der Kamera scannen.</li>
      <li>Link in <b>Safari</b> öffnen.</li>
      <li><b>Teilen</b> → <b>Zum Home-Bildschirm</b>.</li>
    </ol></section>
    ${WISH_URL ? `<p class="note">🏆 Punkte sammeln: Sag deinen Freunden, dass sie beim ersten Start <b>${esc(S.name || 'deinen Namen')}</b> als Empfehlung eintragen.</p>` : ''}
    <button class="btn" data-act="shareLink">Link senden</button>`);
}
async function shareLink() {
  try { if (navigator.share) { await navigator.share({ title: 'Biss', text: 'Biss: Kalorien und Makros tracken, ohne Abo.', url: APP_URL }); return; } }
  catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(APP_URL); toast('Link kopiert'); } catch (e) { toast(APP_URL); }
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
let wRange = 90;
// Einträge der letzten n Tage (0 = alle)
const sinceDays = (list, n) => n ? list.filter(x => x.date >= addDays(todayKey(), -n)) : list;
const rangeSeg = (cur, attr) => `<div class="seg">${[[90, '3 Monate'], [365, 'Jahr'], [0, 'Alles']].map(([n, l]) => `<button class="${cur === n ? 'on' : ''}" ${attr}="${n}">${l}</button>`).join('')}</div>`;
function openWeight() {
  openLayer('sheet', `<div id="wBody" style="display:flex;flex-direction:column;gap:14px"></div>`, el => {
    const draw = () => {
      const w = S.weights, last = w[w.length - 1], ws = sinceDays(w, wRange);
      $('#wBody', el).innerHTML = `
        <div class="sh"><div class="t"><b>Körpergewicht</b><span>${last ? `Zuletzt ${n1(last.kg)} kg am ${shortDate(last.date)}` : 'Noch kein Eintrag'}</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
        <div class="amt"><input id="wk" inputmode="decimal" placeholder="${last ? n1(last.kg) : '80,0'}" aria-label="Gewicht in kg"><span>kg</span></div>
        <button class="btn" id="wOk">Für heute speichern</button>
        ${w.length >= 2 ? `${rangeSeg(wRange, 'data-wr')}<section class="card wchart">${ws.length >= 2 ? weightChart(ws) : '<p class="empty">Zu wenige Einträge in diesem Zeitraum.</p>'}</section>` : ''}
        ${w.length ? `<div class="hdr"><span>Alle Einträge</span><span>${w.length}</span></div><section class="list">${w.slice().reverse().map(x => `<div class="it"><div class="n"><b>${n1(x.kg)} kg</b><span>${shortDate(x.date)}</span></div><button class="xb" data-wdel="${x.date}" aria-label="Löschen" style="color:var(--red)">${icon('trash')}</button></div>`).join('')}</section>` : ''}`;
      fitAmt($('#wk', el));
      $('#wOk', el).addEventListener('click', () => {
        const kg = num($('#wk', el).value); if (!(kg > 20 && kg < 400)) { toast('Bitte ein gültiges Gewicht eingeben'); return; }
        const t = todayKey(); S.weights = S.weights.filter(x => x.date !== t); S.weights.push({ date: t, kg }); S.weights.sort((a, b) => a.date.localeCompare(b.date));
        S.weightKg = kg; save(); buzz(); render(); draw(); toast('Gewicht gespeichert');
      });
      el.querySelectorAll('[data-wr]').forEach(b => b.addEventListener('click', () => { wRange = +b.dataset.wr; draw(); }));
      el.querySelectorAll('[data-wdel]').forEach(b => b.addEventListener('click', () => { S.weights = S.weights.filter(x => x.date !== b.dataset.wdel); save(); render(); draw(); }));
    };
    draw();
  });
}
function weightChart(w, key = 'kg', color = 'var(--blu)') {
  const W = 320, H = 160, L = 34, R = 8, T = 10, B = 22;
  const xs = w.map(x => kdate(x.date).getTime()), ys = w.map(x => x[key]);
  let y0 = Math.min(...ys), y1 = Math.max(...ys); if (y1 - y0 < 2) { y0 -= 1; y1 += 1; }
  y0 = Math.floor(y0); y1 = Math.ceil(y1);
  const x0 = xs[0], x1 = xs[xs.length - 1] || x0 + 1;
  const X = t => L + (t - x0) / Math.max(1, x1 - x0) * (W - L - R), Y = v => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const pts = w.map((x, i) => `${X(xs[i]).toFixed(1)},${Y(x[key]).toFixed(1)}`);
  const ticks = [y0, (y0 + y1) / 2, y1];
  const lp = pts[pts.length - 1].split(',');
  return `<svg viewBox="0 0 ${W} ${H}" style="overflow:visible">
    ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--sep)" stroke-width="1"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="10" style="fill:var(--l2)">${n1(v)}</text>`).join('')}
    <path d="M${pts[0]} L${pts.join(' L')} L${X(x1)},${H - B} L${X(x0)},${H - B}Z" style="fill:color-mix(in srgb, ${color} 18%, transparent)"/>
    <polyline points="${pts.join(' ')}" fill="none" style="stroke:${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${lp[0]}" cy="${lp[1]}" r="4.5" style="fill:${color};stroke:var(--sheetcard)" stroke-width="2"/>
    <text x="${L}" y="${H - 5}" font-size="10" style="fill:var(--l2)">${shortDate(w[0].date)}</text>
    <text x="${W - R}" y="${H - 5}" font-size="10" text-anchor="end" style="fill:var(--l2)">${shortDate(w[w.length - 1].date)}</text></svg>`;
}

/* ---------- Streaks und Abzeichen ---------- */
const dayLogged = k => getDay(k).food.length > 0;
// „Im Ziel“: mindestens 80 % und höchstens 105 % des Kalorienziels (plus Sport)
function dayInGoal(k) {
  if (!dayLogged(k)) return false;
  const t = totals(k), av = S.goals.kcal + t.burned;
  return t.kcal >= av * 0.8 && t.kcal <= av * 1.05;
}
const dayProtein = k => dayLogged(k) && totals(k).p >= S.goals.p * 0.95;
const daySupps = k => S.supps.length > 0 && S.supps.every(s => (S.suppLog[k] || []).includes(s.id));
// Aktuelle Serie zählt bis heute; ist heute noch nicht erfüllt, zählt sie bis gestern (der Tag läuft ja noch)
function streakInfo(test, keys = Object.keys(S.days)) {
  const t = todayKey();
  let k = test(t) ? t : addDays(t, -1), cur = 0;
  while (test(k)) { cur++; k = addDays(k, -1); }
  let best = 0, run = 0, prev = null;
  for (const d of keys.filter(test).sort()) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return { cur, best: Math.max(best, cur) };
}
function badgeStats() {
  const days = Object.values(S.days);
  return {
    log: streakInfo(dayLogged), goal: streakInfo(dayInGoal), prot: streakInfo(dayProtein), supp: streakInfo(daySupps, Object.keys(S.suppLog)),
    logged: Object.keys(S.days).filter(dayLogged).length,
    entries: days.reduce((a, d) => a + d.food.length, 0),
    sport: days.reduce((a, d) => a + d.sport.length, 0),
    weights: S.weights.length, body: S.body.length, photos: S.photos.length,
  };
}
const BADGES = [
  { id: 'first', e: '🍽️', n: 'Erster Biss', d: 'Das erste Essen eingetragen', goal: 1, v: s => s.entries },
  { id: 'goal3', e: '🔥', n: 'Warmgelaufen', d: '3 Tage am Stück im Ziel', goal: 3, v: s => s.goal.best },
  { id: 'goal7', e: '🔥', n: 'Eine Woche on fire', d: '7 Tage am Stück im Ziel', goal: 7, v: s => s.goal.best },
  { id: 'goal14', e: '⚡', n: 'Nicht zu stoppen', d: '14 Tage am Stück im Ziel', goal: 14, v: s => s.goal.best },
  { id: 'goal30', e: '🏆', n: 'Monats-Champion', d: '30 Tage am Stück im Ziel', goal: 30, v: s => s.goal.best },
  { id: 'log7', e: '📅', n: 'Dranbleiber', d: '7 Tage am Stück eingetragen', goal: 7, v: s => s.log.best },
  { id: 'log30', e: '🗓️', n: 'Gewohnheitstier', d: '30 Tage am Stück eingetragen', goal: 30, v: s => s.log.best },
  { id: 'prot7', e: '💪', n: 'Eiweiß-Profi', d: '7 Tage am Stück das Eiweißziel geschafft', goal: 7, v: s => s.prot.best },
  { id: 'supp7', e: '💊', n: 'Routine sitzt', d: '7 Tage am Stück alle Supplements genommen', goal: 7, v: s => s.supp.best },
  { id: 'days50', e: '⭐', n: 'Halbe Hundert', d: 'An 50 Tagen eingetragen', goal: 50, v: s => s.logged },
  { id: 'days100', e: '💯', n: 'Hundert Tage', d: 'An 100 Tagen eingetragen', goal: 100, v: s => s.logged },
  { id: 'sport10', e: '🏋️', n: 'Sportskanone', d: '10 Sporteinheiten eingetragen', goal: 10, v: s => s.sport },
  { id: 'weigh10', e: '⚖️', n: 'Waagemutig', d: '10-mal das Gewicht eingetragen', goal: 10, v: s => s.weights },
  { id: 'body', e: '📏', n: 'Maßband raus', d: 'Erste Körpermaße eingetragen', goal: 1, v: s => s.body },
  { id: 'photo', e: '📸', n: 'Vorher-Bild', d: 'Erstes Fortschrittsfoto gemacht', goal: 1, v: s => s.photos },
];
const earnedCount = () => BADGES.filter(b => S.badges && S.badges[b.id]).length;
// Beim ersten Start mit dieser Version: schon Erreichtes still freischalten, ohne Konfetti-Flut
function initBadges() {
  S.badges = {};
  const s = badgeStats(), t = todayKey();
  for (const b of BADGES) if (b.v(s) >= b.goal) S.badges[b.id] = t;
}
function checkBadges() {
  if (!S.badges) return;
  const s = badgeStats(), fresh = BADGES.filter(b => !S.badges[b.id] && b.v(s) >= b.goal);
  if (!fresh.length) return;
  const t = todayKey(); fresh.forEach(b => { S.badges[b.id] = t; });
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  toast(`Neues Abzeichen: ${fresh[0].e} ${fresh[0].n}`); buzz(); confetti();
  render();
}
function openBadges() {
  const s = badgeStats();
  const big = (e, v, l, best) => `<div class="sk"><div class="e">${e}</div><b class="num">${v}</b><span>${l}</span><em>Rekord ${best}</em></div>`;
  openLayer('sheet', `
    <div class="sh"><div class="t"><b>Streaks & Abzeichen</b><span>${earnedCount()} von ${BADGES.length} freigeschaltet</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
    <section class="card streaks">
      ${big('🔥', s.goal.cur, s.goal.cur === 1 ? 'Tag im Ziel' : 'Tage im Ziel', s.goal.best)}
      ${big('📅', s.log.cur, s.log.cur === 1 ? 'Tag eingetragen' : 'Tage eingetragen', s.log.best)}
    </section>
    <p class="note">Im Ziel bist du, wenn du zwischen 80 und 105 % deines Kalorienziels landest. Verbrannte Kalorien zählen dazu. Der heutige Tag zählt mit, sobald er geschafft ist.</p>
    <div class="badges">${BADGES.map(b => {
      const got = S.badges && S.badges[b.id], v = Math.min(b.v(s), b.goal);
      return `<div class="bdg${got ? '' : ' off'}"><div class="e">${b.e}</div><b>${b.n}</b><span>${b.d}</span>${got ? `<em>${shortDate(got)}</em>` : b.goal > 1 ? `<i style="--p:${(v / b.goal * 100).toFixed(0)}%"></i><em>${v} / ${b.goal}</em>` : '<em>Noch offen</em>'}</div>`;
    }).join('')}</div>`);
}

/* ---------- Supplements verwalten ---------- */
const SUPP_IDEAS = ['Kreatin', 'Protein-Shake', 'Vitamine', 'Vitamin D', 'Magnesium', 'Omega-3', 'Zink', 'Multivitamin', 'Eisen', 'Koffein'];
function openSupps() {
  openLayer('sheet', `<div id="suBody" style="display:flex;flex-direction:column;gap:14px"></div>`, el => {
    const draw = () => {
      const ideas = SUPP_IDEAS.filter(n => !S.supps.some(s => norm(s.name) === norm(n)));
      $('#suBody', el).innerHTML = `
        <div class="sh"><div class="t"><b>Supplements</b><span>Jeden Tag auf „Heute“ abhaken</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
        ${S.supps.length ? `<section class="list">${S.supps.map(s => `<div class="it"><div class="n"><b>${esc(s.name)}</b><span>${s.dose ? esc(s.dose) : 'Ohne Dosis'}</span></div><button class="xb" data-sudel="${esc(s.id)}" aria-label="${esc(s.name)} entfernen" style="color:var(--red)">${icon('trash')}</button></div>`).join('')}</section>` : '<p class="empty">Keine Supplements. Der Bereich ist auf „Heute“ ausgeblendet.</p>'}
        <section class="list">
          <div class="row-in"><label for="suName">Name</label><input id="suName" class="wide" placeholder="z. B. Magnesium" autocapitalize="words"><span class="u"></span></div>
          <div class="row-in"><label for="suDose">Dosis</label><input id="suDose" class="wide" placeholder="optional, z. B. 5 g"><span class="u"></span></div>
        </section>
        <button class="btn" id="suAdd">Hinzufügen</button>
        ${ideas.length ? `<div class="chips">${ideas.map(n => `<button class="chip" data-suidea="${esc(n)}">${icon('plus')}${esc(n)}</button>`).join('')}</div>` : ''}`;
      const add = (name, dose) => {
        name = name.trim().slice(0, 40); if (!name) { toast('Bitte einen Namen eingeben'); return; }
        S.supps.push({ id: uid(), name, dose: (dose || '').trim().slice(0, 30) }); save(); render(); draw(); toast(`${name} hinzugefügt`);
      };
      $('#suAdd', el).addEventListener('click', () => add($('#suName', el).value, $('#suDose', el).value));
      el.querySelectorAll('[data-suidea]').forEach(b => b.addEventListener('click', () => add(b.dataset.suidea, '')));
      el.querySelectorAll('[data-sudel]').forEach(b => b.addEventListener('click', () => { S.supps = S.supps.filter(s => s.id !== b.dataset.sudel); save(); render(); draw(); }));
    };
    draw();
  });
}

/* ---------- Fotos (IndexedDB, weil localStorage dafür zu klein ist) ---------- */
const PDB = (() => {
  let p;
  const open = () => p ||= new Promise((res, rej) => {
    const r = indexedDB.open('biss', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('photos');
    r.onsuccess = () => res(r.result); r.onerror = () => { p = null; rej(r.error); };
  });
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('photos', mode), out = fn(t.objectStore('photos'));
      t.oncomplete = () => res(out ? out.result : undefined); t.onerror = t.onabort = () => rej(t.error);
    });
  };
  return { get: k => run('readonly', s => s.get(k)), put: (k, v) => run('readwrite', s => { s.put(v, k); }), del: k => run('readwrite', s => { s.delete(k); }), clear: () => run('readwrite', s => { s.clear(); }) };
})();
const thumbCache = new Map();
async function loadAllPhotos() {
  const out = {};
  for (const p of S.photos) { const [full, thumb] = await Promise.all([PDB.get(p.id), PDB.get(p.id + ':t')]); if (full) out[p.id] = { full, thumb }; }
  return out;
}
// Foto verkleinern: max. 1280 px als JPEG, dazu ein quadratisches Vorschaubild
async function compressPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('img')); i.src = url; });
    const w = img.naturalWidth, h = img.naturalHeight, sc = Math.min(1, 1280 / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.round(w * sc); c.height = Math.round(h * sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const full = c.toDataURL('image/jpeg', 0.72);
    const t = document.createElement('canvas'), m = Math.min(w, h); t.width = t.height = 240;
    t.getContext('2d').drawImage(img, (w - m) / 2, (h - m) / 3, m, m, 0, 0, 240, 240);
    return { full, thumb: t.toDataURL('image/jpeg', 0.7) };
  } finally { URL.revokeObjectURL(url); }
}
async function getThumb(id) {
  if (!thumbCache.has(id)) thumbCache.set(id, PDB.get(id + ':t').then(v => v || PDB.get(id)).catch(() => null));
  return thumbCache.get(id);
}
function fillThumbs(root) {
  root.querySelectorAll('img[data-ph]').forEach(async im => { const src = await getThumb(im.dataset.ph); if (src) im.src = src; });
}
async function addPhoto(file) {
  toast('Foto wird gespeichert …');
  try {
    const { full, thumb } = await compressPhoto(file);
    const id = 'ph' + uid();
    await PDB.put(id, full); await PDB.put(id + ':t', thumb);
    S.photos.push({ id, date: todayKey(), t: Date.now() }); S.photos.sort((a, b) => a.date.localeCompare(b.date) || a.t - b.t);
    save(); buzz(); toast('Foto gespeichert'); drawBody(); render();
  } catch (e) { toast('Das Foto konnte nicht gespeichert werden'); }
}
async function openPhoto(id) {
  const p = S.photos.find(x => x.id === id); if (!p) return;
  openLayer('sheet', `
    <div class="sh"><div class="t"><b>Fortschrittsfoto</b><span>${longDate(p.date)} ${kdate(p.date).getFullYear()}</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
    <img class="phfull" id="phImg" alt="Fortschrittsfoto vom ${shortDate(p.date)}">
    <button class="btn del" id="phDel">Foto löschen</button>`, el => {
    getThumb(id).then(src => { const im = $('#phImg', el); if (src && !im.src) im.src = src; });
    PDB.get(id).then(src => { if (src) $('#phImg', el).src = src; }).catch(() => {});
    $('#phDel', el).addEventListener('click', ev => {
      const b = ev.currentTarget;
      if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Wirklich löschen? Nochmal tippen'; return; }
      S.photos = S.photos.filter(x => x.id !== id); thumbCache.delete(id);
      PDB.del(id).catch(() => {}); PDB.del(id + ':t').catch(() => {});
      save(); closeTop(); toast('Foto gelöscht'); drawBody(); render();
    });
  });
}

/* ---------- Körpermaße ---------- */
const MEASURES = [
  { id: 'waist', name: 'Taille', unit: 'cm' }, { id: 'chest', name: 'Brust', unit: 'cm' }, { id: 'hips', name: 'Hüfte', unit: 'cm' },
  { id: 'arm', name: 'Oberarm', unit: 'cm' }, { id: 'thigh', name: 'Oberschenkel', unit: 'cm' }, { id: 'fat', name: 'Körperfett', unit: '%' },
];
const series = id => S.body.filter(e => e[id] > 0);
function bodySub() {
  const parts = [];
  const w = series('waist'); if (w.length) parts.push(`Taille ${n1(w[w.length - 1].waist)} cm`);
  if (S.photos.length) parts.push(`${S.photos.length} ${S.photos.length === 1 ? 'Foto' : 'Fotos'}`);
  if (!parts.length && S.body.length) parts.push(`Zuletzt ${shortDate(S.body[S.body.length - 1].date)}`);
  return parts.length ? parts.join(' · ') : 'Maße und Fotos nur auf dem iPhone';
}
let bodyEl = null, bodyMeasure = 'waist', bRange = 0;
function openBody() {
  openLayer('page', `<div id="bodyBody" style="display:flex;flex-direction:column;gap:12px"></div>
    <input type="file" id="phFile" accept="image/*" hidden>`, el => {
    bodyEl = el;
    $('#phFile', el).addEventListener('change', ev => { const f = ev.target.files[0]; if (f) addPhoto(f); ev.target.value = ''; });
    drawBody();
    return () => { bodyEl = null; };
  });
}
function drawBody() {
  if (!bodyEl) return;
  const b = $('#bodyBody', bodyEl), ph = S.photos;
  const first = ph[0], last = ph[ph.length - 1];
  const days = first && last ? Math.round((kdate(last.date) - kdate(first.date)) / 864e5) : 0;
  const avail = MEASURES.filter(m => series(m.id).length);
  if (!avail.some(m => m.id === bodyMeasure) && avail.length) bodyMeasure = avail[0].id;
  const sel = series(bodyMeasure), selM = MEASURES.find(m => m.id === bodyMeasure);
  const diff = (s, m) => { if (s.length < 2) return ''; const d = s[s.length - 1][m.id] - s[0][m.id]; return ` · ${d > 0 ? '+' : d < 0 ? '−' : '±'}${n1(Math.abs(d))} ${m.unit} seit ${shortDate(s[0].date)}`; };
  b.innerHTML = `
    <div class="nav"><button class="navbtn" data-act="close">${icon('left')}Verlauf</button></div>
    <h1 class="lt">Körper</h1>
    <div class="hdr"><span>Fortschrittsfotos</span></div>
    ${ph.length >= 2 ? `<section class="card cmp">
      <figure><img data-ph="${first.id}" alt="" data-act="photo" data-id="${first.id}"><figcaption>Vorher · ${shortDate(first.date)}</figcaption></figure>
      <figure><img data-ph="${last.id}" alt="" data-act="photo" data-id="${last.id}"><figcaption>Jetzt · ${shortDate(last.date)}</figcaption></figure>
      ${days > 0 ? `<p>${days} ${days === 1 ? 'Tag' : 'Tage'} Unterschied</p>` : ''}</section>` : ''}
    ${ph.length ? `<div class="phgrid">${ph.slice().reverse().map(p => `<button data-act="photo" data-id="${p.id}"><img data-ph="${p.id}" alt="Foto vom ${shortDate(p.date)}"><span>${shortDate(p.date).slice(4)}</span></button>`).join('')}</div>` : `<section class="list"><p class="empty">Mach alle paar Wochen ein Foto, gleiche Pose, gleiches Licht. So siehst du Fortschritte, die die Waage nicht zeigt.</p></section>`}
    <button class="btn sec iconbtn" data-act="addPhoto">${icon('camera')}Foto hinzufügen</button>
    <p class="foot">Fotos bleiben nur auf diesem iPhone. Sie werden verkleinert gespeichert und sind im Backup enthalten.</p>
    <div class="hdr"><span>Körpermaße</span></div>
    ${avail.length ? `<section class="list">${avail.map(m => { const s = series(m.id), l = s[s.length - 1]; return `<button class="it${m.id === bodyMeasure ? ' sel' : ''}" data-act="bodyMeasure" data-m="${m.id}"><div class="n"><b>${m.name}</b><span>${shortDate(l.date)}${diff(s, m)}</span></div><span class="k num">${n1(l[m.id])} ${m.unit}</span></button>`; }).join('')}</section>
    ${sel.length >= 2 ? `${rangeSeg(bRange, 'data-act="bodyRange" data-r')}<section class="card wchart"><div class="ctop">${selM.name}</div>${sinceDays(sel, bRange).length >= 2 ? weightChart(sinceDays(sel, bRange), bodyMeasure, 'var(--tint)') : '<p class="empty">Zu wenige Einträge in diesem Zeitraum.</p>'}</section>` : ''}` : ''}
    <button class="btn${avail.length ? ' sec' : ''} iconbtn" data-act="measure">${icon('ruler')}Maße eintragen</button>
    ${S.body.length ? `<div class="hdr"><span>Einträge</span></div><section class="list">${S.body.slice().reverse().map(e => `<div class="it"><div class="n"><b>${shortDate(e.date)}</b><span>${esc(MEASURES.filter(m => e[m.id] > 0).map(m => `${m.name} ${n1(e[m.id])}`).join(' · '))}</span></div><button class="xb" data-bdel="${e.date}" aria-label="Löschen" style="color:var(--red)">${icon('trash')}</button></div>`).join('')}</section>` : `<p class="foot">Miss am besten morgens, nüchtern und immer an derselben Stelle. Taille: auf Höhe des Bauchnabels.</p>`}`;
  b.querySelectorAll('[data-bdel]').forEach(x => x.addEventListener('click', ev => {
    const btn = ev.currentTarget;
    if (!btn.dataset.sure) { btn.dataset.sure = 1; btn.style.background = 'color-mix(in srgb, var(--red) 20%, transparent)'; return; }
    S.body = S.body.filter(e => e.date !== btn.dataset.bdel); save(); drawBody(); render();
  }));
  fillThumbs(b);
}
function openMeasure() {
  const lastOf = id => { const s = series(id); return s.length ? s[s.length - 1][id] : null; };
  const t = todayKey(), today = S.body.find(e => e.date === t) || {};
  openLayer('sheet', `
    <div class="sh"><div class="t"><b>Maße eintragen</b><span>Für heute, leere Felder werden übersprungen</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
    <section class="list">${MEASURES.map(m => `<div class="row-in"><label for="ms_${m.id}">${m.name}</label><input id="ms_${m.id}" inputmode="decimal" value="${today[m.id] ? n1(today[m.id]) : ''}" placeholder="${lastOf(m.id) ? n1(lastOf(m.id)) : '0'}"><span class="u">${m.unit}</span></div>`).join('')}</section>
    <button class="btn" id="msOk">Speichern</button>`, el => {
    $('#msOk', el).addEventListener('click', () => {
      const e = { date: t };
      for (const m of MEASURES) { const v = num($('#ms_' + m.id, el).value); if (v > 0 && v < (m.unit === '%' ? 80 : 300)) e[m.id] = Math.round(v * 10) / 10; }
      if (Object.keys(e).length < 2) { toast('Bitte mindestens ein Maß eintragen'); return; }
      S.body = S.body.filter(x => x.date !== t); S.body.push(e); S.body.sort((a, b) => a.date.localeCompare(b.date));
      save(); buzz(); closeTop(); toast('Maße gespeichert'); drawBody(); render();
    });
  });
}

/* ---------- Verbesserungswunsch ---------- */
let wishDraft = '';
function openWish() {
  openLayer('sheet', `<div id="wishBody" style="display:flex;flex-direction:column;gap:14px"></div>`, el => {
    const body = $('#wishBody', el);
    body.innerHTML = `
      <div class="sh"><div class="t"><b>Wunsch senden 💡</b><span>Geht direkt an den Entwickler</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
      <textarea id="wishTxt" class="ta" rows="6" maxlength="2000" placeholder="Was soll die App noch können? Was nervt dich?" autocapitalize="sentences">${esc(wishDraft)}</textarea>
      <button class="btn" id="wishOk">Absenden</button>
      <p class="note">Mitgeschickt werden nur dein Text, dein Name${S.name ? ` (${esc(S.name)})` : ''} und die App-Version. Deine Essens- und Körperdaten bleiben auf dem iPhone.</p>`;
    const ta = $('#wishTxt', el), ok = $('#wishOk', el);
    setTimeout(() => ta.focus(), 350);
    ta.addEventListener('input', () => { wishDraft = ta.value; });
    ok.addEventListener('click', async () => {
      const txt = ta.value.trim();
      if (!txt) { toast('Schreib kurz, was du dir wünschst'); ta.focus(); return; }
      if (!navigator.onLine) { toast('Kein Internet. Dein Text bleibt hier, versuch es später nochmal.'); return; }
      ok.disabled = true; ok.textContent = 'Wird gesendet …';
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
      try {
        const r = await fetch(WISH_URL, {
          method: 'POST', signal: ctl.signal,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ name: S.name || 'Ohne Namen', message: txt, version: APP_VERSION, _subject: 'Biss – Verbesserungswunsch' + (S.name ? ' von ' + S.name : '') }),
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        wishDraft = ''; buzz(); clearTimeout(toastT); $('#toast').classList.remove('show');
        body.innerHTML = `<div class="hello"><div style="font-size:56px;line-height:1.1">🙌</div><h2>Danke${S.name ? ', ' + esc(S.name) : ''}!</h2><p>Dein Wunsch ist angekommen. Vielleicht steckt er schon im nächsten Update.</p></div><button class="btn" data-act="close">Fertig</button>`;
      } catch (e) {
        ok.disabled = false; ok.textContent = 'Nochmal versuchen';
        toast(navigator.onLine ? 'Senden hat nicht geklappt. Versuch es gleich nochmal.' : 'Kein Internet. Versuch es später nochmal.');
      } finally { clearTimeout(t); }
    });
  });
}

/* ---------- Empfehlungen ---------- */
// Meldet einmalig per Formspree, wer diese Person geworben hat. Klappt es nicht, wird es beim nächsten Start nachgeholt.
async function sendReferral() {
  if (!WISH_URL || !S.referredBy || S.refSent || !navigator.onLine) return false;
  try {
    const r = await fetch(WISH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name: S.name || 'Ohne Namen', geworben_von: S.referredBy, message: `${S.name || 'Jemand'} wurde von ${S.referredBy} geworben.`, version: APP_VERSION, _subject: `Biss – Empfehlung: ${S.referredBy} hat ${S.name || 'jemanden'} geworben` }),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    S.refSent = true; save(); return true;
  } catch (e) { return false; }
}
function openReferral() {
  openLayer('sheet', `<div id="refBody" style="display:flex;flex-direction:column;gap:14px"></div>`, el => {
    const body = $('#refBody', el);
    body.innerHTML = `
      <div class="sh"><div class="t"><b>Wer hat dich geworben?</b><span>Die Person bekommt dafür Punkte</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
      <section class="list"><div class="row-in"><input id="refName" class="wide" style="text-align:left" placeholder="Name" autocapitalize="words" enterkeyhint="send" aria-label="Name"></div></section>
      <button class="btn" id="refOk">Absenden</button>
      <p class="note">Mitgeschickt werden nur dein Name${S.name ? ` (${esc(S.name)})` : ''} und der Name, den du einträgst. Das geht nur einmal.</p>`;
    const inp = $('#refName', el), ok = $('#refOk', el);
    setTimeout(() => inp.focus(), 350);
    const send = async () => {
      const ref = inp.value.trim().slice(0, 40);
      if (!ref) { toast('Wer hat dir Biss empfohlen?'); inp.focus(); return; }
      if (!navigator.onLine) { toast('Kein Internet. Versuch es später nochmal.'); return; }
      ok.disabled = true; ok.textContent = 'Wird gesendet …';
      S.referredBy = ref; S.refSent = false; save();
      if (await sendReferral()) {
        buzz(); render();
        body.innerHTML = `<div class="hello"><div style="font-size:56px;line-height:1.1">🤝</div><h2>Danke!</h2><p>${esc(ref)} bekommt Punkte dafür, dass Biss bei dir gelandet ist.</p></div><button class="btn" data-act="close">Fertig</button>`;
      } else {
        delete S.referredBy; save();
        ok.disabled = false; ok.textContent = 'Nochmal versuchen';
        toast('Senden hat nicht geklappt. Versuch es gleich nochmal.');
      }
    };
    ok.addEventListener('click', send);
    inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); send(); } });
  });
}

/* ---------- Backup ---------- */
let bkPhotos = null;
function openBackup() {
  // Fotos schon beim Öffnen laden, damit „Teilen“ direkt nach dem Tippen startet (iOS verlangt das)
  bkPhotos = S.photos.length ? loadAllPhotos() : Promise.resolve({});
  bkPhotos.then(p => { bkPhotos.done = p; }).catch(() => { bkPhotos.done = {}; });
  openLayer('sheet', `
    <div class="sh"><div class="t"><b>Backup</b><span>${S.lastBackup ? `Zuletzt gesichert am ${shortDate(dkey(new Date(S.lastBackup)))}` : 'Noch nie gesichert'}</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
    <p class="note" style="text-align:left">Deine Daten liegen nur auf diesem iPhone. Sichere sie ab und zu als Datei, z. B. in <b>iCloud Drive</b>. Wenn du die App löschst oder ein neues Handy hast, kannst du sie damit wiederherstellen.${S.photos.length ? ` Deine ${S.photos.length} Fortschrittsfotos sind mit drin.` : ''}</p>
    <button class="btn" id="bkSave">Backup erstellen</button>
    <button class="btn sec" id="bkLoad">Backup wiederherstellen</button>
    <input type="file" id="bkFile" accept="application/json,.json" hidden>`, el => {
    $('#bkSave', el).addEventListener('click', exportBackup);
    $('#bkLoad', el).addEventListener('click', () => $('#bkFile', el).click());
    $('#bkFile', el).addEventListener('change', ev => { const file = ev.target.files[0]; if (file) importBackup(file); ev.target.value = ''; });
  });
}
async function exportBackup() {
  const name = `biss-backup-${todayKey()}.json`;
  const photos = bkPhotos && bkPhotos.done ? bkPhotos.done : await (bkPhotos || loadAllPhotos()).catch(() => ({}));
  const blob = new Blob([JSON.stringify({ app: 'kalorien', version: APP_VERSION, exported: new Date().toISOString(), data: S, photos })], { type: 'application/json' });
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
    let data, photos = {};
    try { const o = JSON.parse(r.result); data = o.data || o; photos = o.photos && typeof o.photos === 'object' ? o.photos : {}; } catch (e) { toast('Die Datei ist kein gültiges Backup'); return; }
    if (!data || typeof data !== 'object' || !data.days || !data.goals) { toast('Die Datei ist kein gültiges Backup'); return; }
    const days = Object.keys(data.days).length;
    openLayer('sheet', `
      <div class="sh"><div class="t"><b>Backup wiederherstellen?</b><span>${days} Tage, ${Object.keys(data.foods || {}).length} Lebensmittel${Object.keys(photos).length ? `, ${Object.keys(photos).length} Fotos` : ''}</span></div><button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button></div>
      <p class="note">Die Daten auf diesem iPhone werden durch das Backup ersetzt.</p>
      <button class="btn" id="imOk">Ersetzen</button><button class="btn sec" data-act="close">Abbrechen</button>`, el => {
      $('#imOk', el).addEventListener('click', () => {
        S = normalize({ ...data, setup: true });
        S.photos = S.photos.filter(p => photos[p.id] && photos[p.id].full);
        if (!S.badges) initBadges();
        save(); closeAll(); render(); toast('Backup wiederhergestellt');
        thumbCache.clear();
        PDB.clear().then(() => Promise.all(S.photos.map(p => Promise.all([PDB.put(p.id, photos[p.id].full), PDB.put(p.id + ':t', photos[p.id].thumb || photos[p.id].full)])))).catch(() => toast('Fotos konnten nicht wiederhergestellt werden'));
      });
    });
  };
  r.readAsText(file);
}

/* ---------- Ziel-Rechner ---------- */
const ACTIVITY = [
  { f: 1.2, n: 'Kaum aktiv', d: 'Bürojob, wenig Bewegung' },
  { f: 1.375, n: 'Leicht aktiv', d: '1–3× Sport pro Woche' },
  { f: 1.55, n: 'Aktiv', d: '3–5× Sport pro Woche' },
  { f: 1.725, n: 'Sehr aktiv', d: '6–7× Sport oder körperliche Arbeit' },
  { f: 1.9, n: 'Extrem aktiv', d: 'Harte Arbeit und tägliches Training' },
];
// Grundumsatz nach Mifflin-St Jeor, Gesamtumsatz über den Aktivitätsfaktor, 7.700 kcal ≈ 1 kg Körperfett
function calcGoals(p) {
  if (!(p.age >= 14 && p.age <= 100 && p.height >= 120 && p.height <= 230 && p.weight >= 35 && p.weight <= 300)) return null;
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'w' ? -161 : 5);
  const tdee = bmr * p.act;
  const target = p.target >= 35 && p.target <= 300 ? p.target : p.weight;
  const diff = target - p.weight, mode = Math.abs(diff) < 0.5 ? 'keep' : diff < 0 ? 'lose' : 'gain';
  const pace = mode === 'gain' ? Math.min(p.pace, 0.5) : p.pace;
  let kcal = mode === 'keep' ? tdee : tdee + (mode === 'lose' ? -1 : 1) * pace * 7700 / 7;
  const floor = Math.max(bmr, p.sex === 'w' ? 1200 : 1500);
  const clamped = mode === 'lose' && kcal < floor;
  if (clamped) kcal = floor;
  kcal = Math.round(kcal / 10) * 10;
  const realPace = mode === 'keep' ? 0 : Math.abs(kcal - tdee) * 7 / 7700;
  const weeks = realPace > 0 ? Math.abs(diff) / realPace : 0;
  // Eiweiß beim Abnehmen 2 g pro kg Zielgewicht (schützt die Muskeln), sonst 1,8 g pro kg
  const prot = Math.round(mode === 'lose' ? 2 * target : 1.8 * p.weight);
  const fat = Math.round(Math.max(kcal * 0.25 / 9, 0.8 * p.weight));
  const carbs = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
  return { bmr, tdee, kcal, p: prot, f: fat, c: carbs, mode, target, weeks, realPace, clamped, eta: weeks ? addDays(todayKey(), Math.ceil(weeks * 7)) : null };
}
const longDateY = k => { const d = kdate(k); return `${d.getDate()}. ${MON[d.getMonth()]} ${d.getFullYear()}`; };
function renderCalc(box, { onDone, onSkip } = {}) {
  const lastW = S.weights.length ? S.weights[S.weights.length - 1].kg : S.weightKg;
  const p = { sex: 'm', age: '', height: '', target: '', act: 1.55, pace: 0.5, ...(S.profile || {}), weight: lastW };
  const v = x => x ? n1(x) : '';
  box.innerHTML = `
    <div class="sh"><div class="t"><b>Ziele berechnen</b><span>Aus deinen Daten, dauert eine Minute</span></div>${onSkip ? '' : `<button class="xb" data-act="close" aria-label="Schließen">${icon('x')}</button>`}</div>
    <div class="seg" id="cSex"><button data-v="m">Mann</button><button data-v="w">Frau</button></div>
    <section class="list">
      <div class="row-in"><label for="cAge">Alter</label><input id="cAge" inputmode="numeric" value="${p.age || ''}" placeholder="25"><span class="u">Jahre</span></div>
      <div class="row-in"><label for="cH">Größe</label><input id="cH" inputmode="numeric" value="${p.height || ''}" placeholder="180"><span class="u">cm</span></div>
      <div class="row-in"><label for="cW">Gewicht jetzt</label><input id="cW" inputmode="decimal" value="${v(p.weight)}" placeholder="80"><span class="u">kg</span></div>
      <div class="row-in"><label for="cT">Zielgewicht</label><input id="cT" inputmode="decimal" value="${v(p.target)}" placeholder="z. B. 75"><span class="u">kg</span></div>
    </section>
    <div class="hdr"><span>Wie aktiv bist du?</span></div>
    <section class="list" id="cAct">${ACTIVITY.map(a => `<button class="it" data-v="${a.f}"><div class="n"><b>${a.n}</b><span>${a.d}</span></div><span class="chk">${icon('check')}</span></button>`).join('')}</section>
    <div id="cPaceWrap"><div class="hdr"><span id="cPaceLbl">Tempo</span></div><div class="seg" id="cPace" style="margin-top:8px"><button data-v="0.25">Gemütlich</button><button data-v="0.5">Normal</button><button data-v="0.75">Schnell</button></div></div>
    <div id="cRes"></div>
    <button class="btn" id="cOk" disabled>Ziele übernehmen</button>
    ${onSkip ? `<button class="btn del" id="cSkip" style="color:var(--l2)">Überspringen, später einstellen</button>` : ''}
    <p class="note">Das ist eine Schätzung. Wenn sich dein Gewicht nach 2–3 Wochen anders entwickelt als geplant, rechne einfach neu oder pass die Ziele unter „Ziele“ an.</p>`;
  const segSel = (id, val) => box.querySelectorAll(`#${id} [data-v]`).forEach(b => b.classList.toggle('on', b.dataset.v === String(val)));
  const actSel = () => box.querySelectorAll('#cAct [data-v]').forEach(b => b.querySelector('.chk').classList.toggle('on', +b.dataset.v === p.act));
  let res = null;
  const upd = () => {
    p.age = num($('#cAge', box).value); p.height = num($('#cH', box).value); p.weight = num($('#cW', box).value); p.target = num($('#cT', box).value);
    res = calcGoals(p);
    const mode = res ? res.mode : (p.target && p.weight ? (Math.abs(p.target - p.weight) < .5 ? 'keep' : p.target < p.weight ? 'lose' : 'gain') : 'keep');
    $('#cPaceWrap', box).hidden = mode === 'keep';
    if (mode === 'gain' && p.pace > .5) p.pace = .5;
    $('#cPaceLbl', box).textContent = `${mode === 'gain' ? 'Wie schnell zunehmen?' : 'Wie schnell abnehmen?'} · ${String(p.pace).replace('.', ',')} kg pro Woche`;
    box.querySelector('#cPace [data-v="0.75"]').hidden = mode === 'gain';
    segSel('cPace', p.pace);
    $('#cOk', box).disabled = !res;
    if (!res) { $('#cRes', box).innerHTML = `<section class="card"><p class="note" style="margin:0">Trag Alter, Größe und Gewicht ein, dann siehst du hier deine Ziele.</p></section>`; return; }
    const what = res.mode === 'keep' ? 'Gewicht halten' : res.mode === 'lose' ? `${n1(p.weight - res.target)} kg abnehmen` : `${n1(res.target - p.weight)} kg zunehmen`;
    $('#cRes', box).innerHTML = `<section class="card calcres">
      <div class="ctop">Dein Tagesziel · ${what}</div>
      <div class="big"><b class="num">${n0(res.kcal)}</b><span>kcal pro Tag</span></div>
      <div class="nut" style="background:var(--g2);margin-top:10px"><div><b class="num" style="color:var(--org)">${n0(res.c)} g</b><span>KH</span></div><div><b class="num" style="color:var(--grn)">${n0(res.p)} g</b><span>Eiweiß</span></div><div><b class="num" style="color:var(--blu)">${n0(res.f)} g</b><span>Fett</span></div><div><b class="num">${n0(res.tdee)}</b><span>Verbrauch</span></div></div>
      ${res.eta ? `<div class="eta">🎯 Zielgewicht ${n1(res.target)} kg voraussichtlich am <b>${longDateY(res.eta)}</b><span>in etwa ${res.weeks < 9 ? `${Math.ceil(res.weeks)} Wochen` : `${Math.round(res.weeks / 4.35)} Monaten`} · ${n1(res.realPace)} kg pro Woche</span></div>` : ''}
      ${res.clamped ? `<p class="note" style="margin:8px 0 0">Weniger als ${n0(res.kcal)} kcal sind auf Dauer nicht gesund. Deshalb dauert es etwas länger als gewählt.</p>` : ''}
      <p class="note" style="margin:8px 0 0;text-align:left">Grundumsatz ${n0(res.bmr)} kcal × Aktivität ${String(p.act).replace('.', ',')} = Verbrauch ${n0(res.tdee)} kcal${res.mode === 'keep' ? '' : `, ${res.mode === 'lose' ? 'minus' : 'plus'} ${n0(Math.abs(res.kcal - res.tdee))} kcal`}.</p>
    </section>`;
  };
  segSel('cSex', p.sex); actSel();
  box.querySelectorAll('#cSex [data-v]').forEach(b => b.addEventListener('click', () => { p.sex = b.dataset.v; segSel('cSex', p.sex); upd(); }));
  box.querySelectorAll('#cPace [data-v]').forEach(b => b.addEventListener('click', () => { p.pace = +b.dataset.v; upd(); }));
  box.querySelectorAll('#cAct [data-v]').forEach(b => b.addEventListener('click', () => { p.act = +b.dataset.v; actSel(); upd(); }));
  box.querySelectorAll('input').forEach(i => i.addEventListener('input', upd));
  $('#cOk', box).addEventListener('click', () => {
    if (!res) return;
    S.goals = { kcal: res.kcal, c: res.c, p: res.p, f: res.f };
    S.profile = { sex: p.sex, age: p.age, height: p.height, target: res.target, act: p.act, pace: p.pace, at: todayKey() };
    S.weightKg = p.weight;
    const t = todayKey();
    if (!S.weights.some(w => w.date === t) && Math.abs((S.weights.length ? S.weights[S.weights.length - 1].kg : 0) - p.weight) > 0.05) { S.weights.push({ date: t, kg: p.weight }); S.weights.sort((a, b) => a.date.localeCompare(b.date)); }
    save(); buzz(); render(); toast(`Neues Tagesziel: ${n0(res.kcal)} kcal`);
    if (onDone) onDone(); else closeTop();
  });
  if (onSkip) $('#cSkip', box).addEventListener('click', onSkip);
  upd();
}
function openCalc() {
  openLayer('sheet', `<div id="calcBody" style="display:flex;flex-direction:column;gap:14px"></div>`, el => renderCalc($('#calcBody', el)));
}
function goalSub() {
  const pr = S.profile;
  if (!pr) return 'Aus Alter, Größe, Gewicht und Zielgewicht';
  const r = calcGoals({ ...pr, weight: S.weights.length ? S.weights[S.weights.length - 1].kg : S.weightKg });
  if (!r || r.mode === 'keep') return `Gewicht halten · berechnet am ${shortDate(pr.at)}`;
  return `Ziel ${n1(r.target)} kg${r.eta ? ` · voraussichtlich am ${shortDate(r.eta)}` : ''}`;
}

/* ---------- Ersteinrichtung ---------- */
function openWelcome() {
  const firstSetup = !S.setup;
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
        </div>${firstSetup ? `<p class="note">Jetzt rechnen wir aus, wie viele Kalorien und Makros zu dir und deinem Zielgewicht passen. Alles bleibt auf deinem iPhone.</p>` : ''}<button class="btn" id="wcOk">${firstSetup ? 'Meine Ziele berechnen' : `Los geht’s${n ? ', ' + n : ''}!`}</button>`;
      confetti();
      $('#wcOk', el).addEventListener('click', () => {
        if (!firstSetup) { save(); closeTop(); render(); return; }
        renderCalc(body, { onDone: closeTop, onSkip: () => { closeTop(); toast('Du kannst die Ziele jederzeit unter „Ziele“ berechnen'); } });
        el.scrollTop = 0;
      });
    };
    if (S.name) { greet(); return; }
    body.innerHTML = `<div class="hello">
        <img src="icons/icon-192.png" alt="" class="hello-ic">
        <h2>Willkommen! 👋</h2>
        <p>Schön, dass du da bist. Wie heißt du?</p>
      </div>
      <section class="list"><div class="row-in"><input id="wcName" class="wide" style="text-align:left" placeholder="Dein Vorname" autocapitalize="words" autocomplete="given-name" enterkeyhint="next" aria-label="Dein Vorname"></div></section>
      ${S.referredBy ? '' : `<div class="hdr"><span>Wer hat dir Biss empfohlen?</span></div>
      <section class="list"><div class="row-in"><input id="wcRef" class="wide" style="text-align:left" placeholder="Name, optional" autocapitalize="words" enterkeyhint="next" aria-label="Wer hat dir Biss empfohlen?"></div></section>
      <p class="note" style="margin-top:-6px">Dann bekommt die Person Punkte fürs Weiterempfehlen.</p>`}
      <button class="btn" id="wcNext">Weiter</button>`;
    const inp = $('#wcName', el), refInp = $('#wcRef', el);
    const next = () => {
      const name = inp.value.trim().slice(0, 30);
      if (!name) { toast('Wie heißt du?'); inp.focus(); return; }
      S.name = name;
      const ref = refInp ? refInp.value.trim().slice(0, 40) : '';
      if (ref) { S.referredBy = ref; S.refSent = false; }
      save(); render(); greet();
      if (ref) sendReferral();
    };
    $('#wcNext', el).addEventListener('click', next);
    inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); if (refInp) refInp.focus(); else next(); } });
    if (refInp) refInp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); next(); } });
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
  body: () => openBody(),
  badges: () => openBadges(),
  supps: () => openSupps(),
  calc: () => openCalc(),
  wish: () => openWish(),
  photo: b => openPhoto(b.dataset.id),
  addPhoto: () => { const f = bodyEl && $('#phFile', bodyEl); if (f) f.click(); },
  measure: () => openMeasure(),
  bodyMeasure: b => { bodyMeasure = b.dataset.m; drawBody(); },
  bodyRange: b => { bRange = +b.dataset.r; drawBody(); },
  suppToggle: b => {
    const id = b.dataset.id, l = S.suppLog[cur] || [];
    S.suppLog[cur] = l.includes(id) ? l.filter(x => x !== id) : [...l, id];
    if (!S.suppLog[cur].length) delete S.suppLog[cur];
    save(); buzz(); render();
    if (daySupps(cur) && !l.includes(id)) toast('Alle Supplements erledigt ✅');
  },
  backup: () => openBackup(),
  healthHelp: () => openHealthHelp(),
  shareApp: () => openShare(),
  shareLink: () => shareLink(),
  referral: () => openReferral(),
  range: b => { histRange = b.dataset.n; histOff = 0; render(); },
  histStep: b => { histOff = Math.max(0, histOff + +b.dataset.d); render(); },
  openmonth: b => { const [y, m] = b.dataset.k.split('-').map(Number), n = kdate(todayKey()); histRange = 'month'; histOff = (n.getFullYear() - y) * 12 + n.getMonth() - (m - 1); render(); window.scrollTo(0, 0); },
  calendar: () => openCalendar(),
  kcalFromMacros: () => { const g = S.goals; g.kcal = Math.round(g.c * 4 + g.p * 4 + g.f * 9); save(); render(); toast('Kalorienziel angepasst'); },
  wipe: b => {
    if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Wirklich alles löschen? Nochmal tippen'; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = 'Alle Daten löschen'; } }, 4000); return; }
    S = DEFAULTS(); initBadges(); save(); thumbCache.clear(); PDB.clear().catch(() => {}); cur = todayKey(); tab = 'today'; render(); toast('Alle Daten gelöscht'); openWelcome();
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

/* ---------- Sperre ---------- */
// status.json im Repo steuert, ob die App gesperrt ist ("gesperrt": true/false).
// Der letzte bekannte Stand wird gemerkt, damit die Sperre auch offline gilt. Die Daten bleiben unberührt.
const LOCK_KEY = 'biss.lock', OWNER_KEY = 'biss.owner';
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* egal */ } };
function showLock(st) {
  let el = $('#lock');
  if (!st || !st.gesperrt || lsGet(OWNER_KEY) === '1') { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'lock'; el.setAttribute('role', 'alertdialog'); document.body.appendChild(el); }
  el.innerHTML = `<div class="hello">
      <img src="icons/icon-192.png" alt="" class="hello-ic" id="lockIc">
      <h2>${esc(st.titel || 'Biss ist gerade gesperrt')}</h2>
      <p>${esc(st.text || 'Die App wird bald wieder freigegeben. Deine Daten bleiben erhalten.')}</p>
    </div>`;
  // Für den Besitzer: 7× aufs Icon tippen hebt die Sperre auf diesem Gerät auf
  let taps = 0, tT;
  $('#lockIc', el).addEventListener('click', () => {
    clearTimeout(tT); tT = setTimeout(() => { taps = 0; }, 2000);
    if (++taps >= 7) { lsSet(OWNER_KEY, '1'); el.remove(); toast('Sperre auf diesem Gerät aufgehoben'); }
  });
}
async function checkLock() {
  try {
    const r = await fetch('status.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const st = await r.json();
    lsSet(LOCK_KEY, JSON.stringify(st)); showLock(st);
  } catch (e) { /* offline: letzter Stand gilt */ }
}
try { showLock(JSON.parse(lsGet(LOCK_KEY) || 'null')); } catch (e) { /* kein Stand */ }
checkLock();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkLock(); });

/* ---------- Start ---------- */
if (!S.badges) { initBadges(); save(); }
render();
if (!S.setup || !S.greeted) openWelcome();
sendReferral();
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
