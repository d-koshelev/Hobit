# Workspace Agent V2 Queue Run Requirements

## Purpose

This document defines requirements for a future Workspace Agent V2 Queue Run
flow.

It is requirements-only. It does not add frontend behavior, backend/Tauri
commands, storage/schema changes, provider tools, Queue execution behavior,
Agent Executor behavior, Knowledge / Skills behavior, durable Evidence storage,
or automatic dispatch.

## Product Requirement

Queue Run is the path where Workspace Agent helps the operator turn visible
prompt/context into a Queue-owned task.

Workspace Agent may draft and show Queue task/result cards and links, but
Agent Queue owns the durable task, execution lifecycle, report/evidence
surface, review state, and closure.

## Required Behavior

- Queue Run creates an Agent Queue task from an explicit prompt and visible
  operator-approved context.
- The created task belongs to the singleton Workspace Queue.
- Workspace Agent must show the task creation result as a Queue task card or
  link, not as hidden execution.
- Workspace Agent must show later Queue result/report links or cards when they
  are visible and available through Queue-owned surfaces.
- Queue owns execution start, run linkage, report/evidence summaries, review
  state, follow-up creation, and closure/finalization decisions.
- Queue task completion must not imply acceptance. Closure requires explicit
  operator or future Coordinator decision through Queue-owned review flow.

## Context Attachment Requirements

When durable context APIs are available, Queue Run must attach selected visible
context to the created Queue task through those APIs.

Eligible context includes:

- visible Knowledge Document refs;
- visible Skill refs;
- explicitly selected files or source refs;
- other approved source refs that have a bounded, visible summary.

Attachment rules:

- Context is attached as Queue-owned refs, summaries, bounded snapshots, or
  source refs, not as hidden Workspace Agent memory.
- Workspace Agent must not inject raw hidden context into the task prompt.
- Workspace Agent must not attach Knowledge, Skills, files, logs, Git diffs,
  Terminal output, JDBC results, Notes, or Executor output unless the operator
  selected or approved that visible context.
- If durable context APIs are unavailable, Queue Run may preserve context only
  in visible task prompt/description text and must make that limitation clear.
- Context attachment does not start execution.

## Run Path Distinctions

Workspace Agent V2 must keep these paths distinct:

- Direct Run: foreground Workspace Agent or supporting Direct Work execution
  from explicit operator inputs. It is not a Queue task by default.
- Create Queue task: creates a Queue-owned task from a prompt/context. It does
  not start execution.
- Future explicit Run through Queue: creates or selects a Queue task, then
  starts it only through a visible Queue-owned execution control or approved
  Queue policy.

The UI and API vocabulary must not collapse these into one ambiguous "run"
action.

## No Auto-Run Rule

Queue Run must not auto-run after task creation.

The only allowed exception is a future explicit control whose behavior clearly
means create-and-start. In that case:

- the control must be visible before activation;
- the operator or future approved policy must explicitly request execution;
- Queue must own the execution start;
- Queue must own run links, report/evidence, review, and closure;
- Workspace Agent must show Queue task/result links rather than bypassing
  Queue.

Provider output, Workspace Agent drafts, Knowledge attachment, file/source
attachment, and task creation must never silently start Agent Executor, Queue
Autorun, Terminal, Git, JDBC, or any other runtime path.

## Non-Goals

This requirements document does not define or implement:

- new Queue APIs;
- new Workspace Agent APIs;
- provider tool calls;
- Queue auto-dispatch;
- durable scheduler behavior;
- backend runner changes;
- storage or schema migrations;
- Evidence store implementation;
- file reading, Git, Terminal, JDBC, or Notes behavior changes;
- automatic Knowledge / Skills attachment.
