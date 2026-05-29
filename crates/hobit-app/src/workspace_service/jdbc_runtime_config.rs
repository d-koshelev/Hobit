use std::collections::BTreeMap;
use std::env;
use std::fmt;
use std::path::PathBuf;

use hobit_storage_sqlite::JdbcConnectorRow;

use super::jdbc_query_types::{
    JdbcExperimentalSidecarRuntimeInput, JdbcReadOnlyQueryResultSummary,
};
use super::jdbc_runtime::{
    JdbcConnectorRuntimeConfig, JdbcReadOnlyAdapterRequest, JdbcReadOnlyRuntimeConnector,
    JdbcRuntimeSecret, JdbcSidecarRuntimeConfig, MockReadOnlyJdbcAdapter, ReadOnlyJdbcAdapter,
    SidecarReadOnlyJdbcAdapter,
};
use super::jdbc_sidecar_protocol::JdbcSidecarProcessRunner;

pub(super) const ENV_JDBC_RUNTIME_MODE: &str = "HOBIT_JDBC_RUNTIME_MODE";
pub(super) const ENV_JDBC_SIDECAR_ENABLED: &str = "HOBIT_JDBC_SIDECAR_ENABLED";
pub(super) const ENV_JDBC_SIDECAR_JAVA_PROGRAM: &str = "HOBIT_JDBC_SIDECAR_JAVA_PROGRAM";
pub(super) const ENV_JDBC_SIDECAR_JAR: &str = "HOBIT_JDBC_SIDECAR_JAR";
pub(super) const ENV_JDBC_SIDECAR_CLASSPATH: &str = "HOBIT_JDBC_SIDECAR_CLASSPATH";
pub(super) const ENV_JDBC_SIDECAR_MAIN_CLASS: &str = "HOBIT_JDBC_SIDECAR_MAIN_CLASS";
pub(super) const ENV_JDBC_SIDECAR_WORKING_DIR: &str = "HOBIT_JDBC_SIDECAR_WORKING_DIR";
pub(super) const ENV_JDBC_SIDECAR_CONNECTOR_ID: &str = "HOBIT_JDBC_SIDECAR_CONNECTOR_ID";
pub(super) const ENV_JDBC_SIDECAR_RUNTIME_KIND: &str = "HOBIT_JDBC_SIDECAR_RUNTIME_KIND";
pub(super) const ENV_JDBC_SIDECAR_DRIVER_KIND: &str = "HOBIT_JDBC_SIDECAR_DRIVER_KIND";
pub(super) const ENV_JDBC_SIDECAR_TIMEOUT_MS: &str = "HOBIT_JDBC_SIDECAR_TIMEOUT_MS";
pub(super) const ENV_JDBC_SIDECAR_JDBC_URL_PRESENT: &str = "HOBIT_JDBC_SIDECAR_JDBC_URL_PRESENT";
pub(super) const ENV_JDBC_SIDECAR_USERNAME_PRESENT: &str = "HOBIT_JDBC_SIDECAR_USERNAME_PRESENT";
pub(super) const ENV_JDBC_SIDECAR_PASSWORD_PRESENT: &str = "HOBIT_JDBC_SIDECAR_PASSWORD_PRESENT";

const DEFAULT_SIDECAR_JAVA_PROGRAM: &str = "java";
const DEFAULT_SIDECAR_MAIN_CLASS: &str = "com.hobit.jdbc.JdbcReadOnlySidecar";
const DEFAULT_SIDECAR_RUNTIME_KIND: &str = "mock_read_only";
const REAL_JDBC_RUNTIME_KIND: &str = "real_jdbc";
const DEFAULT_SIDECAR_DRIVER_KIND: &str = "jdbc";
const DEFAULT_SIDECAR_TIMEOUT_MS: u64 = 10_000;
const MAX_SIDECAR_TIMEOUT_MS: u64 = 10_000;

const ADAPTER_MOCK: &str = "mock";
const ADAPTER_SIDECAR: &str = "sidecar";
const STATUS_MOCK_ACTIVE: &str = "mock_active";
const STATUS_SIDECAR_CONFIGURED: &str = "sidecar_configured";
const STATUS_SIDECAR_NOT_CONFIGURED: &str = "sidecar_not_configured";
const STATUS_UNSUPPORTED_RUNTIME: &str = "unsupported_runtime";

const SIDECAR_NOT_CONFIGURED_MESSAGE: &str =
    "JDBC sidecar runtime is not configured for read-only execution.";

