import { CONFIG, LEVELS, MATCH_LEVELS } from './config.js';
import * as E from './engine.js';
import { BANK, EXAMPLES } from './data.js';
import { BASICS, TRICKS } from './lessons.js';
import * as Svc from './services.js';
import * as LB from './leaderboard.js';
import * as Live from './live.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = {
  back: '<path d="M15 5l-7 7 7 7"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  play: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/>', cup: '<path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 14v4M8 20h8"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/>',
  undo: '<path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2"/>', erase: '<path d="M8 20h12M5 15l9-10 6 5-9 10H8z"/>', pen: '<path d="M4 20l1-5L16 4l4 4L9 19z"/>', bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10z"/>',
  speaker: '<path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', chev: '<path d="M9 5l7 7-7 7"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', check: '<path d="M5 13l4 4L19 7"/>',
};
const I = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${icon[n]}</svg>`;

// ---------- saved data ----------
const KEY = 'play-sudoku.v1';
const DEFAULTS = {
  set: { sound: true, vibrate: true, voice: true, voiceRate: 1, autoNotes: true, sameNum: true, peers: true, timer: true, showMistakes: true, attempts: 3, theme: 'light' },
  wins: {}, played: {}, best: {}, seen: {}, hints: { extra: 0 }, helpEarned: true, matches: { won: 0, lost: 0 }, pro: false, tester: false,
  name: '', country: '', daily: {}, totals: {}, auth: null, game: null, pending: [],
};
let S = load();
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULTS, ...d, set: { ...DEFAULTS.set, ...d.set }, hints: { ...DEFAULTS.hints, ...d.hints } };
  } catch { return structuredClone(DEFAULTS); }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* keeps working from memory */ } }

const today = () => new Date().toISOString().slice(0, 10);
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const level = id => LEVELS.find(l => l.id === id);
const unlocked = id => { const i = LEVELS.findIndex(l => l.id === id); return i === 0 || S.tester || (S.wins[LEVELS[i - 1].id] || 0) >= CONFIG.winsToUnlock; };
function helpLeft() { return S.pro ? Infinity : Math.max(0, CONFIG.helpPerGame - (G?.helpUsed || 0)) + S.hints.extra; }
function spendHelp() {
  if (S.pro) return;
  if ((G.helpUsed || 0) < CONFIG.helpPerGame) G.helpUsed = (G.helpUsed || 0) + 1; else S.hints.extra--;
  save();
}
function applyTheme() {
  document.documentElement.dataset.theme = S.set.theme === 'dark' || S.set.theme === 'night' ? 'dark' : 'light';
}
const setBrand = id => { document.body.className = id ? `lv-${id}` : ''; };
const TAB_BRAND = { play: 'medium', compete: 'extreme', profile: 'easy' };
const sfx = k => { if (S.set.sound) Svc.tone(k); };
const hap = k => { if (S.set.vibrate) Svc.buzz(k); };
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }

// ---------- board ----------
function boardHTML(v) {
  const sel = v.sel ?? -1, hi = v.armed || (sel >= 0 ? v.grid[sel] : 0), hlU = new Set(v.hl?.unit || []), hlF = new Set(v.hl?.focus || []), hlS = new Set(v.hl?.sources || []);
  const marks = {};
  for (const c of v.hl?.cands || []) (marks[c.cell] ||= {})[c.val] = c.kind;
  let out = '';
  for (let i = 0; i < 81; i++) {
    const r = E.rowOf(i), c = E.colOf(i), val = v.grid[i] || v.ghost?.[i] || 0, cls = ['cell'];
    if (c === 2 || c === 5) cls.push('br');
    if (r === 2 || r === 5) cls.push('bb');
    if (v.given[i]) cls.push('given'); else if (v.grid[i]) cls.push('pen');
    if (!v.grid[i] && v.ghost?.[i]) cls.push('ghost');
    if (v.bad?.has(i)) cls.push('bad');
    if (!v.hl) {
      if (sel >= 0 && i !== sel && v.peers && (r === E.rowOf(sel) || c === E.colOf(sel) || E.boxOf(i) === E.boxOf(sel))) cls.push('peer');
      if (hi && val === hi && (v.armed || v.sameNum)) cls.push('same');
      if (i === sel) cls.push('sel');
    }
    if (v.target === i) cls.push('h-target');
    if (hlU.has(i)) cls.push('h-unit');
    if (hlF.has(i)) cls.push('h-focus');
    if (hlS.has(i)) cls.push('h-src');
    let inner = val || '';
    const showMask = v.overlay?.[i] ?? v.notes?.[i];
    if (!val && showMask) {
      inner = '<span class="notes">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => {
        if (!(showMask & (1 << (d - 1)))) return '<span></span>';
        const k = marks[i]?.[d];
        return `<span class="${k || (hi === d && !v.hl ? 'same-n' : '')}">${d}</span>`;
      }).join('') + '</span>';
    }
    const label = `Row ${r + 1}, column ${c + 1}${val ? ', ' + val : ', empty'}`;
    out += v.interactive
      ? `<button class="${cls.join(' ')}" data-act="cell" data-i="${i}" style="--o:${r + c}" aria-label="${label}">${inner}</button>`
      : `<div class="${cls.join(' ')}" style="--o:${r + c}">${inner}</div>`;
  }
  return `<div class="board ${v.cls || ''}"${v.interactive ? '' : ' role="img" aria-label="' + esc(v.alt || 'Sudoku board') + '"'}><div class="grid">${out}</div></div>`;
}

// ---------- navigation ----------
let R = { tab: 'play', sub: null, back: null }, G = null, H = null, tick = null, compete = { mode: 'live', matchLevel: 'easy', view: 'today', level: 'easy', data: null, err: null, loading: false };
const app = $('#app'), sheet = $('#sheet-root');
function closeSheet() { sheet.innerHTML = ''; H = null; Svc.stopSpeaking(); }
const strict = () => G.ranked || !!G.match;
function go(tab, sub = null, back = null) { closeSheet(); R = { tab, sub, back }; render(); }
function render() {
  syncLobby();
  if (R.tab === 'game') return renderGame();
  stopClock();
  setBrand(TAB_BRAND[R.tab]);
  const body = R.sub ? subScreen() : { play: playScreen, compete: competeScreen, profile: profileScreen }[R.tab]();
  const showTabs = !R.sub;
  const scrollTop = $('.scroll', app)?.scrollTop;
  app.innerHTML = `<main class="scroll">${body}</main>` + (showTabs ? `<nav class="tabs">
    ${[['play', 'play', 'Play'], ['compete', 'cup', 'Compete'], ['profile', 'user', 'Profile']].map(([t, ic, n]) => `<button data-act="tab" data-t="${t}" ${R.tab === t ? 'aria-current="page"' : ''}>${I(ic)}${n}</button>`).join('')}
  </nav>` : '');
  if (scrollTop && R.keepScroll) $('.scroll', app).scrollTop = scrollTop;
  R.keepScroll = false;
}
function subScreen() {
  if (R.sub === 'settings') return settingsScreen();
  if (R.sub === 'basics') return basicsScreen();
  if (R.sub === 'stats') return statsScreen();
  if (R.sub?.startsWith('trick:')) return trickScreen(R.sub.slice(6));
  return '';
}
const backBtn = (label = 'Back') => `<button class="back" data-act="back">${I('back')}${label}</button>`;

// ---------- play ----------
function playScreen() {
  const g = S.game;
  const hero = g ? (() => {
    const v = { grid: g.grid, given: [...g.puzzle].map(c => c !== '0'), cls: 'mini-b', alt: 'Your unfinished puzzle' };
    return `<button class="hero" data-act="resume"><div class="mini">${boardHTML(v)}</div><div><b style="font-size:19px;font-weight:600">Continue ${level(g.level).name}</b><br><span class="sub">${g.ranked ? "Today's challenge, " : ''}${fmt(g.seconds)} played</span></div></button>`;
  })() : '';
  const rungs = LEVELS.map((l, i) => {
    const open = unlocked(l.id), w = S.wins[l.id] || 0, prev = LEVELS[i - 1];
    const pips = [...Array(CONFIG.winsToUnlock)].map((_, k) => `<i class="${k < w ? 'on' : ''}"></i>`).join('');
    const note = open ? l.blurb : `Win ${CONFIG.winsToUnlock - (S.wins[prev.id] || 0)} more ${prev.name} to unlock`;
    return `<button class="rung lv-${l.id} ${open ? 'open' : 'locked'}" data-act="start" data-l="${l.id}" aria-label="${l.name}. ${note}">
      <span class="num">${open ? i + 1 : I('lock')}</span>
      <span class="body"><b>${l.name}</b><small>${note}</small>${i < 4 ? `<span class="pips" aria-hidden="true">${pips}</span>` : ''}</span>
      ${open ? `<span class="tag">${w} win${w === 1 ? '' : 's'}</span>` : ''}</button>`;
  }).join('');
  const nextTrick = E.TECHNIQUES.find(t => !S.seen[t.id]);
  return `<header class="band"><div class="spread"><div class="brandline"><span class="logo" aria-hidden="true">${'<i></i>'.repeat(9)}</span><h1 class="title">${CONFIG.appName}</h1></div><button class="iconbtn" data-act="settings" aria-label="Settings">${I('gear')}</button></div>
    <p>Every Help tells you the number and the reason.</p></header>
    ${hero}
    <h2 class="section">Choose a level</h2><div class="ladder">${rungs}</div>
    ${nextTrick ? `<h2 class="section">Learn next</h2><div class="list"><button class="item" data-act="trick" data-id="${nextTrick.id}"><span class="grow"><b style="font-weight:600">${nextTrick.name}</b><small>${TRICKS[nextTrick.id].when}</small></span>${I('chev')}</button></div>` : ''}`;
}
function newGame(lv, opts = {}) {
  let puzzle = opts.puzzle;
  if (!puzzle) {
    const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31), list = BANK[lv];
    puzzle = E.transform(list[E.hashString('p' + seed) % list.length], seed);
  }
  const sol = E.stringify(E.solutionOf(E.parse(puzzle)));
  G = { level: lv, puzzle, solution: sol, grid: [...E.parse(puzzle)], notes: Array(81).fill(0), mistakes: 0, seconds: 0, sel: null, notesOn: false, undo: [], ranked: !!opts.ranked, boardId: opts.boardId || null, lesson: !!opts.lesson, returnTo: opts.returnTo || null, helpUsed: 0, paid: [], armed: null, helpLocked: !opts.lesson && !S.helpEarned, match: opts.match || null, oppPct: 0, oppSeen: Date.now(), pushed: -1 };
  if (!G.lesson && !G.match) { S.game = G; S.played[lv] = (S.played[lv] || 0) + 1; save(); }
  R = { tab: 'game' }; render();
}
function persist() { if (G && !G.lesson && !G.match && !G.over) { S.game = { ...G, undo: [] }; save(); } }
const attemptLimit = () => (strict() ? 3 : S.set.showMistakes ? S.set.attempts : 0);
const myPct = () => { const blanks = [...G.puzzle].filter(c => c === '0').length; let n = 0; G.grid.forEach((v, i) => { if (G.puzzle[i] === '0' && v === +G.solution[i]) n++; }); return Math.round(n / blanks * 100); };
const given = () => [...G.puzzle].map(c => c !== '0');
const isWrong = i => G.grid[i] && G.grid[i] !== +G.solution[i];
const correctGrid = () => Int8Array.from(G.grid.map((v, i) => (v === +G.solution[i] ? v : 0)));

function renderGame() {
  setBrand(G.level);
  const lim = attemptLimit(), showBad = strict() || S.set.showMistakes, counts = Array(10).fill(0);
  G.grid.forEach(v => counts[v]++);
  const bad = new Set(); if (showBad) G.grid.forEach((_, i) => { if (isWrong(i)) bad.add(i); });
  let view = { grid: G.grid, given: given(), notes: G.notes, sel: G.sel, bad, interactive: true, peers: S.set.peers, sameNum: S.set.sameNum, armed: G.armed };
  if (H) view = { ...view, ...hintView(), cls: H.fresh ? 'sweep' : '' };
  if (G.won) view.cls = 'win';
  const left = helpLeft(), helpOff = strict() || G.helpLocked;
  const scroll = `<div class="game">
    <div class="gbar">
      <button class="iconbtn" data-act="leave" aria-label="Leave puzzle">${I('back')}</button>
      <div class="mid"><b>${G.lesson ? 'Practice' : G.match ? 'Live ' + level(G.level).name : G.ranked ? "Today's " + level(G.level).name : level(G.level).name}</b><span id="clock">${S.set.timer ? fmt(G.seconds) : ''}</span>
      ${lim ? `<div class="lives" aria-label="${lim - G.mistakes} attempts left">${[...Array(lim)].map((_, i) => `<i class="${i < G.mistakes ? 'lost' : ''}"></i>`).join('')}</div>` : ''}</div>
      ${G.match ? '<span class="iconbtn"></span>' : `<button class="iconbtn" data-act="settings" aria-label="Settings">${I('gear')}</button>`}
    </div>
    ${G.match ? `<div class="matchbar"><div><div class="who"><b>You</b><span id="my-pct">${myPct()}%</span></div><div class="bar"><i id="my-bar" style="width:${myPct()}%"></i></div></div>
      <div><div class="who"><b>${flag(G.match.opp.country)} ${esc(G.match.opp.name)}</b><span id="opp-pct">${G.oppPct}%</span></div><div class="bar"><i id="opp-bar" style="width:${G.oppPct}%"></i></div></div></div>` : ''}
    ${boardHTML(view)}
    <div class="tools" ${H ? 'style="visibility:hidden"' : ''}>
      <button class="tool" data-act="undo">${I('undo')}Undo</button>
      <button class="tool" data-act="notes" aria-pressed="${G.notesOn}">${I('pen')}Notes ${G.notesOn ? 'on' : 'off'}</button>
      <button class="tool help ${helpOff ? 'off' : ''}" data-act="help">${I(helpOff ? 'lock' : 'bulb')}${helpOff ? 'Help off' : 'Help'}${!helpOff && !G.lesson && left !== Infinity ? `<span class="count">${left}</span>` : ''}</button>
    </div>
    <div class="pad ${G.notesOn ? 'notes-on' : ''}">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<button class="${G.armed === d ? 'armed' : ''}" data-act="num" data-d="${d}" ${counts[d] >= 9 && !G.notesOn ? 'disabled' : ''} aria-pressed="${G.armed === d}" aria-label="${d}, ${Math.max(0, 9 - counts[d])} left">${d}<small>${Math.max(0, 9 - counts[d])}</small></button>`).join('')}<button class="eraser" data-act="erase" aria-label="Erase">${I('erase')}<small>Erase</small></button></div>
  </div>`;
  app.innerHTML = scroll;
  startClock();
}
function startClock() {
  if (tick) return;
  tick = setInterval(() => {
    if (document.hidden || !G || G.over || sheet.querySelector('.dialog')) return;
    G.seconds++;
    const c = $('#clock'); if (c && S.set.timer) c.textContent = fmt(G.seconds);
    if (G.seconds % 10 === 0) persist();
  }, 1000);
}
function stopClock() { clearInterval(tick); tick = null; }

