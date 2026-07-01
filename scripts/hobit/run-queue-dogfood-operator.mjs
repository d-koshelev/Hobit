#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const DEFAULT_PACK_PATH =
  "docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json";
const DEFAULT_ENDPOINT_FILE_NAME = "dogfood-operator-endpoint.json";
const DEFAULT_REPORT_PATH = "docs/dogfood/reports/queue-dogfood-run-010.md";
const ENDPOINT_NOT_RUNNING =
  "Hobit app-owned dogfood operator endpoint is not running.";
const AUTH_HEADER = "x-hobit-dogfood-token";
const DIRECT_DIAGNOSTIC_REQUIRED =
  "Direct database diagnostic mode requires --direct-database-diagnostic and --database.";
const ENDPOINT_WAIT_TIMEOUT_MS = 120_000;
const ENDPOINT_WAIT_INTERVAL_MS = 750;

const args = process.argv.slice(2);

process.exitCode = await main(args);

async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    printHelp();
    return 2;
  }

  if (options.help) {
    printHelp();
    return 0;
  }

  const repoRoot = findRepoRoot(process.cwd());

  if (options.directDatabaseDiagnostic) {
    return runDirectDatabaseDiagnostic(repoRoot, argv, options);
  }

  if (usesDiagnosticDatabaseFlags(options)) {
    console.error(`ERROR: ${DIRECT_DIAGNOSTIC_REQUIRED}`);
    return 2;
  }

  try {
    const result = await runEndpointOperation(options, repoRoot);
    if (options.reportPath) {
      writeReport(repoRoot, options.reportPath, {
        argv,
        packPath: options.packPath ?? DEFAULT_PACK_PATH,
        evidence: result,
      });
    }
    printResult(result, options);
    return 0;
  } catch (error) {
    if (options.reportPath) {
      writeReport(repoRoot, options.reportPath, {
        argv,
        packPath: options.packPath ?? DEFAULT_PACK_PATH,
        error,
      });
    }
    console.error(`ERROR: ${error.message}`);
    return error.exitCode ?? 2;
  }
}

function parseArgs(argv) {
  const options = {
    help: false,
    json: false,
    packPath: null,
    preview: false,
    materialize: false,
    dogfoodPlan: false,
    resumeDogfood: false,
    recoverStaleDogfoodRun: false,
    startPackTaskId: null,
    retryPackTaskId: null,
    allowRealWorker: false,
    reportPath: null,
    operatorHealth: false,
    operatorEndpointInfo: false,
    providerReadinessProviderId: null,
    providerAuthContextProviderId: null,
    allowUnknownProviderReadiness: false,
    runDetail: false,
    runLinkId: null,
    queueTaskId: null,
    launchAppIfNeeded: false,
    noLaunchApp: false,
    directDatabaseDiagnostic: false,
    database: null,
    workspaceId: null,
    workspaceRoot: null,
    listWorkspaces: false,
    resolveWorkspace: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--pack":
        options.packPath = requiredArg(argv, ++index, "--pack");
        break;
      case "--preview":
        options.preview = true;
        break;
      case "--materialize":
        options.materialize = true;
        break;
      case "--dogfood-plan":
        options.dogfoodPlan = true;
        break;
      case "--resume-dogfood":
        options.resumeDogfood = true;
        break;
      case "--recover-stale-dogfood-run":
        options.recoverStaleDogfoodRun = true;
        break;
      case "--start-pack-task":
        options.startPackTaskId = requiredArg(argv, ++index, "--start-pack-task");
        break;
      case "--retry-pack-task":
        options.retryPackTaskId = requiredArg(argv, ++index, "--retry-pack-task");
        break;
      case "--allow-real-worker":
        options.allowRealWorker = true;
        break;
      case "--report":
        options.reportPath = requiredArg(argv, ++index, "--report");
        break;
      case "--operator-health":
        options.operatorHealth = true;
        break;
      case "--operator-endpoint-info":
        options.operatorEndpointInfo = true;
        break;
      case "--provider-readiness":
        options.providerReadinessProviderId = requiredArg(argv, ++index, "--provider-readiness");
        break;
      case "--codex-readiness":
        options.providerReadinessProviderId = "codex";
        break;
      case "--provider-auth-context":
        options.providerAuthContextProviderId = requiredArg(argv, ++index, "--provider-auth-context");
        break;
      case "--codex-auth-context":
        options.providerAuthContextProviderId = "codex";
        break;
      case "--allow-unknown-provider-readiness":
        options.allowUnknownProviderReadiness = true;
        break;
      case "--run-detail":
      case "--status":
        options.runDetail = true;
        break;
      case "--run-link-id":
        options.runLinkId = requiredArg(argv, ++index, "--run-link-id");
        break;
      case "--queue-task-id":
        options.queueTaskId = requiredArg(argv, ++index, "--queue-task-id");
        break;
      case "--launch-app-if-needed":
        options.launchAppIfNeeded = true;
        break;
      case "--no-launch-app":
        options.noLaunchApp = true;
        break;
      case "--direct-database-diagnostic":
        options.directDatabaseDiagnostic = true;
        break;
      case "--database":
        options.database = requiredArg(argv, ++index, "--database");
        break;
      case "--workspace-id":
        options.workspaceId = requiredArg(argv, ++index, "--workspace-id");
        break;
      case "--workspace-root":
        options.workspaceRoot = requiredArg(argv, ++index, "--workspace-root");
        break;
      case "--list-workspaces":
        options.listWorkspaces = true;
        break;
      case "--resolve-workspace":
        options.resolveWorkspace = true;
        break;
      default:
        throw new Error(`unexpected argument: ${arg}`);
    }
  }

  validateOptions(options);
  return options;
}