#[derive(Clone, Eq, PartialEq)]
pub(super) struct JdbcRuntimeConfig {
    adapter: JdbcRuntimeAdapterConfig,
    status: JdbcRuntimeStatusSummary,
}

impl JdbcRuntimeConfig {
    pub(super) fn mock() -> Self {
        Self {
            adapter: JdbcRuntimeAdapterConfig::Mock,
            status: JdbcRuntimeStatusSummary::mock_active(),
        }
    }

    #[allow(dead_code)]
    pub(super) fn from_env() -> Self {
        let mut values = BTreeMap::new();
        for key in JDBC_RUNTIME_ENV_KEYS {
            if let Ok(value) = env::var(key) {
                values.insert((*key).to_owned(), value);
            }
        }
        Self::from_env_values(&values)
    }

    pub(super) fn from_env_values(values: &BTreeMap<String, String>) -> Self {
        let mode = value(values, ENV_JDBC_RUNTIME_MODE)
            .unwrap_or("mock")
            .to_ascii_lowercase();

        match mode.as_str() {
            "" | "mock" | "mock_only" => Self::mock(),
            "sidecar" | "java_sidecar" => Self::sidecar_from_env_values(values),
            _ => Self {
                adapter: JdbcRuntimeAdapterConfig::Sidecar(JdbcSidecarAdapterRuntime::unavailable(
                    None,
                    SIDECAR_NOT_CONFIGURED_MESSAGE,
                    JdbcSidecarCredentialPresence::default(),
                )),
                status: JdbcRuntimeStatusSummary {
                    adapter: ADAPTER_SIDECAR.to_owned(),
                    status: STATUS_UNSUPPORTED_RUNTIME.to_owned(),
                    message: "JDBC runtime mode is unsupported.".to_owned(),
                    sidecar_enabled: false,
                    connector_runtime_id: None,
                    runtime_kind: None,
                    driver_kind: None,
                    credential_presence: JdbcSidecarCredentialPresence::default(),
                },
            },
        }
    }

    pub(super) fn from_explicit_sidecar(
        connector_id: &str,
        input: &JdbcExperimentalSidecarRuntimeInput,
        row_limit: usize,
        timeout_ms: u64,
        max_result_bytes: usize,
    ) -> Self {
        if !input.enabled {
            return Self::mock();
        }

        let credential_presence = JdbcSidecarCredentialPresence {
            jdbc_url: true,
            username: input
                .username
                .as_ref()
                .is_some_and(|value| !value.trim().is_empty()),
            password: input
                .credential_env_var_name
                .as_ref()
                .is_some_and(|value| !value.trim().is_empty()),
        };

        let driver_jar_path = input.driver_jar_path.trim();
        let jdbc_url = input.jdbc_url.trim();
        let sidecar_timeout_ms = input
            .timeout_ms
            .unwrap_or(timeout_ms)
            .clamp(1, MAX_SIDECAR_TIMEOUT_MS);
        let mut status = JdbcRuntimeStatusSummary {
            adapter: ADAPTER_SIDECAR.to_owned(),
            status: STATUS_SIDECAR_NOT_CONFIGURED.to_owned(),
            message: SIDECAR_NOT_CONFIGURED_MESSAGE.to_owned(),
            sidecar_enabled: true,
            connector_runtime_id: Some(connector_id.to_owned()),
            runtime_kind: Some(REAL_JDBC_RUNTIME_KIND.to_owned()),
            driver_kind: Some(DEFAULT_SIDECAR_DRIVER_KIND.to_owned()),
            credential_presence: credential_presence.clone(),
        };

        if driver_jar_path.is_empty() {
            status.message =
                "JDBC driver JAR path is required for experimental sidecar execution.".to_owned();
            return Self {
                adapter: JdbcRuntimeAdapterConfig::Sidecar(JdbcSidecarAdapterRuntime::unavailable(
                    Some(connector_id.to_owned()),
                    &status.message,
                    credential_presence,
                )),
                status,
            };
        }

        if jdbc_url.is_empty() {
            status.message = "JDBC URL is required for experimental sidecar execution.".to_owned();
            return Self {
                adapter: JdbcRuntimeAdapterConfig::Sidecar(JdbcSidecarAdapterRuntime::unavailable(
                    Some(connector_id.to_owned()),
                    &status.message,
                    credential_presence,
                )),
                status,
            };
        }

        if contains_secret_bearing_url_key(jdbc_url) {
            status.message =
                "JDBC URL must not contain password, token, or secret parameters; use a credential environment variable name.".to_owned();
            return Self {
                adapter: JdbcRuntimeAdapterConfig::Sidecar(JdbcSidecarAdapterRuntime::unavailable(
                    Some(connector_id.to_owned()),
                    &status.message,
                    credential_presence,
                )),
                status,
            };
        }

        let launch = explicit_sidecar_launch(input, sidecar_timeout_ms);
        status.status = if launch.runner.is_some() {
            STATUS_SIDECAR_CONFIGURED.to_owned()
        } else {
            STATUS_SIDECAR_NOT_CONFIGURED.to_owned()
        };
        status.message = launch.safe_status_message.clone();

        Self {
            adapter: JdbcRuntimeAdapterConfig::Sidecar(JdbcSidecarAdapterRuntime {
                connector_id: Some(connector_id.to_owned()),
                driver_kind: DEFAULT_SIDECAR_DRIVER_KIND.to_owned(),
                runtime_kind: REAL_JDBC_RUNTIME_KIND.to_owned(),
                credential_presence,
                explicit_runtime: Some(ExplicitJdbcSidecarRuntime {
                    driver_jar_path: driver_jar_path.to_owned(),
                    driver_class_name: trim_option(input.driver_class_name.as_deref()),
                    jdbc_url: JdbcRuntimeSecret::new(jdbc_url),
                    username: trim_option(input.username.as_deref()),
                    credential_env_var_name: trim_option(input.credential_env_var_name.as_deref()),
                    max_rows: row_limit,
                    timeout_ms,
                    max_result_bytes,
                }),
                runner: launch.runner,
                unavailable_message: Some(launch.safe_status_message),
            }),
            status,
        }
    }

