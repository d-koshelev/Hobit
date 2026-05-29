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

## Smoke Ladder

1. HealthCheck: starts the Java sidecar and verifies the protocol response. It
   does not load drivers, connect to a database, or execute SQL.
2. DriverProbe: loads only the explicit operator-provided driver JAR/class. It
   does not connect to a database or execute SQL.
3. Optional H2 in-memory `SELECT 1`: uses an operator-provided H2 driver JAR,
   `org.h2.Driver`, and an in-memory database URL with no password.
4. Optional real external DB smoke: requires a user-provided safe test database,
   driver JAR/class, JDBC URL, credentials when needed through
   `--password-env`, and an explicit read-only SELECT/WITH query.

Compile and smoke when a JDK is available:

```powershell
node scripts/hobit/smoke-jdbc-sidecar.mjs
```

The smoke checks for both `java` and `javac` on `PATH`. If a JDK is absent, it
reports a clean skip so normal Hobit validation does not require Java. With no
arguments, the smoke compiles the sidecar if needed and runs HealthCheck only.
HealthCheck starts the sidecar and verifies the protocol response; it does not
load drivers, connect to a database, or execute SQL.

DriverProbe is optional and does not connect to a database:

```powershell
node scripts/hobit/smoke-jdbc-sidecar.mjs --driver-jar C:\path\driver.jar --driver-class org.example.Driver
```

Optional H2 in-memory smoke is a safe manual DB smoke path. Hobit does not
bundle H2 and does not download drivers; the operator downloads the driver JAR
manually, for example H2 2.4.240 from Maven Central
`com.h2database:h2:2.4.240`:

```text
https://repo1.maven.org/maven2/com/h2database/h2/2.4.240/h2-2.4.240.jar
```

Run the in-memory smoke with the operator-provided JAR:

```powershell
node scripts/hobit/smoke-jdbc-sidecar.mjs --driver-jar C:\path\to\h2-2.4.240.jar --driver-class org.h2.Driver --jdbc-url "jdbc:h2:mem:hobit_smoke;DB_CLOSE_DELAY=-1" --query "SELECT 1"
```

Expected success shape: the script reports optional DB smoke passed with
`1 rows returned`. The H2 path uses an in-memory DB and no password.

Optional real DB smoke is manual and requires a user-provided safe test driver
and database:

```powershell
node scripts/hobit/smoke-jdbc-sidecar.mjs --driver-jar ... --driver-class ... --jdbc-url ... --username ... --password-env JDBC_PASSWORD --query "SELECT 1"
```

The smoke accepts a password environment variable name only; it has no password
value flag. It rejects obvious secret-bearing JDBC URL parameters, non-SELECT/
WITH queries, missing driver JARs, and missing required DB-smoke arguments. It
does not scan folders, download drivers, bundle proprietary drivers, persist
runtime values, or make real DB smoke part of normal validation.

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
