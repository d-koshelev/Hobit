# JDBC Read-Only Sidecar Scaffold

This is the Java sidecar scaffold for Hobit's experimental real JDBC runtime.
It is intentionally dependency-free. HealthCheck does not load drivers or
connect to a database. DriverProbe loads only an explicit driver JAR/class and
does not connect to a database. Read-only query execution remains explicit and
bounded.

Current behavior:

- reads one JSON request from stdin
- writes one JSON response to stdout
- supports explicit `healthCheck`, `driverProbe`, and `executeReadOnlyQuery`
  request kinds
- accepts `runtime_kind: "mock_read_only"` for deterministic mock rows and
  `runtime_kind: "real_jdbc"` only for explicit experimental requests
- returns deterministic bounded mock rows for validated read-only requests
- loads only an explicit driver JAR path; it does not scan folders or download
  drivers
- returns sanitized `query_rejected`, `not_configured`, or
  `unsupported_driver` statuses for unsupported requests

Protocol request fields:

- `protocol_version`
- `request_id`
- `runtime_kind`
- `connector_id`
- `database_kind`
- `driver_kind`
- `statement_kind`
- `validated_read_only`
- `sql`
- `row_limit`
- `timeout_ms`
- `max_columns`
- `max_cell_chars`
- `max_result_bytes`

Protocol response fields:

- `protocol_version`
- `request_id`
- `status`
- `columns`
- `rows`
- `row_count`
- `returned_row_count`
- `truncated`
- `truncated_rows`
- `truncated_columns`
- `truncated_cells`
- `truncated_bytes`
- `duration_ms`
- `sanitized_error`
- `no_secrets_returned`
- `no_ai_context_shared`
- `mock_execution`

Compile and smoke when a JDK is available:

```powershell
node scripts/hobit/smoke-jdbc-sidecar.mjs
```

The smoke compiles and runs the sidecar when `java` and `javac` are on `PATH`.
If a JDK is absent, it reports a clean skip so normal Hobit validation does not
require Java. The smoke runs HealthCheck by default. DriverProbe is optional:

```powershell
node scripts/hobit/smoke-jdbc-sidecar.mjs --driver-jar C:\path\to\driver.jar --driver-class org.example.Driver
```

Backend opt-in activation smoke when a JDK is available:

```powershell
cargo test -p hobit-app sidecar_config_executes_java_mock_runtime_when_jdk_available
```

This Rust test checks for `java` and `javac` before compiling or launching the
sidecar. If either tool is absent, the test returns cleanly. When both tools are
available, it compiles this sidecar into
`target/hobit-jdbc-sidecar-rust-activation/classes`, creates a normal backend
Workspace/JDBC widget/connector, installs an explicit test-only
`JdbcRuntimeConfig`, and executes a valid read-only query through the
`mock_read_only` sidecar protocol. Mutation SQL is still rejected by the
backend validator before sidecar launch.

Backend opt-in runtime config keys for future sidecar wiring:

- `HOBIT_JDBC_RUNTIME_MODE=sidecar`
- `HOBIT_JDBC_SIDECAR_ENABLED=true`
- `HOBIT_JDBC_SIDECAR_JAVA_PROGRAM`, defaulting to `java`
- `HOBIT_JDBC_SIDECAR_JAR` or `HOBIT_JDBC_SIDECAR_CLASSPATH`
- `HOBIT_JDBC_SIDECAR_MAIN_CLASS`, defaulting to
  `com.hobit.jdbc.JdbcReadOnlySidecar`
- `HOBIT_JDBC_SIDECAR_WORKING_DIR`
- `HOBIT_JDBC_SIDECAR_CONNECTOR_ID`
- `HOBIT_JDBC_SIDECAR_RUNTIME_KIND`, defaulting to `mock_read_only`
- `HOBIT_JDBC_SIDECAR_DRIVER_KIND`, defaulting to `jdbc`
- `HOBIT_JDBC_SIDECAR_TIMEOUT_MS`
- presence-only credential flags:
  `HOBIT_JDBC_SIDECAR_JDBC_URL_PRESENT`,
  `HOBIT_JDBC_SIDECAR_USERNAME_PRESENT`, and
  `HOBIT_JDBC_SIDECAR_PASSWORD_PRESENT`

These keys are backend-only. Credential values are not part of this scaffold
protocol and must not be passed through frontend state, Coordinator context,
logs, tests, or proposal cards.

This scaffold is not wired into the JDBC widget by default. The active product
runtime remains `MockReadOnlyJdbcAdapter`. The JDBC widget can trigger
experimental diagnostics and an explicit experimental Run only from visible
operator controls; no diagnostics run automatically.
