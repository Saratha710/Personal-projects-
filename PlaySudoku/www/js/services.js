// Sound, vibration, voice and Google Play purchases.
// On a phone these use native plugins; in a browser they fall back or say so.
import { CONFIG } from './config.js';
const P = () => window.Capacitor?.Plugins || {};
const isNative = () => !!window.Capacitor?.isNativePlatform?.();

let ctx;
const notes = {
  tap: [[520, 0, .04]], place: [[660, 0, .07]], note: [[880, 0, .03]], wrong: [[180, 0, .16]],
  unit: [[660, 0, .08], [880, .07, .1]],
  // Finishing a whole number: a bright three-note rise.
  digit: [[587, 0, .1], [880, .09, .1], [1175, .18, .22], [1760, .18, .22]],
  // Finishing the puzzle: a fanfare ending on a held chord with sparkles.
  win: [[523, 0, .13], [523, .14, .13], [523, .28, .13], [659, .42, .2], [784, .6, .14], [1047, .76, .5], [659, .76, .5], [784, .76, .5],
    [1319, 1.3, .1], [1568, 1.4, .1], [2093, 1.5, .35], [1047, 1.5, .5], [784, 1.5, .5], [523, 1.5, .6]],
};
export function tone(kind) {
  if (CONFIG.allowTesterMode) (window.__tones ||= []).push(kind);
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime;
    for (const [f, at, d] of notes[kind] || []) {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + at;
      o.type = kind === 'wrong' ? 'triangle' : kind === 'win' ? 'triangle' : 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(kind === 'win' ? .1 : .12, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + d);
    }
  } catch { /* sound is optional */ }
}
export function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas'), w = c.width = innerWidth, h = c.height = innerHeight, x = c.getContext('2d');
  c.setAttribute('aria-hidden', 'true');
  c.style.cssText = 'position:fixed;inset:0;z-index:30;pointer-events:none';
  document.body.append(c);
  const cols = ['#0E8A5F', '#1769D2', '#FF9F1C', '#C72C4A', '#6D3BEB', '#FFC933'];
  const bits = [...Array(120)].map(() => ({ x: Math.random() * w, y: -20 - Math.random() * h * .7, r: 5 + Math.random() * 7, vy: 3 + Math.random() * 4, vx: -1.5 + Math.random() * 3, a: Math.random() * 6, c: cols[Math.floor(Math.random() * cols.length)] }));
  const end = performance.now() + 3200;
  (function frame(now) {
    x.clearRect(0, 0, w, h);
    for (const b of bits) { b.y += b.vy; b.x += b.vx; b.a += .12; x.save(); x.translate(b.x, b.y); x.rotate(b.a); x.fillStyle = b.c; x.fillRect(-b.r / 2, -b.r / 3, b.r, b.r * .66); x.restore(); }
    if (now < end) requestAnimationFrame(frame); else c.remove();
  })(performance.now());
}
export function buzz(kind = 'LIGHT') {
  try {
    if (P().Haptics) P().Haptics.impact({ style: kind });
    else navigator.vibrate?.(kind === 'HEAVY' ? 60 : 12);
  } catch { /* vibration is optional */ }
}

export function stopSpeaking() {
  try { P().TextToSpeech?.stop(); window.speechSynthesis?.cancel(); } catch { /* optional */ }
}
export async function speak(text, rate = 1) {
  stopSpeaking();
  try {
    if (P().TextToSpeech) { await P().TextToSpeech.speak({ text, lang: 'en-US', rate, pitch: 1, volume: 1, category: 'ambient' }); return true; }
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = rate;
      window.speechSynthesis.speak(u); return true;
    }
  } catch { /* the written text is always on screen */ }
  return false;
}

const NP = () => P().NativePurchases;
export const billingReady = () => isNative() && !!NP();
export async function loadPrices() {
  if (!billingReady()) return {};
  try {
    const { products } = await NP().getProducts({ productIdentifiers: Object.values(CONFIG.products), productType: 'inapp' });
    return Object.fromEntries(products.map(p => [p.identifier, p.priceString]));
  } catch { return {}; }
}
export async function buy(id, consumable) {
  // With isConsumable the plugin consumes the pack itself, so it can be bought again.
  return NP().purchaseProduct({ productIdentifier: id, productType: 'inapp', quantity: 1, isConsumable: consumable });
}
export async function restore() {
  await NP().restorePurchases();
  const { purchases } = await NP().getPurchases({ productType: 'inapp' });
  return purchases.some(p => p.productIdentifier === CONFIG.products.pro);
}
