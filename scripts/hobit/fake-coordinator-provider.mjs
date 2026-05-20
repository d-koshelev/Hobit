#!/usr/bin/env node
import http from "node:http";
import { pathToFileURL } from "node:url";

export const COORDINATOR_PROVIDER_SCENARIOS = [
  "text",
  "queue-draft",
  "note-draft",
  "jdbc-draft",
  "provider-error",
  "invalid-json",
  "timeout",
  "oversized-response",
];

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8765;
const DEFAULT_DELAY_MS = 2500;
const MAX_FAKE_REQUEST_BYTES = 1024 * 1024;
const OVERSIZED_RESPONSE_BYTES = 600 * 1024;

export function createFakeCoordinatorProviderServer(options = {}) {
  const defaultScenario = options.scenario ?? "text";
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const forbiddenSecrets =
    options.forbiddenSecrets ?? [process.env.HOBIT_COORDINATOR_PROVIDER_API_KEY].filter(Boolean);

  return http.createServer(async (request, response) => {
    try {
      await handleProviderRequest({
        defaultScenario,
        delayMs,
        forbiddenSecrets,
        request,
        response,
      });
    } catch (error) {
      safeJson(response, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

async function handleProviderRequest({
  defaultScenario,
  delayMs,
  forbiddenSecrets,
  request,
  response,
}) {
  if (request.method !== "POST") {
    safeJson(response, 405, { error: "Use POST for Coordinator provider smoke." });
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? DEFAULT_HOST}`);
  const scenario = scenarioFromUrl(url, defaultScenario);

  if (!COORDINATOR_PROVIDER_SCENARIOS.includes(scenario)) {
    safeJson(response, 400, { error: `Unknown fake provider scenario: ${scenario}` });
    return;
  }

  const rawBody = await readRequestBody(request);
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    safeJson(response, 400, { error: "Request body was not valid JSON." });
    return;
  }

  const violations = requestBoundaryViolations(payload, rawBody, forbiddenSecrets);
  if (violations.length > 0) {
    safeJson(response, 400, {
      assistant_text: "Fake provider rejected an unsafe Hobit request.",
      violations,
    });
    return;
  }

  if (scenario === "provider-error") {
    safeJson(response, 503, { error: "Deterministic fake provider error." });
    return;
  }

  if (scenario === "invalid-json") {
    text(response, 200, "not json");
    return;
  }

  if (scenario === "timeout") {
    await delay(delayMs);
  }

  if (scenario === "oversized-response") {
    text(response, 200, "x".repeat(OVERSIZED_RESPONSE_BYTES));
    return;
  }

  safeJson(response, 200, fakeProviderResponse(scenario, payload));
}

function scenarioFromUrl(url, fallback) {
  return (
    url.searchParams.get("scenario") ??
    process.env.HOBIT_FAKE_COORDINATOR_PROVIDER_SCENARIO ??
    fallback
  );
}

async function readRequestBody(request) {
  let body = "";

  for await (const chunk of request) {
    body += chunk.toString("utf8");
    if (Buffer.byteLength(body, "utf8") > MAX_FAKE_REQUEST_BYTES) {
      throw new Error("Fake provider request exceeded local smoke limit.");
    }
  }

  return body;
}

function requestBoundaryViolations(payload, rawBody, forbiddenSecrets) {
  const violations = [];

  if (!Array.isArray(payload.allowed_tools) || payload.allowed_tools.length !== 0) {
    violations.push("allowed_tools must be an empty array.");
  }

  if (!Array.isArray(payload.visible_conversation)) {
    violations.push("visible_conversation must be present.");
  }

  for (const secret of forbiddenSecrets) {
    if (secret && rawBody.includes(secret)) {
      violations.push("provider credential leaked into the JSON request body.");
    }
  }

  for (const hiddenKey of [
    "workspace_id",
    "workbench_id",
    "widget_instance_id",
    "terminal_output",
    "agent_executor_logs",
    "git_status",
    "git_diff",
    "jdbc_metadata",
    "jdbc_results",
    "notes_body",
    "filesystem",
    "environment_variables",
    "provider_api_key",
  ]) {
    if (rawBody.includes(`"${hiddenKey}"`)) {
      violations.push(`hidden context key was present: ${hiddenKey}`);
    }
  }

  return violations;
}

function fakeProviderResponse(scenario, payload) {
  const prefix = `Fake Coordinator provider response for request ${payload.request_id}.`;

  if (scenario === "queue-draft") {
    return {
      assistant_text: `${prefix} Drafted a Queue task proposal only; no action ran.`,
      proposal_drafts: [queueDraft()],
    };
  }

  if (scenario === "note-draft") {
    return {
      assistant_text: `${prefix} Drafted a Note proposal only; no action ran.`,
      proposal_drafts: [noteDraft()],
    };
  }

  if (scenario === "jdbc-draft") {
    return {
      assistant_text: `${prefix} Drafted a non-executing JDBC SQL suggestion only.`,
      proposal_drafts: [jdbcDraft()],
    };
  }

  return {
    assistant_text: `${prefix} Text-only response. allowed_tools was empty and no hidden context was used.`,
    proposal_drafts: [],
  };
}

function queueDraft() {
  return {
    proposal_type: "create-agent-queue-task",
    title: "Investigate visible provider smoke task",
    target_widget: "Agent Queue",
    target_capability: "create Queue task",
    intent: "Create a draft Queue task from explicit visible chat text.",
    visible_inputs: [
      { label: "Title", value: "Investigate visible provider smoke task" },
      { label: "Description", value: "Created by fake provider smoke only." },
      { label: "Prompt", value: "Use only visible Coordinator chat text." },
      { label: "Priority", value: "2" },
    ],
    risk_notes: ["Draft Queue task only; no assignment, dispatch, or run."],
    expected_result: "A review card can create a draft task after explicit approval.",
  };
}

function noteDraft() {
  return {
    proposal_type: "create-note",
    title: "Provider smoke note",
    target_widget: "Notes",
    target_capability: "create Note",
    intent: "Create a workspace-local Note from visible provider smoke text.",
    visible_inputs: [
      { label: "Title", value: "Provider smoke note" },
      { label: "Body", value: "This note draft came from the local fake provider." },
      { label: "Pinned", value: "false" },
    ],
    risk_notes: ["Writes a new Note only after explicit approval and Create Note."],
    expected_result: "A review card can create a Note after explicit approval.",
  };
}

function jdbcDraft() {
  return {
    proposal_type: "prepare-jdbc-query-suggestion",
    title: "Count visible rows",
    target_widget: "Database / JDBC",
    target_capability: "prepare query suggestion",
    intent: "Prepare a non-executing SQL suggestion from visible chat text.",
    visible_inputs: [
      { label: "Question", value: "Count visible smoke rows." },
      { label: "Suggested SQL text", value: "select count(*) from smoke_table;" },
    ],
    risk_notes: ["Suggestion only; no connector access, SQL execution, or EXPLAIN."],
    expected_result: "SQL text can be reviewed or copied without execution.",
  };
}

function safeJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

function text(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
  });
  response.end(body);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(args) {
  const options = {
    delayMs: DEFAULT_DELAY_MS,
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    scenario: "text",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--host") {
      options.host = args[++index] ?? options.host;
    } else if (arg === "--port") {
      options.port = Number.parseInt(args[++index] ?? "", 10);
    } else if (arg === "--scenario") {
      options.scenario = args[++index] ?? options.scenario;
    } else if (arg === "--delay-ms") {
      options.delayMs = Number.parseInt(args[++index] ?? "", 10);
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument "${arg}". Use --help.`);
    }
  }

  if (!Number.isInteger(options.port) || options.port <= 0) {
    throw new Error("Port must be a positive integer.");
  }
  if (!Number.isInteger(options.delayMs) || options.delayMs < 0) {
    throw new Error("Delay must be a non-negative integer.");
  }
  if (!COORDINATOR_PROVIDER_SCENARIOS.includes(options.scenario)) {
    throw new Error(`Unsupported scenario "${options.scenario}".`);
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/hobit/fake-coordinator-provider.mjs [options]

Options:
  --host <host>          Listen host. Default: ${DEFAULT_HOST}
  --port <port>          Listen port. Default: ${DEFAULT_PORT}
  --scenario <scenario>  Default scenario. Query ?scenario=... overrides it.
  --delay-ms <ms>        Delay for timeout scenario. Default: ${DEFAULT_DELAY_MS}
  --help                 Show this help.

Scenarios:
  ${COORDINATOR_PROVIDER_SCENARIOS.join(", ")}

This is a local deterministic smoke provider for Hobit's hobit-http-json
Coordinator provider contract. It is not a production LLM provider.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const server = createFakeCoordinatorProviderServer(options);

  await new Promise((resolve) => server.listen(options.port, options.host, resolve));
  console.log(
    `[fake-coordinator-provider] listening at http://${options.host}:${options.port}/coordinator-provider`,
  );
  console.log(`[fake-coordinator-provider] default scenario: ${options.scenario}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[fake-coordinator-provider] ${error.message}`);
    process.exitCode = 2;
  });
}
