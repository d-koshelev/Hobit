import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const requiredScripts = ['blender:check', 'blender:smoke', 'test', 'build', 'validate:assets'];
const requiredFiles = [
  'scripts/check-blender.mjs',
  'scripts/run-blender-smoke.mjs',
  'scripts/blender_smoke.py',
  'docs/ASSET_PRODUCTION_PIPELINE.md',
];

for (const scriptName of requiredScripts) {
  if (!packageJson.scripts?.[scriptName]) {
    throw new Error(`Missing package script: ${scriptName}`);
  }
}

for (const relativePath of requiredFiles) {
  const stats = statSync(join(root, relativePath));
  if (!stats.isFile()) {
    throw new Error(`Expected file: ${relativePath}`);
  }
}

console.log('visual-event-runtime smoke tests passed');
