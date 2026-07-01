import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const outputPath = join(
  process.cwd(),
  'public',
  'asset-packs',
  'space-placeholder-v1',
  'smoke-test',
  'blender_smoke.png',
);

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const stats = statSync(outputPath);
const data = readFileSync(outputPath);

if (stats.size <= pngSignature.length) {
  throw new Error(`PNG is empty or too small: ${outputPath}`);
}

const header = data.subarray(0, pngSignature.length);
if (!header.equals(pngSignature)) {
  throw new Error(`Rendered file is not a PNG: ${outputPath}`);
}

const chunkType = data.subarray(12, 16).toString('ascii');
const width = data.readUInt32BE(16);
const height = data.readUInt32BE(20);
const colorType = data[25];
const hasAlpha = colorType === 4 || colorType === 6;

if (chunkType !== 'IHDR') {
  throw new Error(`PNG has an unexpected first chunk: ${chunkType}`);
}

if (width !== 256 || height !== 256) {
  throw new Error(`PNG dimensions must be 256x256, got ${width}x${height}`);
}

if (!hasAlpha) {
  throw new Error(`PNG must include an alpha channel, got color type ${colorType}`);
}

console.log(`Asset validation passed: ${outputPath} (${width}x${height}, alpha channel present)`);