function snapshot() { G.undo.push({ grid: G.grid.slice(), notes: G.notes.slice() }); if (G.undo.length > 200) G.undo.shift(); }
function enter(d) {
  if (G.sel == null) return toast('Select an empty square first');
  const i = G.sel;
  if (given()[i]) return toast('This number came with the puzzle');
  if (G.notesOn) {
    if (G.grid[i] && !isWrong(i)) return;
    snapshot(); G.grid[i] = 0; G.notes[i] ^= 1 << (d - 1); sfx('note'); hap('LIGHT'); persist(); return renderGame();
  }
  snapshot();
  if (G.grid[i] === d) { G.grid[i] = 0; persist(); return renderGame(); }
  G.grid[i] = d; G.notes[i] = 0;
  const wrong = d !== +G.solution[i], check = strict() || S.set.showMistakes;
  if (wrong && check) {
    G.mistakes++; sfx('wrong'); hap('HEAVY');
    const lim = attemptLimit();
    if (lim && G.mistakes >= lim) return lose();
  } else {
    if (S.set.autoNotes && !wrong) for (const p of E.PEERS[i]) G.notes[p] &= ~(1 << (d - 1));
    const done = !wrong && E.UNITS.some(u => u.cells.includes(i) && u.cells.every(c => G.grid[c] === +G.solution[c]));
    sfx(done ? 'unit' : 'place'); hap('LIGHT');
    if (!wrong) digitDone(d);
  }
  persist();
  if (G.grid.every(v => v)) {
    if (G.grid.every((v, k) => v === +G.solution[k])) return win();
    toast('The grid is full, but some numbers are wrong');
  }
  renderGame();
}
// When a number is complete: a special sound, then move on to the next unfinished number.
function digitDone(d) {
  if (G.solution.split('').some((c, i) => +c === d && G.grid[i] !== d) || G.grid.every((v, k) => v === +G.solution[k])) return;
  sfx('digit'); hap('HEAVY');
  if (G.armed !== d) return;
  G.armed = null;
  for (let k = 1; k < 9; k++) {
    const n = (d + k - 1) % 9 + 1;
    if (G.solution.split('').some((c, i) => +c === n && G.grid[i] !== n) && G.grid.filter(v => v === n).length < 9) { G.armed = n; break; }
  }
}
function celebrate() { sfx('win'); hap('HEAVY'); Svc.confetti(); }
function score() { const l = level(G.level); return Math.max(100, l.base + Math.max(0, l.par - G.seconds) * 2 - G.mistakes * 100); }
function finishGame() { G.over = true; if (!G.lesson) { S.game = null; save(); } }
function win() {
  if (G.match) return matchFinish(true);
  G.won = true; S.helpEarned = true; finishGame(); celebrate(); renderGame();
  if (G.lesson) return dialog(`<h2>Nice work</h2><p class="sub" style="margin-top:6px">You finished the position from this lesson.</p><div style="margin-top:14px"><button class="btn" data-act="lesson-done">Back to the trick</button></div>`);
  const lv = G.level, before = S.wins[lv] || 0;
  S.wins[lv] = before + 1;
  if (!S.best[lv] || G.seconds < S.best[lv]) S.best[lv] = G.seconds;
  const i = LEVELS.findIndex(l => l.id === lv), nextL = LEVELS[i + 1];
  const unlockedNow = nextL && before + 1 === CONFIG.winsToUnlock;
  let pts = null;
  if (G.ranked) { pts = score(); recordRanked(G.boardId, { score: pts, seconds: G.seconds, mistakes: G.mistakes }); }
  save();
  dialog(`<h2>${unlockedNow ? `${nextL.name} unlocked` : 'Puzzle solved'}</h2>
    <div class="stat3"><div><b>${fmt(G.seconds)}</b><span>Time</span></div><div><b>${G.mistakes}</b><span>Mistakes</span></div><div><b>${pts ?? `${Math.min(S.wins[lv], 10)}/10`}</b><span>${pts != null ? 'Points' : level(lv).name + ' wins'}</span></div></div>
    <div class="row">${G.ranked ? `<button class="btn" data-act="to-board">See the scoreboard</button>` : `<button class="btn alt" data-act="home">Home</button><button class="btn" data-act="start" data-l="${unlockedNow ? nextL.id : lv}">${unlockedNow ? 'Play ' + nextL.name : 'Next puzzle'}</button>`}</div>`);
}
function lose() {
  if (G.match) return matchFinish(false);
  if (!G.lesson) S.helpEarned = false;
  finishGame(); renderGame();
  if (G.ranked) { recordRanked(G.boardId, { failed: true, score: 0, seconds: G.seconds, mistakes: G.mistakes }); save(); }
  dialog(`<h2>Out of attempts</h2><p class="sub" style="margin-top:6px">${G.ranked ? 'Your challenge for today is over. A new one starts tomorrow.' : 'Help is off until you win a puzzle. Try this one again from the start.'}</p>
    <div class="row" style="margin-top:14px">${G.ranked ? `<button class="btn" data-act="to-board">See the scoreboard</button>` : `<button class="btn alt" data-act="home">Home</button><button class="btn" data-act="retry">Try again</button>`}</div>`);
}
function dialog(html) { sheet.innerHTML = `<div class="scrim" style="align-items:center"><div class="sheet dialog" role="dialog" aria-modal="true">${html}</div></div>`; }

