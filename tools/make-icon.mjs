/**
 * Build-time icon generator for dsh-harness-launcher.
 *
 * Draws a rounded blue tile with a white `>_` prompt and writes:
 * - `icon.ico`  (16/32/48 px, 32-bit BGRA) — the desktop shortcut's icon.
 * - `tools/icon-preview.png` (48 px) — a visual check, not shipped.
 *
 * Run with `node tools/make-icon.mjs`. No dependencies.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SIZES = [16, 24, 32, 48];

const TOP = [0x3f, 0x86, 0xf5];
const BOTTOM = [0x1d, 0x40, 0xb0];

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** Distance from a point to a line segment. */
function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1);
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Coverage of a rounded square inset by `radius`, in unit coordinates. */
function insideRoundedSquare(x, y, radius) {
  const cx = clamp(x, radius, 1 - radius);
  const cy = clamp(y, radius, 1 - radius);
  return Math.hypot(x - cx, y - cy) <= radius;
}

/** Premultiplied-free RGBA pixel for a unit-coordinate sample. */
function sample(x, y) {
  if (!insideRoundedSquare(x, y, 0.2)) return [0, 0, 0, 0];

  const t = clamp(y, 0, 1);
  let r = TOP[0] + (BOTTOM[0] - TOP[0]) * t;
  let g = TOP[1] + (BOTTOM[1] - TOP[1]) * t;
  let b = TOP[2] + (BOTTOM[2] - TOP[2]) * t;

  const stroke = 0.085;
  const chevron = Math.min(
    segmentDistance(x, y, 0.27, 0.35, 0.45, 0.5),
    segmentDistance(x, y, 0.45, 0.5, 0.27, 0.65),
  );
  const caret = x >= 0.53 && x <= 0.73 && Math.abs(y - 0.645) <= stroke / 2;
  if (chevron <= stroke / 2 || caret) {
    const mix = 1;
    r = r + (255 - r) * mix;
    g = g + (255 - g) * mix;
    b = b + (255 - b) * mix;
  }

  return [Math.round(r), Math.round(g), Math.round(b), 255];
}

/** Render one square icon as an RGBA buffer (4 supersamples per axis). */
function render(size) {
  const out = Buffer.alloc(size * size * 4);
  const samples = 4;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const [pr, pg, pb, pa] = sample((x + (sx + 0.5) / samples) / size, (y + (sy + 0.5) / samples) / size);
          const alpha = pa / 255;
          r += pr * alpha;
          g += pg * alpha;
          b += pb * alpha;
          a += pa;
        }
      }
      const count = samples * samples;
      const alpha = a / count;
      const scale = alpha === 0 ? 0 : 255 / alpha;
      const index = (y * size + x) * 4;
      out[index] = Math.round(clamp((r / count) * scale, 0, 255));
      out[index + 1] = Math.round(clamp((g / count) * scale, 0, 255));
      out[index + 2] = Math.round(clamp((b / count) * scale, 0, 255));
      out[index + 3] = Math.round(alpha);
    }
  }
  return out;
}

/** One ICO image entry: BITMAPINFOHEADER + bottom-up BGRA + AND mask. */
function icoImage(rgba, size) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(0, 16);
  header.writeUInt32LE(size * size * 4, 20);

  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const sourceRow = size - 1 - y;
    for (let x = 0; x < size; x += 1) {
      const from = (sourceRow * size + x) * 4;
      const to = (y * size + x) * 4;
      pixels[to] = rgba[from + 2];
      pixels[to + 1] = rgba[from + 1];
      pixels[to + 2] = rgba[from];
      pixels[to + 3] = rgba[from + 3];
    }
  }

  const maskRow = Math.ceil(size / 32) * 4;
  const mask = Buffer.alloc(maskRow * size);

  return Buffer.concat([header, pixels, mask]);
}

function buildIco(images) {
  const directory = Buffer.alloc(6 + 16 * images.length);
  directory.writeUInt16LE(0, 0);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(images.length, 4);

  let offset = directory.length;
  images.forEach(({ size, data }, index) => {
    const entry = 6 + index * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, entry);
    directory.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    directory.writeUInt8(0, entry + 2);
    directory.writeUInt8(0, entry + 3);
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(data.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });

  return Buffer.concat([directory, ...images.map((image) => image.data)]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(rgba, size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const images = SIZES.map((size) => {
  const rgba = render(size);
  if (size === 48) mkdirSync(join(ROOT, 'tools'), { recursive: true });
  if (size === 48) writeFileSync(join(ROOT, 'tools', 'icon-preview.png'), encodePng(rgba, size));
  return { size, data: icoImage(rgba, size) };
});

writeFileSync(join(ROOT, 'icon.ico'), buildIco(images));
console.log(`icon.ico written: ${SIZES.join(', ')} px`);

// Storefront tile: the plugin list asks for a GitHub-hosted raster, not an icon.
mkdirSync(join(ROOT, 'assets'), { recursive: true });
writeFileSync(join(ROOT, 'assets', 'icon-180.png'), encodePng(render(180), 180));
console.log('assets/icon-180.png written: 180 px');
