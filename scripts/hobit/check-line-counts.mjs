#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXIT_OK = 0;
const EXIT_CHECK_FAILED = 1;
const EXIT_USAGE_OR_ENVIRONMENT = 2;

const DEFAULT_ALLOWLIST_PATH = "scripts/hobit/line-count-allowlist.json";

const CATEGORY_ORDER = ["source", "test", "docs", "styles", "config"];

const THRESHOLDS = {
  source: {
    limit: 1000,
    level: "hard",
    description: "source hard threshold",
  },
  test: {
    limit: 1200,
    level: "warning",
    description: "test warning threshold",
  },
  docs: {
    limit: 1500,
    level: "warning",
    description: "docs warning threshold",
  },
  styles: {
    limit: 1200,
    level: "warning",
    description: "style warning threshold",
  },
  config: {
    limit: 1500,
    level: "warning",
    description: "config warning threshold",
  },
};

const IGNORED_DIR_NAMES = new Set([
  ".git",
  ".vite",
  "build",
  "coverage",
  "dist",
  "gen",
  "node_modules",
  "out",
  "target",
]);

const IGNORED_RELATIVE_PATHS = new Set([
  "apps/desktop/src-tauri/gen",
]);

const IGNORED_FILE_NAMES = new Set([
  "Cargo.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
]);

const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".java",
  ".js",
  ".jsx",
  ".mjs",
  ".ps1",
  ".py",
  ".rs",
  ".sh",
  ".ts",
  ".tsx",
]);

const STYLE_EXTENSIONS = new Set([
  ".css",
  ".less",
  ".sass",
  ".scss",
]);

const DOC_EXTENSIONS = new Set([
  ".md",
  ".mdx",
  ".rst",
  ".txt",
]);

const CONFIG_EXTENSIONS = new Set([
  ".cjs",
  ".conf",
  ".ini",
  ".json",
  ".jsonc",
  ".mjs",
  ".toml",
  ".yaml",
  ".yml",
]);

const REQUIRED_ALLOWLIST_FIELDS = [
  "path",
  "currentLineCount",
  "category",
  "reason",
  "plannedRefactorBlock",
  "ownerDomain",
  "targetMaxLineCount",
  "removeAfter",
];

export function normalizeRepoPath(value) {
  return value.replaceAll("\\", "/").replace(/^\/+/, "");
}

function hasGlobSyntax(value) {
  return /[*?[\]{}]/u.test(value);
}

