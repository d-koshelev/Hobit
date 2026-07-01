import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  classifyPath,
  countTextLines,
  runLineCountAudit,
} from "./check-line-counts.mjs";

function textWithLines(count) {
  return Array.from({ length: count }, (_, index) => `line ${index + 1}`).join("\n");
}

async function withTempRepo(callback) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hobit-line-count-"));
  try {
    await fs.writeFile(path.join(root, "AGENTS.md"), "# test repo\n", "utf8");
    await fs.writeFile(path.join(root, "Cargo.toml"), "[workspace]\n", "utf8");
    await fs.mkdir(path.join(root, "scripts", "hobit"), { recursive: true });
    await callback(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function writeAllowlist(root, files) {
  await fs.writeFile(
    path.join(root, "scripts", "hobit", "line-count-allowlist.json"),
    JSON.stringify(
      {
        schema: 1,
        files,
      },
      null,
      2,
    ),
    "utf8",
  );
}

test("counts newline-delimited text without adding a phantom trailing line", () => {
  assert.equal(countTextLines(""), 0);
  assert.equal(countTextLines("one"), 1);
  assert.equal(countTextLines("one\n"), 1);
  assert.equal(countTextLines("one\ntwo"), 2);
});

test("classifies Rust plural test modules as tests", () => {
  assert.equal(classifyPath("crates/hobit-app/src/workspace_service/agent_queue_workflow_tests.rs"), "test");
});

test("report mode can identify an oversized source file", async () => {
  await withTempRepo(async (root) => {
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "large.ts"), textWithLines(1001), "utf8");

    const audit = await runLineCountAudit({ root });

    assert.equal(audit.scanned, 3);
    assert.equal(audit.findings.length, 1);
    assert.equal(audit.findings[0].path, "src/large.ts");
    assert.equal(audit.findings[0].status, "unallowlisted");
    assert.equal(audit.failures.length, 1);
  });
});

test("allowlisted existing giant files do not fail the guard", async () => {
  await withTempRepo(async (root) => {
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "giant.ts"), textWithLines(1001), "utf8");
    await writeAllowlist(root, [
      {
        path: "src/giant.ts",
        currentLineCount: 1001,
        category: "source",
        reason: "Synthetic legacy debt fixture.",
        plannedRefactorBlock: "test fixture",
        ownerDomain: "test",
        targetMaxLineCount: 500,
        removeAfter: "Remove when fixture falls below threshold.",
      },
    ]);

    const audit = await runLineCountAudit({ root });

    assert.equal(audit.findings.length, 1);
    assert.equal(audit.findings[0].status, "debt");
    assert.equal(audit.failures.length, 0);
  });
});

test("a synthetic non-allowlisted oversized source fixture fails guard checks", async () => {
  await withTempRepo(async (root) => {
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "newLargeSource.ts"), textWithLines(1001), "utf8");
    await writeAllowlist(root, []);

    const audit = await runLineCountAudit({ root });

    assert.equal(audit.findings.length, 1);
    assert.equal(audit.findings[0].path, "src/newLargeSource.ts");
    assert.equal(audit.findings[0].category, "source");
    assert.equal(audit.findings[0].status, "unallowlisted");
    assert.equal(audit.failures.length, 1);
  });
});
