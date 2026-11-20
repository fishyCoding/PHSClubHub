// Bundles dist/ into one self-contained HTML file that opens straight from
// disk (double-click), with no server needed. Run: npm run build:single
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
let html = readFileSync(new URL('index.html', dist), 'utf8');
const assets = readdirSync(new URL('assets/', dist));

for (const file of assets) {
  const code = readFileSync(new URL(`assets/${file}`, dist), 'utf8');
  if (file.endsWith('.js')) {
    const tag = new RegExp(`<script[^>]*src="\\./assets/${file}"[^>]*></script>`);
    // Inline module scripts run from file://, external ones are blocked.
    const safe = code.replace(/<\/script/gi, '<\\/script');
    html = html.replace(tag, () => `<script type="module">${safe}</script>`);
  } else if (file.endsWith('.css')) {
    const tag = new RegExp(`<link[^>]*href="\\./assets/${file}"[^>]*>`);
    html = html.replace(tag, () => `<style>${code}</style>`);
  }
}

if (/\.\/assets\//.test(html)) throw new Error('Some assets were not inlined.');
writeFileSync(new URL('PHSClubHub.html', dist), html);
console.log('Wrote dist/PHSClubHub.html');
