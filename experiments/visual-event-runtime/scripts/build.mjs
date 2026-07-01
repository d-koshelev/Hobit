import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const root = process.cwd();
const publicDir = join(root, 'public');
const distDir = join(root, 'dist');
const emptyOutDir = process.argv.includes('--emptyOutDir');

function copyDirectory(source, destination) {
  mkdirSync(destination, { recursive: true });

  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
      continue;
    }

    if (entry.isFile()) {
      mkdirSync(dirname(destinationPath), { recursive: true });
      copyFileSync(sourcePath, destinationPath);
    }
  }
}

function collectFiles(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      collectFiles(entryPath, files);
    } else if (entry.isFile()) {
      files.push(relative(publicDir, entryPath).replace(/\\/g, '/'));
    }
  }
  return files;
}

if (emptyOutDir) {
  rmSync(distDir, { recursive: true, force: true });
}

mkdirSync(distDir, { recursive: true });
copyDirectory(publicDir, distDir);

const assets = collectFiles(publicDir)
  .filter((filePath) => statSync(join(publicDir, filePath)).size > 0)
  .sort();

writeFileSync(
  join(distDir, 'asset-manifest.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), assets }, null, 2)}\n`,
);

console.log(`Built ${assets.length} public asset(s) into dist`);
