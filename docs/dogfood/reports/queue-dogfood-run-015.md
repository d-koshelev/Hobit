# Queue Dogfood Run 015

## Run Summary

- Date: 2026-06-29T19:24:23+02:00
- Branch: `queue-dogfood-continuation`
- Goal: repair local Windows/Codex TLS reachability before dogfood resume
- Outcome: stopped before resume
- Fix/workaround applied: no safe workspace-scoped workaround found
- Resume launched: no
- Worker launched: no
- Run link created: no
- Secrets logged: no

## Direct Codex Doctor

- Command: `codex.cmd doctor --json`
- Initial exit code: 1
- Final exit code: 1
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

## TLS Client Comparison

- `curl.exe -v https://api.openai.com/v1`: DNS resolved, TCP attempted, Schannel failed before HTTP with `SEC_E_NO_CREDENTIALS`
- `curl.exe -v https://chatgpt.com`: DNS resolved, TCP attempted, Schannel failed before HTTP with `SEC_E_NO_CREDENTIALS`
- `Invoke-WebRequest https://api.openai.com/v1 -Method Head`: failed before HTTP status with an underlying receive error
- `Invoke-WebRequest https://chatgpt.com -Method Head`: failed before HTTP status with an underlying receive error
- Node HTTPS to `https://api.openai.com/v1`: reached HTTP response, status `404`
- Node HTTPS to `https://chatgpt.com`: reached HTTP response, status `403`
- Additional Schannel checks against `https://www.microsoft.com` and `https://www.google.com`: curl failed with the same `SEC_E_NO_CREDENTIALS`
- Additional Node HTTPS checks against `https://www.microsoft.com` and `https://www.google.com`: reached HTTP responses

## TLS And Environment Summary

- `[Net.ServicePointManager]::SecurityProtocol`: `SystemDefault`
- Environment variable names matching TLS/cert/proxy/OpenAI/Codex/Node patterns: `CODEX_MANAGED_BY_NPM`, `CODEX_MANAGED_PACKAGE_ROOT`, `CODEX_THREAD_ID`, `OPENAI_API_KEY`
- Environment values printed: no
- `curl.exe --version`: Windows/libcurl Schannel build
- PATH curl: `C:\Windows\System32\curl.exe`
- Git curl: present but also Schannel-backed; failed with same `SEC_E_NO_CREDENTIALS`
- WinHTTP proxy: direct access, no proxy server
- Current-user Internet Settings: no proxy server value present, no autoconfig URL present
- TLS 1.2 Schannel client registry: present, enabled, not disabled by default
- TLS 1.0/TLS 1.1/TLS 1.3 Schannel client registry overrides: not present
- FIPS mode: disabled
- Enabled TLS cipher suites: present, 28 suites reported
- Recent Schannel events from System log: none returned by the query

## Workaround Probes

- `curl.exe --tlsv1.2 -I https://api.openai.com/v1`: still failed with `SEC_E_NO_CREDENTIALS`
- `curl.exe --tls-max 1.2 -I https://api.openai.com/v1`: still failed with `SEC_E_NO_CREDENTIALS`
- `curl.exe --ssl-auto-client-cert -I https://api.openai.com/v1`: still failed with `SEC_E_NO_CREDENTIALS`
- OpenSSL-backed curl: not available on PATH

## Classification

`system_schannel_acquire_credentials_failure`

This is broader than OpenAI reachability. DNS and TCP are healthy, Node/OpenSSL-backed HTTPS can reach multiple hosts, TLS 1.2 and cipher suites are present, and both Windows curl and PowerShell/Schannel paths fail before HTTP. Direct `codex.cmd doctor --json` still fails provider reachability, so Codex remains blocked by the local native Windows TLS path.

The evidence does not support an auth-source problem. No credential files were modified.

Smallest next action: repair local Windows Schannel/native TLS outside the Hobit workspace, likely in Windows security policy, security product/VPN/TLS inspection, or OS TLS provider state. After that, rerun:

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
- Reason: direct `codex.cmd doctor --json` did not return `overallStatus=ok`, and Hobit provider readiness stayed `blocked`
- `dogfood-file-import-hardening` launched: no
- `runLinkId`: not available
- Completion status: not launched
- Dependent task auto-started: no
- `widget_runs`: no
- Scheduler/autodispatch: no

## Hobit Boundaries

- Hobit Queue lifecycle changed: no
- Prompt Pack materialization changed: no
- Provider readiness bypassed: no
- Direct DB probing canonical: no
- Frontend lifecycle/materializer canonical: no
- Worker operator token access: no
- Secrets logged: no

## Final Outcome

No safe local environment workaround was found from the available diagnostics. Hobit should remain blocked until direct `codex.cmd doctor --json` reports `overallStatus=ok`.
