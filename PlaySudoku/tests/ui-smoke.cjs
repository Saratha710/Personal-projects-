const { chromium } = require('playwright');
(async () => {
const [file, shots] = process.argv.slice(2);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
const shot = n => p.screenshot({ path: `${shots}/${n}.png` });
const act = (a, extra = '') => p.click(`[data-act="${a}"]${extra}`);
await p.goto('file://' + file); await shot('1-home');
await act('start', '[data-l="easy"]'); await p.waitForSelector('.board'); await shot('2-game');
const empty = await p.evaluate(() => window.__sm.G.grid.findIndex(v => !v));
await p.click(`[data-i="${empty}"]`); await act('notes'); await p.click('[data-d="1"]'); await p.click('[data-d="5"]'); await p.click('[data-d="9"]'); await act('notes'); await shot('3-notes');
await act('help'); await p.waitForSelector('.hint'); await p.waitForTimeout(500); await shot('4-help');
console.log('help text:', (await p.textContent('.hint ol')).slice(0, 140));
console.log('errors', errs.length, errs.slice(0, 5));
await b.close();
})();
