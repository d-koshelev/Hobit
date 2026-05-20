#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const FRONTEND_DIR = path.join(REPO_ROOT, "apps", "desktop", "frontend");
const SMOKE_PATH = "/jdbc-read-only-ui-smoke.html";
const SCENARIOS = [
  "valid",
  "validation",
  "caps",
  "not-configured",
  "no-connectors",
  "unsupported",
];

main().catch((error) => {
  console.error(`[jdbc-read-only-smoke] ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();
  const vitePort = await freePort();
  const browserPort = await freePort();
  const vite = startVite(vitePort);
  const browserPath = options.browserPath ?? (await findBrowser());
  const userDataDir = path.join(
    REPO_ROOT,
    "target",
    "hobit-smoke",
    `jdbc-read-only-ui-${Date.now()}`,
  );
  let browser = null;

  try {
    await waitForHttp(`http://127.0.0.1:${vitePort}${SMOKE_PATH}`);
    browser = await startBrowser({
      browserPath,
      browserPort,
      headed: options.headed,
      userDataDir,
    });

    for (const scenario of options.scenarios) {
      const result = await runScenario({
        browserPort,
        scenario,
        url: `http://127.0.0.1:${vitePort}${SMOKE_PATH}?scenario=${scenario}`,
      });
      console.log(
        `[jdbc-read-only-smoke] ${scenario}: passed in ${result.durationMs}ms`,
      );
    }

    console.log(
      `[jdbc-read-only-smoke] all scenarios passed in ${Date.now() - startedAt}ms`,
    );
  } finally {
    await stopChild(browser);
    await stopChild(vite);
    await fs.rm(userDataDir, { force: true, recursive: true }).catch(() => {});
  }
}

function parseArgs(args) {
  const options = {
    browserPath: process.env.HOBIT_SMOKE_BROWSER || null,
    headed: false,
    scenarios: SCENARIOS,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--headed") {
      options.headed = true;
    } else if (arg === "--browser") {
      options.browserPath = args[++index] ?? null;
    } else if (arg === "--scenario") {
      const scenario = args[++index];
      if (!SCENARIOS.includes(scenario)) {
        throw new Error(`Unsupported scenario "${scenario}".`);
      }
      options.scenarios = [scenario];
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument "${arg}". Use --help.`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/hobit/smoke-jdbc-read-only-ui.mjs [options]

Options:
  --scenario <valid|validation|caps|not-configured|no-connectors|unsupported>
                                       Run one scenario.
  --browser <path>                     Browser executable override.
  --headed                             Run the browser visibly.
  --help                               Show this help.

The smoke starts Vite, opens the committed JDBC smoke page through Chrome
DevTools Protocol, and clicks the real Database / JDBC widget UI with mocked
frontend actions shaped like the mock/safe read-only backend result model.`);
}

async function runScenario({ browserPort, scenario, url }) {
  const startedAt = Date.now();
  const target = await createTarget(browserPort, url);
  const cdp = await CdpSession.connect(target.webSocketDebuggerUrl);

  try {
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 1180,
      mobile: false,
      width: 1440,
    });

    await waitFor(cdp, "Boolean(window.__HOBIT_JDBC_READ_ONLY_SMOKE__)");
    await waitForText(cdp, "JDBC read-only UI smoke");
    await waitForText(cdp, "Database / JDBC");
    await waitForText(cdp, "Read-only SQL");

    if (scenario === "valid") {
      await runValidScenario(cdp);
    } else if (scenario === "validation") {
      await runValidationScenario(cdp);
    } else if (scenario === "caps") {
      await runCapsScenario(cdp);
    } else if (scenario === "not-configured") {
      await runNotConfiguredScenario(cdp);
    } else if (scenario === "no-connectors") {
      await runNoConnectorsScenario(cdp);
    } else {
      await runUnsupportedScenario(cdp);
    }

    await assertNoSecretRendered(cdp);
    const snapshot = await smokeSnapshot(cdp);
    assertEqual(snapshot.coordinatorCallCount, 0, "Coordinator calls");
    return { durationMs: Date.now() - startedAt };
  } finally {
    await cdp.close();
    await closeTarget(browserPort, target.id).catch(() => {});
  }
}