function validateOptions(options) {
  const infoOperations =
    Number(options.operatorHealth) +
    Number(options.operatorEndpointInfo) +
    Number(Boolean(options.providerReadinessProviderId)) +
    Number(Boolean(options.providerAuthContextProviderId)) +
    Number(options.runDetail);
  const packOperations =
    Number(options.preview) +
    Number(options.materialize) +
    Number(options.dogfoodPlan) +
    Number(options.resumeDogfood) +
    Number(options.recoverStaleDogfoodRun) +
    Number(Boolean(options.startPackTaskId)) +
    Number(Boolean(options.retryPackTaskId));
  if (infoOperations > 1) {
    throw new Error("choose only one of --operator-health, --operator-endpoint-info, --provider-readiness, --provider-auth-context, or --run-detail");
  }
  if (infoOperations > 0 && packOperations > 0) {
    throw new Error("operator diagnostics cannot be combined with pack operations");
  }
  if (options.launchAppIfNeeded && options.noLaunchApp) {
    throw new Error("choose only one of --launch-app-if-needed or --no-launch-app");
  }
  if (
    options.providerReadinessProviderId &&
    options.providerReadinessProviderId.trim() !== "codex"
  ) {
    throw new Error("only --provider-readiness codex is supported");
  }
  if (
    options.providerAuthContextProviderId &&
    options.providerAuthContextProviderId.trim() !== "codex"
  ) {
    throw new Error("only --provider-auth-context codex is supported");
  }
  if (options.startPackTaskId && !options.materialize) {
    throw new Error("materialization is required before selected task start");
  }
  if (options.startPackTaskId && options.retryPackTaskId) {
    throw new Error("choose only one of --start-pack-task or --retry-pack-task");
  }
  if ((options.startPackTaskId || options.retryPackTaskId) && !options.allowRealWorker) {
    throw new Error("refusing to start a real queue_local worker without --allow-real-worker");
  }
  if ((options.runLinkId || options.queueTaskId) && !options.runDetail && !options.recoverStaleDogfoodRun) {
    throw new Error("--run-link-id and --queue-task-id require --run-detail");
  }
  if (
    options.allowUnknownProviderReadiness &&
    !options.startPackTaskId &&
    !options.retryPackTaskId &&
    !options.resumeDogfood &&
    !options.dogfoodPlan &&
    !options.recoverStaleDogfoodRun
  ) {
    throw new Error("--allow-unknown-provider-readiness applies only to selected task start/retry/resume/plan/recovery");
  }
  if (options.runDetail && Boolean(options.runLinkId) === Boolean(options.queueTaskId)) {
    throw new Error("--run-detail requires exactly one of --run-link-id or --queue-task-id");
  }
  if (
    !options.help &&
    !options.operatorHealth &&
    !options.operatorEndpointInfo &&
    !options.providerReadinessProviderId &&
    !options.providerAuthContextProviderId &&
    !options.runDetail &&
    !options.listWorkspaces &&
    !options.resolveWorkspace &&
            !options.preview &&
            !options.materialize &&
            !options.dogfoodPlan &&
            !options.resumeDogfood &&
            !options.recoverStaleDogfoodRun &&
            !options.startPackTaskId &&
            !options.retryPackTaskId
  ) {
    throw new Error("choose --operator-health, --provider-readiness, --provider-auth-context, --run-detail, --dogfood-plan, --preview, --materialize, --resume-dogfood, --recover-stale-dogfood-run, --start-pack-task, or --retry-pack-task");
  }
  if (options.resumeDogfood && !options.allowRealWorker) {
    throw new Error("refusing to resume dogfood without --allow-real-worker");
  }
  if (options.resumeDogfood && (options.preview || options.materialize || options.dogfoodPlan || options.startPackTaskId || options.retryPackTaskId)) {
    throw new Error("--resume-dogfood cannot be combined with preview/materialize/plan/start/retry operations");
  }
  if (options.recoverStaleDogfoodRun && !options.resumeDogfood && !options.runLinkId) {
    throw new Error("--recover-stale-dogfood-run requires --run-link-id unless combined with --resume-dogfood");
  }
  if (options.recoverStaleDogfoodRun && (options.preview || options.materialize || options.dogfoodPlan || options.startPackTaskId || options.retryPackTaskId)) {
    throw new Error("--recover-stale-dogfood-run cannot be combined with preview/materialize/plan/start/retry operations");
  }
}

async function runEndpointOperation(options, repoRoot) {
  const session = await attachOrLaunchEndpoint(options, repoRoot);

  if (options.operatorHealth) {
    const health = await callEndpoint(session.endpoint, "GET", "/health", null);
    return annotateOperatorResult(health, session);
  }
  if (options.operatorEndpointInfo) {
    const endpointInfo = await callEndpoint(session.endpoint, "GET", "/endpoint-info", null);
    return annotateOperatorResult(endpointInfo, session);
  }
  if (options.providerReadinessProviderId) {
    const readiness = await callEndpoint(session.endpoint, "POST", "/provider_readiness", {
      providerId: options.providerReadinessProviderId,
    });
    return annotateOperatorResult(readiness, session);
  }
  if (options.providerAuthContextProviderId) {
    const authContext = await callEndpoint(session.endpoint, "POST", "/provider_auth_context", {
      providerId: options.providerAuthContextProviderId,
      operatorEnvironmentSummary: operatorEnvironmentSummary(),
    });
    return annotateOperatorResult(authContext, session);
  }
  if (options.runDetail) {
    const runDetail = await callEndpoint(session.endpoint, "POST", "/run_detail", {
      runLinkId: options.runLinkId,
      queueTaskId: options.queueTaskId,
    });
    return annotateOperatorResult(runDetail, session);
  }

  const packPath = options.packPath ?? DEFAULT_PACK_PATH;
  if (options.dogfoodPlan) {
    const evidence = await callEndpoint(session.endpoint, "POST", "/dogfood_plan", {
      packPath,
    });
    return annotateOperatorResult(evidence, session);
  }
  if (options.recoverStaleDogfoodRun && !options.resumeDogfood) {
    const evidence = await callEndpoint(session.endpoint, "POST", "/recover_stale_dogfood_run", {
      packPath,
      runLinkId: options.runLinkId,
      allowUnknownProviderReadiness: options.allowUnknownProviderReadiness,
    });
    return annotateOperatorResult(evidence, session);
  }
  if (options.resumeDogfood) {
    const health = await callEndpoint(session.endpoint, "GET", "/health", null);
    const readiness = await callEndpoint(session.endpoint, "POST", "/provider_readiness", {
      providerId: "codex",
    });
    const evidence = await callEndpoint(
      session.endpoint,
      "POST",
      "/resume_dogfood",
      {
        packPath,
        allowRealWorker: options.allowRealWorker,
        allowUnknownProviderReadiness: options.allowUnknownProviderReadiness,
        recoverStaleDogfoodRun: options.recoverStaleDogfoodRun,
        runLinkId: options.runLinkId,
      },
      { timeoutMs: 30 * 60 * 1000 },
    );
    evidence.operatorHealth = health;
    evidence.providerReadinessPreflight = readiness.providerReadiness;
    if (!evidence.providerReadiness) {
      evidence.providerReadiness = readiness.providerReadiness;
    }
    return annotateOperatorResult(evidence, session);
  }
  if (options.retryPackTaskId) {
    const evidence = await callEndpoint(
      session.endpoint,
      "POST",
      "/retry_pack_task",
      {
        packPath,
        packTaskId: options.retryPackTaskId,
        allowRealWorker: options.allowRealWorker,
        allowUnknownProviderReadiness: options.allowUnknownProviderReadiness,
      },
      { timeoutMs: 30 * 60 * 1000 },
    );
    return annotateOperatorResult(evidence, session);
  }
  if (options.startPackTaskId) {
    const evidence = await callEndpoint(
      session.endpoint,
      "POST",
      "/start_pack_task",
      {
        packPath,
        packTaskId: options.startPackTaskId,
        allowRealWorker: options.allowRealWorker,
        allowUnknownProviderReadiness: options.allowUnknownProviderReadiness,
      },
      { timeoutMs: 30 * 60 * 1000 },
    );
    return annotateOperatorResult(evidence, session);
  }
  if (options.materialize) {
    const evidence = await callEndpoint(session.endpoint, "POST", "/materialize_prompt_pack_file", {
      packPath,
    });
    if (options.preview) {
      const previewEvidence = await callEndpoint(session.endpoint, "POST", "/preview_prompt_pack_file", {
        packPath,
      });
      evidence.preview = previewEvidence.preview;
    }
    return annotateOperatorResult(evidence, session);
  }
  const evidence = await callEndpoint(session.endpoint, "POST", "/preview_prompt_pack_file", {
    packPath,
  });
  return annotateOperatorResult(evidence, session);
}

