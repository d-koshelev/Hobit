#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const EXIT_OK = 0;
const EXIT_COMMAND_FAILED = 1;
const EXIT_USAGE_OR_ENVIRONMENT = 2;

const FRONTEND_DIR = "apps/desktop/frontend";

const QUEUE_HEADLESS_SMOKE = {
  label: "Queue headless lifecycle smoke",
  program: "cargo",
  args: ["test", "-p", "hobit-desktop", "queue_workflow_headless_smoke"],
};

const WORKFLOW_COMMANDS = [
  QUEUE_HEADLESS_SMOKE,
  {
    label: "Tauri Queue workflow command tests",
    program: "cargo",
    args: ["test", "-p", "hobit-desktop", "agent_queue_workflow"],
  },
  {
    label: "Backend Queue workflow tests",
    program: "cargo",
    args: ["test", "-p", "hobit-app", "agent_queue_workflow"],
  },
  {
    label: "Backend Queue execution tests",
    program: "cargo",
    args: ["test", "-p", "hobit-app", "agent_queue_execution"],
  },
];

const DOGFOOD_COMMANDS = [
  {
    label: "Prompt pack backend tests",
    program: "cargo",
    args: ["test", "-p", "hobit-desktop", "prompt_pack"],
  },
  {
    label: "Selected Queue task bridge tests",
    program: "cargo",
    args: ["test", "-p", "hobit-desktop", "selected_task"],
  },
  {
    label: "queue_local bridge tests",
    program: "cargo",
    args: ["test", "-p", "hobit-desktop", "queue_local"],
  },
  {
    label: "Queue dogfood prompt pack tests",
    program: "cargo",
    args: ["test", "-p", "hobit-desktop", "dogfood"],
  },
  {
    label: "Queue dogfood operator endpoint and adapter tests",
    program: "cargo",
    args: ["test", "-p", "hobit-desktop", "dogfood_operator"],
  },
];

const MODE_COMMANDS = {
  quick: [QUEUE_HEADLESS_SMOKE],
  workflow: WORKFLOW_COMMANDS,
  dogfood: DOGFOOD_COMMANDS,
  full: [
    {
      label: "Rust format check",
      program: "cargo",
      args: ["fmt", "--check"],
    },
    {
      label: "Rust workspace check",
      program: "cargo",
      args: ["check", "--workspace"],
    },
    ...WORKFLOW_COMMANDS,
    {
      label: "Rust test suite",
      program: "cargo",
      args: ["test"],
    },
    {
      label: "Queue smoke docs guard",
      program: "node",
      args: ["--test", "scripts/hobit/check-queue-smoke-docs.test.mjs"],
    },
  ],
};

const FRONTEND_QUEUE_FILTERS = [
  "queueWorkflowRunnerBackendStepDispatcher",
  "QueueWorkflowRunner",
  "queueWorkflow",
  "workflowRequest",
  "queue.workflow",
];

const LINE_COUNT_COMMANDS = [
  {
    label: "Line-count report",
    program: npmProgram(),
    args: ["run", "report:line-count", "--prefix", FRONTEND_DIR],
  },
  {
    label: "Line-count guard",
    program: npmProgram(),
    args: ["run", "check:line-count", "--prefix", FRONTEND_DIR],
  },
  {
    label: "Line-count tests",
    program: npmProgram(),
    args: ["run", "test:line-count", "--prefix", FRONTEND_DIR],
  },
];