    #[allow(dead_code)]
    pub(super) fn status(&self) -> &JdbcRuntimeStatusSummary {
        &self.status
    }

    pub(super) fn runtime_connector(&self, row: JdbcConnectorRow) -> JdbcReadOnlyRuntimeConnector {
        match &self.adapter {
            JdbcRuntimeAdapterConfig::Mock => JdbcReadOnlyRuntimeConnector::mock_only(row),
            JdbcRuntimeAdapterConfig::Sidecar(config) => config.runtime_connector(row),
        }
    }

    pub(super) fn execute_read_only_query(
        &self,
        request: JdbcReadOnlyAdapterRequest,
    ) -> JdbcReadOnlyQueryResultSummary {
        match &self.adapter {
            JdbcRuntimeAdapterConfig::Mock => {
                MockReadOnlyJdbcAdapter.execute_read_only_query(request)
            }
            JdbcRuntimeAdapterConfig::Sidecar(config) => {
                config.adapter().execute_read_only_query(request)
            }
        }
    }

    fn sidecar_from_env_values(values: &BTreeMap<String, String>) -> Self {
        let credential_presence = JdbcSidecarCredentialPresence {
            jdbc_url: bool_value(values, ENV_JDBC_SIDECAR_JDBC_URL_PRESENT).unwrap_or(false),
            username: bool_value(values, ENV_JDBC_SIDECAR_USERNAME_PRESENT).unwrap_or(false),
            password: bool_value(values, ENV_JDBC_SIDECAR_PASSWORD_PRESENT).unwrap_or(false),
        };
        let connector_id = value(values, ENV_JDBC_SIDECAR_CONNECTOR_ID).map(ToOwned::to_owned);
        let runtime_kind = value(values, ENV_JDBC_SIDECAR_RUNTIME_KIND)
            .unwrap_or(DEFAULT_SIDECAR_RUNTIME_KIND)
            .to_owned();
        let driver_kind = value(values, ENV_JDBC_SIDECAR_DRIVER_KIND)
            .unwrap_or(DEFAULT_SIDECAR_DRIVER_KIND)
            .to_owned();
        let timeout_ms = u64_value(values, ENV_JDBC_SIDECAR_TIMEOUT_MS)
            .unwrap_or(DEFAULT_SIDECAR_TIMEOUT_MS)
            .clamp(1, MAX_SIDECAR_TIMEOUT_MS);
        let sidecar_enabled = bool_value(values, ENV_JDBC_SIDECAR_ENABLED).unwrap_or(false);

        let mut status = JdbcRuntimeStatusSummary {
            adapter: ADAPTER_SIDECAR.to_owned(),
            status: STATUS_SIDECAR_NOT_CONFIGURED.to_owned(),
            message: SIDECAR_NOT_CONFIGURED_MESSAGE.to_owned(),
            sidecar_enabled,
            connector_runtime_id: connector_id.clone(),
            runtime_kind: Some(runtime_kind.clone()),
            driver_kind: Some(driver_kind.clone()),
            credential_presence: credential_presence.clone(),
        };

        let Some(connector_id) = connector_id else {
            return Self {
                adapter: JdbcRuntimeAdapterConfig::Sidecar(JdbcSidecarAdapterRuntime::unavailable(
                    None,
                    SIDECAR_NOT_CONFIGURED_MESSAGE,
                    credential_presence,
                )),
                status,
            };
        };

        if !sidecar_enabled {
            return Self {
                adapter: JdbcRuntimeAdapterConfig::Sidecar(JdbcSidecarAdapterRuntime::unavailable(
                    Some(connector_id),
                    SIDECAR_NOT_CONFIGURED_MESSAGE,
                    credential_presence,
                )),
                status,
            };
        }

        let launch = sidecar_launch_from_values(values, timeout_ms);
        status.status = if launch.runner.is_some() {
            STATUS_SIDECAR_CONFIGURED.to_owned()
        } else {
            STATUS_SIDECAR_NOT_CONFIGURED.to_owned()
        };
        status.message = launch.safe_status_message.clone();

        Self {
            adapter: JdbcRuntimeAdapterConfig::Sidecar(JdbcSidecarAdapterRuntime {
                connector_id: Some(connector_id),
                driver_kind,
                runtime_kind,
                credential_presence,
                explicit_runtime: None,
                runner: launch.runner,
                unavailable_message: Some(launch.safe_status_message),
            }),
            status,
        }
    }
}

