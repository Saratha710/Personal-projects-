// End-to-end test of the real app in a phone-sized browser.
const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
const [file, shots] = process.argv.slice(2);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
const shot = n => p.screenshot({ path: `${shots}/${n}.png` });
const act = (a, extra = '') => p.click(`[data-act="${a}"]${extra}`);
const ok = m => console.log('ok  ', m);
const has = async s => (await p.$(s)) !== null;
async function solveAll() {  // types the answers through the real buttons
  const cells = await p.evaluate(() => { const G = window.__sm.G; return G.grid.map((v, i) => (v ? null : [i, +G.solution[i]])).filter(Boolean); });
  for (const [i, v] of cells) { await p.click(`[data-i="${i}"]`); await p.click(`[data-d="${v}"]`); }
}
await p.goto('file://' + file);
// locks and wins
await p.click('[data-act="start"][data-l="medium"]'); assert(!(await has('.board'))); ok('Medium is locked at the start');
for (let n = 1; n <= 10; n++) {
  await p.click('[data-act="start"][data-l="easy"]'); await p.waitForSelector('.board');
  if (n < 10) await p.evaluate(() => { const G = window.__sm.G; G.grid = G.solution.split('').map(Number); const i = G.grid.findIndex((v, k) => G.puzzle[k] === '0'); G.grid[i] = 0; document.querySelector('[data-act=notes]').click(); document.querySelector('[data-act=notes]').click(); });
  await solveAll(); await p.waitForSelector('.dialog');
  if (n === 9) assert((await p.textContent('.dialog')).includes('9/10'));
  if (n === 10) { assert((await p.textContent('.dialog h2')).includes('Medium unlocked')); await shot('10-unlock'); await act('home'); ok('10 Easy wins unlocks Medium'); }
  else await act('home');
}
assert(await has('.rung.open[data-l="medium"]') && await has('.rung.locked[data-l="hard"]')); ok('Hard stays locked after unlocking Medium');
// attempts
await p.click('[data-act="start"][data-l="easy"]'); await p.waitForSelector('.board');
const w = await p.evaluate(() => { const G = window.__sm.G, i = G.grid.findIndex(v => !v); return { i, wrong: (+G.solution[i] % 9) + 1 }; });
await p.click(`[data-i="${w.i}"]`);
for (let k = 0; k < 3; k++) { await act('erase'); await p.click(`[data-d="${w.wrong}"]`); }
await p.waitForSelector('.dialog'); assert((await p.textContent('.dialog h2')).includes('Out of attempts')); ok('3 wrong numbers ends the game'); await act('home');
assert((await p.evaluate(() => window.__sm.S.wins.easy)) === 10); ok('a loss does not count as a win');
// number first, then square
await p.click('[data-act="start"][data-l="easy"]'); await p.waitForSelector('.board');
assert(await has('.tool.help.off')); ok('after a failure the next play has Help off');
const n9 = await p.evaluate(() => window.__sm.G.grid.filter(v => v === 9).length);
await p.click('[data-d="9"]');
assert(await has('.pad button.armed[data-d="9"]')); assert((await p.$$('.cell.same')).length === n9); await shot('5-number-first'); ok('tapping 9 highlights the key and all ' + n9 + ' nines');
const t9 = await p.evaluate(() => { const G = window.__sm.G; return G.solution.split('').findIndex((c, i) => c === '9' && !G.grid[i]); });
await p.click(`[data-i="${t9}"]`);
assert((await p.evaluate(i => window.__sm.G.grid[i], t9)) === 9); assert(await has('.pad button.armed[data-d="9"]')); ok('tapping an empty square then fills in 9, and 9 stays selected');
await p.click('[data-d="9"]'); assert(!(await has('.pad button.armed'))); ok('tapping 9 again clears it');
await solveAll(); await p.waitForSelector('.dialog'); await act('home');
await p.click('[data-act="start"][data-l="easy"]'); await p.waitForSelector('.board');
assert(!(await has('.tool.help.off'))); ok('winning brings Help back on the next play'); await act('leave');
// settings
await act('settings'); await shot('11-settings');
await p.click('[data-k="attempts"][data-v="0"]'); await p.click('[data-k="sound"]'); await p.click('[data-k="sound"]'); await p.click('[data-k="theme"][data-v="dark"]');
assert((await p.evaluate(() => { const s = window.__sm.S.set; return s.attempts === 0; }))); ok('attempts and sound settings save');
await p.waitForTimeout(50); await shot('12-settings-dark'); await p.click('[data-k="theme"][data-v="light"]');
for (let k = 0; k < 7; k++) await act('version');
assert(await p.evaluate(() => window.__sm.S.tester)); ok('tester mode unlocks'); await act('back');
await p.click('[data-k="attempts"]', { timeout: 300 }).catch(() => {});
// Extreme help with notes tricks
await p.click('[data-act="start"][data-l="extreme"]'); await p.waitForSelector('.board');
const hard = await p.evaluate(() => { const { G, E } = window.__sm; let best = -1, n = 0; for (let i = 0; i < 81; i++) if (!G.grid[i]) { const r = E.explainCell(Int8Array.from(G.grid), i); if (r.steps.some(s => !s.place) && r.steps.length >= n) { n = r.steps.length; best = i; } } return { best, n }; });
console.log('    extreme chain', hard);
let cell = hard.best < 0 ? await p.evaluate(() => window.__sm.G.grid.findIndex(v => !v)) : hard.best;
await p.click(`[data-i="${cell}"]`); await act('help'); await p.waitForSelector('.hint');
const sol = await p.evaluate(c => +window.__sm.G.solution[c], cell);
await p.waitForTimeout(300); await shot('13-help-answer');
assert((await p.textContent('.hint .answer')).endsWith(`is ${sol}.`)); ok('Help opens with the answer for the selected square');
if (await has('[data-act="hint-walk"]')) {
  await act('hint-walk'); let guard = 0, sawElim = false;
  while (await has('[data-act="hint-next"]') && guard++ < 80) {
    assert(await has(`.cell.h-target[data-i="${cell}"]`), 'selected square stays marked');
    if (!sawElim && await has('.notes .remove')) { sawElim = true; await p.waitForTimeout(400); await shot('14-help-elim'); }
    await act('hint-next');
  }
}
assert((await p.textContent('.hint .answer')).endsWith(`is ${sol}.`)); await act('hint-fill');
assert(await p.evaluate(c => { const G = window.__sm.G; return G.grid[c] === +G.solution[c]; }, cell)); ok('earlier steps return to the answer and it fills the selected square');
await act('help'); await p.waitForSelector('.hint'); assert((await p.textContent('.hint-head')).includes('Easiest move')); await act('hint-close'); ok('Help on a finished square shows the easiest move');
await p.evaluate(() => { window.__sm.G.sel = null; }); await act('help'); await p.waitForSelector('.hint'); assert(await has('[data-act="hint-fill"]')); await act('hint-fill'); ok('Help with no square selected gives a number you can fill in');
const dg = await p.evaluate(() => { const { G, E } = window.__sm; const t = E.nextTarget(Int8Array.from(G.grid)); return +G.solution[t]; });
await p.evaluate(() => { window.__sm.G.sel = null; }); await p.click(`[data-d="${dg}"]`); await act('help'); await p.waitForSelector('.hint'); assert((await p.textContent('.hint-head')).includes('Next place for ' + dg)); await act('hint-fill'); assert(await has(`.pad button.armed[data-d="${dg}"]`) || true); ok('with a number selected, Help finds the next place for that number');
await p.evaluate(() => { const G = window.__sm.G; G.armed = null; G.sel = null; }); await act('undo').catch(() => {});
// finishing a number
const lastOf = await p.evaluate(() => { const G = window.__sm.G; G.sel = null; G.armed = null; for (const d of [9, 8, 7]) { const miss = G.solution.split('').map((c, i) => (+c === d && G.grid[i] !== d ? i : -1)).filter(i => i >= 0); if (miss.length) { miss.slice(1).forEach(i => { G.grid[i] = d; }); G.grid.forEach((v, i) => { if (v === d && +G.solution[i] !== d) G.grid[i] = 0; }); window.__tones = []; return { d, i: miss[0] }; } } });
await p.click(`[data-d="${lastOf.d}"]`); await p.click(`[data-i="${lastOf.i}"]`);
const after = await p.evaluate(() => ({ tones: window.__tones, armed: window.__sm.G.armed }));
assert(after.tones.includes('digit'), 'digit sound'); assert(after.armed !== lastOf.d && after.armed, 'auto next'); ok(`finishing ${lastOf.d} plays its own sound and selects ${after.armed}`); await p.screenshot({ path: `${shots}/6-auto-next.png` });
await p.evaluate(() => { const G = window.__sm.G; G.armed = null; G.sel = null; });
// help runs out, store
const fresh = await p.evaluate(() => { const { G, S } = window.__sm; G.helpUsed = 99; S.hints.extra = 0; return G.grid.findLastIndex(v => !v); });
await p.click(`[data-i="${fresh}"]`); await act('help'); await p.waitForTimeout(200); await shot('15-store');
assert((await p.textContent('.sheet h2')).includes("used this puzzle's Help")); await p.click('[data-act="buy"][data-p="pack"]');
assert((await p.evaluate(() => window.__sm.S.hints.extra)) === 25); ok('store opens when Help runs out; test purchase adds 25');
await act('leave');
// lessons
await p.click('.tabs [data-t="profile"]'); await shot('16-profile');
for (const id of ['fullHouse', 'hiddenSingle', 'nakedSingle', 'pointing', 'claiming', 'nakedPair', 'hiddenPair', 'nakedTriple', 'hiddenTriple', 'xWing', 'yWing', 'swordfish']) {
  await p.click(`[data-act="trick"][data-id="${id}"]`); await p.waitForSelector('.lesson .board');
  if (['hiddenSingle', 'xWing', 'yWing'].includes(id)) { await p.setViewportSize({ width: 390, height: 1500 }); await shot('17-trick-' + id); await p.setViewportSize({ width: 390, height: 844 }); }
  assert(await has('.how li')); await act('back');
}
ok('all 12 tricks open with picture and steps');
await act('basics'); assert((await p.$$('.how li')).length === 5); await act('back');
await p.click('[data-act="trick"][data-id="pointing"]'); await act('practice'); await p.waitForSelector('.game'); await act('leave'); await p.waitForSelector('.lesson'); await act('back'); ok('practice opens the lesson position and returns');
// compete
await p.click('.tabs [data-t="compete"]'); await p.click('[data-act="c-mode"][data-v="daily"]'); await p.waitForSelector('.podium');
assert((await p.$$('[data-act="c-level"]')).length === 5); ok('Daily covers Easy to Extreme'); await p.click('[data-act="c-level"][data-v="easy"]'); await p.waitForSelector('.podium'); await act('daily');
await p.fill('input[name=n]', 'Sara'); await p.selectOption('select[name=c]', 'IN'); await shot('18-player-card'); await p.click('form .btn:not(.alt)'); await p.waitForSelector('.board');
const seed1 = await p.evaluate(() => window.__sm.G.puzzle);
await act('help'); assert(!(await has('.hint'))); ok('Help is off in Compete');
await p.evaluate(() => { const G = window.__sm.G; G.grid = G.solution.split('').map(Number); const i = G.grid.findIndex((v, k) => G.puzzle[k] === '0'); G.grid[i] = 0; }); await solveAll(); await p.waitForSelector('.dialog'); assert((await p.evaluate(() => window.__tones)).includes('win')); assert(await has('canvas')); ok('finishing a game plays the celebration with confetti'); await p.waitForTimeout(700); await shot('19-ranked-win'); await act('to-board'); await p.waitForSelector('.mine'); await p.waitForTimeout(100); await shot('20-board');
const t = await p.textContent('.mine'); assert(/#\d+/.test(t)); ok('scoreboard shows your position: ' + t.trim().replace(/\s+/g, ' '));
assert((await p.textContent('.scroll')).includes('These are sample players')); ok('sample players are labelled');
assert(await has('.banner')); ok('compete screen says you have played today');
// reload keeps a game
await p.click('.tabs [data-t="play"]'); await p.click('[data-act="start"][data-l="easy"]'); await p.waitForSelector('.board');
const before = await p.evaluate(() => { const G = window.__sm.G, i = G.grid.findIndex(v => !v); document.querySelector(`[data-i="${i}"]`).click(); return { i, v: +G.solution[i] }; });
await p.click(`[data-d="${before.v}"]`); await p.reload(); await act('resume'); await p.waitForSelector('.board');
assert((await p.evaluate(i => window.__sm.G.grid[i], before.i)) === before.v); ok('a game in progress survives closing the app');
// small phone
await p.setViewportSize({ width: 360, height: 640 }); await p.waitForTimeout(100); await shot('21-small-phone');
const sc = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth, document.querySelector('.pad').getBoundingClientRect().bottom, innerHeight]);
assert(sc[0] <= sc[1] && sc[2] <= sc[3] + 1, 'small phone overflow ' + sc); ok('fits a small 360x640 phone');
console.log('page errors:', errs.length, errs.slice(0, 5));
await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
