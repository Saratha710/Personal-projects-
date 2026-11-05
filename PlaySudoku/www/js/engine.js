// Sudoku engine: fast solver, generator helpers, and a human-style solver that
// explains every move. Runs unchanged in the app and in Node (for tests and tools).

export const ALL = 0x1ff;
const bit = d => 1 << (d - 1);
export const popcount = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
export const digitsOf = m => { const r = []; for (let d = 1; d <= 9; d++) if (m & bit(d)) r.push(d); return r; };
export const rowOf = i => Math.floor(i / 9);
export const colOf = i => i % 9;
export const boxOf = i => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

export const UNITS = [];
for (let r = 0; r < 9; r++) UNITS.push({ type: 'row', n: r, cells: [...Array(9)].map((_, c) => r * 9 + c) });
for (let c = 0; c < 9; c++) UNITS.push({ type: 'col', n: c, cells: [...Array(9)].map((_, r) => r * 9 + c) });
for (let b = 0; b < 9; b++) {
  const cells = [];
  for (let i = 0; i < 81; i++) if (boxOf(i) === b) cells.push(i);
  UNITS.push({ type: 'box', n: b, cells });
}
const BOXES_FIRST = [...UNITS.slice(18), ...UNITS.slice(0, 18)];
export const PEERS = [...Array(81)].map((_, i) =>
  [...Array(81).keys()].filter(j => j !== i && (rowOf(i) === rowOf(j) || colOf(i) === colOf(j) || boxOf(i) === boxOf(j))));
const sees = (a, b) => a !== b && (rowOf(a) === rowOf(b) || colOf(a) === colOf(b) || boxOf(a) === boxOf(b));

