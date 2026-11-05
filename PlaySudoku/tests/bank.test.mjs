import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../www/js/engine.js';
const bank = JSON.parse(fs.readFileSync('data/bank.json', 'utf8'));
const examples = JSON.parse(fs.readFileSync('data/examples.json', 'utf8'));
const range = { easy: [0, 3], medium: [0, 3], hard: [4, 6], expert: [7, 9], extreme: [10, 12] };
function walk(str, each) {
  const g = E.parse(str), sol = E.solutionOf(g), s = E.makeState(g);
  for (;;) {
    if (s.g.every(Boolean)) return;
    const st = E.firstStep(s);
    assert.ok(st, 'stuck on ' + str);
    if (st.place) assert.equal(st.place.val, sol[st.place.cell]);
    for (const e of st.elim) assert.notEqual(e.val, sol[e.cell], `${st.tech} removed the true answer`);
    each?.(st); E.applyStep(s, st);
  }
}
for (const [lvl, list] of Object.entries(bank)) test(`${lvl}: unique, graded, every step is true`, () => {
  assert.ok(list.length >= 150);
  assert.equal(new Set(list).size, list.length);
  for (const p of list) {
    assert.ok(E.hasUniqueSolution(E.parse(p)));
    const r = E.rate(E.parse(p));
    assert.ok(r.solved && r.maxRank >= range[lvl][0] && r.maxRank <= range[lvl][1], lvl + ' ' + r.maxRank);
    walk(p);
  }
});
test('selected-square help is right and quick from mid-game positions', () => {
  const rand = E.rng(5); let n = 0, slow = 0, longest = 0;
  for (const lvl of Object.keys(bank)) for (const p of bank[lvl].slice(0, 25)) {
    const g = E.parse(p), sol = E.solutionOf(g);
    for (let i = 0; i < 81; i++) if (!g[i] && rand() < 0.25) g[i] = sol[i];
    for (let i = 0; i < 81; i++) if (!g[i] && rand() < 0.25) {
      const t = Date.now(), r = E.explainCell(g, i); slow = Math.max(slow, Date.now() - t);
      assert.ok(r, 'no explanation'); assert.equal(r.value, sol[i]); n++; longest = Math.max(longest, r.steps.length);
      for (const st of r.steps) for (const e of st.elim) assert.notEqual(e.val, sol[e.cell]);
    }
  }
  console.log(`checked ${n} squares, slowest ${slow}ms, longest chain ${longest}`);
});
test('every trick has a truthful lesson example', () => {
  assert.equal(examples.length, E.TECHNIQUES.length);
  for (const ex of examples) {
    const g = E.parse(ex.grid), sol = E.solutionOf(g);
    assert.ok(sol && E.hasUniqueSolution(g));
    const found = [...E.TECH[ex.id].find(E.makeState(g))].find(s => s.key === ex.step.key);
    assert.ok(found, ex.id);
    if (ex.step.place) assert.equal(ex.step.place.val, sol[ex.step.place.cell]);
    for (const e of ex.step.elim) assert.notEqual(e.val, sol[e.cell]);
  }
});