async function pathExists(candidate) {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

export async function findRepoRoot(startDirectory = process.cwd()) {
  let current = path.resolve(startDirectory);

  while (true) {
    if (
      await pathExists(path.join(current, "AGENTS.md")) &&
      await pathExists(path.join(current, "Cargo.toml"))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error("run this script from inside the Hobit repository");
    }
    current = parent;
  }
}

function isIgnoredRelativePath(relativePath) {
  const normalized = normalizeRepoPath(relativePath);
  if (normalized.endsWith(".zip")) {
    return true;
  }

  if (IGNORED_FILE_NAMES.has(path.posix.basename(normalized))) {
    return true;
  }

  const parts = normalized.split("/");
  if (parts.some((part) => IGNORED_DIR_NAMES.has(part))) {
    return true;
  }

  return [...IGNORED_RELATIVE_PATHS].some(
    (ignored) => normalized === ignored || normalized.startsWith(`${ignored}/`),
  );
}

function isTestPath(relativePath) {
  const normalized = normalizeRepoPath(relativePath);
  const name = path.posix.basename(normalized);
  const parts = normalized.split("/");

  return (
    name === "tests.rs" ||
    name.endsWith("_test.rs") ||
    name.endsWith("_tests.rs") ||
    name.endsWith(".test.ts") ||
    name.endsWith(".test.tsx") ||
    name.endsWith(".test.js") ||
    name.endsWith(".test.jsx") ||
    name.endsWith(".spec.ts") ||
    name.endsWith(".spec.tsx") ||
    name.endsWith(".spec.js") ||
    name.endsWith(".spec.jsx") ||
    parts.includes("tests") ||
    parts.includes("__tests__")
  );
}

export function classifyPath(relativePath) {
  const normalized = normalizeRepoPath(relativePath);
  if (isIgnoredRelativePath(normalized)) {
    return null;
  }

  const extension = path.posix.extname(normalized).toLowerCase();
  if (DOC_EXTENSIONS.has(extension) || normalized.startsWith("docs/") || normalized.startsWith("decisions/")) {
    return "docs";
  }
  if (STYLE_EXTENSIONS.has(extension)) {
    return "styles";
  }
  if (isTestPath(normalized) && SOURCE_EXTENSIONS.has(extension)) {
    return "test";
  }
  if (SOURCE_EXTENSIONS.has(extension)) {
    return "source";
  }
  if (CONFIG_EXTENSIONS.has(extension)) {
    return "config";
  }

  return null;
}

async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function validateAllowlistEntry(entry, index, allowlistPath) {
  for (const field of REQUIRED_ALLOWLIST_FIELDS) {
    if (!(field in entry)) {
      throw new Error(`${allowlistPath} entry ${index} is missing ${field}`);
    }
  }

  if (typeof entry.path !== "string" || entry.path.trim() === "") {
    throw new Error(`${allowlistPath} entry ${index} has an invalid path`);
  }
  if (hasGlobSyntax(entry.path)) {
    throw new Error(`${allowlistPath} entry ${index} must use a specific path, not a glob`);
  }
  if (!CATEGORY_ORDER.includes(entry.category)) {
    throw new Error(`${allowlistPath} entry ${entry.path} has an invalid category`);
  }
  if (!Number.isInteger(entry.currentLineCount) || entry.currentLineCount < 1) {
    throw new Error(`${allowlistPath} entry ${entry.path} has an invalid currentLineCount`);
  }
  if (!Number.isInteger(entry.targetMaxLineCount) || entry.targetMaxLineCount < 1) {
    throw new Error(`${allowlistPath} entry ${entry.path} has an invalid targetMaxLineCount`);
  }

  for (const field of ["reason", "plannedRefactorBlock", "ownerDomain", "removeAfter"]) {
    if (typeof entry[field] !== "string" || entry[field].trim() === "") {
      throw new Error(`${allowlistPath} entry ${entry.path} has an invalid ${field}`);
    }
  }

  return {
    ...entry,
    path: normalizeRepoPath(entry.path),
  };
}

async function loadAllowlist(root, allowlistRelativePath = DEFAULT_ALLOWLIST_PATH) {
  const normalizedAllowlistPath = normalizeRepoPath(allowlistRelativePath);
  const fullPath = path.join(root, normalizedAllowlistPath);

  if (!(await pathExists(fullPath))) {
    return {
      path: normalizedAllowlistPath,
      entries: [],
      byPath: new Map(),
    };
  }

  let parsed;
  try {
    parsed = await readJsonFile(fullPath);
  } catch (error) {
    throw new Error(`${normalizedAllowlistPath} is not valid JSON: ${error.message}`);
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.files)) {
    throw new Error(`${normalizedAllowlistPath} must contain a files array`);
  }

  const entries = parsed.files.map((entry, index) =>
    validateAllowlistEntry(entry, index, normalizedAllowlistPath),
  );
  const byPath = new Map();
  for (const entry of entries) {
    if (byPath.has(entry.path)) {
      throw new Error(`${normalizedAllowlistPath} has duplicate entry for ${entry.path}`);
    }
    byPath.set(entry.path, entry);
  }

  return {
    path: normalizedAllowlistPath,
    entries,
    byPath,
  };
}

export function countTextLines(text) {
  if (text.length === 0) {
    return 0;
  }

  let newlines = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) {
      newlines += 1;
    }
  }

  return text.endsWith("\n") ? newlines : newlines + 1;
}

async function countFileLines(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return countTextLines(raw);
}

async function walkFiles(root, relativeDirectory = "") {
  const absoluteDirectory = path.join(root, relativeDirectory);
  const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = normalizeRepoPath(path.posix.join(relativeDirectory, entry.name));

    if (entry.isDirectory()) {
      if (!isIgnoredRelativePath(relativePath)) {
        files.push(...await walkFiles(root, relativePath));
      }
      continue;
    }

    if (entry.isFile() && !isIgnoredRelativePath(relativePath)) {
      files.push(relativePath);
    }
  }

  return files;
}

function compareFindings(left, right) {
  if (right.lines !== left.lines) {
    return right.lines - left.lines;
  }
  return left.path.localeCompare(right.path);
}

function countByCategory(files) {
  const counts = Object.fromEntries(CATEGORY_ORDER.map((category) => [category, 0]));
  for (const file of files) {
    counts[file.category] += 1;
  }
  return counts;
}

