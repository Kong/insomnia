// Regenerates app icons from src/icons/icon.svg. Needs rsvg-convert and ImageMagick.
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const svg = path.join(root, 'src/icons/icon.svg');
const tmp = mkdtempSync(path.join(tmpdir(), 'icons-'));

const png = size => {
  const file = path.join(tmp, `${size}.png`);
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), svg, '-o', file]);
  return file;
};

// ICNS is a header followed by typed PNG chunks
const icnsTypes = { 32: 'ic05', 128: 'ic07', 256: 'ic08', 512: 'ic09', 1024: 'ic10' };
const chunks = Object.entries(icnsTypes).map(([size, type]) => {
  const data = readFileSync(png(Number(size)));
  const header = Buffer.alloc(8);
  header.write(type, 'ascii');
  header.writeUInt32BE(data.length + 8, 4);
  return Buffer.concat([header, data]);
});
const header = Buffer.alloc(8);
header.write('icns', 'ascii');
header.writeUInt32BE(chunks.reduce((total, chunk) => total + chunk.length, 8), 4);
writeFileSync(path.join(root, 'src/icons/icon.icns'), Buffer.concat([header, ...chunks]));

execFileSync('magick', [...[16, 24, 32, 48, 64, 128, 256].map(png), path.join(root, 'src/icons/icon.ico')]);
writeFileSync(path.join(root, 'src/static/app-icon.png'), readFileSync(png(512)));

execFileSync('magick', [
  '-size', '164x314', 'xc:#181818',
  '(', png(88), ')', '-gravity', 'center', '-composite',
  '-alpha', 'off', '-type', 'Palette', 'BMP3:' + path.join(root, 'src/icons/nsis-sidebar.bmp'),
]);

rmSync(tmp, { recursive: true });
