import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const outDir = path.resolve("public", "icons");
fs.mkdirSync(outDir, { recursive: true });

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([size, typeBuffer, data, crc]);
}

function createPng(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function setPixel(pixels, width, x, y, rgba) {
  if (x < 0 || y < 0 || x >= width) return;
  const offset = (y * width + x) * 4;
  pixels[offset] = rgba[0];
  pixels[offset + 1] = rgba[1];
  pixels[offset + 2] = rgba[2];
  pixels[offset + 3] = rgba[3];
}

function fillRect(pixels, width, height, x, y, w, h, rgba) {
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(width, Math.ceil(x + w));
  const endY = Math.min(height, Math.ceil(y + h));
  for (let py = startY; py < endY; py += 1) {
    for (let px = startX; px < endX; px += 1) {
      setPixel(pixels, width, px, py, rgba);
    }
  }
}

function fillCircle(pixels, width, height, cx, cy, r, rgba) {
  const minX = Math.max(0, Math.floor(cx - r));
  const maxX = Math.min(width - 1, Math.ceil(cx + r));
  const minY = Math.max(0, Math.floor(cy - r));
  const maxY = Math.min(height - 1, Math.ceil(cy + r));
  const r2 = r * r;
  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const dx = px + 0.5 - cx;
      const dy = py + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) {
        setPixel(pixels, width, px, py, rgba);
      }
    }
  }
}

function fillRoundedRect(pixels, width, height, x, y, w, h, r, rgba) {
  fillRect(pixels, width, height, x + r, y, w - r * 2, h, rgba);
  fillRect(pixels, width, height, x, y + r, w, h - r * 2, rgba);
  fillCircle(pixels, width, height, x + r, y + r, r, rgba);
  fillCircle(pixels, width, height, x + w - r, y + r, r, rgba);
  fillCircle(pixels, width, height, x + r, y + h - r, r, rgba);
  fillCircle(pixels, width, height, x + w - r, y + h - r, r, rgba);
}

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const sx = (value) => Math.round((value / 128) * size);

  const colors = {
    bg: [26, 15, 8, 255],
    glow: [255, 196, 82, 40],
    frame: [255, 215, 0, 255],
    frameSoft: [168, 112, 39, 255],
    tileA: [107, 66, 38, 255],
    tileB: [92, 58, 34, 255],
    cup: [245, 245, 245, 255],
    cupShade: [224, 224, 224, 255],
    coffee: [62, 28, 10, 255],
    steam: [255, 255, 255, 160],
    accent: [79, 195, 247, 255],
  };

  fillRoundedRect(pixels, size, size, sx(8), sx(8), sx(112), sx(112), sx(24), colors.bg);
  fillRoundedRect(pixels, size, size, sx(11), sx(11), sx(106), sx(106), sx(20), colors.frameSoft);
  fillRoundedRect(pixels, size, size, sx(14), sx(14), sx(100), sx(100), sx(18), colors.bg);

  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      fillRect(
        pixels,
        size,
        size,
        sx(22 + col * 21),
        sx(56 + row * 14),
        sx(20),
        sx(13),
        (row + col) % 2 === 0 ? colors.tileA : colors.tileB,
      );
    }
  }

  fillRect(pixels, size, size, sx(18), sx(26), sx(92), sx(12), [83, 52, 28, 255]);
  for (let i = 0; i < 6; i += 1) {
    fillCircle(pixels, size, size, sx(28 + i * 14), sx(32), sx(6), colors.glow);
    fillRect(pixels, size, size, sx(26 + i * 14), sx(30), sx(4), sx(8), colors.frame);
  }

  fillRoundedRect(pixels, size, size, sx(40), sx(34), sx(44), sx(48), sx(10), colors.cup);
  fillRect(pixels, size, size, sx(44), sx(42), sx(36), sx(24), colors.coffee);
  fillRect(pixels, size, size, sx(38), sx(34), sx(48), sx(6), colors.cupShade);
  fillRoundedRect(pixels, size, size, sx(80), sx(42), sx(14), sx(18), sx(8), colors.cupShade);
  fillRoundedRect(pixels, size, size, sx(84), sx(46), sx(6), sx(10), sx(4), colors.bg);

  fillCircle(pixels, size, size, sx(44), sx(24), sx(4), colors.steam);
  fillCircle(pixels, size, size, sx(58), sx(20), sx(5), colors.steam);
  fillCircle(pixels, size, size, sx(72), sx(24), sx(4), colors.steam);

  fillRoundedRect(pixels, size, size, sx(54), sx(86), sx(20), sx(12), sx(6), colors.accent);
  fillRect(pixels, size, size, sx(60), sx(82), sx(8), sx(5), [255, 255, 255, 255]);

  return pixels;
}

function writeIcon(name, size) {
  const buffer = createPng(size, size, drawIcon(size));
  fs.writeFileSync(path.join(outDir, name), buffer);
}

writeIcon("icon-192.png", 192);
writeIcon("icon-512.png", 512);
writeIcon("apple-touch-icon.png", 180);

const faviconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#1a0f08"/>
  <rect x="11" y="11" width="106" height="106" rx="20" fill="#a87027"/>
  <rect x="14" y="14" width="100" height="100" rx="18" fill="#1a0f08"/>
  <rect x="18" y="26" width="92" height="12" fill="#53341c"/>
  <g fill="#ffd700">
    <rect x="26" y="30" width="4" height="8"/>
    <rect x="40" y="30" width="4" height="8"/>
    <rect x="54" y="30" width="4" height="8"/>
    <rect x="68" y="30" width="4" height="8"/>
    <rect x="82" y="30" width="4" height="8"/>
    <rect x="96" y="30" width="4" height="8"/>
  </g>
  <rect x="40" y="34" width="44" height="48" rx="10" fill="#f5f5f5"/>
  <rect x="44" y="42" width="36" height="24" fill="#3e1c0a"/>
  <rect x="38" y="34" width="48" height="6" fill="#dedede"/>
  <rect x="84" y="42" width="12" height="18" rx="6" fill="#dedede"/>
  <rect x="87" y="46" width="6" height="10" rx="3" fill="#1a0f08"/>
  <g fill="#ffffff" fill-opacity="0.65">
    <circle cx="44" cy="24" r="4"/>
    <circle cx="58" cy="20" r="5"/>
    <circle cx="72" cy="24" r="4"/>
  </g>
  <rect x="54" y="86" width="20" height="12" rx="6" fill="#4fc3f7"/>
  <rect x="60" y="82" width="8" height="5" fill="#ffffff"/>
</svg>
`;

fs.writeFileSync(path.resolve("public", "favicon.svg"), faviconSvg);
console.log("Icons generated in public/icons");