impl Default for JdbcRuntimeConfig {
    fn default() -> Self {
        Self::mock()
    }
}

impl fmt::Debug for JdbcRuntimeConfig {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("JdbcRuntimeConfig")
            .field("status", &self.status)
            .field("adapter", &self.adapter)
            .finish()
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct JdbcRuntimeStatusSummary {
    pub(super) adapter: String,
    pub(super) status: String,
    pub(super) message: String,
    pub(super) sidecar_enabled: bool,
    pub(super) connector_runtime_id: Option<String>,
    pub(super) runtime_kind: Option<String>,
    pub(super) driver_kind: Option<String>,
    pub(super) credential_presence: JdbcSidecarCredentialPresence,
}

impl JdbcRuntimeStatusSummary {
    fn mock_active() -> Self {
        Self {
            adapter: ADAPTER_MOCK.to_owned(),
            status: STATUS_MOCK_ACTIVE.to_owned(),
            message: "JDBC mock read-only adapter is active.".to_owned(),
            sidecar_enabled: false,
            connector_runtime_id: None,
            runtime_kind: None,
            driver_kind: None,
            credential_presence: JdbcSidecarCredentialPresence::default(),
        }
    }
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub(super) struct JdbcSidecarCredentialPresence {
    pub(super) jdbc_url: bool,
    pub(super) username: bool,
    pub(super) password: bool,
}

#[derive(Clone, Eq, PartialEq)]
enum JdbcRuntimeAdapterConfig {
    Mock,
    Sidecar(JdbcSidecarAdapterRuntime),
}

impl fmt::Debug for JdbcRuntimeAdapterConfig {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Mock => formatter.write_str("Mock"),
            Self::Sidecar(config) => formatter.debug_tuple("Sidecar").field(config).finish(),
        }
    }
}

#[derive(Clone, Eq, PartialEq)]
struct JdbcSidecarAdapterRuntime {
    connector_id: Option<String>,
    driver_kind: String,
    runtime_kind: String,
    credential_presence: JdbcSidecarCredentialPresence,
    explicit_runtime: Option<ExplicitJdbcSidecarRuntime>,
    runner: Option<JdbcSidecarProcessRunner>,
    unavailable_message: Option<String>,
}

#[derive(Clone, Eq, PartialEq)]
struct ExplicitJdbcSidecarRuntime {
    driver_jar_path: String,
    driver_class_name: Option<String>,
    jdbc_url: JdbcRuntimeSecret,
    username: Option<String>,
    credential_env_var_name: Option<String>,
    max_rows: usize,
    timeout_ms: u64,
    max_result_bytes: usize,
}

