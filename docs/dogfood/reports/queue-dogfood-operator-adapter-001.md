# Queue Dogfood Operator Adapter 001

## Summary

BLOCK 70G adds a supported thin operator adapter for the first real Queue
dogfood run. This is adapter readiness evidence only. It does not claim that a
real dogfood worker was launched.

## Adapter

- Entry point: `scripts/hobit/run-queue-dogfood-operator.mjs`
- Rust helper: `queue-dogfood-operator`
- Pack path: `docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json`
- First pack task: `dogfood-foundation-checkpoint`

The adapter reuses backend-owned Prompt Pack file preview, backend-owned Prompt
Pack file materialization, and backend-owned selected-task `queue_local` start.
It does not use the frontend Prompt Pack materializer as canonical logic.

## Real Worker Guard

Automated tests use fake/headless workers only. The adapter refuses selected
task start unless `--allow-real-worker` is present.

## Next Run

BLOCK 70H should run the adapter against a real Hobit workspace database,
capture `packSpecHash`, generated Queue task ids, `runLinkId`, and completion
status, then write `docs/dogfood/reports/queue-dogfood-run-002.md`.