async function runValidScenario(cdp) {
  await waitForText(cdp, "Smoke read-only connector");
  await waitForText(cdp, "Smoke analytics connector");
  await setSelectByLabel(cdp, "Connector", "Smoke analytics connector");
  await waitForText(cdp, "Smoke analytics connector");
  await setFieldByLabel(cdp, "SQL", "select 1");
  await assertButtonDisabled(cdp, "Run read-only query");
  await clickButton(cdp, "Validate SQL");
  await waitForText(cdp, "SELECT statement accepted.");
  await clickButton(cdp, "Run read-only query");
  await waitForText(cdp, "Completed");
  await waitForText(cdp, "Smoke analytics connector");
  await waitForText(cdp, "1 of 1 rows");
  await waitForText(cdp, "Mock");
  await waitForText(cdp, "row_number");
  await waitForText(cdp, "sample_value");

  const snapshot = await smokeSnapshot(cdp);
  assertEqual(snapshot.connectorListCallCount, 1, "connector list calls");
  assertAtLeast(snapshot.getConnectorCallCount, 2, "connector get calls");
  assertEqual(snapshot.validateCallCount, 1, "validation calls");
  assertEqual(snapshot.executeCallCount, 1, "execute calls");
  assertEqual(snapshot.lastResultStatus, "completed", "last result status");
  assertEqual(snapshot.lastExecutedRowLimit, 100, "default row limit");
}

async function runValidationScenario(cdp) {
  const validExamples = [
    ["select 1", "SELECT statement accepted."],
    ["with smoke as (select 1) select * from smoke", "WITH statement accepted."],
    ["show tables", "SHOW statement accepted."],
    ["describe smoke_table", "DESCRIBE statement accepted."],
  ];

  for (const [sql, expected] of validExamples) {
    await setFieldByLabel(cdp, "SQL", sql);
    await clickButton(cdp, "Validate SQL");
    await waitForText(cdp, expected);
  }

  await setFieldByLabel(cdp, "SQL", "drop table x");
  await clickButton(cdp, "Validate SQL");
  await waitForText(cdp, "Only conservative read-only SQL is allowed.");

  await setFieldByLabel(cdp, "SQL", "update t set x = 1");
  await clickButton(cdp, "Validate SQL");
  await waitForText(cdp, "Only conservative read-only SQL is allowed.");

  await setFieldByLabel(cdp, "SQL", "select 1; select 2");
  await clickButton(cdp, "Validate SQL");
  await waitForText(cdp, "Multiple statements are not allowed.");

  const beforeEmpty = await smokeSnapshot(cdp);
  await setFieldByLabel(cdp, "SQL", "");
  await clickButton(cdp, "Validate SQL");
  await waitForText(cdp, "Enter SQL before validation.");
  const afterEmpty = await smokeSnapshot(cdp);
  assertEqual(
    afterEmpty.validateCallCount,
    beforeEmpty.validateCallCount,
    "empty SQL validation backend calls",
  );
  assertEqual(afterEmpty.executeCallCount, 0, "execute calls");
}

async function runCapsScenario(cdp) {
  await setFieldByLabel(cdp, "Row limit", "999");
  await waitForFieldValue(cdp, "Row limit", "100");
  await setFieldByLabel(cdp, "Row limit", "2");
  await setFieldByLabel(cdp, "SQL", "select * from smoke_table");
  await clickButton(cdp, "Validate SQL");
  await waitForText(cdp, "SELECT statement accepted.");
  await clickButton(cdp, "Run read-only query");
  await waitForText(cdp, "2 of 4 rows");
  await waitForText(cdp, "Result capped by rows, cell values limits.");
  await waitForText(cdp, "bounded-long-cell");

  const snapshot = await smokeSnapshot(cdp);
  assertEqual(snapshot.validateCallCount, 1, "validation calls");
  assertEqual(snapshot.executeCallCount, 1, "execute calls");
  assertEqual(snapshot.lastExecutedRowLimit, 2, "bounded row limit");
  assertEqual(snapshot.lastResultStatus, "completed", "last result status");
}

async function runNotConfiguredScenario(cdp) {
  await waitForText(cdp, "Smoke not configured connector");
  await setFieldByLabel(cdp, "SQL", "select 1");
  await clickButton(cdp, "Validate SQL");
  await waitForText(cdp, "SELECT statement accepted.");
  await clickButton(cdp, "Run read-only query");
  await waitForText(cdp, "Query did not complete.");
  await waitForText(cdp, "Connector runtime is not configured for mock smoke.");

  const snapshot = await smokeSnapshot(cdp);
  assertEqual(snapshot.executeCallCount, 1, "execute calls");
  assertEqual(snapshot.lastResultStatus, "not_configured", "last result status");
}

