// Bundles the whole app into one HTML file for phone-browser testing.
import { build } from 'esbuild';
import fs from 'node:fs';
const out = process.argv[2];
const js = (await build({ entryPoints: ['www/js/app.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020' })).outputFiles[0].text;
let css = fs.readFileSync('www/css/app.css', 'utf8').replace(/url\(\.\.\/fonts\/([^)]+)\)/g, (_, f) => `url(data:font/woff2;base64,${fs.readFileSync('www/fonts/' + f).toString('base64')})`);
let html = fs.readFileSync('www/index.html', 'utf8')
  .replace('<link rel="stylesheet" href="css/app.css">', () => `<style>${css}</style>`)
  .replace('<script type="module" src="js/app.js"></script>', () => `<script>${js.replace(/<\/script/g, '<\\/script')}</script>`);
fs.writeFileSync(out, html);
console.log(out, Math.round(html.length / 1024) + ' KB');
