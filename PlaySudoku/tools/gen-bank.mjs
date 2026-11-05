// Generates graded puzzles. Usage: node tools/gen-bank.mjs <seed> <seconds> <outfile>
import fs from 'node:fs';
import * as E from '../www/js/engine.js';
const [seed, secs, out] = [+process.argv[2], +process.argv[3], process.argv[4]];
const want = { easy: 200, medium: 200, hard: 200, expert: 200, extreme: 200 };
const bank = { easy: [], medium: [], hard: [], expert: [], extreme: [] };
const rand = E.rng(seed), end = Date.now() + secs * 1000;
function full() { return E.solveCount(new Int8Array(81), 1, rand).solution; }
function dig(sol, minGivens) {
  const g = Int8Array.from(sol); let n = 81;
  for (const i of E.shuffle([...Array(41).keys()], rand)) {
    const j = 80 - i, a = g[i], b = g[j], k = i === j ? 1 : 2;
    if (n - k < minGivens) break;
    g[i] = 0; g[j] = 0;
    if (E.hasUniqueSolution(g)) n -= k; else { g[i] = a; g[j] = b; }
  }
  return { g, n };
}
const put = (lvl, g) => { if (bank[lvl].length < want[lvl]) bank[lvl].push(E.stringify(g)); };
const done = () => Object.keys(want).every(k => bank[k].length >= want[k]);
while (Date.now() < end && !done()) {
  const sol = full();
  if (bank.easy.length < want.easy) { const { g } = dig(sol, 38 + Math.floor(rand() * 4)); if (E.rate(g).maxRank <= 3) put('easy', g); }
  if (bank.medium.length < want.medium) { const { g } = dig(sol, 30 + Math.floor(rand() * 5)); const r = E.rate(g); if (r.solved && r.maxRank <= 3) put('medium', g); }
  const { g } = dig(sol, 17), r = E.rate(g);
  if (!r.solved) continue;
  if (r.maxRank >= 10) put('extreme', g);
  else if (r.maxRank >= 7) put('expert', g);
  else if (r.maxRank >= 4) put('hard', g);
}
fs.writeFileSync(out, JSON.stringify(bank));
console.log(Object.entries(bank).map(([k, v]) => `${k}:${v.length}`).join(' '));