async function runNoConnectorsScenario(cdp) {
  await waitForText(cdp, "No connectors yet.");
  await waitForText(cdp, "Select connector");
  await setFieldByLabel(cdp, "SQL", "select 1");
  await clickButton(cdp, "Validate SQL");
  await waitForText(cdp, "Select a connector before validating SQL.");

  const snapshot = await smokeSnapshot(cdp);
  assertEqual(snapshot.validateCallCount, 0, "validation calls");
  assertEqual(snapshot.executeCallCount, 0, "execute calls");
}

async function runUnsupportedScenario(cdp) {
  await waitForText(cdp, "Smoke read-only connector");
  await setFieldByLabel(cdp, "SQL", "select 1");
  await clickButton(cdp, "Validate SQL");
  await waitForText(
    cdp,
    "JDBC SQL validation is only available in the Tauri desktop shell.",
  );

  const snapshot = await smokeSnapshot(cdp);
  assertEqual(snapshot.validateCallCount, 0, "validation calls");
  assertEqual(snapshot.executeCallCount, 0, "execute calls");
}

function startVite(port) {
  const viteBin = path.join(FRONTEND_DIR, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(
    process.execPath,
    [viteBin, "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd: FRONTEND_DIR,
      env: { ...process.env, BROWSER: "none" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";

  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`[jdbc-read-only-smoke] Vite exited with code ${code}.`);
      if (output.trim()) {
        console.error(output.trim());
      }
    }
  });

  return child;
}

async function startBrowser({ browserPath, browserPort, headed, userDataDir }) {
  await fs.mkdir(userDataDir, { recursive: true });
  const args = [
    `--remote-debugging-port=${browserPort}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-background-networking",
    "--disable-sync",
    "--disable-extensions",
    "--disable-gpu",
    "--disable-gpu-sandbox",
    "--disable-gpu-compositing",
    "--disable-accelerated-2d-canvas",
    "--disable-accelerated-video-decode",
    "--disable-vulkan",
    "--disable-features=VizDisplayCompositor,UseSkiaRenderer",
    "about:blank",
  ];

  if (!headed) {
    args.unshift("--headless=new");
  }

  const child = spawn(browserPath, args, {
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: true,
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  await waitForHttp(`http://127.0.0.1:${browserPort}/json/version`, 8000).catch(
    (error) => {
      throw new Error(
        `Browser CDP did not become available. ${error.message}${
          stderr.trim() ? ` Browser stderr: ${stderr.trim()}` : ""
        }`,
      );
    },
  );

  return child;
}

async function findBrowser() {
  const candidates = [
    process.env.HOBIT_SMOKE_BROWSER,
    process.platform === "win32"
      ? "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
      : null,
    process.platform === "win32"
      ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
      : null,
    process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : null,
    process.platform === "win32"
      ? "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
      : null,
    process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : null,
    "google-chrome",
    "chromium",
    "chromium-browser",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (path.isAbsolute(candidate)) {
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        continue;
      }
    }

    if (await commandExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "No Chrome/Edge browser executable was found. Set HOBIT_SMOKE_BROWSER or pass --browser <path>.",
  );
}

