import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveBlenderPath } from './check-blender.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const smokeScript = join(scriptDir, 'blender_smoke.py');
const outputPath = join(
  projectRoot,
  'public',
  'asset-packs',
  'space-placeholder-v1',
  'smoke-test',
  'blender_smoke.png',
);

function main() {
  try {
    const blenderPath = resolveBlenderPath();
    console.log(`Blender path: ${blenderPath}`);

    const result = spawnSync(blenderPath, ['--background', '--python', smokeScript], {
      cwd: projectRoot,
      encoding: 'utf8',
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    if (result.error) {
      throw new Error(`Failed to run Blender smoke render: ${result.error.message}`);
    }

    if (result.status !== 0) {
      throw new Error(`Blender smoke render exited with code ${result.status}`);
    }

    if (!existsSync(outputPath) || statSync(outputPath).size === 0) {
      throw new Error(`Blender completed but did not produce a PNG at: ${outputPath}`);
    }

    console.log(`Smoke render output: ${outputPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

main();