async function attachOrLaunchEndpoint(options, repoRoot) {
  const workspaceRoot = repoRoot;
  cleanupLegacyRepoLocalEndpointFile(repoRoot);
  const endpointFiles = endpointFileCandidates(repoRoot);
  const launchAllowed = !options.noLaunchApp;
  let lastAttachError = null;

  for (const endpointFile of endpointFiles) {
    try {
      const endpoint = readEndpointRendezvous(endpointFile);
      const ensure = await ensureWorkspaceForRoot(endpoint, workspaceRoot);
      return endpointSession(endpoint, ensure, {
        appLaunchAttempted: false,
        appLaunchCommandSummary: null,
        launchLogPath: null,
        contextSource: "running_app_endpoint",
      });
    } catch (error) {
      lastAttachError = error;
    }
  }

  if (!launchAllowed) {
    throw endpointUnavailable(lastAttachError?.message);
  }

  const launch = launchApp(repoRoot);
  const endpoint = await waitForEndpoint(defaultEndpointFile(repoRoot), workspaceRoot, launch);
  return endpointSession(endpoint.endpoint, endpoint.ensure, {
    appLaunchAttempted: true,
    appLaunchCommandSummary: launch.commandSummary,
    launchLogPath: launch.logPath,
    contextSource: "launched_app_endpoint",
  });
}

function endpointSession(endpoint, ensure, launch) {
  return {
    endpoint,
    ensure,
    appLaunchAttempted: launch.appLaunchAttempted,
    appLaunchCommandSummary: launch.appLaunchCommandSummary,
    launchLogPath: launch.launchLogPath,
    contextSource: launch.contextSource,
  };
}

async function waitForEndpoint(endpointFile, workspaceRoot, launch) {
  const deadline = Date.now() + ENDPOINT_WAIT_TIMEOUT_MS;
  let lastError = null;
  while (Date.now() < deadline) {
    if (launch.exitCode !== null) {
      throw appLaunchFailed(launch, lastError);
    }
    try {
      const endpoint = readEndpointRendezvous(endpointFile);
      const ensure = await ensureWorkspaceForRoot(endpoint, workspaceRoot);
      return { endpoint, ensure };
    } catch (error) {
      lastError = error;
      await sleep(ENDPOINT_WAIT_INTERVAL_MS);
    }
  }
  throw appLaunchTimedOut(launch, lastError);
}

function ensureWorkspaceForRoot(endpoint, workspaceRoot) {
  return callEndpoint(endpoint, "POST", "/ensure_workspace_for_root", {
    workspaceRoot,
  });
}

function operatorEnvironmentSummary() {
  return [
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "OPENAI_ORG_ID",
    "OPENAI_ORGANIZATION",
    "OPENAI_PROJECT",
    "CODEX_HOME",
  ].map((name) => ({
    name,
    present: Boolean(process.env[name]),
  }));
}

function annotateOperatorResult(result, session) {
  const operatorContext = result.operatorContext ?? {};
  const ensureContext = session.ensure?.operatorContext ?? {};
  result.operatorContext = {
    ...operatorContext,
    contextSource: session.contextSource,
    usedDirectDatabasePath: false,
    endpointKind: operatorContext.endpointKind ?? ensureContext.endpointKind ?? session.endpoint.endpointKind,
    endpointPid: operatorContext.endpointPid ?? ensureContext.endpointPid ?? session.endpoint.processId,
    profileMode: operatorContext.profileMode ?? ensureContext.profileMode,
    appLaunchAttempted: session.appLaunchAttempted,
    appLaunchCommandSummary: session.appLaunchCommandSummary,
    workspaceId: operatorContext.workspaceId ?? ensureContext.workspaceId,
    workspaceResolutionMethod:
      operatorContext.workspaceResolutionMethod ?? ensureContext.workspaceResolutionMethod,
    workspaceRoot: operatorContext.workspaceRoot ?? ensureContext.workspaceRoot,
  };
  result.endpointAttach = {
    endpointKind: session.endpoint.endpointKind,
    endpointPid: session.endpoint.processId,
    endpointFile: session.endpoint.endpointFile,
    appLaunchAttempted: session.appLaunchAttempted,
    appLaunchCommandSummary: session.appLaunchCommandSummary,
    launchLogPath: session.launchLogPath,
  };
  return result;
}