// ---------- help ----------
function openHelp() {
  if (strict()) return toast(G.match ? 'Help is off in live matches' : 'Help is off in Compete so scores stay fair');
  if (G.helpLocked) return toast('Help comes back after you win a puzzle');
  const sel = G.sel, picked = sel != null && !given()[sel] && (!G.grid[sel] || isWrong(sel));
  const grid = correctGrid(), target = picked ? sel : E.nextTarget(grid, G.armed || 0);
  if (target == null) return toast('Fix the crossed-out numbers first');
  if (!G.lesson && !G.paid.includes(target)) {
    if (helpLeft() <= 0) return openStore("You have used this puzzle's Help");
    spendHelp(); G.paid.push(target);
  }
  const r = E.explainCell(grid, target);
  if (!r) return toast('Fix the crossed-out numbers first');
  H = { steps: r.steps, i: r.steps.length - 1, target, wrongHere: isWrong(target), general: !picked, forDigit: !picked && G.armed === r.value ? r.value : 0, fresh: true };
  showHint();
}
function hintView() {
  const s = E.makeState(correctGrid());
  for (let k = 0; k < H.i; k++) E.applyStep(s, H.steps[k]);
  const st = H.steps[H.i], ghost = {}, overlay = {};
  for (let c = 0; c < 81; c++) if (s.g[c] && G.grid[c] !== s.g[c]) ghost[c] = s.g[c];
  for (const m of st.hl.cands) overlay[m.cell] = s.c[m.cell] | (overlay[m.cell] || 0);
  if (st.place) ghost[st.place.cell] = st.place.val;
  return { hl: st.hl, ghost, overlay, grid: G.grid.map((v, c) => (isWrong(c) ? 0 : v)), sel: null, armed: null, target: H.target };
}
function hintParts() {
  const st = H.steps[H.i], n = H.steps.length, last = H.i === n - 1;
  const answer = last && st.place ? `${E.cellName(st.place.cell).replace('row', 'Row')} is ${st.place.val}.` : null;
  const lines = [...st.lines];
  if (last && H.wrongHere) lines.unshift('The number entered here is not right.');
  if (last && n > 1) lines.push(`Underlined numbers are not on your board yet. They come from ${n - 1} earlier step${n > 2 ? 's' : ''}.`);
  return { st, n, last, answer, lines };
}
const hintSpeech = () => { const { st, answer, lines } = hintParts(); return [answer, `This uses the trick called ${E.TECH[st.tech].name}.`, ...lines].filter(Boolean).join(' '); };
function showHint() {
  const { st, n, last, answer, lines } = hintParts();
  const fill = H.target != null ? H.steps[n - 1].place : null;
  S.seen[st.tech] = true; save();
  renderGame();
  sheet.innerHTML = `<div class="scrim clear"><section class="sheet hint" aria-live="polite">
    <div class="spread hint-head"><div><h2>${E.TECH[st.tech].name}</h2>${!last ? `<span class="sub">Earlier step ${H.i + 1} of ${n - 1}</span>` : H.forDigit ? `<span class="sub">Next place for ${H.forDigit}</span>` : H.general ? '<span class="sub">Easiest move on the board</span>' : ''}</div>
      <div class="row" style="gap:0"><button class="iconbtn" data-act="say" aria-label="Read aloud">${I('speaker')}</button><button class="iconbtn" data-act="hint-close" aria-label="Close help">${I('x')}</button></div></div>
    <ol>${answer ? `<li><span class="answer">${esc(answer)}</span></li>` : ''}${lines.map(p => `<li>${esc(p)}</li>`).join('')}</ol>
    <div class="row hint-main">
      ${!last ? `<button class="btn alt" data-act="hint-prev">Back</button><button class="btn" data-act="hint-next">${H.i === n - 2 ? 'Back to the answer' : 'Next step'}</button>` : fill ? `<button class="btn" data-act="hint-fill">Fill in ${fill.val}</button>` : `<button class="btn" data-act="hint-apply">${st.elim.length ? 'Erase these notes' : 'Got it'}</button>`}
    </div>
    <div class="row hint-links">
      ${last && n > 1 ? `<button data-act="hint-walk">See the ${n - 1} earlier step${n > 2 ? 's' : ''}</button>` : ''}
      <button data-act="trick" data-id="${st.tech}">Learn this trick</button>
    </div>
  </section></div>`;
  H.fresh = false;
  if (S.set.voice) Svc.speak(hintSpeech(), S.set.voiceRate);
}

