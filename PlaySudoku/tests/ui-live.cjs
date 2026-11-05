// Two real app sessions playing each other through a simulated game server.
// The simulator applies the same "first write wins" rules as firebase/database.rules.json.
const { chromium } = require('playwright'); const assert = require('assert');
(async () => {
const [file, shots] = process.argv.slice(2);
const db = {}; let uid = 0;
const getNode = parts => parts.reduce((n, k) => (n == null ? null : n[k] ?? null), db);
function setNode(parts, v) { let n = db; for (const k of parts.slice(0, -1)) n = n[k] ??= {}; if (v === null) delete n[parts[parts.length - 1]]; else n[parts[parts.length - 1]] = v; }
const b = await chromium.launch();
async function player(name) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { window.__FB = { apiKey: 'k', projectId: 'p', databaseURL: 'https://rtdb.test' }; });
  await ctx.route('https://identitytoolkit.googleapis.com/**', r => r.fulfill({ json: { localId: 'u' + ++uid, idToken: 't' + uid, refreshToken: 'r', expiresIn: '3600' } }));
  await ctx.route('https://firestore.googleapis.com/**', r => r.fulfill({ json: [] }));
  await ctx.route('https://rtdb.test/**', r => {
    const q = r.request(), parts = new URL(q.url()).pathname.replace(/\.json$/, '').split('/').filter(Boolean), last = parts[parts.length - 1];
    const cors = { 'access-control-allow-origin': '*' };
    if (q.method() === 'GET') return r.fulfill({ json: getNode(parts), headers: cors });
    if (q.method() === 'DELETE') { setNode(parts, null); return r.fulfill({ json: null, headers: cors }); }
    if ((last === 'guest' || last === 'winner') && getNode(parts) != null) return r.fulfill({ status: 401, json: { error: 'Permission denied' }, headers: cors });
    const v = q.postDataJSON(); setNode(parts, v); r.fulfill({ json: v, headers: cors });
  });
  const p = await ctx.newPage(); p.on('pageerror', e => { console.error('PAGE ERROR', name, e.message); process.exitCode = 1; });
  await p.goto('file://' + file);
  await p.evaluate(n => { const s = window.__sm.S; s.name = n; s.country = 'IN'; s.tester = true; s.set.voice = false; s.set.sound = false; }, name);
  await p.click('.tabs [data-t="compete"]');
  return p;
}
const ok = m => console.log('ok  ', m);
const solveAll = async p => { const c = await p.evaluate(() => { const G = window.__sm.G; return G.grid.map((v, i) => (v ? null : [i, +G.solution[i]])).filter(Boolean); }); for (const [i, v] of c) { await p.click(`[data-i="${i}"]`); await p.click(`[data-d="${v}"]`); } };
const wrong = async (p, times) => { const w = await p.evaluate(() => { const G = window.__sm.G, i = G.grid.findIndex(v => !v); return { i, d: (+G.solution[i] % 9) + 1 }; }); await p.click(`[data-i="${w.i}"]`); for (let k = 0; k < times; k++) { await p.click('[data-act="erase"]'); await p.click(`[data-d="${w.d}"]`); } };
async function pair(a, bb, lvl, joiner = bb) {
  await a.click(`[data-act="c-match-level"][data-v="${lvl}"]`); await a.click('[data-act="find"]'); await a.waitForSelector('.live-sheet');
  await joiner.waitForSelector('[data-act="accept"]', { timeout: 8000 }); await joiner.click('[data-act="accept"]');
  await a.waitForSelector('.game', { timeout: 15000 }); await joiner.waitForSelector('.game', { timeout: 15000 });
}
const home = async p => { await p.click('[data-act="match-done"]'); await p.waitForSelector('[data-act="find"]'); };