function frontendCommands() {
  return [
    ...FRONTEND_QUEUE_FILTERS.map((filter) => ({
      label: `Frontend Queue test filter: ${filter}`,
      program: npmProgram(),
      args: ["run", "test", "--", "--run", filter],
      cwd: FRONTEND_DIR,
    })),
    {
      label: "Frontend typecheck",
      program: npmProgram(),
      args: ["run", "typecheck"],
      cwd: FRONTEND_DIR,
    },
    {
      label: "Frontend build",
      program: npmProgram(),
      args: ["run", "build"],
      cwd: FRONTEND_DIR,
    },
  ];
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

  let repoRoot;
  try {
    repoRoot = await findRepoRoot(process.cwd());
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    return EXIT_USAGE_OR_ENVIRONMENT;
  }
  const commands = buildCommandList(options);

  if (options.list) {
    printList(repoRoot);
    return EXIT_OK;
  }

  console.log(`[queue-smoke-gate] repo root: ${repoRoot}`);
  console.log(`[queue-smoke-gate] mode: ${options.mode}`);
  console.log(
    `[queue-smoke-gate] optional gates: frontend=${options.includeFrontend ? "yes" : "no"}, line-count=${options.includeLineCount ? "yes" : "no"}`,
  );

  const summary = [];
  for (const command of commands) {
    const result = await runCommand(command, repoRoot);
    summary.push(result);
    if (result.exitCode !== 0) {
      printSummary(summary);
      return result.exitCode ?? EXIT_COMMAND_FAILED;
    }
  }

  printSummary(summary);
  return EXIT_OK;
}

function parseArgs(argv) {
  const options = {
    help: false,
    includeFrontend: false,
    includeLineCount: false,
    list: false,
    mode: null,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--list") {
      options.list = true;
      continue;
    }
    if (arg === "--include-frontend") {
      options.includeFrontend = true;
      continue;
    }
    if (arg === "--include-line-count") {
      options.includeLineCount = true;
      continue;
    }
    if (
      arg === "--quick" ||
      arg === "--workflow" ||
      arg === "--dogfood" ||
      arg === "--full"
    ) {
      const mode = arg.slice(2);
      if (options.mode && options.mode !== mode) {
        throw new Error("choose only one mode: --quick, --workflow, --dogfood, or --full");
      }
      options.mode = mode;
      continue;
    }
    throw new Error(`unexpected argument: ${arg}`);
  }

  if (!options.help && !options.list && !options.mode) {
    throw new Error("choose one mode: --quick, --workflow, --dogfood, or --full");
  }

  return options;
}

function buildCommandList(options) {
  if (options.list) {
    return [];
  }

  const commands = [...MODE_COMMANDS[options.mode]];
  if (options.includeFrontend) {
    commands.push(...frontendCommands());
  }
  if (options.includeLineCount) {
    commands.push(...LINE_COUNT_COMMANDS);
  }
  return commands;
}

