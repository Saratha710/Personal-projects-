import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../www/js/engine.js';
const P = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
test('solver finds the known answer', () => {
  assert.equal(E.stringify(E.solutionOf(E.parse(P))), '534678912672195348198342567859761423426853791713924856961537284287419635345286179');
  assert.ok(E.hasUniqueSolution(E.parse(P)));
});
test('transform keeps the puzzle valid and is repeatable', () => {
  const a = E.transform(P, 42), b = E.transform(P, 42);
  assert.equal(a, b); assert.notEqual(a, P);
  assert.ok(E.hasUniqueSolution(E.parse(a)));
  assert.equal(E.rate(E.parse(a)).maxRank, E.rate(E.parse(P)).maxRank);
});
test('explainCell gives the right number with a reason for every empty square', () => {
  const g = E.parse(P), sol = E.solutionOf(g);
  for (let i = 0; i < 81; i++) if (!g[i]) {
    const r = E.explainCell(g, i);
    assert.equal(r.value, sol[i]);
    assert.ok(r.steps.every(s => s.lines.length >= 2));
  }
});