function findingStatusFor(lines, allowlistEntry) {
  if (!allowlistEntry) {
    return "unallowlisted";
  }
  if (lines > allowlistEntry.currentLineCount) {
    return "ratchet";
  }
  return "debt";
}

function buildFailures({ findings, missingAllowlistEntries, categoryMismatchEntries }) {
  return [
    ...findings.filter((finding) =>
      finding.status === "unallowlisted" || finding.status === "ratchet",
    ),
    ...missingAllowlistEntries,
    ...categoryMismatchEntries,
  ];
}

export async function runLineCountAudit(options = {}) {
  const root = options.root ? path.resolve(options.root) : await findRepoRoot(options.startDirectory);
  const allowlist = await loadAllowlist(root, options.allowlistPath);
  const allFiles = await walkFiles(root);
  const scannedFiles = [];
  const findings = [];
  const seenAllowlistedPaths = new Set();
  const categoryMismatchEntries = [];

  for (const relativePath of allFiles.sort()) {
    const category = classifyPath(relativePath);
    if (!category) {
      continue;
    }

    const lines = await countFileLines(path.join(root, relativePath));
    const threshold = THRESHOLDS[category];
    scannedFiles.push({ path: relativePath, category, lines });

    const allowlistEntry = allowlist.byPath.get(relativePath);
    if (allowlistEntry) {
      seenAllowlistedPaths.add(relativePath);
      if (allowlistEntry.category !== category) {
        categoryMismatchEntries.push({
          path: relativePath,
          status: "allowlist-category-mismatch",
          category,
          allowlistedCategory: allowlistEntry.category,
        });
      }
    }

    if (lines <= threshold.limit) {
      continue;
    }

    findings.push({
      path: relativePath,
      lines,
      category,
      threshold: threshold.limit,
      thresholdLevel: threshold.level,
      thresholdDescription: threshold.description,
      status: findingStatusFor(lines, allowlistEntry),
      allowlistedLineCount: allowlistEntry?.currentLineCount ?? null,
      ownerDomain: allowlistEntry?.ownerDomain ?? null,
      plannedRefactorBlock: allowlistEntry?.plannedRefactorBlock ?? null,
      targetMaxLineCount: allowlistEntry?.targetMaxLineCount ?? null,
    });
  }

  const missingAllowlistEntries = allowlist.entries
    .filter((entry) => !seenAllowlistedPaths.has(entry.path))
    .map((entry) => ({
      path: entry.path,
      status: "allowlist-path-missing",
      category: entry.category,
      allowlistedLineCount: entry.currentLineCount,
      ownerDomain: entry.ownerDomain,
      plannedRefactorBlock: entry.plannedRefactorBlock,
    }));

  const belowThresholdAllowlistEntries = [];
  const byPathScanned = new Map(scannedFiles.map((file) => [file.path, file]));
  for (const entry of allowlist.entries) {
    const scanned = byPathScanned.get(entry.path);
    if (!scanned || scanned.category !== entry.category) {
      continue;
    }
    const threshold = THRESHOLDS[scanned.category];
    if (scanned.lines <= threshold.limit) {
      belowThresholdAllowlistEntries.push({
        path: entry.path,
        status: "allowlist-below-threshold",
        category: entry.category,
        lines: scanned.lines,
        threshold: threshold.limit,
      });
    }
  }

  findings.sort(compareFindings);
  const failures = buildFailures({
    findings,
    missingAllowlistEntries,
    categoryMismatchEntries,
  });

  return {
    root,
    thresholds: THRESHOLDS,
    allowlistPath: allowlist.path,
    scanned: scannedFiles.length,
    scannedByCategory: countByCategory(scannedFiles),
    findings,
    findingsByCategory: countByCategory(findings),
    failures,
    missingAllowlistEntries,
    categoryMismatchEntries,
    belowThresholdAllowlistEntries,
  };
}

function formatThresholds() {
  return CATEGORY_ORDER.map((category) => {
    const threshold = THRESHOLDS[category];
    return `${category} ${threshold.level} > ${threshold.limit}`;
  }).join("; ");
}

function formatFinding(finding) {
  const allowlistSuffix = finding.allowlistedLineCount
    ? ` allowlist=${finding.allowlistedLineCount}`
    : " not-allowlisted";
  const ownerSuffix = finding.ownerDomain
    ? ` owner="${finding.ownerDomain}"`
    : "";
  return `${finding.status.toUpperCase()}: ${finding.category} ${finding.lines} lines > ${finding.threshold} ${finding.path}${allowlistSuffix}${ownerSuffix}`;
}

