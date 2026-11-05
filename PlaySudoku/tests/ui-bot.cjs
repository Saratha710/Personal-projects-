// Without a game server: test challenge and computer opponent.
const { chromium } = require('playwright'); const assert = require('assert');
(async () => {
const [file, shots] = process.argv.slice(2);
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + file); await p.click('.tabs [data-t="compete"]'); await p.waitForTimeout(100); await p.screenshot({ path: `${shots}/33-compete.png` });
await p.click('[data-act="test-invite"]'); await p.waitForSelector('[data-act="accept"]'); await p.click('[data-act="decline"]'); assert(!(await p.$('.live-sheet'))); console.log('ok   test challenge can be declined');
await p.click('[data-act="find"]'); await p.fill('input[name=n]', 'Sara'); await p.selectOption('select[name=c]', 'IN'); await p.click('form .btn:not(.alt)');
await p.waitForSelector('.game', { timeout: 10000 }); await p.waitForFunction(() => parseInt(document.querySelector('#opp-pct').textContent) > 0, null, { timeout: 15000 }); console.log('ok   computer opponent progresses');
const cells = await p.evaluate(() => { const G = window.__sm.G; return G.grid.map((v, i) => (v ? null : [i, +G.solution[i]])).filter(Boolean); });
for (const [i, v] of cells) { await p.click(`[data-i="${i}"]`); await p.click(`[data-d="${v}"]`); }
await p.waitForSelector('.dialog'); assert((await p.textContent('.dialog h2')).includes('You won')); await p.screenshot({ path: `${shots}/34-won.png` }); await p.click('[data-act="match-done"]'); await p.waitForSelector('[data-act="find"]');
assert.equal(await p.evaluate(() => window.__sm.S.matches.won), 1); console.log('ok   match win is recorded');
await p.click('[data-act="find"]'); await p.waitForSelector('.live-sheet'); await p.click('[data-act="cancel-host"]'); await p.waitForTimeout(3000); assert(!(await p.$('.game'))); console.log('ok   stop looking cancels the computer match');
await p.evaluate(() => { window.__sm.S.set.theme = 'blue'; }); console.log('errors', errs.length);
await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