impl fmt::Debug for ExplicitJdbcSidecarRuntime {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("ExplicitJdbcSidecarRuntime")
            .field("driver_jar_path_configured", &true)
            .field(
                "driver_class_name_configured",
                &self.driver_class_name.is_some(),
            )
            .field("jdbc_url_configured", &true)
            .field("username_configured", &self.username.is_some())
            .field(
                "credential_env_var_name_configured",
                &self.credential_env_var_name.is_some(),
            )
            .field("max_rows", &self.max_rows)
            .field("timeout_ms", &self.timeout_ms)
            .field("max_result_bytes", &self.max_result_bytes)
            .finish()
    }
}

impl JdbcSidecarAdapterRuntime {
    fn unavailable(
        connector_id: Option<String>,
        unavailable_message: &str,
        credential_presence: JdbcSidecarCredentialPresence,
    ) -> Self {
        Self {
            connector_id,
            driver_kind: DEFAULT_SIDECAR_DRIVER_KIND.to_owned(),
            runtime_kind: DEFAULT_SIDECAR_RUNTIME_KIND.to_owned(),
            credential_presence,
            explicit_runtime: None,
            runner: None,
            unavailable_message: Some(unavailable_message.to_owned()),
        }
    }

    fn runtime_connector(&self, row: JdbcConnectorRow) -> JdbcReadOnlyRuntimeConnector {
        let runtime_config = if self.connector_id.as_deref() != Some(row.connector_id.as_str()) {
            JdbcConnectorRuntimeConfig::NotConfigured
        } else if row.driver_kind != self.driver_kind {
            JdbcConnectorRuntimeConfig::UnsupportedDriver {
                driver_kind: row.driver_kind.clone(),
            }
        } else {
            JdbcConnectorRuntimeConfig::Sidecar(JdbcSidecarRuntimeConfig {
                driver_kind: self.driver_kind.clone(),
                runtime_kind: self.runtime_kind.clone(),
                driver_jar_path: self
                    .explicit_runtime
                    .as_ref()
                    .map(|runtime| runtime.driver_jar_path.clone()),
                driver_class_name: self
                    .explicit_runtime
                    .as_ref()
                    .and_then(|runtime| runtime.driver_class_name.clone()),
                jdbc_url: self
                    .explicit_runtime
                    .as_ref()
                    .map(|runtime| runtime.jdbc_url.clone())
                    .or_else(|| Some(JdbcRuntimeSecret::presence_marker("jdbc_url"))),
                username: self
                    .explicit_runtime
                    .as_ref()
                    .and_then(|runtime| runtime.username.clone()),
                credential_env_var_name: self
                    .explicit_runtime
                    .as_ref()
                    .and_then(|runtime| runtime.credential_env_var_name.clone()),
            })
        };

        JdbcReadOnlyRuntimeConnector {
            connector_id: row.connector_id,
            display_name: row.display_name,
            database_kind: row.database_kind,
            driver_kind: row.driver_kind,
            environment: row.environment,
            runtime_config,
        }
    }

    fn adapter(&self) -> SidecarReadOnlyJdbcAdapter {
        match &self.runner {
            Some(runner) => SidecarReadOnlyJdbcAdapter::with_runner(runner.clone()),
            None => SidecarReadOnlyJdbcAdapter::unavailable(
                self.unavailable_message
                    .as_deref()
                    .unwrap_or(SIDECAR_NOT_CONFIGURED_MESSAGE),
            ),
        }
    }
}

impl fmt::Debug for JdbcSidecarAdapterRuntime {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("JdbcSidecarAdapterRuntime")
            .field("connector_id", &self.connector_id)
            .field("driver_kind", &self.driver_kind)
            .field("runtime_kind", &self.runtime_kind)
            .field("credential_presence", &self.credential_presence)
            .field("explicit_runtime", &self.explicit_runtime)
            .field("runner_configured", &self.runner.is_some())
            .field("unavailable_message", &self.unavailable_message)
            .finish()
    }
}