export function printHumanReport(audit, { mode = "report" } = {}) {
  console.log(`Line-count audit mode: ${mode}`);
  console.log(`Repository: ${audit.root}`);
  console.log(`Allowlist: ${audit.allowlistPath}`);
  console.log(`Thresholds: ${formatThresholds()}`);
  console.log(`Scanned files: ${audit.scanned}`);
  console.log(
    `Scanned by category: ${CATEGORY_ORDER.map((category) => `${category}=${audit.scannedByCategory[category]}`).join(", ")}`,
  );
  console.log(
    `Oversized findings: ${audit.findings.length} (${CATEGORY_ORDER.map((category) => `${category}=${audit.findingsByCategory[category]}`).join(", ")})`,
  );
  console.log(`Guard failures: ${audit.failures.length}`);

  if (audit.findings.length > 0) {
    console.log("");
    console.log("Oversized files:");
    for (const finding of audit.findings) {
      console.log(formatFinding(finding));
    }
  }

  if (audit.missingAllowlistEntries.length > 0) {
    console.log("");
    console.log("Missing allowlist paths:");
    for (const entry of audit.missingAllowlistEntries) {
      console.log(`${entry.status.toUpperCase()}: ${entry.path}`);
    }
  }

  if (audit.categoryMismatchEntries.length > 0) {
    console.log("");
    console.log("Allowlist category mismatches:");
    for (const entry of audit.categoryMismatchEntries) {
      console.log(
        `${entry.status.toUpperCase()}: ${entry.path} actual=${entry.category} allowlist=${entry.allowlistedCategory}`,
      );
    }
  }

  if (audit.belowThresholdAllowlistEntries.length > 0) {
    console.log("");
    console.log("Allowlist cleanup candidates:");
    for (const entry of audit.belowThresholdAllowlistEntries) {
      console.log(`${entry.status.toUpperCase()}: ${entry.category} ${entry.lines} lines <= ${entry.threshold} ${entry.path}`);
    }
  }
}

function printJsonReport(audit) {
  console.log(JSON.stringify(audit, null, 2));
}

function parseArgs(argv) {
  const options = {
    mode: "guard",
    json: false,
    allowlistPath: DEFAULT_ALLOWLIST_PATH,
    startDirectory: process.cwd(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--mode") {
      index += 1;
      options.mode = argv[index];
      continue;
    }
    if (arg.startsWith("--mode=")) {
      options.mode = arg.slice("--mode=".length);
      continue;
    }
    if (arg === "--allowlist") {
      index += 1;
      options.allowlistPath = argv[index];
      continue;
    }
    if (arg.startsWith("--allowlist=")) {
      options.allowlistPath = arg.slice("--allowlist=".length);
      continue;
    }
    if (arg === "--root") {
      index += 1;
      options.root = argv[index];
      continue;
    }
    if (arg.startsWith("--root=")) {
      options.root = arg.slice("--root=".length);
      continue;
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }

  if (!["report", "guard"].includes(options.mode)) {
    throw new Error("--mode must be report or guard");
  }

  return options;
}

function printHelp() {
  console.log("Usage: node scripts/hobit/check-line-counts.mjs [--mode report|guard] [--json]");
  console.log("");
  console.log("Modes:");
  console.log("  report  Print the current oversized-file inventory and exit 0.");
  console.log("  guard   Print the inventory and fail on unallowlisted or ratcheted oversized files.");
  console.log("");
  console.log("Options:");
  console.log("  --allowlist <path>  Override scripts/hobit/line-count-allowlist.json.");
  console.log("  --root <path>       Override repository root discovery.");
  console.log("  --json              Print machine-readable output.");
}

async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    printHelp();
    return EXIT_USAGE_OR_ENVIRONMENT;
  }

  if (options.help) {
    printHelp();
    return EXIT_OK;
  }

  try {
    const audit = await runLineCountAudit(options);
    if (options.json) {
      printJsonReport(audit);
    } else {
      printHumanReport(audit, { mode: options.mode });
    }

    if (options.mode === "guard" && audit.failures.length > 0) {
      return EXIT_CHECK_FAILED;
    }
    return EXIT_OK;
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    return EXIT_USAGE_OR_ENVIRONMENT;
  }
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  process.exitCode = await main(process.argv.slice(2));
}
