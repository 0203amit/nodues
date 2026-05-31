import sharp from "sharp";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public");
mkdirSync(outDir, { recursive: true });

// --- SVG builder -----------------------------------------------------------

function buildSvg({ size, rectSize, rectOffset, radius, fontSize }) {
  // rectSize/rectOffset control how big the rounded rect is relative to the
  // canvas.  For the normal icon the rect fills the canvas; for the maskable
  // icon the rect is ~80 % of the canvas so the safe-zone padding keeps the
  // letters visible under Android adaptive masks.
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="${rectOffset}" y="${rectOffset}" width="${rectSize}" height="${rectSize}"
        rx="${radius}" ry="${radius}" fill="#4338CA"/>
  <text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle"
        font-family="'IBM Plex Sans', 'SF Pro Display', 'Segoe UI', system-ui, sans-serif"
        font-weight="700" font-size="${fontSize}" fill="white">ND</text>
</svg>`.trim();
}

// --- Render each variant ---------------------------------------------------

const variants = [
  {
    name: "icon-192.png",
    size: 192,
    rectSize: 192,
    rectOffset: 0,
    radius: 29,       // ~15 % of 192
    fontSize: 105,     // scaled from 280/512 * 192 ≈ 105
  },
  {
    name: "icon-512.png",
    size: 512,
    rectSize: 512,
    rectOffset: 0,
    radius: 76,        // ~15 % of 512
    fontSize: 280,
  },
  {
    name: "icon-512-maskable.png",
    size: 512,
    rectSize: 410,     // 80 % of 512
    rectOffset: 51,    // (512 - 410) / 2
    radius: 62,        // ~15 % of 410
    fontSize: 224,     // 280 * 0.8
  },
];

for (const v of variants) {
  const svg = buildSvg(v);
  const out = join(outDir, v.name);
  await sharp(Buffer.from(svg)).resize(v.size, v.size).png().toFile(out);
  console.log(`✓ ${v.name}  (${v.size}×${v.size})`);
}

console.log("\nDone — icons written to public/");
