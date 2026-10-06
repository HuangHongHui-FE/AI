import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'input/20260930-cailei-als';
const files = readdirSync(BASE).filter(f => /^\d+\.jpg$/.test(f)).sort();
const PER = +(process.env.PER || 30);
const start = +(process.env.START || 0);
const CELL = 260, COLS = 6, LBL = 24;

const slice = files.slice(start, start + PER);
const rows = Math.ceil(slice.length / COLS);
const W = COLS * CELL, H = rows * (CELL + LBL);
const comps = [];
for (let i = 0; i < slice.length; i++) {
  const x = (i % COLS) * CELL, y = Math.floor(i / COLS) * (CELL + LBL);
  const buf = await sharp(join(BASE, slice[i])).resize(CELL - 6, CELL - 6, { fit: 'inside' }).toBuffer();
  comps.push({ input: buf, left: x + 3, top: y + LBL + 3 });
  const n = slice[i].replace('.jpg', '');
  const svg = `<svg width="${CELL}" height="${LBL}"><rect width="${CELL}" height="${LBL}" fill="#000"/><text x="6" y="18" font-family="Helvetica" font-size="17" fill="#0f0">${n}</text></svg>`;
  comps.push({ input: Buffer.from(svg), left: x, top: y });
}
const out = `/tmp/cs-${start}.jpg`;
await sharp({ create: { width: W, height: H, channels: 3, background: '#444' } }).composite(comps).jpeg({ quality: 84 }).toFile(out);
console.log(`${out}  (${slice.length} 张: ${slice[0]} ~ ${slice[slice.length-1]})`);