fn explicit_sidecar_launch(
    input: &JdbcExperimentalSidecarRuntimeInput,
    timeout_ms: u64,
) -> JdbcSidecarLaunchConfig {
    let values = BTreeMap::from([
        (
            ENV_JDBC_SIDECAR_JAVA_PROGRAM.to_owned(),
            input
                .java_program
                .as_deref()
                .unwrap_or(DEFAULT_SIDECAR_JAVA_PROGRAM)
                .to_owned(),
        ),
        (
            ENV_JDBC_SIDECAR_JAR.to_owned(),
            input.sidecar_jar_path.clone().unwrap_or_default(),
        ),
        (
            ENV_JDBC_SIDECAR_CLASSPATH.to_owned(),
            input.sidecar_classpath.clone().unwrap_or_default(),
        ),
        (
            ENV_JDBC_SIDECAR_MAIN_CLASS.to_owned(),
            input
                .sidecar_main_class
                .as_deref()
                .unwrap_or(DEFAULT_SIDECAR_MAIN_CLASS)
                .to_owned(),
        ),
        (ENV_JDBC_SIDECAR_WORKING_DIR.to_owned(), ".".to_owned()),
    ]);

    sidecar_launch_from_values(&values, timeout_ms)
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct JdbcSidecarLaunchConfig {
    runner: Option<JdbcSidecarProcessRunner>,
    safe_status_message: String,
}

fn sidecar_launch_from_values(
    values: &BTreeMap<String, String>,
    timeout_ms: u64,
) -> JdbcSidecarLaunchConfig {
    let java_program =
        value(values, ENV_JDBC_SIDECAR_JAVA_PROGRAM).unwrap_or(DEFAULT_SIDECAR_JAVA_PROGRAM);
    let working_directory = value(values, ENV_JDBC_SIDECAR_WORKING_DIR).unwrap_or(".");
    let jar = value(values, ENV_JDBC_SIDECAR_JAR);
    let classpath = value(values, ENV_JDBC_SIDECAR_CLASSPATH);
    let main_class =
        value(values, ENV_JDBC_SIDECAR_MAIN_CLASS).unwrap_or(DEFAULT_SIDECAR_MAIN_CLASS);

    if java_program.is_empty() {
        return JdbcSidecarLaunchConfig {
            runner: None,
            safe_status_message: "JDBC sidecar Java program is not configured.".to_owned(),
        };
    }

    let args = if let Some(jar) = jar {
        vec!["-jar".to_owned(), jar.to_owned()]
    } else if let Some(classpath) = classpath {
        vec![
            "-cp".to_owned(),
            classpath.to_owned(),
            main_class.to_owned(),
        ]
    } else {
        return JdbcSidecarLaunchConfig {
            runner: None,
            safe_status_message: "JDBC sidecar classpath or jar is not configured.".to_owned(),
        };
    };

    JdbcSidecarLaunchConfig {
        runner: Some(JdbcSidecarProcessRunner::new(
            java_program,
            args,
            PathBuf::from(working_directory),
            timeout_ms,
        )),
        safe_status_message: "JDBC sidecar runtime is configured for opt-in read-only execution."
            .to_owned(),
    }
}

fn value<'a>(values: &'a BTreeMap<String, String>, key: &str) -> Option<&'a str> {
    let value = values.get(key)?.trim();
    (!value.is_empty()).then_some(value)
}

fn bool_value(values: &BTreeMap<String, String>, key: &str) -> Option<bool> {
    match value(values, key)?.to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" | "enabled" => Some(true),
        "0" | "false" | "no" | "off" | "disabled" => Some(false),
        _ => None,
    }
}

fn u64_value(values: &BTreeMap<String, String>, key: &str) -> Option<u64> {
    value(values, key)?.parse::<u64>().ok()
}

fn trim_option(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    (!value.is_empty()).then(|| value.to_owned())
}

fn contains_secret_bearing_url_key(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    [
        "password=",
        "passwd=",
        "pwd=",
        "token=",
        "secret=",
        "apikey=",
        "api_key=",
    ]
    .iter()
    .any(|key| lower.contains(key))
}

const JDBC_RUNTIME_ENV_KEYS: &[&str] = &[
    ENV_JDBC_RUNTIME_MODE,
    ENV_JDBC_SIDECAR_ENABLED,
    ENV_JDBC_SIDECAR_JAVA_PROGRAM,
    ENV_JDBC_SIDECAR_JAR,
    ENV_JDBC_SIDECAR_CLASSPATH,
    ENV_JDBC_SIDECAR_MAIN_CLASS,
    ENV_JDBC_SIDECAR_WORKING_DIR,
    ENV_JDBC_SIDECAR_CONNECTOR_ID,
    ENV_JDBC_SIDECAR_RUNTIME_KIND,
    ENV_JDBC_SIDECAR_DRIVER_KIND,
    ENV_JDBC_SIDECAR_TIMEOUT_MS,
    ENV_JDBC_SIDECAR_JDBC_URL_PRESENT,
    ENV_JDBC_SIDECAR_USERNAME_PRESENT,
    ENV_JDBC_SIDECAR_PASSWORD_PRESENT,
];
