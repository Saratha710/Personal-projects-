import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../www/js/config.js';
import * as LB from '../www/js/leaderboard.js';
test('sample board is labelled, sorted and places you correctly', () => {
  const d = LB.sampleBoard('2026-11-05_easy', 1200, { name: 'Sara', country: 'IN', score: 99999, seconds: 100 });
  assert.equal(d.sample, true); assert.equal(d.rank, 1); assert.equal(d.rows[0].name, 'Sara');
  assert.ok(d.rows.every((r, i) => !i || d.rows[i - 1].score >= r.score));
});
test('talks to Firebase with the documented request shapes', async () => {
  CONFIG.firebase.apiKey = 'KEY'; CONFIG.firebase.projectId = 'proj';
  const calls = [];
  globalThis.fetch = async (url, o) => {
    calls.push({ url, o });
    const reply = b => ({ ok: true, json: async () => b });
    if (url.includes('accounts:signUp')) return reply({ localId: 'u1', idToken: 't', refreshToken: 'r', expiresIn: '3600' });
    if (url.includes(':runQuery')) return reply([{ document: { name: 'x/entries/u9', fields: { name: { stringValue: 'Ana' }, country: { stringValue: 'BR' }, score: { integerValue: '1500' }, seconds: { integerValue: '300' } } } }]);
    if (url.includes(':runAggregationQuery')) return reply([{ result: { aggregateFields: { n: { integerValue: '7' } } } }]);
    return reply({});
  };
  const a = await LB.signIn(null); assert.equal(a.uid, 'u1');
  await LB.postScore(a, '2026-11-05_easy', { name: 'Sara', country: 'IN', score: 1200, seconds: 300, mistakes: 1 });
  const put = calls[1];
  assert.equal(put.o.method, 'PATCH'); assert.ok(put.url.endsWith('/projects/proj/databases/(default)/documents/boards/2026-11-05_easy/entries/u1'));
  assert.equal(JSON.parse(put.o.body).fields.score.integerValue, '1200');
  assert.equal(put.o.headers.Authorization, 'Bearer t');
  const d = await LB.loadBoard(a, '2026-11-05_easy', 1200);
  assert.equal(d.rows[0].name, 'Ana'); assert.equal(d.rows[0].score, 1500); assert.equal(d.rank, 8); assert.equal(d.total, 7);
  CONFIG.firebase.apiKey = ''; CONFIG.firebase.projectId = '';
});
