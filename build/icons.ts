/**
 * Regenerates the raster icons in src/assets from logo.svg. Run with `bun run icons`
 * after the mark changes; the PNGs are committed so a normal build does not need this.
 *
 *  favicon.png           32 x 32, the colour mark on transparency, rendered directly at
 *                        32 px so its edges land on whole pixels (branding/README.md).
 *  apple-touch-icon.png  180 x 180, the mark at 120 px on a paper field with a quarter of
 *                        its height as clear space. iOS fills transparency with black,
 *                        which would hide the turned corner.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const assets = path.resolve(import.meta.dir, "..", "src", "assets");
const svg = await readFile(path.join(assets, "logo.svg"));
const VIEWBOX = 512;
const at = (px: number) => sharp(svg, { density: (72 * px) / VIEWBOX }).resize(px, px);

await at(32).png({ compressionLevel: 9 }).toFile(path.join(assets, "favicon.png"));

const mark = await at(120).png().toBuffer();
await sharp({ create: { width: 180, height: 180, channels: 4, background: "#f6f3ec" } })
  .composite([{ input: mark, left: 30, top: 30 }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(assets, "apple-touch-icon.png"));

console.log("wrote src/assets/favicon.png and src/assets/apple-touch-icon.png");
