// Źródła ikony i ekranu startowego aplikacji (znak „?” jak favicon).
// Potem: npx capacitor-assets generate --android
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const LIME = '#C6F432', INK = '#111113';
// „?” jako ścieżka (bez zależności od fontów), rysowany w polu 1024×1024
const mark = (color, scale = 1) => `
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <path d="M384 404a128 128 0 1 1 196 108c-44 28-68 56-68 108v26" fill="none" stroke="${color}" stroke-width="92" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="512" cy="776" r="56" fill="${color}"/>
  </g>`;
const svg = (body, size = 1024, bg = 'none') => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg !== 'none' ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}${body}</svg>`);

mkdirSync('assets', { recursive: true });
// Ikona pełna (starsze Androidy): limonkowy kwadrat z zaokrągleniem robi system, tu pełne tło.
await sharp(svg(mark(INK, 0.72), 1024, LIME)).png().toFile('assets/icon-only.png');
// Ikona adaptacyjna: znak w bezpiecznej strefie (ok. 66% środka) i osobne tło.
await sharp(svg(mark(INK, 0.5))).png().toFile('assets/icon-foreground.png');
await sharp(svg('', 1024, LIME)).png().toFile('assets/icon-background.png');
// Ekran startowy: mały znak na tle motywu.
const splash = bg => svg(`<g transform="translate(1366 1366) scale(.42) translate(-512 -512)"><rect width="1024" height="1024" rx="230" fill="${LIME}"/>${mark(INK, 0.72)}</g>`, 2732, bg);
await sharp(splash('#F4F4F1')).png().toFile('assets/splash.png');
await sharp(splash('#0E0E11')).png().toFile('assets/splash-dark.png');
console.log('assets/: icon-only, icon-foreground, icon-background, splash, splash-dark');
