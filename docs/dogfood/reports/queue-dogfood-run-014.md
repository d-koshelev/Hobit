# Queue Dogfood Run 014

## Run Summary

- Date: 2026-06-29T18:34:28+02:00
- Branch: `queue-dogfood-continuation`
- Goal: external Codex provider reachability recovery before dogfood resume
- Outcome: stopped before resume
- Resume launched: no
- Worker launched: no
- Run link created: no
- Secrets logged: no

## Direct Codex Doctor

- Command: `codex.cmd doctor --json`
- First run exit code: 1
- Retry exit code: 1
- `overallStatus`: `fail`
- `checks.auth.credentials.status`: `ok`
- Auth summary: auth is provided by environment
- `checks.network.env`: proxy env vars `none`
- `checks.network.provider_reachability.status`: `fail`
- Provider reachability summary: one or more required provider endpoints are unreachable over HTTP
- Provider reachability detail summary: OpenAI API base URL connect failed; required path; API key auth mode
- `checks.network.websocket_reachability.status`: `warning`
- WebSocket summary: Responses WebSocket failed; HTTPS fallback may still work
- WebSocket detail summary: route probe returned HTTP 401 without bearer/basic auth
- Codex version: `0.142.4`
- Raw credential values logged: no

## Network Diagnostics

- `Test-NetConnection api.openai.com -Port 443`: TCP succeeded
- `Test-NetConnection chatgpt.com -Port 443`: TCP succeeded
- `Resolve-DnsName api.openai.com`: DNS succeeded, IPv4 answers returned
- `Resolve-DnsName chatgpt.com`: DNS succeeded, IPv4 and IPv6 answers returned
- `curl.exe -I https://api.openai.com/v1`: failed before HTTP with Schannel `SEC_E_NO_CREDENTIALS`
- `curl.exe -I https://chatgpt.com`: failed before HTTP with Schannel `SEC_E_NO_CREDENTIALS`
- `curl.exe --ssl-no-revoke -I ...`: same Schannel failure
- `curl.exe -k -I ...`: same Schannel failure
- `Invoke-WebRequest` HEAD to `https://api.openai.com/v1`: failed before status with an underlying receive error
- `Invoke-WebRequest` HEAD to `https://chatgpt.com`: failed before status with an underlying receive error
- Node HTTPS HEAD to `https://api.openai.com/v1`: reached HTTP response, status `404`
- Node HTTPS HEAD to `https://chatgpt.com`: reached HTTP response, status `403`
- `curl.exe --version`: Windows Schannel build

## Classification

`tls/http_reachable_but_codex_fails`

DNS and TCP 443 are healthy. Node's HTTPS stack can reach both endpoints and receive HTTP responses without auth headers. Windows Schannel-based HTTPS clients fail before HTTP, and direct `codex.cmd doctor --json` still fails provider reachability. This points to a local native TLS/security-policy or Codex CLI reachability path issue outside Hobit, not a Queue lifecycle, prompt-pack, or Hobit Coordinator issue.

Smallest next action: repair the local Codex CLI/native HTTPS path for `https://api.openai.com/v1`, including Windows Schannel/security policy, VPN/firewall/inspection, or Codex CLI transport environment, then rerun:

```powershell
codex.cmd doctor --json
node scripts/hobit/run-queue-dogfood-operator.mjs --provider-readiness codex --json
```

## Hobit Provider Readiness

- Command: `node scripts/hobit/run-queue-dogfood-operator.mjs --provider-readiness codex --json`
- Command result: ok
- Status: `blocked`
- Provider id: `codex`
- Execution target: `queue_local`
- Auth status: `ready`
- Auth source summary: `environment_present`
- Codex executable resolved: true
- Codex executable summary: `codex.cmd`
- Codex version: `0.142.4`
- Blockers: `codex_provider_unreachable`
- Used direct database path: false
- Raw credential values logged: no

## Resume Decision

- `--resume-dogfood` launched: no
- Reason: direct Codex doctor and Hobit provider readiness did not become ready
- `dogfood-file-import-hardening` launched: no
- `runLinkId`: not available
- Completion status: not launched
- Next task became eligible: no change verified; `dogfood-file-import-hardening` remains the blocked next task
- Dependent task auto-started: no

## Boundary Checks

- Queue lifecycle changed: no
- Prompt Pack materialization changed: no
- Direct DB probing canonical: no
- `usedDirectDatabasePath`: false
- `widget_runs`: no
- Scheduler/autodispatch: no
- Frontend lifecycle/materializer canonical: no
- Worker operator token access: no
- Repo-local endpoint token file: absent at `.hobit\dogfood-profile\dogfood-operator-endpoint.json`
- Real `codex.cmd` diagnostics: yes
- Real worker execution: no
- Automated tests launching real `codex.cmd`: no
- Secrets logged: no

## Validation

- `cargo fmt --all`: pass, with existing `could not canonicalize path C:\Users\Dmitry` warning
- `cargo test -p hobit-desktop dogfood_operator`: pass
- `cargo test -p hobit-app queue_local_provider_readiness`: pass
- `node scripts/hobit/run-queue-smoke-gate.mjs --dogfood`: pass
- `node scripts/hobit/run-queue-dogfood-operator.mjs --provider-readiness codex --json`: command pass, readiness status `blocked`

## Final Outcome

No dogfood task was started in this block. The blocker remains external to Hobit until direct `codex.cmd doctor --json` reports usable provider reachability and Hobit provider readiness returns `ready`.
