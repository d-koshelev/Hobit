import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");

const DOC_PATHS = [
  "docs/SMART_QUEUE_MANUAL_SMOKE_CHECKLIST.md",
  "docs/SMART_QUEUE_IMPLEMENTATION_STATUS.md",
];

const FORBIDDEN_PHRASES = [
  "manual smoke is canonical",
  "primary regression path is Workspace Agent",
  "reuse workflowRunId",
  "continue old workflowRunId",
];

test("Queue smoke docs do not make manual prompting the regression gate", async () => {
  for (const relativePath of DOC_PATHS) {
    const text = await readRepoText(relativePath);
    const normalized = text.toLowerCase();
    for (const phrase of FORBIDDEN_PHRASES) {
      assert.equal(
        normalized.includes(phrase.toLowerCase()),
        false,
        `${relativePath} contains forbidden Queue smoke wording: ${phrase}`,
      );
    }
  }
});

test("Queue smoke docs publish the automated gate commands", async () => {
  const manualChecklist = await readRepoText(DOC_PATHS[0]);
  for (const mode of ["--quick", "--workflow", "--full"]) {
    assert.match(
      manualChecklist,
      new RegExp(`node scripts/hobit/run-queue-smoke-gate\\.mjs ${mode}`),
    );
  }
});

async function readRepoText(relativePath) {
  return fs.readFile(path.join(REPO_ROOT, relativePath), "utf8");
}
