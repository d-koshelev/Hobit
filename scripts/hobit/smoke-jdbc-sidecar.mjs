#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import fsSync from "node:fs";
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
const MAIN_CLASS_FILE = path.join(
  BUILD_DIR,
  "com",
  "hobit",
  "jdbc",
  "JdbcReadOnlySidecar.class",
);

main().catch((error) => {
  console.error(`[jdbc-sidecar-smoke] ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();
  await assertSourceExists();

  const java = toolAvailable("java");
  const javac = toolAvailable("javac");
  console.log(
    `[jdbc-sidecar-smoke] java: ${java ? "found" : "missing"}; javac: ${javac ? "found" : "missing"}`,
  );
  if (!java || !javac) {
    console.log(
      "[jdbc-sidecar-smoke] skipped: Java/JDK is required on PATH for sidecar smoke",
    );
    return;
  }

  await compileSidecarIfNeeded();

  if (args.mode === "health") {
    console.log("[jdbc-sidecar-smoke] mode: HealthCheck only (default; no SQL)");
    await healthCheckScenario();
  } else if (args.mode === "driver-probe") {
    console.log(
      "[jdbc-sidecar-smoke] mode: DriverProbe only (loads explicit driver; no DB connection)",
    );
    await driverProbeScenario(args.driverJar, args.driverClass);
  } else {
    console.log(
      "[jdbc-sidecar-smoke] mode: optional manual DB smoke (explicit SELECT/WITH only)",
    );
    await dbSmokeScenario(args);
  }

  console.log(
    `[jdbc-sidecar-smoke] completed in ${Date.now() - startedAt}ms`,
  );
}

async function compileSidecarIfNeeded() {
  if (!(await needsCompile())) {
    console.log("[jdbc-sidecar-smoke] compile: skipped (classes are current)");
    return;
  }

  await fs.rm(BUILD_DIR, { force: true, recursive: true });
  await fs.mkdir(BUILD_DIR, { recursive: true });
  await runProcess("javac", ["-d", BUILD_DIR, SIDECAR_SOURCE], null, 10_000);
  console.log("[jdbc-sidecar-smoke] compile: passed");
}

async function needsCompile() {
  try {
    const source = await fs.stat(SIDECAR_SOURCE);
    const target = await fs.stat(MAIN_CLASS_FILE);
    return source.mtimeMs > target.mtimeMs;
  } catch {
    return true;
  }
}

async function healthCheckScenario() {
  const response = await runSidecar({
    protocol_version: 1,
    request_id: "jdbc-sidecar-health-smoke",
    request: "healthCheck",
  });
  assertEqual(response.status, "completed", "health status");
  assertEqual(response.no_secrets_returned, true, "health secret flag");
  assertEqual(response.no_ai_context_shared, true, "health AI context flag");
  assertNoSecretWords(JSON.stringify(response), "health response");
  console.log("[jdbc-sidecar-smoke] health-check: passed");
}

async function driverProbeScenario(driverJar, driverClass) {
  const request = {
    protocol_version: 1,
    request_id: "jdbc-driver-probe-smoke",
    request: "driverProbe",
    runtime_kind: "real_jdbc",
    driver_kind: "jdbc",
    driver_jar_path: driverJar,
  };
  if (driverClass) {
    request.driver_class_name = driverClass;
  }

  const response = await runSidecar(request);
  assertEqual(response.status, "completed", "driver probe status");
  assertEqual(response.no_secrets_returned, true, "driver probe secret flag");
  assertEqual(response.no_ai_context_shared, true, "driver probe AI context flag");
  assertNoSecretWords(JSON.stringify(response), "driver probe response");
  console.log("[jdbc-sidecar-smoke] driver-probe: passed");
}

async function dbSmokeScenario(options) {
  const request = {
    protocol_version: 1,
    request_id: "jdbc-sidecar-db-smoke",
    request: "executeReadOnlyQuery",
    runtime_kind: "real_jdbc",
    connector_id: "jdbc-sidecar-manual-smoke",
    database_kind: "generic_jdbc",
    driver_kind: "jdbc",
    statement_kind: firstSqlToken(options.query),
    validated_read_only: true,
    sql: options.query,
    row_limit: options.maxRows,
    timeout_ms: options.timeoutMs,
    max_columns: 50,
    max_cell_chars: 2_000,
    max_result_bytes: 256 * 1024,
    driver_jar_path: options.driverJar,
    driver_class_name: options.driverClass,
    jdbc_url: options.jdbcUrl,
  };
  if (options.username) {
    request.username = options.username;
  }
  if (options.passwordEnv) {
    request.credential_env_var_name = options.passwordEnv;
  }

  const response = await runSidecar(request, options.timeoutMs + 5_000);
  assertNoSecretWords(JSON.stringify(response), "manual DB smoke response");
  assertEqual(response.status, "completed", "manual DB smoke status");
  assertEqual(response.no_secrets_returned, true, "manual DB smoke secret flag");
  assertEqual(
    response.no_ai_context_shared,
    true,
    "manual DB smoke AI context flag",
  );
  console.log(
    `[jdbc-sidecar-smoke] optional-db-smoke: passed (${response.returned_row_count} rows returned)`,
  );
}

async function runSidecar(request, timeoutMs = 10_000) {
  const output = await runProcess(
    "java",
    ["-cp", BUILD_DIR, MAIN_CLASS],
    JSON.stringify(request),
    timeoutMs,
  );
  assertNoSecretWords(output.stderr, "sidecar stderr");
  return JSON.parse(output.stdout);
}

async function runProcess(program, args, stdin, timeoutMs) {
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
    }, timeoutMs);

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
  for (const word of secretNeedles()) {
    if (normalized.includes(word)) {
      throw new Error(`${label} contained a secret-looking token`);
    }
  }
}

function parseArgs(argv) {
  const seenFlags = new Set();
  const parsed = {
    driverClass: null,
    driverJar: null,
    jdbcUrl: null,
    maxRows: 10,
    mode: "health",
    passwordEnv: null,
    query: "SELECT 1",
    timeoutMs: 5_000,
    username: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (isPasswordValueFlag(arg)) {
      throw new Error(
        "password values are not accepted; use --password-env <ENV_VAR_NAME>",
      );
    }

    if (arg === "--driver-jar") {
      seenFlags.add(arg);
      parsed.driverJar = readFlagValue(argv, index, arg);
      index += 1;
    } else if (arg === "--driver-class") {
      seenFlags.add(arg);
      parsed.driverClass = readFlagValue(argv, index, arg);
      index += 1;
    } else if (arg === "--jdbc-url") {
      seenFlags.add(arg);
      parsed.jdbcUrl = readFlagValue(argv, index, arg);
      index += 1;
    } else if (arg === "--username") {
      seenFlags.add(arg);
      parsed.username = readFlagValue(argv, index, arg);
      index += 1;
    } else if (arg === "--password-env") {
      seenFlags.add(arg);
      parsed.passwordEnv = readFlagValue(argv, index, arg);
      index += 1;
    } else if (arg === "--query") {
      seenFlags.add(arg);
      parsed.query = readFlagValue(argv, index, arg);
      index += 1;
    } else if (arg === "--max-rows") {
      seenFlags.add(arg);
      parsed.maxRows = parseBoundedInt(
        readFlagValue(argv, index, arg),
        arg,
        1,
        100,
      );
      index += 1;
    } else if (arg === "--timeout-ms") {
      seenFlags.add(arg);
      parsed.timeoutMs = parseBoundedInt(
        readFlagValue(argv, index, arg),
        arg,
        1,
        60_000,
      );
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  validateArgs(parsed, seenFlags);
  return parsed;
}

function validateArgs(parsed, seenFlags) {
  const dbSmokeRequested =
    parsed.jdbcUrl !== null ||
    parsed.username !== null ||
    parsed.passwordEnv !== null ||
    seenFlags.has("--query") ||
    seenFlags.has("--max-rows") ||
    seenFlags.has("--timeout-ms");

  if (parsed.driverClass && !parsed.driverJar) {
    throw new Error("--driver-class requires --driver-jar");
  }

  if (dbSmokeRequested) {
    parsed.mode = "db-smoke";
    if (!parsed.driverJar) {
      throw new Error("optional DB smoke requires --driver-jar");
    }
    if (!parsed.driverClass) {
      throw new Error("optional DB smoke requires --driver-class");
    }
    if (!parsed.jdbcUrl) {
      throw new Error("optional DB smoke requires --jdbc-url");
    }
    if (!isSafeReadOnlyQuery(parsed.query)) {
      throw new Error("optional DB smoke accepts only single SELECT or WITH queries");
    }
    assertNoSecretJdbcUrl(parsed.jdbcUrl);
  } else if (parsed.driverJar) {
    parsed.mode = "driver-probe";
  }

  if (parsed.passwordEnv) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(parsed.passwordEnv)) {
      throw new Error("--password-env must be an environment variable name");
    }
    if (!Object.prototype.hasOwnProperty.call(process.env, parsed.passwordEnv)) {
      throw new Error(
        `--password-env ${parsed.passwordEnv} is not set in the current environment`,
      );
    }
  }

  if (parsed.driverJar) {
    if (!path.isAbsolute(parsed.driverJar)) {
      parsed.driverJar = path.resolve(process.cwd(), parsed.driverJar);
    }
    if (!fsSyncFileExists(parsed.driverJar)) {
      throw new Error(`driver JAR was not found: ${parsed.driverJar}`);
    }
  }
}

function readFlagValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parseBoundedInt(value, flag, minimum, maximum) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${flag} must be an integer`);
  }
  const parsed = Number.parseInt(value, 10);
  if (parsed < minimum || parsed > maximum) {
    throw new Error(`${flag} must be between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function fsSyncFileExists(filePath) {
  try {
    return fsSync.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function isPasswordValueFlag(arg) {
  return (
    arg === "--password" ||
    arg.startsWith("--password=") ||
    arg === "--passwd" ||
    arg.startsWith("--passwd=") ||
    arg === "--pwd" ||
    arg.startsWith("--pwd=") ||
    arg === "--password-value" ||
    arg.startsWith("--password-value=")
  );
}

function assertNoSecretJdbcUrl(jdbcUrl) {
  const normalized = jdbcUrl.toLowerCase();
  for (const word of secretNeedles()) {
    if (normalized.includes(word)) {
      throw new Error(
        "JDBC URL contains an obvious secret-bearing parameter; pass secrets through --password-env only",
      );
    }
  }
}

function secretNeedles() {
  return [
    "password=",
    "passwd=",
    "pwd=",
    "token=",
    "secret=",
    "access_token=",
    "api_key=",
    "apikey=",
    "privatekey=",
    "sslkey=",
  ];
}

function isSafeReadOnlyQuery(sql) {
  let scanSql;
  try {
    scanSql = scanSqlForClassification(sql.trim());
  } catch {
    return false;
  }
  if (containsMultipleStatements(scanSql)) {
    return false;
  }
  const tokens = sqlTokens(trimSingleTrailingSemicolon(scanSql.trim()));
  if (tokens.length === 0) {
    return false;
  }
  if (tokens.some((token) => unsafeSqlTokens().has(token))) {
    return false;
  }
  return tokens[0] === "SELECT" || tokens[0] === "WITH";
}

function firstSqlToken(sql) {
  const tokens = sqlTokens(
    trimSingleTrailingSemicolon(scanSqlForClassification(sql.trim())),
  );
  return tokens[0] ?? "SELECT";
}

function scanSqlForClassification(sql) {
  let output = "";
  let index = 0;
  while (index < sql.length) {
    const current = sql[index];
    const next = index + 1 < sql.length ? sql[index + 1] : "";

    if (current === "-" && next === "-") {
      index += 2;
      while (index < sql.length && sql[index] !== "\n") {
        index += 1;
      }
      output += " ";
      continue;
    }

    if (current === "/" && next === "*") {
      index += 2;
      let closed = false;
      while (index + 1 < sql.length) {
        if (sql[index] === "*" && sql[index + 1] === "/") {
          index += 2;
          closed = true;
          break;
        }
        index += 1;
      }
      if (!closed) {
        throw new Error("unterminated block comment");
      }
      output += " ";
      continue;
    }

    if (current === "'" || current === '"') {
      const quote = current;
      index += 1;
      let closed = false;
      while (index < sql.length) {
        if (sql[index] === quote) {
          if (index + 1 < sql.length && sql[index + 1] === quote) {
            index += 2;
            continue;
          }
          index += 1;
          closed = true;
          break;
        }
        index += 1;
      }
      if (!closed) {
        throw new Error("unterminated quoted value");
      }
      output += " ";
      continue;
    }

    output += current;
    index += 1;
  }
  return output;
}

function containsMultipleStatements(sql) {
  let sawSemicolon = false;
  for (const character of sql) {
    if (character === ";") {
      if (sawSemicolon) {
        return true;
      }
      sawSemicolon = true;
      continue;
    }
    if (sawSemicolon && !/\s/.test(character)) {
      return true;
    }
  }
  return false;
}

function trimSingleTrailingSemicolon(sql) {
  const trimmed = sql.trim();
  return trimmed.endsWith(";") ? trimmed.slice(0, -1).trim() : trimmed;
}

function sqlTokens(sql) {
  return Array.from(sql.matchAll(/[A-Za-z0-9_]+/g), (match) =>
    match[0].toUpperCase(),
  );
}

function unsafeSqlTokens() {
  return new Set([
    "INSERT",
    "UPDATE",
    "DELETE",
    "MERGE",
    "CREATE",
    "ALTER",
    "DROP",
    "TRUNCATE",
    "GRANT",
    "REVOKE",
    "CALL",
    "EXEC",
    "EXECUTE",
    "COPY",
    "LOAD",
    "EXPORT",
    "IMPORT",
    "SET",
    "USE",
    "BEGIN",
    "COMMIT",
    "ROLLBACK",
    "LOCK",
    "UNLOCK",
    "VACUUM",
    "ANALYZE",
    "PRAGMA",
    "ATTACH",
    "DETACH",
    "EXTENSION",
    "OUTFILE",
    "INFILE",
  ]);
}

function printHelp() {
  console.log(`Usage:
  node scripts/hobit/smoke-jdbc-sidecar.mjs
  node scripts/hobit/smoke-jdbc-sidecar.mjs --driver-jar <path> --driver-class <class>
  node scripts/hobit/smoke-jdbc-sidecar.mjs --driver-jar <path> --driver-class <class> --jdbc-url <url> [options]

Modes:
  No args                       Check java/javac, compile sidecar if needed, run HealthCheck only.
  --driver-jar + --driver-class Run DriverProbe only. It loads the explicit driver and does not connect to a DB.
  --jdbc-url                    Optional manual DB smoke. Runs only an explicit SELECT/WITH query.

Options:
  --driver-jar <path>           Explicit JDBC driver JAR. Required for DriverProbe and DB smoke.
  --driver-class <class>        Explicit JDBC Driver class. Required for DB smoke.
  --jdbc-url <url>              Runtime-only JDBC URL for optional manual DB smoke.
  --username <user>             Optional runtime-only username.
  --password-env <ENV_VAR_NAME> Optional environment variable name containing the password.
  --query "SELECT 1"            Optional DB smoke query. SELECT/WITH only. Default: SELECT 1.
  --max-rows 10                 Max rows for optional DB smoke. Range: 1-100. Default: 10.
  --timeout-ms 5000             Query/process timeout for optional DB smoke. Range: 1-60000. Default: 5000.

Examples:
  HealthCheck:
    node scripts/hobit/smoke-jdbc-sidecar.mjs

  DriverProbe:
    node scripts/hobit/smoke-jdbc-sidecar.mjs --driver-jar C:\\path\\driver.jar --driver-class org.example.Driver

  Optional H2 in-memory SELECT 1:
    # Download the H2 driver JAR manually, for example h2-2.4.240.jar from Maven Central:
    # https://repo1.maven.org/maven2/com/h2database/h2/2.4.240/h2-2.4.240.jar
    node scripts/hobit/smoke-jdbc-sidecar.mjs --driver-jar C:\\path\\to\\h2-2.4.240.jar --driver-class org.h2.Driver --jdbc-url "jdbc:h2:mem:hobit_smoke;DB_CLOSE_DELAY=-1" --query "SELECT 1"

  Optional safe query:
    node scripts/hobit/smoke-jdbc-sidecar.mjs --driver-jar ... --driver-class ... --jdbc-url ... --username ... --password-env JDBC_PASSWORD --query "SELECT 1"

Safety:
  This smoke does not store secrets, does not accept password values, does not scan folders,
  does not download drivers, and rejects obvious secret-bearing JDBC URL parameters.
  Real DB smoke is optional/manual and is not required by normal validation.`);
}