const sara = await player('Sara'), arun = await player('Arun'), mei = await player('Mei');
await sara.waitForFunction(() => document.querySelector('#here')?.textContent.includes('2 other players'), null, { timeout: 12000 }); ok('the page shows who else is here');
// match 1: invite, decline, race, same puzzle, progress, first to finish
await sara.click('[data-act="c-match-level"][data-v="medium"]'); await sara.click('[data-act="find"]');
await arun.waitForSelector('[data-act="accept"]', { timeout: 8000 }); await mei.waitForSelector('[data-act="accept"]', { timeout: 8000 });
await arun.screenshot({ path: `${shots}/30-invite.png` });
const inviteText = await arun.textContent('.invite'); assert(inviteText.includes('Sara') && inviteText.includes('Medium')); ok('everyone on the page is notified: ' + inviteText.trim().slice(0, 34));
await Promise.all([arun.click('[data-act="accept"]'), mei.click('[data-act="accept"]')]);
await sara.waitForSelector('.game', { timeout: 15000 });
await mei.waitForTimeout(600);
const inGame = [await arun.$('.game'), await mei.$('.game')].filter(Boolean).length; assert.equal(inGame, 1); ok('two people tap Yes at once: only one gets in');
const [p1, loser] = (await arun.$('.game')) ? [arun, mei] : [mei, arun];
await p1.waitForSelector('.game', { timeout: 8000 });
const ga = await sara.evaluate(() => window.__sm.G.puzzle), gb = await p1.evaluate(() => window.__sm.G.puzzle); assert.equal(ga, gb); ok('both players get the same puzzle');
assert.equal(await sara.evaluate(() => window.__sm.G.level), 'medium'); assert.equal(await p1.evaluate(() => window.__sm.G.level), 'medium'); ok('level comes from the first player');
assert(await sara.$('.tool.help.off')); await sara.waitForFunction(() => document.querySelectorAll('.lives i').length === 3); ok('3 attempts and no Help');
const t0 = await sara.textContent('#clock'); await sara.waitForTimeout(1200); assert.notEqual(await sara.textContent('#clock'), t0); ok('timer is running');
const cells = await p1.evaluate(() => { const G = window.__sm.G; return G.grid.map((v, i) => (v ? null : [i, +G.solution[i]])).filter(Boolean).slice(0, 12); });
for (const [i, v] of cells) { await p1.click(`[data-i="${i}"]`); await p1.click(`[data-d="${v}"]`); }
const want = await p1.textContent('#my-pct');
await sara.waitForFunction(w => document.querySelector('#opp-pct').textContent === w, want, { timeout: 6000 }); await sara.screenshot({ path: `${shots}/31-match.png` }); ok('other player sees progress: ' + want);
await solveAll(sara); await sara.waitForSelector('.dialog', { timeout: 8000 }); assert((await sara.textContent('.dialog h2')).includes('You won'));
await p1.waitForSelector('.dialog', { timeout: 8000 }); await p1.screenshot({ path: `${shots}/32-lost.png` }); assert((await p1.textContent('.dialog h2')).includes('Sara won')); ok('first to finish wins on both phones');
await home(sara); await home(p1);
assert.equal(await sara.evaluate(() => window.__sm.S.matches.won), 1); assert.equal(await p1.evaluate(() => window.__sm.S.matches.lost), 1);
// a third player stays on Compete without being stuck
await loser.waitForFunction(() => !document.querySelector('.live-sheet'), null, { timeout: 8000 }); ok('the invite disappears for the player who missed it');
// match 2: decline
await sara.click('[data-act="find"]'); await p1.waitForSelector('[data-act="decline"]', { timeout: 8000 }); await p1.click('[data-act="decline"]');
await loser.waitForSelector('[data-act="decline"]', { timeout: 8000 }); await loser.click('[data-act="decline"]');
await p1.waitForTimeout(3500); assert(!(await p1.$('.invite')) && !(await sara.$('.game'))); await sara.click('[data-act="cancel-host"]'); ok('No thanks works, and the first player can stop looking');
await p1.waitForTimeout(3500);
// match 3: 3 mistakes
await pair(p1, sara, 'easy');
await wrong(p1, 3); await sara.waitForSelector('.dialog', { timeout: 8000 }); assert((await sara.textContent('.dialog')).includes('ran out of attempts')); assert((await p1.textContent('.dialog h2')).includes('Sara won')); ok('3 wrong numbers loses the match');
await home(sara); await home(p1); await p1.waitForTimeout(3500);
// match 4: leaving
await pair(sara, p1, 'easy');
await p1.click('[data-act="leave"]'); await p1.waitForSelector('.dialog'); await p1.click('[data-act="forfeit"]');
await sara.waitForSelector('.dialog', { timeout: 8000 }); assert((await sara.textContent('.dialog h2')).includes('You won')); ok('leaving hands the win to the other player');
await home(sara); await home(p1); await p1.waitForTimeout(3500);
// match 5: phone disappears
await pair(p1, sara, 'easy');
await sara.context().close();
await p1.waitForSelector('.dialog', { timeout: 35000 }); assert((await p1.textContent('.dialog')).includes('left the match')); ok('a player who loses connection is treated as having left');
await b.close();
console.log('done');
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
