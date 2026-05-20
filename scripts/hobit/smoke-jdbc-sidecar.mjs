#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const SIDECAR_SOURCE = path.join(
  REPO_ROOT,
  "sidecars",
  "jdbc-readonly-sidecar",
  "src",
  "main",
  "java",
  "com",
  "hobit",
  "jdbc",
  "JdbcReadOnlySidecar.java",
);
const BUILD_DIR = path.join(
  REPO_ROOT,
  "target",
  "hobit-jdbc-sidecar-smoke",
  "classes",
);
const MAIN_CLASS = "com.hobit.jdbc.JdbcReadOnlySidecar";

main().catch((error) => {
  console.error(`[jdbc-sidecar-smoke] ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const startedAt = Date.now();
  await assertSourceExists();

  if (!toolAvailable("javac") || !toolAvailable("java")) {
    console.log("[jdbc-sidecar-smoke] skipped: java and javac are not on PATH");
    return;
  }

  await fs.rm(BUILD_DIR, { force: true, recursive: true });
  await fs.mkdir(BUILD_DIR, { recursive: true });
  await runProcess("javac", ["-d", BUILD_DIR, SIDECAR_SOURCE], null);

  await validReadOnlyScenario();
  await invalidSqlScenario();
  await unsupportedDriverScenario();
  await notConfiguredScenario();
  await capScenario();

  console.log(
    `[jdbc-sidecar-smoke] all scenarios passed in ${Date.now() - startedAt}ms`,
  );
}

async function validReadOnlyScenario() {
  const response = await runSidecar(baseRequest());
  assertEqual(response.status, "completed", "valid status");
  assertEqual(response.columns.length, 4, "valid columns");
  assertEqual(response.rows.length, 3, "valid rows");
  assertEqual(response.no_secrets_returned, true, "secret flag");
  assertEqual(response.no_ai_context_shared, true, "AI context flag");
  assertNoSecretWords(JSON.stringify(response), "valid response");
  console.log("[jdbc-sidecar-smoke] valid: passed");
}

async function invalidSqlScenario() {
  const response = await runSidecar({
    ...baseRequest(),
    statement_kind: null,
    validated_read_only: false,
    sql: "drop table accounts",
  });
  assertEqual(response.status, "query_rejected", "invalid status");
  assertEqual(response.rows.length, 0, "invalid rows");
  assertNoSecretWords(JSON.stringify(response), "invalid response");
  console.log("[jdbc-sidecar-smoke] invalid: passed");
}

async function unsupportedDriverScenario() {
  const response = await runSidecar({
    ...baseRequest(),
    driver_kind: "oracle_jdbc",
  });
  assertEqual(response.status, "unsupported_driver", "unsupported status");
  assertEqual(response.rows.length, 0, "unsupported rows");
  assertNoSecretWords(JSON.stringify(response), "unsupported response");
  console.log("[jdbc-sidecar-smoke] unsupported-driver: passed");
}

async function notConfiguredScenario() {
  const response = await runSidecar({
    ...baseRequest(),
    runtime_kind: "real_jdbc",
  });
  assertEqual(response.status, "not_configured", "not configured status");
  assertEqual(response.rows.length, 0, "not configured rows");
  assertNoSecretWords(JSON.stringify(response), "not configured response");
  console.log("[jdbc-sidecar-smoke] not-configured: passed");
}

async function capScenario() {
  const response = await runSidecar({
    ...baseRequest(),
    row_limit: 1,
    max_columns: 2,
    max_cell_chars: 8,
    max_result_bytes: 256 * 1024,
  });
  assertEqual(response.status, "completed", "cap status");
  assertEqual(response.rows.length, 1, "cap rows");
  assertEqual(response.columns.length, 2, "cap columns");
  assertEqual(response.truncated, true, "cap truncated");
  assertNoSecretWords(JSON.stringify(response), "cap response");
  console.log("[jdbc-sidecar-smoke] caps: passed");
}

function baseRequest() {
  return {
    protocol_version: 1,
    request_id: "jdbc-sidecar-smoke",
    runtime_kind: "mock_read_only",
    connector_id: "jdbc-sidecar-smoke",
    database_kind: "postgres",
    driver_kind: "jdbc",
    statement_kind: "SELECT",
    validated_read_only: true,
    sql: "select 1",
    row_limit: 100,
    timeout_ms: 10_000,
    max_columns: 50,
    max_cell_chars: 2_000,
    max_result_bytes: 256 * 1024,
  };
}

async function runSidecar(request) {
  const output = await runProcess(
    "java",
    ["-cp", BUILD_DIR, MAIN_CLASS],
    JSON.stringify(request),
  );
  assertNoSecretWords(output.stderr, "sidecar stderr");
  return JSON.parse(output.stdout);
}

async function runProcess(program, args, stdin) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      cwd: REPO_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`${program} timed out`));
    }, 10_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`${program} exited ${code}: ${stderr.trim()}`));
        return;
      }
      resolve({ stdout, stderr });
    });

    if (stdin) {
      child.stdin.end(stdin);
    } else {
      child.stdin.end();
    }
  });
}

async function assertSourceExists() {
  await fs.access(SIDECAR_SOURCE);
}

function toolAvailable(program) {
  const result = spawnSync(program, ["-version"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return result.status === 0;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function assertNoSecretWords(value, label) {
  const normalized = value.toLowerCase();
  for (const word of ["password=", "passwd=", "pwd=", "token=", "secret="]) {
    if (normalized.includes(word)) {
      throw new Error(`${label} contained a secret-looking token`);
    }
  }
}