async function findRepoRoot(startDirectory) {
  let current = path.resolve(startDirectory);
  while (true) {
    if (
      await pathExists(path.join(current, "AGENTS.md")) &&
      await pathExists(path.join(current, "Cargo.toml")) &&
      await pathExists(path.join(current, "scripts", "hobit"))
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

async function pathExists(candidate) {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

function runCommand(command, repoRoot) {
  return new Promise((resolve) => {
    const cwd = path.resolve(repoRoot, command.cwd ?? ".");
    const display = formatCommand(command);
    console.log("");
    console.log(`[queue-smoke-gate] ==> ${command.label}`);
    console.log(`[queue-smoke-gate] $ ${display}`);
    const startedAt = Date.now();

    const spawnSpec = commandSpawnSpec(command);
    let child;
    try {
      child = spawn(spawnSpec.program, spawnSpec.args, {
        cwd,
        env: process.env,
        shell: false,
        stdio: "inherit",
      });
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      console.error(`[queue-smoke-gate] command failed to start: ${error.message}`);
      resolve({
        command,
        elapsedMs,
        exitCode: EXIT_USAGE_OR_ENVIRONMENT,
        status: "failed-to-start",
      });
      return;
    }

    child.on("error", (error) => {
      const elapsedMs = Date.now() - startedAt;
      console.error(`[queue-smoke-gate] command failed to start: ${error.message}`);
      resolve({
        command,
        elapsedMs,
        exitCode: EXIT_USAGE_OR_ENVIRONMENT,
        status: "failed-to-start",
      });
    });

    child.on("close", (code, signal) => {
      const elapsedMs = Date.now() - startedAt;
      if (code === 0) {
        console.log(
          `[queue-smoke-gate] passed in ${formatDuration(elapsedMs)}`,
        );
      } else if (code !== null) {
        console.error(
          `[queue-smoke-gate] failed with exit code ${code} after ${formatDuration(elapsedMs)}`,
        );
      } else {
        console.error(
          `[queue-smoke-gate] stopped by signal ${signal} after ${formatDuration(elapsedMs)}`,
        );
      }
      resolve({
        command,
        elapsedMs,
        exitCode: code ?? EXIT_COMMAND_FAILED,
        signal,
        status: code === 0 ? "passed" : "failed",
      });
    });
  });
}

function printSummary(results) {
  console.log("");
  console.log("[queue-smoke-gate] Summary:");
  for (const result of results) {
    const status = result.exitCode === 0 ? "PASS" : "FAIL";
    console.log(
      `- ${status} ${result.command.label}: ${formatDuration(result.elapsedMs)}`,
    );
  }
}

function printList(repoRoot) {
  console.log(`[queue-smoke-gate] repo root: ${repoRoot}`);
  console.log("Available modes:");
  for (const mode of ["quick", "workflow", "dogfood", "full"]) {
    console.log("");
    console.log(`--${mode}`);
    for (const command of MODE_COMMANDS[mode]) {
      console.log(`  ${formatCommand(command)}`);
    }
  }
  console.log("");
  console.log("--include-frontend adds:");
  for (const command of frontendCommands()) {
    console.log(`  ${formatCommand(command)}`);
  }
  console.log("");
  console.log("--include-line-count adds:");
  for (const command of LINE_COUNT_COMMANDS) {
    console.log(`  ${formatCommand(command)}`);
  }
}

function printHelp() {
  console.log(`Usage:
  node scripts/hobit/run-queue-smoke-gate.mjs --quick [options]
  node scripts/hobit/run-queue-smoke-gate.mjs --workflow [options]
  node scripts/hobit/run-queue-smoke-gate.mjs --dogfood [options]
  node scripts/hobit/run-queue-smoke-gate.mjs --full [options]
  node scripts/hobit/run-queue-smoke-gate.mjs --list

Modes:
  --quick     Run only the canonical headless Queue lifecycle smoke.
  --workflow  Run the headless smoke plus focused Queue workflow/execution tests.
  --dogfood   Run safe prompt-pack and selected-task dogfood bridge tests.
  --full      Run Rust format/check, focused Queue workflow tests, full cargo test, and docs guard.

Options:
  --include-frontend    Also run focused frontend Queue workflow projection/adapter checks, typecheck, and build.
  --include-line-count  Also run the frontend line-count report, guard, and tests.
  --list                Print commands without running them.
  --help                Print this help.

Safety:
  This runner is read-only validation orchestration. It does not launch Hobit UI,
  call real codex.cmd, mutate Queue state outside tests, run Git mutations,
  launch Terminal, run validation/rollback product operations, or require network access.`);
}

function formatCommand(command) {
  return [command.program, ...command.args].map(quoteArg).join(" ");
}

function quoteArg(value) {
  if (/^[A-Za-z0-9_./:=@+-]+$/u.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function formatDuration(elapsedMs) {
  return `${(elapsedMs / 1000).toFixed(1)}s`;
}

function commandSpawnSpec(command) {
  if (
    process.platform === "win32" &&
    /\.(cmd|bat)$/iu.test(command.program)
  ) {
    return {
      program: "cmd.exe",
      args: ["/D", "/C", command.program, ...command.args],
    };
  }

  return {
    program: command.program,
    args: command.args,
  };
}

function npmProgram() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

process.exitCode = await main(process.argv.slice(2));
