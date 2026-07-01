import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, readdirSync } from 'node:fs';
import { delimiter, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WINDOWS_BLENDER_ROOT = 'C:\\Program Files\\Blender Foundation';

function canExecute(filePath) {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    try {
      accessSync(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

function candidateNames(command) {
  if (process.platform !== 'win32') {
    return [command];
  }

  const extensions = (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM')
    .split(';')
    .filter(Boolean);
  const lowerCommand = command.toLowerCase();

  if (extensions.some((extension) => lowerCommand.endsWith(extension.toLowerCase()))) {
    return [command];
  }

  return [command, ...extensions.map((extension) => `${command}${extension.toLowerCase()}`)];
}

function findOnPath(command) {
  const pathValue = process.env.PATH ?? '';

  for (const directory of pathValue.split(delimiter).filter(Boolean)) {
    for (const name of candidateNames(command)) {
      const candidate = resolve(directory, name);
      if (canExecute(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function findWindowsInstall() {
  if (process.platform !== 'win32' || !existsSync(WINDOWS_BLENDER_ROOT)) {
    return null;
  }

  const matches = [];
  const stack = [WINDOWS_BLENDER_ROOT];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries;

    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name.toLowerCase() === 'blender.exe' && canExecute(entryPath)) {
        matches.push(entryPath);
      }
    }
  }

  matches.sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
  return matches[0] ?? null;
}

export function resolveBlenderPath() {
  const explicitPath = process.env.BLENDER_EXE?.trim();

  if (explicitPath) {
    const normalizedPath = isAbsolute(explicitPath) ? explicitPath : resolve(process.cwd(), explicitPath);
    if (!canExecute(normalizedPath)) {
      throw new Error(`BLENDER_EXE is set but Blender was not found at: ${normalizedPath}`);
    }
    return normalizedPath;
  }

  const pathMatch = findOnPath('blender');
  if (pathMatch) {
    return pathMatch;
  }

  const windowsMatch = findWindowsInstall();
  if (windowsMatch) {
    return windowsMatch;
  }

  throw new Error(
    'Blender was not found. Install Blender, add blender to PATH, or set BLENDER_EXE to the Blender executable.',
  );
}

export function runBlenderVersion(blenderPath) {
  const result = spawnSync(blenderPath, ['--version'], {
    cwd: dirname(blenderPath),
    encoding: 'utf8',
    shell: false,
  });

  if (result.error) {
    throw new Error(`Failed to run Blender --version: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || '').trim();
    throw new Error(`Blender --version exited with code ${result.status}${details ? `: ${details}` : ''}`);
  }

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    firstLine: (result.stdout ?? '').split(/\r?\n/).find((line) => line.trim())?.trim() ?? 'unknown version',
  };
}

function main() {
  try {
    const blenderPath = resolveBlenderPath();
    const version = runBlenderVersion(blenderPath);
    console.log(`Blender path: ${blenderPath}`);
    console.log(version.firstLine);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? resolve(process.argv[1]) : '';

if (currentFile === entryFile) {
  main();
}