// ---------- lessons ----------
function basicsScreen() {
  return `${backBtn()}<h1 class="title">How Sudoku works</h1><ol class="how" style="margin-top:16px">${BASICS.map(b => `<li><b style="font-weight:600">${b.t}</b><br><span class="sub">${b.b}</span></li>`).join('')}</ol>`;
}
function trickScreen(id) {
  const t = E.TECH[id], ex = EXAMPLES.find(e => e.id === id), info = TRICKS[id], g = [...E.parse(ex.grid)], st = ex.step;
  const s = E.makeState(E.parse(ex.grid)), overlay = {};
  for (const m of st.hl.cands) overlay[m.cell] = s.c[m.cell];
  const pic = boardHTML({ grid: g, given: g.map(Boolean), hl: st.hl, overlay, alt: `Example of ${t.name}` });
  const answer = st.place ? `<p><span class="answer" style="background:var(--brand);color:var(--on-brand);padding:2px 8px;border-radius:6px;font-weight:600">So ${E.cellName(st.place.cell)} is ${st.place.val}.</span></p>` : '';
  return `<div class="lesson">${backBtn()}<div class="spread"><h1 class="title">${t.name}</h1><span class="tag lv-${info.level.toLowerCase()}">From ${info.level}</span></div>
    <p class="sub" style="margin-top:6px">${info.when}</p>
    <h2 class="section">Example</h2>${pic}
    <div class="why">${st.lines.map(l => `<p>${esc(l)}</p>`).join('')}${answer}</div>
    <button class="btn alt" style="margin-top:12px" data-act="say-trick" data-id="${id}">${I('speaker')}Read aloud</button>
    <h2 class="section">How to solve it</h2><ol class="how">${info.how.map(h => `<li>${h}</li>`).join('')}</ol>
    <button class="btn mark" style="margin-top:8px" data-act="practice" data-id="${id}">Try this position</button></div>`;
}

