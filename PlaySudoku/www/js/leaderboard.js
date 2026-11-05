// Worldwide scores through Firebase (free tier). No SDK: plain HTTPS keeps the app small.
// Until firebase keys are added to config.js the board shows clearly labelled sample players.
import { CONFIG } from './config.js';
import { hashString, rng } from './engine.js';

export const isOnline = () => !!(CONFIG.firebase.apiKey && CONFIG.firebase.projectId);
const docs = () => `https://firestore.googleapis.com/v1/projects/${CONFIG.firebase.projectId}/databases/(default)/documents`;
const json = async r => { if (!r.ok) throw new Error(`Score server said ${r.status}`); return r.json(); };

export async function signIn(auth) {
  if (auth?.idToken && auth.expires > Date.now() + 60000) return auth;
  if (auth?.refreshToken) {
    const d = await json(await fetch(`https://securetoken.googleapis.com/v1/token?key=${CONFIG.firebase.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(auth.refreshToken)}` }));
    return { uid: d.user_id, idToken: d.id_token, refreshToken: d.refresh_token, expires: Date.now() + d.expires_in * 1000 };
  }
  const d = await json(await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${CONFIG.firebase.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) }));
  return { uid: d.localId, idToken: d.idToken, refreshToken: d.refreshToken, expires: Date.now() + d.expiresIn * 1000 };
}
const head = a => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${a.idToken}` });
const fields = e => ({ fields: { name: { stringValue: e.name }, country: { stringValue: e.country }, score: { integerValue: String(e.score) }, seconds: { integerValue: String(e.seconds) }, mistakes: { integerValue: String(e.mistakes) } } });
const row = d => ({ uid: d.name.split('/').pop(), name: d.fields.name.stringValue, country: d.fields.country.stringValue, score: +d.fields.score.integerValue, seconds: +d.fields.seconds.integerValue });

export const postScore = (a, board, e) => fetch(`${docs()}/boards/${board}/entries/${a.uid}`, { method: 'PATCH', headers: head(a), body: JSON.stringify(fields(e)) }).then(json);

async function top(a, board, limit) {
  const q = { structuredQuery: { from: [{ collectionId: 'entries' }], orderBy: [{ field: { fieldPath: 'score' }, direction: 'DESCENDING' }], limit } };
  const out = await json(await fetch(`${docs()}/boards/${board}:runQuery`, { method: 'POST', headers: head(a), body: JSON.stringify(q) }));
  return out.filter(x => x.document).map(x => row(x.document));
}
async function count(a, board, above) {
  const q = { from: [{ collectionId: 'entries' }] };
  if (above != null) q.where = { fieldFilter: { field: { fieldPath: 'score' }, op: 'GREATER_THAN', value: { integerValue: String(above) } } };
  const out = await json(await fetch(`${docs()}/boards/${board}:runAggregationQuery`, { method: 'POST', headers: head(a), body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: q, aggregations: [{ alias: 'n', count: {} }] } }) }));
  return +out[0].result.aggregateFields.n.integerValue;
}
export async function loadBoard(a, board, myScore) {
  const [rows, total, ahead] = await Promise.all([top(a, board, 10), count(a, board), myScore != null ? count(a, board, myScore) : null]);
  return { rows, total, rank: ahead == null ? null : ahead + 1, sample: false };
}

const NAMES = [['Aiko', 'JP'], ['Mateo', 'MX'], ['Priya', 'IN'], ['Lukas', 'DE'], ['Amara', 'NG'], ['Noah', 'CA'], ['Sofia', 'BR'], ['Yuna', 'KR'], ['Omar', 'EG'], ['Freya', 'SE'], ['Liam', 'IE'], ['Chloe', 'FR'], ['Ravi', 'IN'], ['Mia', 'AU'], ['Elif', 'TR'], ['Tom', 'GB'], ['Zara', 'AE'], ['Diego', 'AR'], ['Hana', 'VN'], ['Ivan', 'PL']];
export function sampleBoard(board, base, me) {
  const r = rng(hashString(board));
  const rows = NAMES.map(([name, country]) => ({ uid: name, name, country, score: Math.round(base * (.55 + r() * .8)), seconds: 200 + Math.floor(r() * 900) })).sort((a, b) => b.score - a.score);
  if (me) rows.push({ ...me, uid: 'me', me: true });
  rows.sort((a, b) => b.score - a.score);
  const rank = me ? rows.findIndex(x => x.me) + 1 : null;
  return { rows: rows.slice(0, 10), total: rows.length, rank, sample: true };
}