function readEndpointRendezvous(endpointFile = defaultEndpointFile()) {
  let payload;
  try {
    payload = fs.readFileSync(endpointFile, "utf8");
  } catch {
    throw endpointUnavailable();
  }

  let endpoint;
  try {
    endpoint = JSON.parse(payload);
  } catch (error) {
    throw endpointUnavailable(`Invalid endpoint rendezvous file: ${error.message}`);
  }

  if (
    endpoint.endpointKind !== "loopback_http_json" ||
    endpoint.host !== "127.0.0.1" ||
    typeof endpoint.port !== "number" ||
    typeof endpoint.authToken !== "string" ||
    endpoint.authToken.length === 0
  ) {
    throw endpointUnavailable("Endpoint rendezvous file is invalid or stale.");
  }

  return {
    endpointKind: endpoint.endpointKind,
    host: endpoint.host,
    port: endpoint.port,
    authToken: endpoint.authToken,
    processId: endpoint.processId,
    endpointFile,
  };
}

function callEndpoint(endpoint, method, requestPath, body, options = {}) {
  const payload = body ? JSON.stringify(body) : "";
  const headers = {
    [AUTH_HEADER]: endpoint.authToken,
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  };
  const timeoutMs = options.timeoutMs ?? 10_000;

  return new Promise((resolve, reject) => {
    const requestOptions = {
      host: endpoint.host,
      port: endpoint.port,
      path: requestPath,
      method,
      headers,
    };
    if (timeoutMs !== null) {
      requestOptions.timeout = timeoutMs;
    }

    const request = http.request(
      requestOptions,
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let parsed;
          try {
            parsed = text ? JSON.parse(text) : {};
          } catch (error) {
            reject(endpointUnavailable(`Endpoint returned invalid JSON: ${error.message}`));
            return;
          }
          if ((response.statusCode ?? 500) >= 400) {
            const message = parsed?.error?.message ?? `endpoint returned ${response.statusCode}`;
            const failure = new Error(message);
            failure.exitCode = 2;
            failure.endpointResponse = parsed;
            reject(failure);
            return;
          }
          resolve(parsed);
        });
      },
    );

    if (timeoutMs !== null) {
      request.on("timeout", () => {
        request.destroy(endpointUnavailable("Endpoint request timed out."));
      });
    }
    request.on("error", (error) => {
      reject(endpointUnavailable(error.message));
    });
    request.write(payload);
    request.end();
  });
}

function launchApp(repoRoot) {
  if (process.env.HOBIT_DOGFOOD_OPERATOR_MOCK_LAUNCH) {
    return {
      commandSummary: "mocked app launch",
      logPath: null,
      exitCode: null,
      stdoutSummary: "",
      stderrSummary: "",
    };
  }

  const command = appLaunchCommand(repoRoot);
  const logDir = path.join(repoRoot, "target", "hobit-dogfood", "operator-launch");
  fs.mkdirSync(logDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(logDir, `hobit-desktop-${process.pid}-${stamp}.log`);

  const logFd = fs.openSync(logPath, "a");
  let child;
  const env = dogfoodLaunchEnvironment(repoRoot, command);
  if (process.platform === "win32") {
    child = spawn("cmd.exe", ["/D", "/C", command.program, ...command.args], {
      cwd: command.cwd,
      env,
      detached: true,
      shell: false,
      stdio: ["ignore", logFd, logFd],
      windowsHide: true,
    });
  } else {
    child = spawn(command.program, command.args, {
      cwd: command.cwd,
      env,
      detached: true,
      shell: false,
      stdio: ["ignore", logFd, logFd],
      windowsHide: true,
    });
  }

  const launch = {
    commandSummary: command.summary,
    logPath,
    exitCode: null,
    stdoutSummary: "",
    stderrSummary: "",
  };
  child.on("exit", (code, signal) => {
    launch.exitCode = code ?? 1;
    launch.stderrSummary = signal ? `stopped by signal ${signal}` : "";
    closeLaunchLog(logFd);
  });
  child.on("error", (error) => {
    launch.exitCode = 2;
    launch.stderrSummary = error.message;
    closeLaunchLog(logFd);
  });
  child.unref();
  return launch;
}

function closeLaunchLog(logFd) {
  try {
    fs.closeSync(logFd);
  } catch {
    // Best effort: the log handle may already be closed during process teardown.
  }
}

function appLaunchCommand(repoRoot) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const configPath = dogfoodTauriConfigPath(repoRoot);
  const cargoTargetDir = path.join(repoRoot, "target", "hobit-dogfood", "cargo-target");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ build: { beforeDevCommand: null } }, null, 2));
  const args = [
    "run",
    "tauri:dev",
    "--prefix",
    "apps/desktop/frontend",
    "--",
    "--config",
    configPath,
    "--no-dev-server-wait",
  ];
  const summary = `${npm} ${args.join(" ")}`;
  return {
    program: npm,
    args,
    cwd: repoRoot,
    summary,
    cargoTargetDir,
  };
}

function dogfoodLaunchEnvironment(repoRoot, command) {
  return {
    ...process.env,
    CARGO_TARGET_DIR: command.cargoTargetDir,
    HOBIT_DOGFOOD_OPERATOR_ENDPOINT: "1",
    HOBIT_DOGFOOD_OPERATOR_ENDPOINT_FILE: defaultEndpointFile(repoRoot),
    HOBIT_DOGFOOD_PROFILE: "1",
    HOBIT_DOGFOOD_PROFILE_DIR: dogfoodProfileDataDir(repoRoot),
    HOBIT_DOGFOOD_WORKSPACE_ROOT: repoRoot,
  };
}

function dogfoodTauriConfigPath(repoRoot) {
  return path.join(
    repoRoot,
    "target",
    "hobit-dogfood",
    "operator-launch",
    "tauri-dogfood-operator.json",
  );
}