function commandExists(command) {
  const checker = process.platform === "win32" ? "where" : "which";
  const child = spawn(checker, [command], { stdio: "ignore", windowsHide: true });

  return new Promise((resolve) => {
    child.on("exit", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

async function createTarget(browserPort, url) {
  const response = await fetch(
    `http://127.0.0.1:${browserPort}/json/new?${encodeURIComponent(url)}`,
    { method: "PUT" },
  );

  if (!response.ok) {
    throw new Error(`Unable to create browser target: HTTP ${response.status}`);
  }

  return response.json();
}

function closeTarget(browserPort, targetId) {
  return fetch(`http://127.0.0.1:${browserPort}/json/close/${targetId}`);
}

class CdpSession {
  constructor(socket) {
    this.nextId = 0;
    this.pending = new Map();
    this.socket = socket;
    socket.addEventListener("message", (message) => this.handleMessage(message));
  }

  static async connect(wsUrl) {
    const socket = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new CdpSession(socket);
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    this.socket.send(JSON.stringify({ id, method, params }));

    return new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
    });
  }

  async close() {
    for (const { reject } of this.pending.values()) {
      reject(new Error("CDP session closed."));
    }
    this.pending.clear();
    this.socket.close();
  }

  handleMessage(message) {
    const payload = JSON.parse(message.data);
    if (!payload.id) {
      return;
    }

    const pending = this.pending.get(payload.id);
    if (!pending) {
      return;
    }

    this.pending.delete(payload.id);
    if (payload.error) {
      pending.reject(new Error(payload.error.message));
    } else {
      pending.resolve(payload.result);
    }
  }
}

async function setFieldByLabel(cdp, label, value) {
  await evaluate(
    cdp,
    `(() => {
      const label = findLabel(${JSON.stringify(label)});
      const field = document.getElementById(label.htmlFor);
      if (!field) throw new Error("Field not found for label: ${escapeForJs(label)}");
      const proto = field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : field instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(field, ${JSON.stringify(value)});
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    })()`,
  );
}

async function setSelectByLabel(cdp, label, optionText) {
  await evaluate(
    cdp,
    `(() => {
      const label = findLabel(${JSON.stringify(label)});
      const field = document.getElementById(label.htmlFor);
      if (!(field instanceof HTMLSelectElement)) {
        throw new Error("Select not found for label: ${escapeForJs(label)}");
      }
      const option = [...field.options].find((candidate) => candidate.textContent.trim() === ${JSON.stringify(optionText)});
      if (!option) {
        throw new Error("Option not found: ${escapeForJs(optionText)}");
      }
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(field, option.value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    })()`,
  );
}

async function waitForFieldValue(cdp, label, value) {
  await waitFor(
    cdp,
    `(() => {
      const label = findLabel(${JSON.stringify(label)});
      const field = document.getElementById(label.htmlFor);
      return field?.value === ${JSON.stringify(value)};
    })()`,
  );
}

async function clickButton(cdp, text) {
  await evaluate(
    cdp,
    `(() => {
      const button = [...document.querySelectorAll("button")].find(
        (candidate) => candidate.textContent.trim() === ${JSON.stringify(text)} && !candidate.disabled
      );
      if (!button) throw new Error("Enabled button not found: ${escapeForJs(text)}");
      button.click();
    })()`,
  );
}

async function assertButtonDisabled(cdp, text) {
  const disabled = await evaluate(
    cdp,
    `[...document.querySelectorAll("button")].some((button) => button.textContent.trim() === ${JSON.stringify(text)} && button.disabled)`,
  );
  assert(disabled, `${text} should be disabled`);
}

async function waitForText(cdp, text) {
  await waitFor(
    cdp,
    `document.body && document.body.innerText.includes(${JSON.stringify(text)})`,
  );
}

async function waitForSnapshot(cdp, predicate, timeoutMs = 5000) {
  await waitUntil(async () => predicate(await smokeSnapshot(cdp)), timeoutMs);
}

async function waitFor(cdp, expression, timeoutMs = 5000) {
  await waitUntil(async () => Boolean(await evaluate(cdp, expression)), timeoutMs);
}

async function waitUntil(predicate, timeoutMs = 5000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      if (await predicate()) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(100);
  }

  throw lastError ?? new Error(`Timed out after ${timeoutMs}ms.`);
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    awaitPromise: true,
    expression: withDomHelpers(expression),
    returnByValue: true,
    userGesture: true,
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Browser evaluation failed.");
  }

  return result.result.value;
}

function withDomHelpers(expression) {
  return `(() => {
    function findLabel(text) {
      const label = [...document.querySelectorAll("label")].find((candidate) => {
        const content = candidate.textContent.trim();
        return content === text || content.startsWith(text);
      });
      if (!label?.htmlFor) {
        throw new Error("Field label not found: " + text);
      }
      return label;
    }
    return (${expression});
  })()`;
}

function smokeSnapshot(cdp) {
  return evaluate(cdp, "window.__HOBIT_JDBC_READ_ONLY_SMOKE__.snapshot()");
}

async function assertNoSecretRendered(cdp) {
  const secret = await evaluate(
    cdp,
    "window.__HOBIT_JDBC_READ_ONLY_SMOKE__.secretSentinel",
  );
  const includes = await evaluate(
    cdp,
    `document.body.innerText.includes(${JSON.stringify(secret)})`,
  );
  assert(!includes, "secret sentinel rendered in JDBC smoke UI");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, label) {
  assert(actual === expected, `${label}: expected ${expected}, got ${actual}`);
}

function assertAtLeast(actual, expected, label) {
  assert(actual >= expected, `${label}: expected at least ${expected}, got ${actual}`);
}

async function waitForHttp(url, timeoutMs = 12000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(150);
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? "no response"}`);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("Unable to allocate a local port."));
        } else {
          resolve(address.port);
        }
      });
    });
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(1500).then(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }),
  ]);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeForJs(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
