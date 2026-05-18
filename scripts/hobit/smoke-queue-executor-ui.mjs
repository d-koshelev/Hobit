#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const FRONTEND_DIR = path.join(REPO_ROOT, "apps", "desktop", "frontend");
const SMOKE_PATH = "/queue-executor-ui-smoke.html";
const SCENARIOS = ["event-final", "reconciliation-final"];
const RUN_ID = "queue-executor-smoke-run";

main().catch((error) => {
  console.error(`[queue-executor-smoke] ${error.message}`);
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
    `queue-executor-ui-${Date.now()}`,
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
        `[queue-executor-smoke] ${scenario}: passed in ${result.durationMs}ms`,
      );
    }

    console.log(
      `[queue-executor-smoke] all scenarios passed in ${Date.now() - startedAt}ms`,
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
  console.log(`Usage: node scripts/hobit/smoke-queue-executor-ui.mjs [options]

Options:
  --scenario <event-final|reconciliation-final>  Run one scenario.
  --browser <path>                               Browser executable override.
  --headed                                       Run the browser visibly.
  --help                                         Show this help.

The smoke starts Vite, opens the committed smoke page in a local browser over
Chrome DevTools Protocol, and uses mocked frontend actions only.`);
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
      height: 1100,
      mobile: false,
      width: 1440,
    });

    await waitFor(cdp, "Boolean(window.__HOBIT_QUEUE_EXECUTOR_SMOKE__)");
    await waitForText(cdp, "Queue to Executor smoke");
    await setFieldByLabel(cdp, "Repo root", REPO_ROOT);
    await waitForEnabledButton(cdp, "Run assigned task");
    await clickButton(cdp, "Run assigned task");

    await waitForSnapshot(cdp, (snapshot) => snapshot.startCallCount === 1);
    await waitForSnapshot(cdp, (snapshot) => snapshot.attachCallCount === 1);
    await waitForText(cdp, "Source: Agent Queue");
    await waitForText(cdp, `Task: Queue to Executor smoke`);
    await waitForText(cdp, RUN_ID);

    if (scenario === "event-final") {
      await evaluate(
        cdp,
        "window.__HOBIT_QUEUE_EXECUTOR_SMOKE__.emitExecutorFinalEvents()",
      );
    }

    await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.taskStatus === "completed" &&
        snapshot.queueListCallsAfterFinal === 1,
      scenario === "reconciliation-final" ? 7000 : 5000,
    );

    const snapshot = await smokeSnapshot(cdp);
    assertEqual(snapshot.startCallCount, 1, "startAssignedAgentQueueTask calls");
    assertEqual(snapshot.attachCallCount, 1, "Agent Executor attach calls");
    assertEqual(
      snapshot.queueListCallsAfterFinal,
      1,
      "Queue refresh calls after final state",
    );
    assertEqual(snapshot.terminalRunCallCount, 0, "Terminal command calls");
    assertEqual(snapshot.forbiddenCallCount, 0, "forbidden backend calls");

    if (scenario === "event-final") {
      assertEqual(snapshot.finalEventEmitCallCount, 1, "final event emits");
      await assertDocumentIncludes(cdp, await smokeField(cdp, "liveLogText"));
    } else {
      assertEqual(snapshot.finalEventEmitCallCount, 0, "final event emits");
      assertAtLeast(
        snapshot.executorRunDetailCallCount,
        1,
        "run detail reconciliation calls",
      );
    }

    await assertDocumentIncludes(cdp, await smokeField(cdp, "finalResponseText"));
    await assertQueueExcludes(cdp, await smokeField(cdp, "liveLogText"));
    await assertQueueExcludes(cdp, await smokeField(cdp, "finalResponseText"));
    await assertQueueIncludes(cdp, "Completed");

    return { durationMs: Date.now() - startedAt };
  } finally {
    await cdp.close();
    await closeTarget(browserPort, target.id).catch(() => {});
  }
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
      console.error(`[queue-executor-smoke] Vite exited with code ${code}.`);
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

    const found = await commandExists(candidate);
    if (found) {
      return candidate;
    }
  }

  throw new Error(
    "No Chrome/Edge browser executable was found. Set HOBIT_SMOKE_BROWSER or pass --browser <path>.",
  );
}

async function commandExists(command) {
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

async function closeTarget(browserPort, targetId) {
  await fetch(`http://127.0.0.1:${browserPort}/json/close/${targetId}`);
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
    const message = JSON.stringify({ id, method, params });
    this.socket.send(message);

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
      const labels = [...document.querySelectorAll("label")];
      const label = labels.find((candidate) => candidate.textContent.trim() === ${JSON.stringify(label)});
      if (!label || !label.htmlFor) {
        throw new Error("Field label not found: ${escapeForJs(label)}");
      }
      const field = document.getElementById(label.htmlFor);
      if (!field) {
        throw new Error("Field not found for label: ${escapeForJs(label)}");
      }
      const proto =
        field instanceof HTMLTextAreaElement
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

async function clickButton(cdp, text) {
  await evaluate(
    cdp,
    `(() => {
      const button = [...document.querySelectorAll("button")].find(
        (candidate) => candidate.textContent.trim() === ${JSON.stringify(text)} && !candidate.disabled
      );
      if (!button) {
        throw new Error("Enabled button not found: ${escapeForJs(text)}");
      }
      button.click();
    })()`,
  );
}

async function waitForEnabledButton(cdp, text) {
  await waitFor(
    cdp,
    `[...document.querySelectorAll("button")].some((button) => button.textContent.trim() === ${JSON.stringify(text)} && !button.disabled)`,
  );
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
    expression,
    returnByValue: true,
    userGesture: true,
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Browser evaluation failed.");
  }

  return result.result.value;
}

async function smokeSnapshot(cdp) {
  return evaluate(cdp, "window.__HOBIT_QUEUE_EXECUTOR_SMOKE__.snapshot()");
}

async function smokeField(cdp, field) {
  return evaluate(cdp, `window.__HOBIT_QUEUE_EXECUTOR_SMOKE__[${JSON.stringify(field)}]`);
}

async function assertDocumentIncludes(cdp, text) {
  const includes = await evaluate(
    cdp,
    `document.body.innerText.includes(${JSON.stringify(text)})`,
  );
  assert(includes, `Document did not include expected text: ${text}`);
}

async function assertQueueIncludes(cdp, text) {
  const queueText = await widgetText(cdp, "Agent Queue");
  assert(queueText.includes(text), `Agent Queue did not include expected text: ${text}`);
}

async function assertQueueExcludes(cdp, text) {
  const queueText = await widgetText(cdp, "Agent Queue");
  assert(!queueText.includes(text), `Agent Queue unexpectedly included text: ${text}`);
}

async function widgetText(cdp, title) {
  return evaluate(
    cdp,
    `(() => {
      const heading = [...document.querySelectorAll(".widget-title")].find(
        (candidate) => candidate.textContent.trim() === ${JSON.stringify(title)}
      );
      const frame = heading?.closest(".widget-frame");
      return frame?.textContent ?? "";
    })()`,
  );
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

async function freePort() {
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
