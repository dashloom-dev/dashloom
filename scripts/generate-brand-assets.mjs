import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'public');
const logoMark = await readFile(resolve(publicDir, 'brand', 'logo-mark.png'));

for (const [name, size] of [
  ['favicon-16x16.png', 16],
  ['favicon-32x32.png', 32],
  ['apple-touch-icon.png', 180],
  ['android-chrome-192x192.png', 192],
  ['android-chrome-512x512.png', 512],
]) {
  await sharp(logoMark).resize(size, size).png().toFile(resolve(publicDir, name));
}

const background = resolve(publicDir, 'brand', 'og-background.png');
const mark = logoMark;

function overlay({ title, subtitle, eyebrow }) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs><linearGradient id="fade" x1="0" x2="1"><stop stop-color="#031119" stop-opacity=".99"/><stop offset=".52" stop-color="#031119" stop-opacity=".76"/><stop offset="1" stop-color="#031119" stop-opacity=".08"/></linearGradient></defs>
    <rect width="1200" height="630" fill="url(#fade)"/>
    <rect x="48" y="48" width="1104" height="534" rx="28" fill="none" stroke="#72CDB2" stroke-opacity=".18"/>
    <g transform="translate(72 72)"><image href="data:image/png;base64,${mark.toString('base64')}" width="54" height="54"/><text x="70" y="40" fill="#ECF8F4" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" letter-spacing="-1">Dashloom</text></g>
    <text x="72" y="214" fill="#54E6AD" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="2.2">${eyebrow}</text>
    <text x="72" y="292" fill="#F3FBF8" font-family="Segoe UI, Arial, sans-serif" font-size="62" font-weight="700" letter-spacing="-2.4">${title[0]}</text>
    <text x="72" y="362" fill="#F3FBF8" font-family="Segoe UI, Arial, sans-serif" font-size="62" font-weight="700" letter-spacing="-2.4">${title[1]}</text>
    <text x="72" y="424" fill="#9CB2AA" font-family="Segoe UI, Arial, sans-serif" font-size="25">${subtitle}</text>
    <g transform="translate(72 520)"><circle cx="6" cy="-5" r="5" fill="#54E6AD"/><text x="23" fill="#81958E" font-family="Segoe UI, Arial, sans-serif" font-size="17">dashloom.dev</text></g>
  </svg>`);
}

for (const card of [
  { file: 'og-dashloom.png', eyebrow: 'OPEN-SOURCE AI PRODUCT INTELLIGENCE', title: ['Turn every signal', 'into your next move.'], subtitle: 'Connect data. Explain change. Act with evidence.' },
  { file: 'og-zh.png', eyebrow: '开源 AI 产品智能平台', title: ['让所有产品数据，', '变成下一步行动。'], subtitle: '连接数据 · 解释变化 · 基于证据行动' },
]) {
  const output = await sharp(background).resize(1200, 630, { fit: 'cover' }).composite([{ input: overlay(card) }]).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(resolve(publicDir, card.file), output);
}