function appLaunchFailed(launch, lastError) {
  const details = [
    "Hobit Desktop launch exited before the dogfood endpoint became available.",
    `Command: ${launch.commandSummary}`,
    `Exit code: ${launch.exitCode}`,
    launch.logPath ? `Log: ${launch.logPath}` : null,
    launch.stderrSummary ? `stderr: ${launch.stderrSummary}` : null,
    lastError ? `Last endpoint error: ${lastError.message}` : null,
    launch.logPath ? `Log tail: ${readTextTail(launch.logPath)}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const error = new Error(details);
  error.exitCode = 2;
  return error;
}

function appLaunchTimedOut(launch, lastError) {
  const details = [
    "Timed out waiting for Hobit app-owned dogfood operator endpoint.",
    `Command: ${launch.commandSummary}`,
    launch.logPath ? `Log: ${launch.logPath}` : null,
    lastError ? `Last endpoint error: ${lastError.message}` : null,
    launch.logPath ? `Log tail: ${readTextTail(launch.logPath)}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const error = new Error(details);
  error.exitCode = 2;
  return error;
}

function runDirectDatabaseDiagnostic(repoRoot, argv, options) {
  if (!options.database) {
    console.error(`ERROR: ${DIRECT_DIAGNOSTIC_REQUIRED}`);
    return 2;
  }
  const cargo = process.platform === "win32" ? "cargo.exe" : "cargo";
  const helperArgs = argv.filter((arg) => arg !== "--direct-database-diagnostic");
  const cargoArgs = [
    "run",
    "-p",
    "hobit-desktop",
    "--bin",
    "queue-dogfood-operator",
    "--",
    ...helperArgs,
  ];
  const result = spawnSync(cargo, cargoArgs, {
    cwd: repoRoot,
    env: process.env,
    shell: false,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(`ERROR: failed to start cargo diagnostic helper: ${result.error.message}`);
    return 2;
  }
  return result.status ?? 1;
}

function usesDiagnosticDatabaseFlags(options) {
  return Boolean(
    options.database ||
      options.workspaceId ||
      options.workspaceRoot ||
      options.listWorkspaces ||
      options.resolveWorkspace,
  );
}

function endpointUnavailable(detail) {
  const error = new Error(detail ? `${ENDPOINT_NOT_RUNNING} ${detail}` : ENDPOINT_NOT_RUNNING);
  error.exitCode = 2;
  return error;
}

function printResult(result, options) {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const context = result.operatorContext;
  if (context) {
    console.log(`operatorContext.contextSource: ${context.contextSource}`);
    console.log(`operatorContext.usedDirectDatabasePath: ${context.usedDirectDatabasePath}`);
    console.log(`operatorContext.workspaceId: ${context.workspaceId}`);
    console.log(`operatorContext.workspaceResolutionMethod: ${context.workspaceResolutionMethod}`);
    if (context.workspaceRoot) {
      console.log(`operatorContext.workspaceRoot: ${context.workspaceRoot}`);
    }
    if (context.profileMode) {
      console.log(`operatorContext.profileMode: ${context.profileMode}`);
    }
    if (context.endpointKind) {
      console.log(`operatorContext.endpointKind: ${context.endpointKind}`);
    }
    if (context.endpointPid) {
      console.log(`operatorContext.endpointPid: ${context.endpointPid}`);
    }
    console.log(`operatorContext.appLaunchAttempted: ${context.appLaunchAttempted}`);
    if (context.appLaunchCommandSummary) {
      console.log(`operatorContext.appLaunchCommandSummary: ${context.appLaunchCommandSummary}`);
    }
    if (result.providerReadiness) {
      console.log(`providerReadiness.providerId: ${result.providerReadiness.providerId}`);
      console.log(`providerReadiness.executionTarget: ${result.providerReadiness.executionTarget}`);
      console.log(`providerReadiness.status: ${result.providerReadiness.status}`);
      console.log(`providerReadiness.authStatus: ${result.providerReadiness.authStatus}`);
      console.log(`providerReadiness.blockers: ${(result.providerReadiness.blockers ?? []).join(", ") || "none"}`);
    }
    if (result.providerAuthContext) {
      console.log(`providerAuthContext.providerId: ${result.providerAuthContext.providerId}`);
      console.log(`providerAuthContext.status: ${result.providerAuthContext.status}`);
      console.log(
        `providerAuthContext.authSourceClassification: ${result.providerAuthContext.authSourceClassification}`,
      );
      console.log(
        `providerAuthContext.mismatchReasons: ${(result.providerAuthContext.mismatchReasons ?? []).join(", ") || "none"}`,
      );
    }
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

function writeReport(repoRoot, reportPath, { argv, packPath, evidence, error }) {
  const target = path.resolve(repoRoot, reportPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    renderReport({
      branch: gitBranch(repoRoot),
      command: `node scripts/hobit/run-queue-dogfood-operator.mjs ${argv.join(" ")}`,
      packPath,
      evidence,
      error,
    }),
  );
}

function renderReport({ branch, command, packPath, evidence, error }) {
  const plan = evidence?.dogfoodPlan ?? (evidence?.nextAction ? evidence : null);
  const context = evidence?.operatorContext ?? plan?.operatorContext ?? error?.endpointResponse?.operatorContext;
  const attach = evidence?.endpointAttach;
  const preview = evidence?.preview;
  const materialization = evidence?.materialization;
  const providerReadiness = evidence?.providerReadiness ?? plan?.providerReadiness ?? error?.endpointResponse?.providerReadiness;
  const providerAuthContext =
    evidence?.providerAuthContext ?? error?.endpointResponse?.providerAuthContext;
  const selected = evidence?.selectedTask;
  const resume = evidence?.resumeDogfood;
  const nextAction = resume?.nextAction ?? plan?.nextAction;
  const taskStates = plan?.taskStates ?? resume?.taskStatesBefore ?? [];
  const taskStatesAfter = resume?.taskStatesAfterAction ?? [];
  const completionSucceeded = selected?.completionStatus === "completed";
  const blocker =
    error?.message ??
    (nextAction?.kind === "start_task_blocked_by_provider" && providerReadiness?.status && providerReadiness.status !== "ready"
      ? `provider readiness ${providerReadiness.status}: ${(providerReadiness.blockers ?? []).join(", ") || "unknown"}`
      : null) ??
    (providerAuthContext?.authSourceClassification &&
    providerAuthContext.authSourceClassification !== "auth_source_ready"
      ? `provider auth source ${providerAuthContext.authSourceClassification}: ${(providerAuthContext.mismatchReasons ?? []).join(", ") || "no mismatch reason"}`
      : null) ??
    (selected?.completionStatus && !completionSucceeded
      ? `selected task terminalized as ${selected.completionStatus}`
      : "none");
  const mappings = materialization?.mappings ?? taskStates.map((state) => ({
    packTaskId: state.packTaskId,
    queueTaskId: state.queueTaskId,
    status: plan?.materializationStatus ?? "planned",
  }));
  const acceptedDependencies = resume?.acceptedDependencies ?? [];
  return `# ${resume ? "Queue Dogfood Resume" : plan ? "Queue Dogfood Plan" : "Queue Dogfood Run 010"}

## Run Summary

- Date: ${new Date().toISOString()}
- Branch: \`${branch}\`
- Pack path: \`${packPath}\`
- Pack id: \`${preview?.packId ?? materialization?.packId ?? plan?.packId ?? "not available"}\`
- Next action: \`${formatNextAction(nextAction)}\`
- Operator context source: \`${context?.contextSource ?? "not available"}\`
- Endpoint kind: \`${context?.endpointKind ?? attach?.endpointKind ?? "not available"}\`
- Endpoint pid: \`${context?.endpointPid ?? attach?.endpointPid ?? "not available"}\`
- Profile mode: \`${context?.profileMode ?? "not available"}\`
- App launch attempted: ${context?.appLaunchAttempted ?? false}
- App launch command: \`${context?.appLaunchCommandSummary ?? "not launched"}\`
- Used direct database path: ${context?.usedDirectDatabasePath ?? false}
- Workspace id: \`${context?.workspaceId ?? "not available"}\`
- Workspace method: \`${context?.workspaceResolutionMethod ?? "not available"}\`
- Workspace root: \`${context?.workspaceRoot ?? "not available"}\`
- Real dogfood run performed: ${evidence?.realDogfoodRunPerformed ?? false}
- Resume status: \`${resume?.status ?? "not applicable"}\`
- Started new worker count: ${resume?.startedNewWorkerCount ?? 0}
- Accepted/finalized dependencies: ${acceptedDependencies.length}
- Run link created: ${resume?.runLinkCreated ?? selected?.createdRunLink ?? false}
- Worker started: ${resume?.workerStarted ?? selected?.wouldStartWorkers ?? false}
- Dependent auto-started: ${resume?.dependentsAutoStarted ?? selected?.dependentTasksAutoStarted ?? false}
- Blocker: \`${blocker}\`

## Command

\`\`\`powershell
${command}
\`\`\`

## Endpoint Attach Or Launch

- endpoint file: \`${attach?.endpointFile ?? "not available"}\`
- launch log: \`${attach?.launchLogPath ?? "not available"}\`
- command summary: \`${attach?.appLaunchCommandSummary ?? "not launched"}\`

## Preview

- packSpecHash: \`${preview?.packSpecHash ?? materialization?.packSpecHash ?? plan?.packSpecHash ?? "not available"}\`
- runSettingsHash: \`${preview?.runSettingsHash ?? materialization?.runSettingsHash ?? plan?.runSettingsHash ?? "not available"}\`
- dependencySpecHash: \`${preview?.dependencySpecHash ?? materialization?.dependencySpecHash ?? plan?.dependencySpecHash ?? "not available"}\`
- fullPreviewHash: \`${preview?.fullPreviewHash ?? materialization?.fullPreviewHash ?? plan?.fullPreviewHash ?? "not available"}\`

## Dogfood Plan

- nextAction.kind: \`${nextAction?.kind ?? "not available"}\`
- nextAction.packTaskId: \`${nextAction?.packTaskId ?? "not available"}\`
- nextAction.queueTaskId: \`${nextAction?.queueTaskId ?? "not available"}\`
- nextAction.runLinkId: \`${nextAction?.runLinkId ?? "not available"}\`
- nextAction.retryFailed: ${nextAction?.retryFailed ?? false}
- materializationStatus: \`${plan?.materializationStatus ?? "not available"}\`
- active run links: \`${(plan?.activeRunLinkIds ?? resume?.activeRunLinkIds ?? []).join(", ") || "none"}\`
- stale candidates: \`${(plan?.staleCandidateRunLinkIds ?? resume?.staleCandidateRunLinkIds ?? []).join(", ") || "none"}\`
- blockers: \`${(plan?.blockers ?? []).join(", ") || "none"}\`
- warnings: \`${(plan?.warnings ?? []).join(", ") || "none"}\`

${formatTaskStateTable(taskStates)}

## Task States After Action

${formatTaskStateTable(taskStatesAfter)}

## Provider Readiness

- providerId: \`${providerReadiness?.providerId ?? "not available"}\`
- executionTarget: \`${providerReadiness?.executionTarget ?? "not available"}\`
- status: \`${providerReadiness?.status ?? "not available"}\`
- primary blocker: ${nextAction?.kind === "start_task_blocked_by_provider" ? "yes" : "no"}
- codexExecutableResolved: ${providerReadiness?.codexExecutableResolved ?? "not available"}
- codexExecutableSummary: \`${providerReadiness?.codexExecutableSummary ?? "not available"}\`
- codexVersion: \`${providerReadiness?.codexVersion ?? "not available"}\`
- authStatus: \`${providerReadiness?.authStatus ?? "not available"}\`
- authSourceSummary: \`${providerReadiness?.authSourceSummary ?? "not available"}\`
- readinessCheckMethod: \`${providerReadiness?.readinessCheckMethod ?? "not available"}\`
- blockers: \`${(providerReadiness?.blockers ?? []).join(", ") || "none"}\`
- warnings: \`${(providerReadiness?.warnings ?? []).join(", ") || "none"}\`
- secrets logged: no

## Provider Auth Context

- providerId: \`${providerAuthContext?.providerId ?? "not available"}\`
- status: \`${providerAuthContext?.status ?? "not available"}\`
- authSourceClassification: \`${providerAuthContext?.authSourceClassification ?? "not available"}\`
- mismatchReasons: \`${(providerAuthContext?.mismatchReasons ?? []).join(", ") || "none"}\`
- profileMode: \`${providerAuthContext?.profileMode ?? "not available"}\`
- usedDirectDatabasePath: ${providerAuthContext?.usedDirectDatabasePath ?? false}
- operator_process env presence: \`${formatEnvPresence(providerAuthContext?.contexts?.operatorProcess?.envPresence)}\`
- app_process env presence: \`${formatEnvPresence(providerAuthContext?.contexts?.appProcess?.envPresence)}\`
- worker_launch_context env presence: \`${formatEnvPresence(providerAuthContext?.contexts?.workerLaunchContext?.envPresence)}\`
- codex_doctor_context env presence: \`${formatEnvPresence(providerAuthContext?.contexts?.codexDoctorContext?.envPresence)}\`
- raw credential values inspected or logged: no

## Materialization

- status: \`${materialization?.materializationStatus ?? "not available"}\`
- created: ${materialization?.createdCount ?? "not available"}
- reused: ${materialization?.reusedCount ?? "not available"}
- conflicts: ${materialization?.conflictCount ?? "not available"}

${mappings.length > 0 ? mappings.map((mapping) => `- \`${mapping.packTaskId}\` -> \`${mapping.queueTaskId ?? "none"}\` (${mapping.status})`).join("\n") : "- mappings: not available"}

## Selected Task

- selected pack task id: \`${selected?.selectedPackTaskId ?? "not available"}\`
- selected Queue task id: \`${selected?.selectedQueueTaskId ?? "not available"}\`
- runLinkId: \`${selected?.runLinkId ?? "not available"}\`
- launch status: \`${selected?.launchStatus ?? "not available"}\`
- completion status: \`${selected?.completionStatus ?? "not available"}\`
- completion bridge terminalized run: ${Boolean(selected?.completionStatus)}
- dependent task auto-started: ${resume?.dependentsAutoStarted ?? selected?.dependentTasksAutoStarted ?? false}

## Stale Recovery

- recovery executed: ${Boolean(resume?.staleRecovery)}
- recovery runLinkId: \`${resume?.staleRecovery?.runLinkId ?? "not available"}\`
- recovery reason: \`${resume?.staleRecovery?.reason ?? "not available"}\`
- recovery created run link: ${resume?.staleRecovery?.createdRunLink ?? false}
- recovery worker started: ${resume?.staleRecovery?.workerStarted ?? false}

## Accepted Dependencies

${acceptedDependencies.length > 0 ? acceptedDependencies.map((dependency) => `- \`${dependency.packTaskId}\` -> \`${dependency.queueTaskId}\` (${dependency.status})`).join("\n") : "- none"}

## Boundary Checks

- frontend materializer canonical: no
- frontend lifecycle state: no
- widget_runs: no
- Agent Executor / Agent Queue widget identity: no
- scheduler/autodispatch: no
- automated tests launched real codex.cmd: no
- real codex.cmd invoked by explicit coordinator resume: ${selected?.realCodexInvoked ?? false}
- secrets logged: no
- raw credential values persisted: no

## Tests And Gates

- See final task report for validation commands run in this block.

## Next

- ${nextAction?.kind ? `Next planned action is ${nextAction.kind}.` : completionSucceeded ? "Resume invocation stopped after exactly one selected task." : "Smallest next unblock action: inspect provider readiness or selected task status before the next resume."}
`;
}

function formatNextAction(action) {
  if (!action) {
    return "not available";
  }
  const suffix = action.packTaskId ? `:${action.packTaskId}` : "";
  return `${action.kind}${suffix}`;
}

function formatTaskStateTable(states) {
  if (!Array.isArray(states) || states.length === 0) {
    return "- task states: not available";
  }
  const rows = states.map((state) => [
    state.packTaskId,
    state.queueTaskId ?? "",
    state.ticketState ?? "",
    state.workerRunState ?? "",
    state.reviewState ?? "",
    state.evidenceState ?? "",
    state.dependencyState ?? "",
    state.latestRunStatus ?? "",
    state.latestRunLinkId ?? "",
    state.startEligible ? "yes" : "no",
    state.finalizationEligible ? "yes" : "no",
    state.activeRun ? "yes" : "no",
    state.staleRunningCandidate ? "yes" : "no",
    state.dependencyAccepted ? "yes" : "no",
    state.dependencyBlockedReason ?? "",
  ].map(markdownCell));
  return [
    "| packTaskId | queueTaskId | ticket | worker | review | evidence | dependency | runStatus | runLinkId | start | final | active | stale | depAccepted | depBlocker |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function markdownCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}

function formatEnvPresence(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return "not available";
  }
  return entries
    .map((entry) => `${entry.name}:${entry.present ? "present" : "absent"}`)
    .join(", ");
}

function readTextTail(filePath, maxChars = 4000) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    return text.slice(-maxChars).replace(/\s+/g, " ").trim();
  } catch (error) {
    return `unable to read log: ${error.message}`;
  }
}

function gitBranch(repoRoot) {
  const result = spawnSync("git", ["branch", "--show-current"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });
  return result.status === 0 ? result.stdout.trim() || "unknown" : "unknown";
}

function requiredArg(argv, index, flag) {
  const value = argv[index];
  if (!value || value.trim().length === 0) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function defaultEndpointFile(repoRoot = findRepoRoot(process.cwd())) {
  if (process.env.HOBIT_DOGFOOD_OPERATOR_ENDPOINT_FILE) {
    const endpointFile = path.resolve(process.env.HOBIT_DOGFOOD_OPERATOR_ENDPOINT_FILE);
    assertPathOutsideRepo(endpointFile, repoRoot, "HOBIT_DOGFOOD_OPERATOR_ENDPOINT_FILE");
    return endpointFile;
  }
  return dogfoodOperatorEndpointFile(repoRoot);
}

function endpointFileCandidates(repoRoot = findRepoRoot(process.cwd())) {
  if (process.env.HOBIT_DOGFOOD_OPERATOR_ENDPOINT_FILE) {
    return [defaultEndpointFile(repoRoot)];
  }
  return uniquePaths([dogfoodOperatorEndpointFile(repoRoot), normalProfileEndpointFile()]);
}

function dogfoodOperatorEndpointFile(repoRoot = findRepoRoot(process.cwd())) {
  const endpointDir = path.join(
    os.tmpdir(),
    "hobit-dogfood-operator",
    repoScopedRuntimeKey(repoRoot),
  );
  const endpointFile = path.join(endpointDir, DEFAULT_ENDPOINT_FILE_NAME);
  assertPathOutsideRepo(endpointFile, repoRoot, "dogfood operator endpoint file");
  return endpointFile;
}

function dogfoodProfileDataDir(repoRoot = findRepoRoot(process.cwd())) {
  if (process.env.HOBIT_DOGFOOD_PROFILE_DIR) {
    return path.resolve(process.env.HOBIT_DOGFOOD_PROFILE_DIR);
  }
  return path.join(repoRoot, ".hobit", "dogfood-profile");
}

function repoScopedRuntimeKey(repoRoot) {
  const digest = crypto.createHash("sha256").update(path.resolve(repoRoot)).digest("hex").slice(0, 16);
  const base = path.basename(repoRoot).replace(/[^a-zA-Z0-9_.-]/g, "_") || "workspace";
  return `${base}-${digest}`;
}

function cleanupLegacyRepoLocalEndpointFile(repoRoot) {
  const legacyEndpointFile = path.join(
    repoRoot,
    ".hobit",
    "dogfood-profile",
    DEFAULT_ENDPOINT_FILE_NAME,
  );
  try {
    fs.rmSync(legacyEndpointFile, { force: true });
  } catch {
    // Best effort cleanup of the old worker-readable rendezvous location.
  }
}

function assertPathOutsideRepo(candidatePath, repoRoot, label) {
  const resolvedCandidate = path.resolve(candidatePath);
  const resolvedRepo = path.resolve(repoRoot);
  if (isSameOrInsidePath(resolvedCandidate, resolvedRepo)) {
    throw endpointUnavailable(`${label} must be outside the workspace root.`);
  }
}

function isSameOrInsidePath(candidatePath, parentPath) {
  const relative = path.relative(parentPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalProfileEndpointFile() {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (!appData) {
      throw endpointUnavailable("APPDATA is not set.");
    }
    return path.join(appData, "com.hobit.desktop", DEFAULT_ENDPOINT_FILE_NAME);
  }
  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "com.hobit.desktop",
      DEFAULT_ENDPOINT_FILE_NAME,
    );
  }
  return path.join(
    process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"),
    "com.hobit.desktop",
    DEFAULT_ENDPOINT_FILE_NAME,
  );
}

function uniquePaths(paths) {
  const seen = new Set();
  const unique = [];
  for (const candidate of paths) {
    const key = path.resolve(candidate).toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(candidate);
    }
  }
  return unique;
}

function findRepoRoot(startDirectory) {
  let current = path.resolve(startDirectory);
  while (true) {
    if (
      fs.existsSync(path.join(current, "AGENTS.md")) &&
      fs.existsSync(path.join(current, "Cargo.toml")) &&
      fs.existsSync(path.join(current, "scripts", "hobit"))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      console.error("ERROR: run this script from inside the Hobit repository");
      process.exit(2);
    }
    current = parent;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printHelp() {
  console.log(`Usage:
  node scripts/hobit/run-queue-dogfood-operator.mjs --operator-health --json
  node scripts/hobit/run-queue-dogfood-operator.mjs --operator-endpoint-info --json
  node scripts/hobit/run-queue-dogfood-operator.mjs --provider-readiness codex --json
  node scripts/hobit/run-queue-dogfood-operator.mjs --provider-auth-context codex --json
  node scripts/hobit/run-queue-dogfood-operator.mjs --run-detail --run-link-id queue_run_link_1782673319681359700_4 --json
  node scripts/hobit/run-queue-dogfood-operator.mjs --dogfood-plan --json
  node scripts/hobit/run-queue-dogfood-operator.mjs --pack docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json --preview --json
  node scripts/hobit/run-queue-dogfood-operator.mjs --pack docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json --materialize --json
  node scripts/hobit/run-queue-dogfood-operator.mjs --resume-dogfood --allow-real-worker --json --report docs/dogfood/reports/queue-dogfood-resume-001.md
  node scripts/hobit/run-queue-dogfood-operator.mjs --recover-stale-dogfood-run --run-link-id queue_run_link_1782673319681359700_4 --json
  node scripts/hobit/run-queue-dogfood-operator.mjs --pack docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json --materialize --start-pack-task dogfood-foundation-checkpoint --allow-real-worker --json --report ${DEFAULT_REPORT_PATH}
  node scripts/hobit/run-queue-dogfood-operator.mjs --pack docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json --retry-pack-task dogfood-foundation-checkpoint --allow-real-worker --json --report ${DEFAULT_REPORT_PATH}

Default mode attaches to a running Hobit Desktop app-owned dogfood operator
endpoint. If the endpoint is missing, stale, or unreachable, it launches Hobit
Desktop with:
  npm.cmd run tauri:dev --prefix apps/desktop/frontend -- --config <dogfood config> --no-dev-server-wait

Default launch sets:
  CARGO_TARGET_DIR=<repo>/target/hobit-dogfood/cargo-target
  HOBIT_DOGFOOD_OPERATOR_ENDPOINT=1
  HOBIT_DOGFOOD_OPERATOR_ENDPOINT_FILE=<private temp dogfood endpoint file>
  HOBIT_DOGFOOD_PROFILE=1
  HOBIT_DOGFOOD_PROFILE_DIR=<repo>/.hobit/dogfood-profile
  HOBIT_DOGFOOD_WORKSPACE_ROOT=<current repo root>

Dogfood profile mode is selected inside Hobit Desktop startup and uses a
persistent dogfood profile/data directory for Queue state continuity. The
token-bearing endpoint rendezvous file is kept outside the workspace root. This
is not a Node database fallback and does not repair or chmod the normal app
profile database.

The app endpoint opens or ensures the repo workspace from the operator's current
repository root through backend WorkspaceService APIs. It does not require
--database, --workspace-id, HOBIT_DOGFOOD_DATABASE, or
HOBIT_DOGFOOD_WORKSPACE_ID, and it does not inspect SQLite directly.

Options:
  --no-launch-app           Fail instead of launching Hobit Desktop.
  --launch-app-if-needed    Explicitly request the default auto-launch behavior.
  --provider-readiness codex
                            Check app-owned queue_local Codex provider readiness.
  --provider-auth-context codex
                            Compare operator/app/worker/Codex auth context using env names and presence only.
  --allow-unknown-provider-readiness
                            Diagnostic override for selected task start/retry only.
  --run-detail              Read-only selected-task run detail/status.
  --run-link-id <id>        Inspect a specific Queue run link with --run-detail.
  --queue-task-id <id>      Inspect the latest Queue task run link with --run-detail.
  --dogfood-plan            Read-only dogfood coordinator plan.
  --recover-stale-dogfood-run
                            Explicitly recover the planned/current stale dogfood run; standalone mode requires --run-link-id.
  --retry-pack-task <id>    Explicitly retry a terminal failed materialized pack task.
  --resume-dogfood          Coordinator-owned single-action dogfood resume/apply.

The endpoint context reports:
  contextSource: running_app_endpoint | launched_app_endpoint
  usedDirectDatabasePath: false
  profileMode
  workspaceResolutionMethod
  workspaceRoot
  endpointKind / endpointPid
  appLaunchAttempted / appLaunchCommandSummary

Provider auth-context diagnostics report only variable names and present/absent
booleans. They do not print raw API keys, tokens, credential file contents, or
secret-bearing environment values.

Diagnostic/dev-only direct DB mode:
  --direct-database-diagnostic --database <sqlite> [--workspace-id <id>]
  --direct-database-diagnostic --database <sqlite> --list-workspaces

Direct DB mode is never used as default fallback. If the app endpoint cannot be
attached or launched, the command fails without probing SQLite.`);
}
