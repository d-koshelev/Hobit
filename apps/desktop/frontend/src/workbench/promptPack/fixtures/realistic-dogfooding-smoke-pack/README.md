# Realistic Dogfooding Smoke Pack

Small deterministic prompt-pack fixture for the realistic self-development
manual smoke product path.

It contains two prompt bodies:

- `001-add-dogfooding-smoke-result-doc.md`
- `002-record-dependent-gate-result.md`

Task 002 depends on task 001. Importing this pack must create Queue items only
after explicit confirmation and must not start execution, validation,
finalization, Git, Terminal, shell, or SQLite direct actions.