// ---------- profile, settings ----------
const flag = c => (c ? String.fromCodePoint(...[...c.toUpperCase()].map(ch => 127397 + ch.charCodeAt(0))) : '');
const COUNTRIES = 'AE AR AU BD BE BR CA CH CL CN CO CZ DE DK EG ES ET FI FR GB GH GR HK ID IE IL IN IR IT JP KE KR LK MA MX MY NG NL NO NP NZ PE PH PK PL PT RO RU SA SE SG TH TR TW UA US VN ZA'.split(' ');
const countryName = c => { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(c); } catch { return c; } };
function profileScreen() {
  const wins = Object.values(S.wins).reduce((a, b) => a + b, 0), learned = E.TECHNIQUES.filter(t => S.seen[t.id]).length;
  return `<header class="band"><div class="spread"><h1 class="title">${esc(S.name || 'Your profile')} ${flag(S.country)}</h1><button class="iconbtn" data-act="settings" aria-label="Settings">${I('gear')}</button></div><p>Track your wins and learn every trick.</p></header>
    <div class="stat3"><div><b>${wins}</b><span>Puzzles won</span></div><div><b>${learned}/${E.TECHNIQUES.length}</b><span>Tricks used</span></div><div><b>${S.matches.won}</b><span>Live wins</span></div></div>
    <div class="list">
      <button class="item" data-act="edit-profile"><span class="grow">Player name and country</span>${I('chev')}</button>
      <button class="item" data-act="stats"><span class="grow">Wins and best times</span>${I('chev')}</button>
      <button class="item" data-act="store"><span class="grow">${S.pro ? 'Play Sudoku Pro is active' : 'Get unlimited Help'}</span>${I('chev')}</button>
    </div>
    <h2 class="section">Tips and tricks</h2>
    <div class="list"><button class="item" data-act="basics"><span class="grow"><b style="font-weight:600">How Sudoku works</b><small>The rule, scanning and notes</small></span>${I('chev')}</button>
    ${E.TECHNIQUES.map(t => `<button class="item" data-act="trick" data-id="${t.id}"><span class="grow"><b style="font-weight:600">${t.name}</b><small class="lvtxt lv-${TRICKS[t.id].level.toLowerCase()}">${TRICKS[t.id].level}</small></span>${S.seen[t.id] ? `<span class="seen" aria-label="Used">${I('check')}</span>` : ''}${I('chev')}</button>`).join('')}</div>`;
}
function statsScreen() {
  return `${backBtn()}<h1 class="title">Wins and best times</h1><div class="list" style="margin-top:16px">${LEVELS.map(l => `<div class="item"><span class="grow">${l.name}<small>${S.played[l.id] || 0} played</small></span><span>${S.wins[l.id] || 0} won${S.best[l.id] ? `, best ${fmt(S.best[l.id])}` : ''}</span></div>`).join('')}<div class="item"><span class="grow">Live matches</span><span>${S.matches.won} won, ${S.matches.lost} lost</span></div></div>`;
}
const toggle = (k, label, sub = '') => `<button class="item" role="switch" aria-checked="${!!S.set[k]}" data-act="toggle" data-k="${k}"><span class="grow">${label}${sub ? `<small>${sub}</small>` : ''}</span><span class="switch"></span></button>`;
const seg = (k, label, opts, sub = '') => `<div class="setting"><div>${label}</div>${sub ? `<small class="sub" style="font-size:13.5px">${sub}</small>` : ''}<div class="seg">${opts.map(([v, n]) => `<button aria-pressed="${S.set[k] === v}" data-act="seg" data-k="${k}" data-v="${v}">${n}</button>`).join('')}</div></div>`;
function settingsScreen() {
  return `${backBtn()}<h1 class="title">Settings</h1>
    <h2 class="section">Sound</h2><div class="list">${toggle('sound', 'Sound effects')}${toggle('vibrate', 'Vibration')}${toggle('voice', 'Read Help aloud', 'The text always stays on screen')}${seg('voiceRate', 'Voice speed', [[.75, 'Slow'], [1, 'Normal'], [1.25, 'Fast']])}</div>
    <h2 class="section">Rules</h2><div class="list">${toggle('showMistakes', 'Show mistakes right away')}${S.set.showMistakes ? seg('attempts', 'Number of attempts', [[3, '3'], [5, '5'], [10, '10'], [0, 'Unlimited']], 'Compete always uses 3 attempts') : ''}</div>
    <h2 class="section">Board</h2><div class="list">${toggle('autoNotes', 'Clear notes automatically', 'Removes a number from nearby notes when you place it')}${toggle('sameNum', 'Highlight matching numbers')}${toggle('peers', 'Highlight row, column and box')}${toggle('timer', 'Show timer')}</div>
    <h2 class="section">Appearance</h2><div class="list">${seg('theme', 'App colours', [['light', 'Bright'], ['dark', 'Dark']], 'The puzzle board stays black and white')}</div>
    <h2 class="section">About</h2><div class="list">
      ${CONFIG.privacyUrl ? `<a class="item" style="color:inherit;text-decoration:none" href="${CONFIG.privacyUrl}">Privacy policy</a>` : ''}
      <button class="item" data-act="reset"><span class="grow" style="color:var(--wrong)">Reset all progress</span></button>
      <button class="item" data-act="version"><span class="grow sub">Version ${CONFIG.version}${S.tester ? ' (tester mode)' : ''}</span></button></div>`;
}
function editProfile(then) {
  const guess = S.country || (navigator.language.split('-')[1] || '').toUpperCase();
  sheet.innerHTML = `<div class="scrim"><form class="sheet" data-form="profile"><h2>Your player card</h2><p class="sub" style="margin-top:4px">Other players see this on the scoreboard.</p>
    <label class="field">Player name<input name="n" maxlength="16" required value="${esc(S.name)}" autocomplete="off"></label>
    <label class="field">Country<select name="c" required><option value="">Choose a country</option>${COUNTRIES.map(c => [c, countryName(c)]).sort((a, b) => a[1].localeCompare(b[1])).map(([c, n]) => `<option value="${c}" ${c === guess ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    <div class="row" style="margin-top:16px"><button type="button" class="btn alt" data-act="sheet-close">Cancel</button><button class="btn">Save</button></div></form></div>`;
  afterProfile = then || null;
}
let afterProfile = null;

// ---------- store ----------
let prices = {};
function openStore(msg = 'Help teaches you every trick') {
  const canBuy = Svc.billingReady() || S.tester;
  sheet.innerHTML = `<div class="scrim"><div class="sheet"><div class="spread"><h2>${esc(msg)}</h2><button class="iconbtn" data-act="sheet-close" aria-label="Close">${I('x')}</button></div>
    <p class="sub">${S.pro ? 'You have unlimited Help.' : `Every puzzle includes ${CONFIG.helpPerGame} Help after a win. You also have ${S.hints.extra} extra.`}</p>
    ${S.pro ? '' : `<div class="list" style="margin-top:12px">
      <button class="item" data-act="buy" data-p="pro" ${canBuy ? '' : 'disabled'}><span class="grow"><b style="font-weight:600">Play Sudoku Pro</b><small>Unlimited Help on every puzzle. One payment.</small></span><span class="price">${esc(prices[CONFIG.products.pro] || '')}</span></button>
      <button class="item" data-act="buy" data-p="pack" ${canBuy ? '' : 'disabled'}><span class="grow"><b style="font-weight:600">${CONFIG.packSize} Help</b><small>Used after a puzzle's included Help runs out</small></span><span class="price">${esc(prices[CONFIG.products.pack] || '')}</span></button></div>
    ${canBuy ? '' : '<p class="sub" style="margin-top:10px">Purchases work in the version installed from Google Play.</p>'}
    <button class="btn alt" style="margin-top:12px" data-act="restore" ${canBuy ? '' : 'disabled'}>Restore purchases</button>`}
    <p class="sub" style="margin-top:10px;font-size:14px">Purchases never skip levels or bring back Help after a failed puzzle.</p></div></div>`;
}
async function purchase(kind) {
  const consumable = kind === 'pack', grant = () => { if (kind === 'pro') S.pro = true; else S.hints.extra += CONFIG.packSize; save(); };
  if (!Svc.billingReady()) { grant(); toast('Test purchase added. No money was charged'); return afterStore(); }
  try { await Svc.buy(CONFIG.products[kind], consumable); grant(); toast(kind === 'pro' ? 'Pro is active' : `${CONFIG.packSize} Help added`); afterStore(); }
  catch (e) { toast(/cancel/i.test(e?.message || '') ? 'Purchase cancelled' : 'Purchase failed. Check your connection and try again'); }
}
function afterStore() { closeSheet(); render(); }

// ---------- compete ----------
const boardId = lv => (compete.view === 'today' ? `${today()}_${lv}` : `alltime_${lv}`);
function recordRanked(id, r) {
  S.daily[id] = r;
  const lv = id.split('_')[1];
  if (!r.failed) S.totals[lv] = (S.totals[lv] || 0) + r.score;
  S.pending.push({ id, lv, score: r.score, seconds: r.seconds, mistakes: r.mistakes, failed: !!r.failed });
  save(); flushScores();
}
async function flushScores() {
  if (!LB.isOnline() || !S.pending.length || !S.name) return;
  try {
    S.auth = await LB.signIn(S.auth); save();
    for (const p of S.pending.slice()) {
      if (!p.failed) {
        const me = { name: S.name, country: S.country };
        await LB.postScore(S.auth, p.id, { ...me, score: p.score, seconds: p.seconds, mistakes: p.mistakes });
        await LB.postScore(S.auth, `alltime_${p.lv}`, { ...me, score: S.totals[p.lv], seconds: 0, mistakes: 0 });
      }
      S.pending.shift(); save();
    }
  } catch { /* retried on next visit */ }
}
async function loadCompete() {
  compete.loading = true; compete.err = null; compete.data = null;
  const lv = compete.level, id = boardId(lv), rec = compete.view === 'today' ? S.daily[id] : (S.totals[lv] ? { score: S.totals[lv], seconds: 0 } : null);
  const mine = rec && !rec.failed ? rec.score : null;
  try {
    if (LB.isOnline()) {
      await flushScores();
      S.auth = await LB.signIn(S.auth); save();
      compete.data = await LB.loadBoard(S.auth, id, mine);
      compete.data.rows.forEach(r => { if (r.uid === S.auth.uid) r.me = true; });
    } else {
      const base = level(lv).base * (compete.view === 'today' ? 1.2 : 18);
      compete.data = LB.sampleBoard(id, base, mine != null ? { name: S.name || 'You', country: S.country, score: mine, seconds: rec.seconds } : null);
    }
  } catch { compete.err = 'Scores could not be loaded. Check your connection and try again.'; }
  compete.loading = false;
  if (R.tab === 'compete' && !R.sub) { R.keepScroll = true; render(); }
}
function competeScreen() {
  const seg2 = (v, k, cur, n) => `<button aria-pressed="${cur === v}" data-act="${k}" data-v="${v}">${n}</button>`;
  const head = `<header class="band"><h1 class="title">Compete</h1><p>Race real players or climb the daily board.</p></header>
    <div class="seg" style="margin-top:14px">${seg2('live', 'c-mode', compete.mode, 'Live match')}${seg2('daily', 'c-mode', compete.mode, 'Daily challenge')}</div>`;
  return head + (compete.mode === 'live' ? livePanel(seg2) : dailyPanel(seg2));
}
function livePanel(seg2) {
  const lv = compete.matchLevel, open = unlocked(lv), i = LEVELS.findIndex(x => x.id === lv);
  return `<p class="sub" style="margin-top:12px">Play one other person on the same puzzle. The first to finish wins. You both get 3 attempts, no Help, and you can see each other's progress.</p>
    <h2 class="section">Choose a level</h2>
    <div class="seg">${MATCH_LEVELS.map(x => seg2(x, 'c-match-level', lv, level(x).name)).join('')}</div>
    <div style="margin-top:12px">${open ? `<button class="btn" data-act="find">Find an opponent</button>` : `<button class="btn alt" disabled>${I('lock')}Win ${CONFIG.winsToUnlock} ${LEVELS[i - 1].name} puzzles to start this level</button>`}</div>
    ${Live.liveReady() ? `<p class="sub" style="margin-top:12px" id="here">${hereText()}</p>
    <p class="sub" style="margin-top:4px">Stay on this page to get challenges from other players.</p>` : `<p class="banner" style="margin-top:14px">Live matches with real players start when the game server is connected. For now you can test the match with a computer opponent.</p>
    <button class="btn alt" style="margin-top:8px" data-act="test-invite">Show a test challenge</button>`}
    <h2 class="section">Your record</h2><div class="list"><div class="item"><span class="grow">Live matches</span><span>${S.matches.won} won, ${S.matches.lost} lost</span></div></div>`;
}
const hereText = () => (LV.here ? `${LV.here} other player${LV.here > 1 ? 's are' : ' is'} here now.` : 'No other players are here right now.');
function dailyPanel(seg2) {
  const lv = compete.level, l = level(lv), open = unlocked(lv), id = `${today()}_${lv}`, rec = S.daily[id], d = compete.data;
  if (!d && !compete.loading && !compete.err) setTimeout(loadCompete);
  let action;
  if (!open) { const i = LEVELS.findIndex(x => x.id === lv); action = `<button class="btn alt" disabled>${I('lock')}Win ${CONFIG.winsToUnlock} ${LEVELS[i - 1].name} puzzles to enter</button>`; }
  else if (rec?.failed) action = `<p class="banner">You ran out of attempts today. A new puzzle starts tomorrow.</p>`;
  else if (rec) action = `<p class="banner">You scored ${rec.score} points today in ${fmt(rec.seconds)}.</p>`;
  else if (S.game?.boardId === id) action = `<button class="btn" data-act="resume">Continue today's ${l.name}</button>`;
  else action = `<button class="btn" data-act="daily">Play today's ${l.name}</button>`;
  let board = '';
  if (compete.loading) board = '<p class="sub" style="margin-top:16px">Loading scores</p>';
  else if (compete.err) board = `<p class="banner" style="margin-top:14px">${compete.err}</p><button class="btn alt" style="margin-top:8px" data-act="reload">Try again</button>`;
  else if (d) {
    const top = d.rows.slice(0, 3), cell = (r, cls, place) => (r ? `<div class="${cls}"><span class="place">${place}</span><span class="who">${flag(r.country)} ${esc(r.name)}</span><span class="pts">${r.score.toLocaleString()}</span></div>` : '<div style="visibility:hidden"></div>');
    board = `${d.sample ? '<p class="banner" style="margin-top:14px">These are sample players. Worldwide scores start when the score server is connected.</p>' : ''}
      ${d.rank ? `<div class="mine"><span class="sub">Your position</span><br><b>#${d.rank}</b> <span class="sub">of ${d.total.toLocaleString()} players</span></div>` : `<p class="sub" style="margin-top:14px">Finish a puzzle to see your position.</p>`}
      ${d.rows.length ? `<div class="podium">${cell(top[1], '', 2)}${cell(top[0], 'first', 1)}${cell(top[2], '', 3)}</div>
      <div class="list">${d.rows.slice(3).map((r, k) => `<div class="rankrow ${r.me ? 'me' : ''}"><span class="n">${k + 4}</span><span class="nm">${flag(r.country)} ${esc(r.name)}</span><span>${r.score.toLocaleString()}</span></div>`).join('')}</div>` : `<p class="sub" style="margin-top:14px">No scores yet. Be the first on the board.</p>`}`;
  }
  return `<p class="sub" style="margin-top:12px">Everyone gets the same puzzle each day. 3 attempts, no Help.</p>
    <div class="seg" style="margin-top:12px">${LEVELS.map(x => seg2(x.id, 'c-level', lv, x.name)).join('')}</div>
    <div style="margin-top:10px">${action}</div>
    <div class="seg" style="margin-top:16px">${seg2('today', 'c-view', compete.view, 'Today')}${seg2('all', 'c-view', compete.view, 'All time')}</div>
    ${board}`;
}

// ---------- live matches ----------
const LV = { timer: null, tick: 0, here: 0, invites: [], declined: new Set(), hosting: null, starting: false, waitT: null, seen: new Set() };
const liveMe = () => ({ name: S.name, country: S.country });
async function liveAuth() { S.auth = await LB.signIn(S.auth); save(); return S.auth; }
function syncLobby() {
  const want = R.tab === 'compete' && !R.sub && !LV.starting;
  if (want && !LV.timer) { LV.tick = 0; LV.timer = setInterval(lobbyTick, 3000); lobbyTick(); }
  if (!want && LV.timer) {
    clearInterval(LV.timer); LV.timer = null;
    if (Live.liveReady() && S.auth) Live.leaveLobby(S.auth).catch(() => {});
    if (LV.hosting && !LV.starting) cancelHost();
  }
}
async function lobbyTick() {
  if (!Live.liveReady() || !S.name) return;
  try {
    const a = await liveAuth();
    if (LV.tick++ % 3 === 0) await Live.announce(a, liveMe());
    const snap = await Live.snapshot(a);
    if (!LV.timer) return;
    LV.here = snap.here; LV.invites = snap.invites.filter(v => !LV.declined.has(v.id));
    const el = $('#here'); if (el) el.textContent = hereText();
    if (LV.hosting) {
      const m = await Live.read(a, LV.hosting.id);
      if (m?.guest) return startMatch(LV.hosting.id, m.level, m.seed, m.guest, m.guest.uid);
      if (Date.now() - LV.hosting.since > Live.INVITE_MS) { await cancelHost(); toast('Nobody joined. Try again in a moment'); return closeLive(); }
    }
    showLive();
  } catch { /* the next check tries again */ }
}
const closeLive = () => { if ($('.live-sheet')) sheet.innerHTML = ''; };
function inviteHTML(v) {
  return `<div class="invite"><b style="font-weight:600;font-size:18px">${flag(v.country)} ${esc(v.name)}</b> <span class="sub">wants to play ${level(v.level).name}</span>
    <div class="row" style="margin-top:10px"><button class="btn alt" data-act="decline" data-id="${v.id}">No thanks</button><button class="btn" data-act="accept" data-id="${v.id}">Yes, play</button></div></div>`;
}
function showLive() {
  if (R.tab !== 'compete' || R.sub || LV.starting) return;
  if (sheet.innerHTML && !$('.live-sheet')) return;
  const fresh = LV.invites.filter(v => !LV.seen.has(v.id));
  fresh.forEach(v => LV.seen.add(v.id));
  if (fresh.length) { sfx('unit'); hap('HEAVY'); }
  if (!LV.hosting && !LV.invites.length) return closeLive();
  const body = LV.hosting
    ? `<h2>Looking for a player</h2><p class="sub" style="margin-top:4px">${level(LV.hosting.level).name} level. Everyone on this page has been told.</p>${LV.invites.slice(0, 2).map(inviteHTML).join('')}<button class="btn alt" style="margin-top:12px" data-act="cancel-host">Stop looking</button>`
    : `<h2>New challenge</h2>${inviteHTML(LV.invites[0])}`;
  sheet.innerHTML = `<div class="scrim"><div class="sheet live-sheet" role="dialog" aria-live="assertive">${body}</div></div>`;
}
async function cancelHost() {
  const h = LV.hosting; LV.hosting = null; clearTimeout(LV.waitT);
  if (h && !h.bot && S.auth) await Live.cancel(S.auth, h.id).catch(() => {});
}
function startMatch(id, lvl, seed, opp, oppUid, bot = false) {
  LV.starting = true; LV.hosting = null; LV.invites = []; clearTimeout(LV.waitT);
  syncLobby();
  let n = 3;
  const show = () => { sheet.innerHTML = `<div class="scrim" style="align-items:center"><div class="sheet dialog live-sheet" style="text-align:center"><p class="sub">${esc(opp.name)} is ready. ${level(lvl).name} level.</p><div class="count3">${n}</div></div></div>`; };
  show();
  const t = setInterval(() => {
    if (--n > 0) return show();
    clearInterval(t); closeSheet(); LV.starting = false;
    newGame(lvl, { seed, match: { id, opp, oppUid, bot } });
    startMatchLoop();
  }, 1000);
}
let matchT = null;
function startMatchLoop() { stopMatchLoop(); matchT = setInterval(matchTick, G.match.bot ? 1000 : 1500); }
function stopMatchLoop() { clearInterval(matchT); matchT = null; }
function paintOpp() {
  const a = $('#opp-pct'), b = $('#opp-bar');
  if (a) { a.textContent = `${G.oppPct}%`; b.style.width = `${G.oppPct}%`; }
}
async function matchTick() {
  if (!G?.match || G.over) return stopMatchLoop();
  const m = G.match;
  if (m.bot) {
    if (Math.random() < .45) { G.oppPct = Math.min(100, G.oppPct + 1 + Math.floor(Math.random() * 2)); paintOpp(); }
    if (G.oppPct >= 100) matchEnd(false, 'solved');
    return;
  }
  try {
    const a = S.auth = await LB.signIn(S.auth), pct = myPct(), tickN = (m.n = (m.n || 0) + 1);
    if (pct !== G.pushed || tickN % 3 === 0) { await Live.push(a, m.id, { pct, t: Date.now() }); G.pushed = pct; }
    const d = await Live.read(a, m.id);
    if (!G?.match || G.over || G.match.id !== m.id) return;
    const p = d?.p?.[m.oppUid];
    if (p) { if (p.t !== m.lastT) { m.lastT = p.t; G.oppSeen = Date.now(); } G.oppPct = p.pct; paintOpp(); }
    if (d?.winner) return matchEnd(d.winner === a.uid, d.winner === a.uid ? 'other' : 'solved');
    if (Date.now() - G.oppSeen > Live.STALE_MS) { await Live.claim(a, m.id, a.uid); matchEnd(true, 'left'); }
  } catch { /* the next check tries again */ }
}
async function matchFinish(solved) {
  const m = G.match;
  G.over = true; renderGame();
  if (m.bot) return matchEnd(solved, solved ? 'solved' : 'attempts');
  sheet.innerHTML = `<div class="scrim" style="align-items:center"><div class="sheet dialog"><h2>Checking the result</h2></div></div>`;
  for (let k = 0; k < 4; k++) {
    try {
      const a = S.auth = await LB.signIn(S.auth);
      await Live.push(a, m.id, { pct: myPct(), t: Date.now() });
      await Live.claim(a, m.id, solved ? a.uid : m.oppUid);
      const d = await Live.read(a, m.id);
      if (d?.winner) return matchEnd(d.winner === a.uid, solved ? (d.winner === a.uid ? 'solved' : 'late') : 'attempts');
    } catch { /* try again below */ }
    await new Promise(r => setTimeout(r, 1200));
  }
  sheet.innerHTML = `<div class="scrim" style="align-items:center"><div class="sheet dialog"><h2>Result not confirmed</h2><p class="sub" style="margin-top:6px">The game server could not be reached, so this match was not counted.</p><button class="btn" style="margin-top:14px" data-act="match-done">Back to Compete</button></div></div>`;
}
function matchEnd(won, why) {
  stopMatchLoop();
  const name = esc(G.match.opp.name);
  G.won = won && why === 'solved'; G.over = true; G.matchDone = true;
  S.matches[won ? 'won' : 'lost']++;
  if (G.won) { S.wins[G.level] = (S.wins[G.level] || 0) + 1; if (!S.best[G.level] || G.seconds < S.best[G.level]) S.best[G.level] = G.seconds; }
  save(); if (won) celebrate(); else { sfx('wrong'); hap('HEAVY'); } renderGame();
  const msg = { solved: won ? 'You finished first.' : `${name} finished first.`, attempts: won ? `${name} ran out of attempts.` : 'You ran out of attempts.', left: `${name} left the match.`, late: `${name} finished just before you.`, other: `${name} ran out of attempts or left the match.` }[why];
  dialog(`<h2>${won ? 'You won' : `${name} won`}</h2><p class="sub" style="margin-top:6px">${msg}</p>
    <div class="stat3"><div><b>${fmt(G.seconds)}</b><span>Time</span></div><div><b>${myPct()}%</b><span>You</span></div><div><b>${G.oppPct}%</b><span>${name}</span></div></div>
    <button class="btn" data-act="match-done">Back to Compete</button>`);
}
function testBotMatch(lvl) {
  startMatch('test', lvl, Math.floor(Math.random() * 2 ** 31), { name: 'Computer', country: '' }, 'bot', true);
}

// ---------- events ----------
let versionTaps = 0;
const actions = {
  tab: b => { const t = b.dataset.t; if (t === 'compete') compete.data = null; go(t); },
  back: () => { const b = R.back; if (b?.game) { G = b.game; R = { tab: 'game' }; render(); } else if (b) { R = b; render(); } else go(R.tab); },
  settings: () => { const back = R.tab === 'game' ? { game: G } : { tab: R.tab, sub: R.sub }; if (R.tab === 'game') persist(); stopClock(); go(R.tab === 'game' ? 'play' : R.tab, 'settings', back); },
  start: b => { const l = b.dataset.l; if (!unlocked(l)) { const i = LEVELS.findIndex(x => x.id === l); return toast(`Win ${CONFIG.winsToUnlock} ${LEVELS[i - 1].name} puzzles first`); } closeSheet(); newGame(l); },
  resume: () => { G = { ...S.game, undo: [], sel: null }; R = { tab: 'game' }; render(); },
  home: () => go('play'),
  retry: () => { closeSheet(); const { level: l, puzzle } = G; newGame(l, { puzzle }); },
  leave: () => {
    if (G.match && !G.over) return dialog(`<h2>Leave this match?</h2><p class="sub" style="margin-top:6px">${esc(G.match.opp.name)} will win.</p><div class="row" style="margin-top:14px"><button class="btn alt" data-act="sheet-close">Keep playing</button><button class="btn" data-act="forfeit">Leave</button></div>`);
    if (G.match) return actions['match-done']();
    persist(); closeSheet(); stopClock(); const r = G.returnTo; if (r) { R = r; render(); } else go(G.ranked ? 'compete' : 'play'); },
  cell: b => {
    if (H) closeSheet();
    if (G.over) return;
    const i = +b.dataset.i;
    if (G.armed) {
      if (G.grid[i] && !isWrong(i)) { G.armed = G.grid[i]; G.sel = null; sfx('tap'); return renderGame(); }
      G.sel = i; enter(G.armed); if (G) G.sel = null; if (!G.over) renderGame();
      return;
    }
    G.sel = i; sfx('tap'); renderGame();
  },
  num: b => {
    if (H) closeSheet();
    if (G.over) return;
    const d = +b.dataset.d, i = G.sel;
    if (i != null && !given()[i] && (!G.grid[i] || isWrong(i))) return enter(d);
    G.armed = G.armed === d ? null : d; G.sel = null; sfx('tap'); renderGame();
  },
  undo: () => { if (H) closeSheet(); const u = G.undo.pop(); if (!u) return toast('Nothing to undo'); G.grid = u.grid; G.notes = u.notes; persist(); renderGame(); },
  erase: () => { if (H) closeSheet(); const i = G.sel; if (i == null || given()[i]) return toast('Select a square you filled in'); snapshot(); G.grid[i] = 0; G.notes[i] = 0; persist(); renderGame(); },
  notes: () => { G.notesOn = !G.notesOn; renderGame(); },
  help: () => { if (H) closeSheet(); openHelp(); },
  say: () => Svc.speak(hintSpeech(), S.set.voiceRate),
  'hint-close': () => { closeSheet(); renderGame(); },
  'hint-next': () => { H.i++; H.fresh = true; showHint(); },
  'hint-prev': () => { H.i = H.i === 0 ? H.steps.length - 1 : H.i - 1; H.fresh = true; showHint(); },
  'hint-walk': () => { H.i = 0; H.fresh = true; showHint(); },
  'hint-fill': () => {
    const { cell, val } = H.steps[H.steps.length - 1].place;
    closeSheet(); G.sel = cell; G.notesOn = false; snapshot(); G.grid[cell] = val; G.notes[cell] = 0;
    if (S.set.autoNotes) for (const p of E.PEERS[cell]) G.notes[p] &= ~(1 << (val - 1));
    sfx('place'); digitDone(val); persist();
    if (G.grid.every((v, k) => v === +G.solution[k])) return win();
    renderGame();
  },
  'hint-apply': () => { const st = H.steps[H.i]; closeSheet(); for (const e of st.elim) G.notes[e.cell] &= ~(1 << (e.val - 1)); persist(); renderGame(); },
  trick: b => { const back = R.tab === 'game' ? { game: G } : { tab: R.tab, sub: R.sub, back: R.back }; if (R.tab === 'game') persist(); go(R.tab === 'game' ? 'profile' : R.tab, 'trick:' + b.dataset.id, back); },
  basics: () => go('profile', 'basics', { tab: 'profile', sub: null }),
  stats: () => go('profile', 'stats', { tab: 'profile', sub: null }),
  'say-trick': b => { const ex = EXAMPLES.find(e => e.id === b.dataset.id); Svc.speak(ex.step.lines.join(' ') + (ex.step.place ? ` So ${E.cellName(ex.step.place.cell)} is ${ex.step.place.val}.` : ''), S.set.voiceRate); },
  practice: b => { const ex = EXAMPLES.find(e => e.id === b.dataset.id); Svc.stopSpeaking(); newGame('easy', { puzzle: ex.grid, lesson: true, returnTo: { tab: 'profile', sub: 'trick:' + ex.id, back: { tab: 'profile', sub: null } } }); },
  'lesson-done': () => { closeSheet(); R = G.returnTo; render(); },
  toggle: b => { const k = b.dataset.k; S.set[k] = !S.set[k]; save(); R.keepScroll = true; render(); },
  seg: b => { const k = b.dataset.k; let v = b.dataset.v; v = isNaN(+v) ? v : +v; S.set[k] = v; save(); if (k === 'theme') applyTheme(); if (k === 'voiceRate' && S.set.voice) Svc.speak('This is the voice speed.', v); R.keepScroll = true; render(); },
  reset: () => dialog(`<h2>Reset all progress?</h2><p class="sub" style="margin-top:6px">This removes your wins, best times and unlocked levels. Your scoreboard points and purchases stay.</p><div class="row" style="margin-top:14px"><button class="btn alt" data-act="sheet-close">Cancel</button><button class="btn" data-act="reset-yes">Reset</button></div>`),
  'reset-yes': () => { const { set, pro, hints, daily, totals, auth, name, country, pending } = S; S = { ...structuredClone(DEFAULTS), set, pro, hints, daily, totals, auth, name, country, pending }; save(); closeSheet(); go('play'); },
  version: () => {
    if (!CONFIG.allowTesterMode || S.tester) return;
    if (++versionTaps >= 7) { S.tester = true; save(); toast('Tester mode on. All levels unlocked'); R.keepScroll = true; render(); }
  },
  'edit-profile': () => editProfile(),
  store: () => openStore(),
  buy: b => purchase(b.dataset.p),
  restore: async () => {
    try { const pro = await Svc.restore(); if (pro) { S.pro = true; save(); toast('Pro restored'); afterStore(); } else toast('No purchases found on this account'); }
    catch { toast('Restore failed. Check your connection and try again'); }
  },
  'sheet-close': () => { closeSheet(); if (R.tab === 'game') renderGame(); },
  daily: () => {
    const start = () => { const lv = compete.level, id = `${today()}_${lv}`; newGame(lv, { seed: E.hashString(id), ranked: true, boardId: id }); };
    if (!S.name || !S.country) editProfile(start); else start();
  },
  'to-board': () => { closeSheet(); compete.view = 'today'; compete.level = G.level; compete.data = null; go('compete'); },
  'c-mode': b => { compete.mode = b.dataset.v; R.keepScroll = false; render(); },
  'c-match-level': b => { compete.matchLevel = b.dataset.v; R.keepScroll = true; render(); },
  find: () => {
    const lv = compete.matchLevel;
    const begin = async () => {
      if (!Live.liveReady()) {
        LV.hosting = { bot: true, id: 'test', level: lv, since: Date.now() }; showLive();
        LV.waitT = setTimeout(() => testBotMatch(lv), 2500);
        return;
      }
      try { const a = await liveAuth(), h = await Live.host(a, liveMe(), lv); LV.hosting = { ...h, since: Date.now() }; showLive(); }
      catch { toast('Could not reach the game server. Check your connection and try again'); }
    };
    if (!S.name || !S.country) editProfile(begin); else begin();
  },
  'cancel-host': async () => { await cancelHost(); closeLive(); },
  decline: b => { LV.declined.add(b.dataset.id); LV.invites = LV.invites.filter(v => v.id !== b.dataset.id); closeLive(); showLive(); },
  accept: async b => {
    const id = b.dataset.id, inv = LV.invites.find(v => v.id === id);
    if (id.startsWith('test-')) { closeLive(); LV.invites = []; return testBotMatch(inv.level); }
    const go2 = async () => {
      try {
        if (LV.hosting) await cancelHost();
        const a = await liveAuth(), m = await Live.join(a, liveMe(), id);
        if (!m) { LV.declined.add(id); LV.invites = LV.invites.filter(v => v.id !== id); closeLive(); return toast('Another player joined first'); }
        startMatch(id, m.level, m.seed, m.host, m.host.uid);
      } catch { toast('Could not reach the game server. Check your connection and try again'); }
    };
    closeLive();
    if (!S.name || !S.country) editProfile(go2); else go2();
  },
  'test-invite': () => { LV.invites = [{ id: 'test-' + Date.now(), name: 'Computer', country: '', level: compete.matchLevel, ts: Date.now() }]; showLive(); },
  forfeit: async () => {
    const m = G.match; closeSheet();
    if (m.bot) return matchEnd(false, 'attempts');
    try { const a = await liveAuth(); await Live.claim(a, m.id, m.oppUid); } catch { /* the other player's check sees you left */ }
    matchEnd(false, 'attempts');
  },
  'match-done': () => { closeSheet(); stopMatchLoop(); compete.mode = 'live'; go('compete'); },
  'c-level': b => { compete.level = b.dataset.v; compete.data = null; R.keepScroll = true; render(); },
  'c-view': b => { compete.view = b.dataset.v === 'all' ? 'all' : 'today'; compete.data = null; R.keepScroll = true; render(); },
  reload: () => { compete.err = null; compete.data = null; render(); },
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (b && !b.disabled) actions[b.dataset.act]?.(b);
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(e.target);
  S.name = f.get('n').trim().slice(0, 16); S.country = f.get('c'); save(); closeSheet();
  const then = afterProfile; afterProfile = null;
  if (then) then(); else render();
});
document.addEventListener('keydown', e => {
  if (R.tab !== 'game' || !G || G.over || e.target.matches('input,select')) return;
  if (/^[1-9]$/.test(e.key)) enter(+e.key);
  const move = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key];
  if (move) { e.preventDefault(); const n = (G.sel ?? 40) + move; if (n >= 0 && n < 81) { G.sel = n; renderGame(); } }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { persist(); Svc.stopSpeaking(); } });

async function boot() {
  applyTheme();
  const P = window.Capacitor?.Plugins || {};
  P.SplashScreen?.hide?.().catch?.(() => {});
  P.App?.addListener?.('backButton', () => {
    if (LV.starting) return;
    if ($('.live-sheet')) return actions['cancel-host']();
    if (G?.matchDone && R.tab === 'game') return actions['match-done']();
    if (sheet.innerHTML) { closeSheet(); if (R.tab === 'game') renderGame(); return; }
    if (R.tab === 'game') return actions.leave();
    if (R.sub) return actions.back();
    if (R.tab !== 'play') return go('play');
    P.App.exitApp();
  });
  render();
  prices = await Svc.loadPrices();
}
if (CONFIG.allowTesterMode) window.__sm = { get G() { return G; }, get S() { return S; }, E };
boot();