const BOX_NAMES = ['top-left', 'top-middle', 'top-right', 'middle-left', 'centre', 'middle-right', 'bottom-left', 'bottom-middle', 'bottom-right'];
export const cellName = i => `row ${rowOf(i) + 1}, column ${colOf(i) + 1}`;
export const unitName = u => u.type === 'row' ? `row ${u.n + 1}` : u.type === 'col' ? `column ${u.n + 1}` : `the ${BOX_NAMES[u.n]} box`;
const listWords = a => a.length < 2 ? String(a[0] ?? '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const cap = s => s[0].toUpperCase() + s.slice(1);
const cellsWords = cs => listWords(cs.map(i => (cs.length > 1 ? `row ${rowOf(i) + 1} column ${colOf(i) + 1}` : cellName(i))));

// ---------- parsing ----------
export const parse = s => Int8Array.from([...s].map(ch => (ch === '.' ? 0 : +ch)));
export const stringify = g => Array.from(g).join('');

// ---------- random ----------
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(a, rand = Math.random) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function hashString(s) {
  let h = 2166136261;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---------- brute-force solver (uniqueness + answers only) ----------
export function solveCount(grid, limit = 2, rand = null) {
  const g = Int8Array.from(grid);
  const R = new Uint16Array(9), C = new Uint16Array(9), B = new Uint16Array(9);
  for (let i = 0; i < 81; i++) if (g[i]) {
    const m = bit(g[i]), r = rowOf(i), c = colOf(i), b = boxOf(i);
    if ((R[r] | C[c] | B[b]) & m) return { count: 0, solution: null };
    R[r] |= m; C[c] |= m; B[b] |= m;
  }
  let count = 0, solution = null;
  const rec = () => {
    let best = -1, bestMask = 0, bestN = 10;
    for (let i = 0; i < 81; i++) if (!g[i]) {
      const mask = ALL & ~(R[rowOf(i)] | C[colOf(i)] | B[boxOf(i)]);
      const n = popcount(mask);
      if (n < bestN) { best = i; bestMask = mask; bestN = n; if (n <= 1) break; }
    }
    if (best < 0) { count++; if (!solution) solution = Int8Array.from(g); return; }
    const ds = digitsOf(bestMask);
    if (rand) shuffle(ds, rand);
    const r = rowOf(best), c = colOf(best), b = boxOf(best);
    for (const d of ds) {
      const m = bit(d);
      g[best] = d; R[r] |= m; C[c] |= m; B[b] |= m;
      rec();
      g[best] = 0; R[r] &= ~m; C[c] &= ~m; B[b] &= ~m;
      if (count >= limit) return;
    }
  };
  rec();
  return { count, solution };
}
export const solutionOf = grid => solveCount(grid, 1).solution;
export const hasUniqueSolution = grid => solveCount(grid, 2).count === 1;

// ---------- solving state ----------
export function makeState(grid) {
  const g = Int8Array.from(grid), c = new Uint16Array(81);
  for (let i = 0; i < 81; i++) {
    if (g[i]) continue;
    let m = ALL;
    for (const p of PEERS[i]) if (g[p]) m &= ~bit(g[p]);
    c[i] = m;
  }
  return { g, c };
}
const clone = s => ({ g: Int8Array.from(s.g), c: Uint16Array.from(s.c) });
export function applyStep(s, step) {
  if (step.place) {
    const { cell, val } = step.place;
    s.g[cell] = val; s.c[cell] = 0;
    for (const p of PEERS[cell]) s.c[p] &= ~bit(val);
  }
  for (const e of step.elim) s.c[e.cell] &= ~bit(e.val);
  return s;
}
const uniqueCells = a => [...new Set(a)];
const elimNote = elim => {
  const by = new Map();
  for (const e of elim) by.set(e.cell, [...(by.get(e.cell) || []), e.val]);
  return [...by].map(([c, v]) => `${listWords(v.sort())} from ${cellName(c)}`);
};
const removeSentence = elim => `So you can remove ${listWords(elimNote(elim))}.`;
function combos(a, n, start = 0, cur = [], out = []) {
  if (cur.length === n) { out.push(cur.slice()); return out; }
  for (let i = start; i < a.length; i++) { cur.push(a[i]); combos(a, n, i + 1, cur, out); cur.pop(); }
  return out;
}

// ---------- the tricks ----------
function* fullHouse(s) {
  for (const u of UNITS) {
    const empty = u.cells.filter(c => !s.g[c]);
    if (empty.length !== 1) continue;
    const cell = empty[0], have = u.cells.reduce((m, c) => (s.g[c] ? m | bit(s.g[c]) : m), 0);
    const val = digitsOf(ALL & ~have)[0];
    yield {
      tech: 'fullHouse', key: `single:${cell}:${val}`, place: { cell, val }, elim: [],
      hl: { focus: [cell], unit: u.cells, sources: [], cands: [] },
      lines: [`Look at ${unitName(u)}.`, `Only one square is empty, at ${cellName(cell)}.`, `Eight numbers are already there. The only one missing is ${val}.`],
    };
  }
}
function coverage(s, u, d, target) {
  const empties = u.cells.filter(c => !s.g[c] && c !== target);
  const placed = []; for (let i = 0; i < 81; i++) if (s.g[i] === d) placed.push(i);
  const uncovered = new Set(empties.filter(e => placed.some(p => sees(p, e)))), sources = [];
  const earlier = empties.filter(e => !uncovered.has(e));
  while (uncovered.size) {
    let best = -1, n = 0;
    for (const p of placed) {
      const k = [...uncovered].filter(e => sees(p, e)).length;
      if (k > n) { n = k; best = p; }
    }
    sources.push(best);
    for (const e of [...uncovered]) if (sees(best, e)) uncovered.delete(e);
  }
  return { sources, earlier, empties };
}
function* hiddenSingle(s) {
  for (const u of BOXES_FIRST) {
    for (let d = 1; d <= 9; d++) {
      if (u.cells.some(c => s.g[c] === d)) continue;
      const spots = u.cells.filter(c => s.c[c] & bit(d));
      if (spots.length !== 1) continue;
      const cell = spots[0], { sources, earlier, empties } = coverage(s, u, d, cell);
      const lines = [`Look for the number ${d} in ${unitName(u)}.`];
      if (!empties.length) lines.push(`Only one square is free there.`);
      else if (sources.length) lines.push(`${d} is already placed at ${cellsWords(sources)}, and that rules out the other empty squares in ${unitName(u)}.`);
      if (earlier.length) lines.push(`Earlier steps already ruled out ${d} from ${cellsWords(earlier)}.`);
      lines.push(`The only square left for ${d} is ${cellName(cell)}.`);
      yield {
        tech: 'hiddenSingle', key: `single:${cell}:${d}`, place: { cell, val: d }, elim: [], digit: d,
        hl: { focus: [cell], unit: u.cells, sources, cands: [] }, lines,
      };
    }
  }
}
function* nakedSingle(s) {
  for (let i = 0; i < 81; i++) {
    if (s.g[i] || popcount(s.c[i]) !== 1) continue;
    const val = digitsOf(s.c[i])[0], inRow = [], inCol = [], inBox = [], earlier = [];
    const r = UNITS[rowOf(i)].cells, c = UNITS[9 + colOf(i)].cells, b = UNITS[18 + boxOf(i)].cells;
    for (let d = 1; d <= 9; d++) {
      if (d === val) continue;
      if (r.some(x => s.g[x] === d)) inRow.push(d);
      else if (c.some(x => s.g[x] === d)) inCol.push(d);
      else if (b.some(x => s.g[x] === d)) inBox.push(d);
      else earlier.push(d);
    }
    const lines = [`Check which numbers can go at ${cellName(i)}.`];
    if (inRow.length) lines.push(`Its row already has ${listWords(inRow)}.`);
    if (inCol.length) lines.push(`Its column adds ${listWords(inCol)}.`);
    if (inBox.length) lines.push(`Its 3 by 3 box adds ${listWords(inBox)}.`);
    if (earlier.length) lines.push(`Earlier steps ruled out ${listWords(earlier)}.`);
    lines.push(`The only number left is ${val}.`);
    yield {
      tech: 'nakedSingle', key: `single:${i}:${val}`, place: { cell: i, val }, elim: [],
      hl: { focus: [i], unit: uniqueCells([...r, ...c, ...b]), sources: [], cands: [] }, lines,
    };
  }
}
function* pointing(s) {
  for (const u of UNITS.slice(18)) for (let d = 1; d <= 9; d++) {
    const spots = u.cells.filter(c => s.c[c] & bit(d));
    if (spots.length < 2 || spots.length > 3) continue;
    for (const line of [UNITS[rowOf(spots[0])], UNITS[9 + colOf(spots[0])]]) {
      if (!spots.every(c => line.cells.includes(c))) continue;
      const elim = line.cells.filter(c => !spots.includes(c) && (s.c[c] & bit(d))).map(cell => ({ cell, val: d }));
      if (!elim.length) continue;
      yield {
        tech: 'pointing', key: `pointing:${u.n}:${d}:${line.type}${line.n}`, place: null, elim, digit: d,
        hl: { focus: [], unit: uniqueCells([...u.cells, ...line.cells]), sources: [], cands: [...spots.map(cell => ({ cell, val: d, kind: 'keep' })), ...elim.map(e => ({ ...e, kind: 'remove' }))] },
        lines: [`In ${unitName(u)}, the number ${d} can only go in ${cellsWords(spots)}.`, `All of those squares are in ${unitName(line)}.`, `Whichever one it is, ${d} in ${unitName(line)} must sit inside this box.`, removeSentence(elim)],
      };
    }
  }
}
function* claiming(s) {
  for (const u of UNITS.slice(0, 18)) for (let d = 1; d <= 9; d++) {
    const spots = u.cells.filter(c => s.c[c] & bit(d));
    if (spots.length < 2 || spots.length > 3) continue;
    const b = boxOf(spots[0]);
    if (!spots.every(c => boxOf(c) === b)) continue;
    const box = UNITS[18 + b];
    const elim = box.cells.filter(c => !spots.includes(c) && (s.c[c] & bit(d))).map(cell => ({ cell, val: d }));
    if (!elim.length) continue;
    yield {
      tech: 'claiming', key: `claiming:${u.type}${u.n}:${d}`, place: null, elim, digit: d,
      hl: { focus: [], unit: uniqueCells([...u.cells, ...box.cells]), sources: [], cands: [...spots.map(cell => ({ cell, val: d, kind: 'keep' })), ...elim.map(e => ({ ...e, kind: 'remove' }))] },
      lines: [`In ${unitName(u)}, the number ${d} can only go in ${cellsWords(spots)}.`, `All of those squares are inside ${unitName(box)}.`, `So the ${d} of that box must be one of these squares too.`, removeSentence(elim)],
    };
  }
}
const SUBSET = { 2: 'two', 3: 'three' };
function nakedSubset(n, tech) {
  return function* (s) {
    for (const u of UNITS) {
      const empties = u.cells.filter(c => !s.g[c]);
      if (empties.length <= n) continue;
      const pool = empties.filter(c => popcount(s.c[c]) >= 2 && popcount(s.c[c]) <= n);
      for (const cells of combos(pool, n)) {
        const mask = cells.reduce((m, c) => m | s.c[c], 0);
        if (popcount(mask) !== n) continue;
        const elim = [];
        for (const c of empties) if (!cells.includes(c)) for (const d of digitsOf(s.c[c] & mask)) elim.push({ cell: c, val: d });
        if (!elim.length) continue;
        const ds = digitsOf(mask);
        yield {
          tech, key: `${tech}:${u.type}${u.n}:${cells}`, place: null, elim,
          hl: { focus: [], unit: u.cells, sources: [], cands: [...cells.flatMap(c => digitsOf(s.c[c]).map(val => ({ cell: c, val, kind: 'keep' }))), ...elim.map(e => ({ ...e, kind: 'remove' }))] },
          lines: [`In ${unitName(u)}, look at ${cellsWords(cells)}.`, `Those ${SUBSET[n]} squares can only hold ${listWords(ds)}.`, `So ${listWords(ds)} are used up there, and no other square in ${unitName(u)} can have them.`, removeSentence(elim)],
        };
      }
    }
  };
}
function hiddenSubset(n, tech) {
  return function* (s) {
    for (const u of UNITS) {
      const ds = [];
      for (let d = 1; d <= 9; d++) {
        if (u.cells.some(c => s.g[c] === d)) continue;
        const k = u.cells.filter(c => s.c[c] & bit(d)).length;
        if (k >= 2 && k <= n) ds.push(d);
      }
      for (const set of combos(ds, n)) {
        const mask = set.reduce((m, d) => m | bit(d), 0);
        const cells = u.cells.filter(c => s.c[c] & mask);
        if (cells.length !== n) continue;
        const elim = [];
        for (const c of cells) for (const d of digitsOf(s.c[c] & ~mask)) elim.push({ cell: c, val: d });
        if (!elim.length) continue;
        yield {
          tech, key: `${tech}:${u.type}${u.n}:${set}`, place: null, elim,
          hl: { focus: [], unit: u.cells, sources: [], cands: [...cells.flatMap(c => digitsOf(s.c[c] & mask).map(val => ({ cell: c, val, kind: 'keep' }))), ...elim.map(e => ({ ...e, kind: 'remove' }))] },
          lines: [`In ${unitName(u)}, the numbers ${listWords(set)} can only go in ${cellsWords(cells)}.`, `Those ${SUBSET[n]} squares must hold those ${SUBSET[n]} numbers.`, `So nothing else can go in them.`, removeSentence(elim)],
        };
      }
    }
  };
}
function fish(n, tech) {
  return function* (s) {
    for (const byRow of [true, false]) for (let d = 1; d <= 9; d++) {
      const base = byRow ? UNITS.slice(0, 9) : UNITS.slice(9, 18);
      const cross = byRow ? UNITS.slice(9, 18) : UNITS.slice(0, 9);
      const crossOf = byRow ? colOf : rowOf;
      const lines_ = base.filter(u => { const k = u.cells.filter(c => s.c[c] & bit(d)).length; return k >= 2 && k <= n; });
      for (const set of combos(lines_, n)) {
        const spots = set.flatMap(u => u.cells.filter(c => s.c[c] & bit(d)));
        const crossIdx = uniqueCells(spots.map(crossOf));
        if (crossIdx.length !== n) continue;
        const elim = [];
        for (const x of crossIdx) for (const c of cross[x].cells) if (!spots.includes(c) && (s.c[c] & bit(d))) elim.push({ cell: c, val: d });
        if (!elim.length) continue;
        const baseNames = listWords(set.map(unitName)), crossNames = listWords(crossIdx.sort((a, b) => a - b).map(x => unitName(cross[x])));
        yield {
          tech, key: `${tech}:${byRow}:${d}:${set.map(u => u.n)}`, place: null, elim, digit: d,
          hl: { focus: [], unit: uniqueCells([...set.flatMap(u => u.cells), ...crossIdx.flatMap(x => cross[x].cells)]), sources: [], cands: [...spots.map(cell => ({ cell, val: d, kind: 'keep' })), ...elim.map(e => ({ ...e, kind: 'remove' }))] },
          lines: [`Follow the number ${d} in ${baseNames}.`, `In these lines, ${d} can only go in ${crossNames}.`, `Each line needs one ${d}, so these ${n === 2 ? 'two' : 'three'} lines will use up the ${d} of those crossing lines.`, removeSentence(elim)],
        };
      }
    }
  };
}
function* yWing(s) {
  for (let p = 0; p < 81; p++) {
    if (popcount(s.c[p]) !== 2) continue;
    const [a, b] = digitsOf(s.c[p]);
    const wings = PEERS[p].filter(c => popcount(s.c[c]) === 2 && popcount(s.c[c] & s.c[p]) === 1);
    for (const w1 of wings) for (const w2 of wings) {
      if (w1 >= w2) continue;
      const m1 = s.c[w1], m2 = s.c[w2];
      const z = m1 & m2 & ~s.c[p];
      if (popcount(z) !== 1 || popcount(m1 & m2) !== 1) continue;
      if ((m1 & s.c[p]) === (m2 & s.c[p])) continue;
      const v = digitsOf(z)[0];
      const elim = [];
      for (let c = 0; c < 81; c++) if (c !== p && c !== w1 && c !== w2 && (s.c[c] & z) && sees(c, w1) && sees(c, w2)) elim.push({ cell: c, val: v });
      if (!elim.length) continue;
      const wa = digitsOf(m1 & ~z)[0], wb = digitsOf(m2 & ~z)[0];
      yield {
        tech: 'yWing', key: `yWing:${p}:${w1}:${w2}`, place: null, elim, digit: v,
        hl: { focus: [p], unit: [], sources: [], cands: [...[p, w1, w2].flatMap(c => digitsOf(s.c[c]).map(val => ({ cell: c, val, kind: 'keep' }))), ...elim.map(e => ({ ...e, kind: 'remove' }))] },
        lines: [`The middle square at ${cellName(p)} can only be ${a} or ${b}.`, `It connects to ${cellName(w1)}, which is ${wa} or ${v}, and to ${cellName(w2)}, which is ${wb} or ${v}.`, `Whichever number the middle square takes, one of those two squares must become ${v}.`, `Any square that sees both of them cannot be ${v}.`, removeSentence(elim)],
      };
    }
  }
}

export const TECHNIQUES = [
  { id: 'fullHouse', find: fullHouse, name: 'Last empty square', rank: 1 },
  { id: 'hiddenSingle', find: hiddenSingle, name: 'Only place left', rank: 2 },
  { id: 'nakedSingle', find: nakedSingle, name: 'Only number left', rank: 3 },
  { id: 'pointing', find: pointing, name: 'Pointing numbers', rank: 4 },
  { id: 'claiming', find: claiming, name: 'Box claim', rank: 5 },
  { id: 'nakedPair', find: nakedSubset(2, 'nakedPair'), name: 'Matching pair', rank: 6 },
  { id: 'hiddenPair', find: hiddenSubset(2, 'hiddenPair'), name: 'Hidden pair', rank: 7 },
  { id: 'nakedTriple', find: nakedSubset(3, 'nakedTriple'), name: 'Matching triple', rank: 8 },
  { id: 'hiddenTriple', find: hiddenSubset(3, 'hiddenTriple'), name: 'Hidden triple', rank: 9 },
  { id: 'xWing', find: fish(2, 'xWing'), name: 'X-Wing', rank: 10 },
  { id: 'yWing', find: yWing, name: 'Y-Wing', rank: 11 },
  { id: 'swordfish', find: fish(3, 'swordfish'), name: 'Swordfish', rank: 12 },
];
export const TECH = Object.fromEntries(TECHNIQUES.map(t => [t.id, t]));
const SINGLES = TECHNIQUES.slice(0, 3);

export function firstStep(s) {
  for (const t of TECHNIQUES) { const n = t.find(s).next(); if (!n.done) return n.value; }
  return null;
}
const isSolved = s => s.g.every(v => v);

// Solve with people-tricks only. Returns the hardest trick needed, if it finishes.
export function rate(grid) {
  const s = makeState(grid), counts = {};
  let maxRank = 0, steps = 0;
  for (;;) {
    if (isSolved(s)) return { solved: true, maxRank, counts, steps };
    const st = firstStep(s);
    if (!st) return { solved: false, maxRank, counts, steps };
    counts[st.tech] = (counts[st.tech] || 0) + 1;
    maxRank = Math.max(maxRank, TECH[st.tech].rank);
    applyStep(s, st); steps++;
  }
}

function targetSingle(s, target) {
  for (const t of SINGLES) for (const st of t.find(s)) if (st.place.cell === target) return st;
  return null;
}
function refind(s, step) {
  if (step.place) {
    for (const t of SINGLES) for (const st of t.find(s)) if (st.key === step.key) return st;
    return null;
  }
  for (const st of TECH[step.tech].find(s)) if (st.key === step.key) return st;
  return null;
}
function replay(start, steps, target) {
  const s = clone(start), out = [];
  for (const step of steps) {
    const fresh = refind(s, step);
    if (!fresh) return null;
    applyStep(s, fresh); out.push(fresh);
  }
  return out.length && out[out.length - 1].place?.cell === target ? out : null;
}

// The heart of Help: why does THIS square hold THIS number?
// grid must contain only correct numbers. Returns the shortest chain we can find.
export function explainCell(grid, target, budgetMs = 350) {
  const start = makeState(grid);
  if (start.g[target]) return null;
  const direct = targetSingle(start, target);
  if (direct) return { value: direct.place.val, steps: [direct], direct: true };
  const s = clone(start); let path = [];
  while (!s.g[target]) {
    const st = targetSingle(s, target) || firstStep(s);
    if (!st) return null;
    applyStep(s, st); path.push(st);
  }
  const t0 = Date.now();
  for (let i = path.length - 2; i >= 0; i--) {
    if (Date.now() - t0 > budgetMs) break;
    const trial = replay(start, path.filter((_, k) => k !== i), target);
    if (trial) path = trial;
  }
  return { value: path[path.length - 1].place.val, steps: path, direct: false };
}

// Which square should Help show when none is selected? Prefer the selected number,
// otherwise the first square that the simplest line of logic fills in.
export function nextTarget(grid, digit = 0) {
  const s = makeState(grid);
  if (digit) for (const t of SINGLES) for (const st of t.find(s)) if (st.place.val === digit) return st.place.cell;
  for (;;) {
    const st = firstStep(s);
    if (!st) return null;
    if (st.place) return st.place.cell;
    applyStep(s, st);
  }
}

// Every relabelled, reflowed copy keeps the same difficulty, so a small bank gives
// an effectively endless supply of puzzles, and one seed gives everyone the same one.
export function transform(str, seed) {
  const r = rng(seed), sh = a => shuffle(a, r);
  const digits = [0, ...sh([1, 2, 3, 4, 5, 6, 7, 8, 9])];
  const lines = () => sh([0, 1, 2]).flatMap(b => sh([0, 1, 2]).map(x => b * 3 + x));
  const rows = lines(), cols = lines(), flip = r() < 0.5;
  const g = parse(str), out = new Int8Array(81);
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    const src = flip ? rows[x] * 9 + cols[y] : rows[y] * 9 + cols[x];
    out[y * 9 + x] = digits[g[src]];
  }
  return stringify(out);
}
