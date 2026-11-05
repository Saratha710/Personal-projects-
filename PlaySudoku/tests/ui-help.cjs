// Selects every empty square across all levels and proves Help answers that exact square.
const { chromium } = require('playwright'); const assert = require('assert');
(async () => {
const file = process.argv[2];
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await p.goto('file://' + file);
await p.evaluate(() => { const s = window.__sm.S; s.pro = true; s.tester = true; s.set.voice = false; });
let total = 0, chains = 0;
for (const lv of ['easy', 'medium', 'hard', 'expert', 'extreme']) {
  await p.reload(); await p.evaluate(() => { const s = window.__sm.S; s.pro = true; s.tester = true; s.set.voice = false; });
  await p.click(`[data-act="start"][data-l="${lv}"]`); await p.waitForSelector('.board');
  const blanks = await p.evaluate(() => window.__sm.G.grid.map((v, i) => (v ? -1 : i)).filter(i => i >= 0));
  for (const c of blanks) {
    await p.click(`[data-i="${c}"]`); await p.click('[data-act="help"]'); await p.waitForSelector('.hint');
    const want = await p.evaluate(c => +window.__sm.G.solution[c], c);
    const name = `Row ${Math.floor(c / 9) + 1}, column ${c % 9 + 1} is ${want}.`;
    assert.equal(await p.textContent('.hint .answer'), name);
    assert(await p.$(`.cell.h-target[data-i="${c}"]`)); assert(await p.$(`.cell.h-focus[data-i="${c}"]`));
    assert.equal(await p.textContent('[data-act="hint-fill"]'), `Fill in ${want}`);
    if (await p.$('[data-act="hint-walk"]')) chains++;
    await p.click('[data-act="hint-close"]'); total++;
  }
  console.log('ok  ', lv, blanks.length, 'squares');
}
// after filling, the number lands in the selected square
await p.reload(); await p.click('.hero');  await p.waitForSelector('.board');
const c = await p.evaluate(() => window.__sm.G.grid.findIndex(v => !v));
await p.click(`[data-i="${c}"]`); await p.click('[data-act="help"]'); await p.click('[data-act="hint-fill"]');
assert(await p.evaluate(c => { const G = window.__sm.G; return G.grid[c] === +G.solution[c]; }, c));
console.log(`ok   ${total} squares answered for the selected square, ${chains} with optional earlier steps; Fill in lands in the same square`);
await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
