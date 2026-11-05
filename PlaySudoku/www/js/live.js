// Live two-player matches through Firebase Realtime Database.
// Phones check for changes every couple of seconds while on the Compete page or in a match.
import { CONFIG } from './config.js';

export const liveReady = () => !!(CONFIG.firebase.databaseURL && CONFIG.firebase.apiKey);
export const STALE_MS = 25000;
export const INVITE_MS = 90000;

async function call(a, method, path, body) {
  const base = CONFIG.firebase.databaseURL.replace(/\/$/, '');
  const r = await fetch(`${base}/${path}.json?auth=${encodeURIComponent(a.idToken)}`, {
    method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  return { ok: r.ok, status: r.status, data: r.ok ? await r.json().catch(() => null) : null };
}
const must = r => { if (!r.ok) throw new Error(`Game server said ${r.status}`); return r.data; };

export const announce = (a, me) => call(a, 'PUT', `lobby/${a.uid}`, { name: me.name, country: me.country, ts: Date.now() }).then(must);
export const leaveLobby = a => call(a, 'DELETE', `lobby/${a.uid}`);

export async function snapshot(a) {
  const [lobby, open] = await Promise.all([call(a, 'GET', 'lobby').then(must), call(a, 'GET', 'open').then(must)]);
  const now = Date.now();
  const here = Object.entries(lobby || {}).filter(([uid, v]) => uid !== a.uid && now - v.ts < STALE_MS).length;
  const invites = Object.entries(open || {}).filter(([, v]) => v.uid !== a.uid && now - v.ts < INVITE_MS).map(([id, v]) => ({ id, ...v })).sort((x, y) => x.ts - y.ts);
  return { here, invites };
}
export async function host(a, me, level) {
  const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`, seed = Math.floor(Math.random() * 2 ** 31);
  must(await call(a, 'PUT', `matches/${id}`, { level, seed, created: Date.now(), host: { uid: a.uid, name: me.name, country: me.country } }));
  must(await call(a, 'PUT', `open/${id}`, { uid: a.uid, name: me.name, country: me.country, level, ts: Date.now() }));
  return { id, level, seed };
}
export async function cancel(a, id) { await call(a, 'DELETE', `open/${id}`); await call(a, 'DELETE', `matches/${id}`); }
// The server accepts only the first player to write here, so two people cannot both join.
export async function join(a, me, id) {
  const r = await call(a, 'PUT', `matches/${id}/guest`, { uid: a.uid, name: me.name, country: me.country });
  if (!r.ok) return null;
  await call(a, 'DELETE', `open/${id}`);
  return must(await call(a, 'GET', `matches/${id}`));
}
export const read = (a, id) => call(a, 'GET', `matches/${id}`).then(must);
export const push = (a, id, p) => call(a, 'PUT', `matches/${id}/p/${a.uid}`, p).then(must);
// Also first write wins: this decides the winner on the server, not on either phone.
export const claim = async (a, id, uid) => (await call(a, 'PUT', `matches/${id}/winner`, uid)).ok;
