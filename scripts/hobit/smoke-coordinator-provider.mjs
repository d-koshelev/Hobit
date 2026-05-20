#!/usr/bin/env node
import { spawn } from "node:child_process";
import net from "node:net";

import {
  COORDINATOR_PROVIDER_SCENARIOS,
  createFakeCoordinatorProviderServer,
} from "./fake-coordinator-provider.mjs";

const DEFAULT_SCENARIOS = [
  "text",
  "queue-draft",
  "note-draft",
  "jdbc-draft",
  "provider-error",
  "invalid-json",
  "timeout",
  "oversized-response",
];

const SMOKE_TEST_FILTER = "coordinator_provider_configured_http_smoke_from_env";
const SMOKE_SECRET = "sk-hobit-fake-provider-smoke-secret";

main().catch((error) => {
  console.error(`[coordinator-provider-smoke] ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const port = await freePort();
  const server = createFakeCoordinatorProviderServer({
    delayMs: options.delayMs,
    forbiddenSecrets: [SMOKE_SECRET],
    scenario: "text",
  });

  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  console.log(
    `[coordinator-provider-smoke] fake provider: http://127.0.0.1:${port}/coordinator-provider`,
  );

  const startedAt = Date.now();
  try {
    for (const scenario of options.scenarios) {
      const timeoutMs = scenario === "timeout" ? 1000 : options.providerTimeoutMs;
      const endpoint = `http://127.0.0.1:${port}/coordinator-provider?scenario=${encodeURIComponent(
        scenario,
      )}`;
      await runSmokeScenario({ endpoint, scenario, timeoutMs });
    }

    console.log(
      `[coordinator-provider-smoke] all scenarios passed in ${Date.now() - startedAt}ms`,
    );
  } finally {
    await closeServer(server);
  }
}

function parseArgs(args) {
  const options = {
    delayMs: 2500,
    providerTimeoutMs: 5000,
    scenarios: DEFAULT_SCENARIOS,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--scenario") {
      const scenario = args[++index];
      if (!COORDINATOR_PROVIDER_SCENARIOS.includes(scenario)) {
        throw new Error(`Unsupported scenario "${scenario}".`);
      }
      options.scenarios = [scenario];
    } else if (arg === "--delay-ms") {
      options.delayMs = Number.parseInt(args[++index] ?? "", 10);
    } else if (arg === "--provider-timeout-ms") {
      options.providerTimeoutMs = Number.parseInt(args[++index] ?? "", 10);
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument "${arg}". Use --help.`);
    }
  }

  if (!Number.isInteger(options.delayMs) || options.delayMs < 0) {
    throw new Error("Delay must be a non-negative integer.");
  }
  if (!Number.isInteger(options.providerTimeoutMs) || options.providerTimeoutMs <= 0) {
    throw new Error("Provider timeout must be a positive integer.");
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/hobit/smoke-coordinator-provider.mjs [options]

Options:
  --scenario <scenario>          Run one scenario.
  --delay-ms <ms>                Fake provider delay for timeout scenario.
  --provider-timeout-ms <ms>     Hobit provider timeout for non-timeout scenarios.
  --help                         Show this help.

Scenarios:
  ${DEFAULT_SCENARIOS.join(", ")}

The smoke starts the local fake hobit-http-json provider and runs the real
desktop backend configured-provider command test against it. The provider
request is checked for allowed_tools: [] and absence of hidden context. Provider
drafts are validated by the backend before they can become Coordinator review
cards.`);
}

async function runSmokeScenario({ endpoint, scenario, timeoutMs }) {
  const startedAt = Date.now();
  const env = {
    ...process.env,
    HOBIT_COORDINATOR_PROVIDER: "external",
    HOBIT_COORDINATOR_PROVIDER_API_KEY: SMOKE_SECRET,
    HOBIT_COORDINATOR_PROVIDER_ENDPOINT: endpoint,
    HOBIT_COORDINATOR_PROVIDER_KIND: "hobit-http-json",
    HOBIT_COORDINATOR_PROVIDER_SMOKE_SCENARIO: scenario,
    HOBIT_COORDINATOR_PROVIDER_TIMEOUT_MS: String(timeoutMs),
  };
  const result = await runCommand(
    process.env.CARGO ?? "cargo",
    ["test", "-p", "hobit-desktop", SMOKE_TEST_FILTER, "--", "--nocapture"],
    { env },
  );

  if (result.code !== 0) {
    throw new Error(
      `${scenario}: cargo smoke test failed with exit code ${result.code}.\n${result.output}`,
    );
  }

  console.log(
    `[coordinator-provider-smoke] ${scenario}: passed in ${Date.now() - startedAt}ms`,
  );
}

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "";

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      resolve({ code: code ?? 1, output });
    });
  });
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

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}
