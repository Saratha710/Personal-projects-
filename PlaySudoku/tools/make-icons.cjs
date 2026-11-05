// Draws the app icon and splash screen for every Android screen density.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const res = 'android/app/src/main/res';
const font = fs.readFileSync('www/fonts/lexend-latin-700-normal.woff2').toString('base64');
const mark = (bg, scale) => `<!doctype html><style>@font-face{font-family:K;src:url(data:font/woff2;base64,${font})}html,body{margin:0;width:100%;height:100%;background:${bg}}
svg{position:absolute;inset:0;margin:auto;width:${scale}%;height:${scale}%}</style><svg viewBox="0 0 100 100"><rect x="4" y="4" width="92" height="92" rx="10" fill="#fff" stroke="#000000" stroke-width="5"/>
<rect x="35" y="35" width="30" height="30" fill="#000000"/><g stroke="#000000" stroke-width="3"><path d="M35 4v92M65 4v92M4 35h92M4 65h92"/></g>
<text x="50" y="59" text-anchor="middle" font-family="K" font-weight="700" font-size="26" fill="#FFFFFF">7</text></svg>`;
(async () => {
  const b = await chromium.launch();
  const shot = async (html, w, h, out, alpha) => { const p = await b.newPage({ viewport: { width: w, height: h } }); await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(60); fs.mkdirSync(path.dirname(out), { recursive: true }); await p.screenshot({ path: out, omitBackground: !!alpha }); await p.close(); };
  for (const [d, px] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
    await shot(mark('#1769D2', 74), px, px, `${res}/mipmap-${d}/ic_launcher.png`);
    await shot(mark('#1769D2', 74), px, px, `${res}/mipmap-${d}/ic_launcher_round.png`);
    const fg = Math.round(px * 108 / 48);
    await shot(mark('transparent', 50), fg, fg, `${res}/mipmap-${d}/ic_launcher_foreground.png`, true);
  }
  for (const dir of fs.readdirSync(res).filter(x => x.startsWith('drawable'))) {
    const f = `${res}/${dir}/splash.png`; if (!fs.existsSync(f)) continue;
    const m = fs.readFileSync(f); const w = m.readUInt32BE(16), h = m.readUInt32BE(20);
    await shot(mark('#1769D2', Math.round(36 * Math.min(w, h) / Math.max(w, h) * 1.8) ), w, h, f);
  }
  await shot(mark('#1769D2', 74), 512, 512, 'store-listing/icon-512.png');
  await b.close();
})();
