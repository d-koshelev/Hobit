use std::{
    env, fs,
    io::{Read, Write},
    net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream},
    path::{Component, Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread::{self, JoinHandle},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

#[cfg(test)]
use hobit_app::FinishAssignedAgentQueueTaskRunInput;
use hobit_app::{
    AgentQueueTaskRunStatus, CheckQueueLocalProviderAuthContextInput,
    CheckQueueLocalProviderReadinessInput, QueueLocalProviderEnvironmentSummary,
    QueueLocalProviderReadinessSummary, SelectedAgentQueueTaskLocalStartSummary,
    QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID,
};
#[cfg(test)]
use hobit_storage_sqlite::NewAgentQueueTaskRunLink;
use hobit_storage_sqlite::SqliteStore;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::Manager;

use crate::{
    app_state::{ActiveWorkspaceContext, ActiveWorkspaceRegistry, AppState},
    dogfood_operator::{
        real_worker_runner, run_dogfood_operator_for_app_workspace_with_runner,
        run_dogfood_plan_for_app_workspace, run_dogfood_resume_for_app_workspace_with_runner,
        DogfoodOperatorAppWorkspaceRunInput, DogfoodOperatorContextEvidence,
        DogfoodOperatorWorkerOutcome,
    },
};

pub(crate) const DOGFOOD_OPERATOR_ENDPOINT_FILE_NAME: &str = "dogfood-operator-endpoint.json";
const ENDPOINT_KIND: &str = "loopback_http_json";
const AUTH_HEADER: &str = "x-hobit-dogfood-token";
const NO_ACTIVE_WORKSPACE_MESSAGE: &str = "No active app workspace available for dogfood operator.";
const MAX_HTTP_REQUEST_BYTES: usize = 1024 * 1024;

pub(crate) fn start_dogfood_operator_endpoint<R: tauri::Runtime>(
    app: &tauri::App<R>,
) -> Result<(), Box<dyn std::error::Error>> {
    let state = app.state::<AppState>();
    let rendezvous_path = env::var_os("HOBIT_DOGFOOD_OPERATOR_ENDPOINT_FILE")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            state
                .profile_data_dir()
                .join(DOGFOOD_OPERATOR_ENDPOINT_FILE_NAME)
        });
    let config = DogfoodOperatorEndpointConfig::new(
        state.db_path().to_path_buf(),
        state.profile_mode().to_owned(),
        state.active_workspace(),
        rendezvous_path,
    );
    let server = DogfoodOperatorEndpointServer::start(config)?;
    app.manage(server);
    Ok(())
}

#[derive(Clone)]
pub(crate) struct DogfoodOperatorEndpointConfig {
    db_path: PathBuf,
    profile_mode: String,
    active_workspace: ActiveWorkspaceRegistry,
    rendezvous_path: PathBuf,
    token: String,
    worker_mode: DogfoodOperatorEndpointWorkerMode,
    provider_readiness_mode: DogfoodOperatorEndpointProviderReadinessMode,
}

impl DogfoodOperatorEndpointConfig {
    pub(crate) fn new(
        db_path: PathBuf,
        profile_mode: String,
        active_workspace: ActiveWorkspaceRegistry,
        rendezvous_path: PathBuf,
    ) -> Self {
        Self {
            db_path,
            profile_mode,
            active_workspace,
            rendezvous_path,
            token: generate_token(),
            worker_mode: DogfoodOperatorEndpointWorkerMode::Real,
            provider_readiness_mode: DogfoodOperatorEndpointProviderReadinessMode::Real,
        }
    }

    #[cfg(test)]
    fn with_token(mut self, token: impl Into<String>) -> Self {
        self.token = token.into();
        self
    }

    #[cfg(test)]
    fn with_fake_worker_status(mut self, status: impl Into<String>) -> Self {
        self.worker_mode = DogfoodOperatorEndpointWorkerMode::FakeCompletedForTests(status.into());
        self
    }

    #[cfg(test)]
    fn with_fake_provider_readiness(
        mut self,
        readiness: QueueLocalProviderReadinessSummary,
    ) -> Self {
        self.provider_readiness_mode =
            DogfoodOperatorEndpointProviderReadinessMode::Fake(readiness);
        self
    }
}

#[derive(Clone)]
enum DogfoodOperatorEndpointWorkerMode {
    Real,
    #[cfg(test)]
    FakeCompletedForTests(String),
}

#[derive(Clone)]
enum DogfoodOperatorEndpointProviderReadinessMode {
    Real,
    #[cfg(test)]
    Fake(QueueLocalProviderReadinessSummary),
}

#[derive(Clone)]
struct DogfoodOperatorEndpointState {
    db_path: PathBuf,
    profile_mode: String,
    active_workspace: ActiveWorkspaceRegistry,
    endpoint_kind: String,
    endpoint_pid: u32,
    worker_mode: DogfoodOperatorEndpointWorkerMode,
    provider_readiness_mode: DogfoodOperatorEndpointProviderReadinessMode,
}

pub(crate) struct DogfoodOperatorEndpointServer {
    local_addr: SocketAddr,
    rendezvous_path: PathBuf,
    running: Arc<AtomicBool>,
    handle: Mutex<Option<JoinHandle<()>>>,
}

impl DogfoodOperatorEndpointServer {
    pub(crate) fn start(config: DogfoodOperatorEndpointConfig) -> Result<Self, String> {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).map_err(|error| {
            format!("failed to bind dogfood operator endpoint to loopback: {error}")
        })?;
        let local_addr = listener.local_addr().map_err(|error| {
            format!("failed to read dogfood operator endpoint address: {error}")
        })?;
        if !local_addr.ip().is_loopback() {
            return Err("dogfood operator endpoint must bind only to loopback".to_owned());
        }

        let endpoint_pid = std::process::id();
        let rendezvous = DogfoodOperatorEndpointRendezvous {
            endpoint_kind: ENDPOINT_KIND.to_owned(),
            host: "127.0.0.1".to_owned(),
            port: local_addr.port(),
            auth_token: config.token.clone(),
            process_id: endpoint_pid,
            created_at: timestamp_millis().to_string(),
        };
        write_rendezvous_file(&config.rendezvous_path, &rendezvous)?;

        let running = Arc::new(AtomicBool::new(true));
        let thread_running = running.clone();
        let token = config.token.clone();
        let state = DogfoodOperatorEndpointState {
            db_path: config.db_path,
            profile_mode: config.profile_mode,
            active_workspace: config.active_workspace,
            endpoint_kind: ENDPOINT_KIND.to_owned(),
            endpoint_pid,
            worker_mode: config.worker_mode,
            provider_readiness_mode: config.provider_readiness_mode,
        };
        let handle = thread::spawn(move || {
            for stream in listener.incoming() {
                if !thread_running.load(Ordering::SeqCst) {
                    break;
                }
                match stream {
                    Ok(stream) => handle_connection(stream, &state, &token),
                    Err(error) => {
                        eprintln!("dogfood operator endpoint connection failed: {error}");
                        break;
                    }
                }
            }
        });

        Ok(Self {
            local_addr,
            rendezvous_path: config.rendezvous_path,
            running,
            handle: Mutex::new(Some(handle)),
        })
    }

    #[cfg(test)]
    fn local_addr(&self) -> SocketAddr {
        self.local_addr
    }
}

impl Drop for DogfoodOperatorEndpointServer {
    fn drop(&mut self) {
        self.running.store(false, Ordering::SeqCst);
        let _ = TcpStream::connect(self.local_addr);
        if let Some(handle) = self.handle.lock().expect("endpoint thread lock").take() {
            let _ = handle.join();
        }
        let _ = fs::remove_file(&self.rendezvous_path);
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DogfoodOperatorEndpointRendezvous {
    pub(crate) endpoint_kind: String,
    pub(crate) host: String,
    pub(crate) port: u16,
    pub(crate) auth_token: String,
    pub(crate) process_id: u32,
    pub(crate) created_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct EndpointPackRequest {
    pack_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct EndpointStartPackTaskRequest {
    pack_path: String,
    pack_task_id: String,
    allow_real_worker: bool,
    #[serde(default)]
    allow_unknown_provider_readiness: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct EndpointResumeDogfoodRequest {
    pack_path: String,
    allow_real_worker: bool,
    #[serde(default)]
    allow_unknown_provider_readiness: bool,
    #[serde(default)]
    recover_stale_dogfood_run: bool,
    #[serde(default)]
    run_link_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct EndpointRecoverStaleDogfoodRunRequest {
    pack_path: String,
    run_link_id: String,
    #[serde(default)]
    allow_unknown_provider_readiness: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct EndpointProviderReadinessRequest {
    provider_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct EndpointProviderAuthContextRequest {
    provider_id: String,
    operator_environment_summary: Vec<QueueLocalProviderEnvironmentSummary>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct EndpointRunDetailRequest {
    run_link_id: Option<String>,
    queue_task_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct EndpointEnsureWorkspaceForRootRequest {
    workspace_root: String,
}

struct HttpRequest {
    method: String,
    path: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

fn handle_connection(mut stream: TcpStream, state: &DogfoodOperatorEndpointState, token: &str) {
    let response = match read_http_request(&mut stream) {
        Ok(request) => route_request(request, state, token),
        Err(error) => json_error(400, "bad_request", error),
    };
    let _ = write_json_response(&mut stream, response.status, &response.body);
}

fn route_request(
    request: HttpRequest,
    state: &DogfoodOperatorEndpointState,
    token: &str,
) -> JsonResponse {
    if header_value(&request.headers, AUTH_HEADER) != Some(token) {
        return json_error(401, "unauthorized", "dogfood operator token is required");
    }

    match (request.method.as_str(), request.path.as_str()) {
        ("GET", "/health") => endpoint_context(state)
            .map(|operator_context| {
                json_ok(json!({
                    "ok": true,
                    "operatorContext": operator_context,
                    "endpointKind": state.endpoint_kind,
                    "endpointPid": state.endpoint_pid
                }))
            })
            .unwrap_or_else(|error| json_error(409, "no_active_workspace", error)),
        ("GET", "/endpoint-info") => endpoint_context(state)
            .map(|operator_context| {
                json_ok(json!({
                    "endpointKind": state.endpoint_kind,
                    "endpointPid": state.endpoint_pid,
                    "operatorContext": operator_context
                }))
            })
            .unwrap_or_else(|error| json_error(409, "no_active_workspace", error)),
        ("POST", "/provider_readiness") => {
            let request: EndpointProviderReadinessRequest = match parse_json_body(&request.body) {
                Ok(request) => request,
                Err(error) => return json_error(400, "invalid_request", error),
            };
            provider_readiness(state, request.provider_id)
        }
        ("POST", "/provider_auth_context") => {
            let request: EndpointProviderAuthContextRequest = match parse_json_body(&request.body) {
                Ok(request) => request,
                Err(error) => return json_error(400, "invalid_request", error),
            };
            provider_auth_context(state, request)
        }
        ("POST", "/ensure_workspace_for_root") => {
            let request: EndpointEnsureWorkspaceForRootRequest =
                match parse_json_body(&request.body) {
                    Ok(request) => request,
                    Err(error) => return json_error(400, "invalid_request", error),
                };
            ensure_workspace_for_root(state, request.workspace_root)
        }
        ("POST", "/preview_prompt_pack_file") => {
            let request: EndpointPackRequest = match parse_json_body(&request.body) {
                Ok(request) => request,
                Err(error) => return json_error(400, "invalid_request", error),
            };
            run_pack_operation(
                state,
                request.pack_path,
                true,
                false,
                None,
                None,
                false,
                false,
            )
        }
        ("POST", "/materialize_prompt_pack_file") => {
            let request: EndpointPackRequest = match parse_json_body(&request.body) {
                Ok(request) => request,
                Err(error) => return json_error(400, "invalid_request", error),
            };
            run_pack_operation(
                state,
                request.pack_path,
                false,
                true,
                None,
                None,
                false,
                false,
            )
        }
        ("POST", "/dogfood_plan") => {
            let request: EndpointPackRequest = match parse_json_body(&request.body) {
                Ok(request) => request,
                Err(error) => return json_error(400, "invalid_request", error),
            };
            dogfood_plan_operation(state, request.pack_path, false)
        }
        ("POST", "/start_pack_task") => {
            let request: EndpointStartPackTaskRequest = match parse_json_body(&request.body) {
                Ok(request) => request,
                Err(error) => return json_error(400, "invalid_request", error),
            };
            run_pack_operation(
                state,
                request.pack_path,
                false,
                true,
                Some(request.pack_task_id),
                None,
                request.allow_real_worker,
                request.allow_unknown_provider_readiness,
            )
        }
        ("POST", "/retry_pack_task") => {
            let request: EndpointStartPackTaskRequest = match parse_json_body(&request.body) {
                Ok(request) => request,
                Err(error) => return json_error(400, "invalid_request", error),
            };
            run_pack_operation(
                state,
                request.pack_path,
                false,
                true,
                None,
                Some(request.pack_task_id),
                request.allow_real_worker,
                request.allow_unknown_provider_readiness,
            )
        }
        ("POST", "/resume_dogfood") => {
            let request: EndpointResumeDogfoodRequest = match parse_json_body(&request.body) {
                Ok(request) => request,
                Err(error) => return json_error(400, "invalid_request", error),
            };
            resume_dogfood_operation(
                state,
                request.pack_path,
                request.allow_real_worker,
                request.allow_unknown_provider_readiness,
                request.recover_stale_dogfood_run,
                request.run_link_id,
            )
        }
        ("POST", "/recover_stale_dogfood_run") => {
            let request: EndpointRecoverStaleDogfoodRunRequest =
                match parse_json_body(&request.body) {
                    Ok(request) => request,
                    Err(error) => return json_error(400, "invalid_request", error),
                };
            resume_dogfood_operation(
                state,
                request.pack_path,
                true,
                request.allow_unknown_provider_readiness,
                true,
                Some(request.run_link_id),
            )
        }
        ("POST", "/run_detail") => {
            let request: EndpointRunDetailRequest = match parse_json_body(&request.body) {
                Ok(request) => request,
                Err(error) => return json_error(400, "invalid_request", error),
            };
            run_detail(state, request)
        }
        _ => json_error(
            404,
            "not_found",
            "dogfood operator endpoint operation not found",
        ),
    }
}

fn endpoint_context(
    state: &DogfoodOperatorEndpointState,
) -> Result<DogfoodOperatorContextEvidence, String> {
    let active_workspace = state
        .active_workspace
        .current()
        .ok_or_else(|| NO_ACTIVE_WORKSPACE_MESSAGE.to_owned())?;
    let service = workspace_service(&state.db_path)?;
    service
        .get_workspace_summary(&active_workspace.workspace_id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| NO_ACTIVE_WORKSPACE_MESSAGE.to_owned())?;
    let workspace_root = active_workspace.workspace_root;
    Ok(DogfoodOperatorContextEvidence {
        context_source: "running_app_endpoint".to_owned(),
        workspace_id: active_workspace.workspace_id,
        workspace_resolution_method: active_workspace.workspace_resolution_method,
        database_path: None,
        used_direct_database_path: false,
        endpoint_kind: Some(state.endpoint_kind.clone()),
        endpoint_pid: Some(state.endpoint_pid),
        profile_mode: Some(state.profile_mode.clone()),
        workspace_root,
        app_launch_attempted: None,
        app_launch_command_summary: None,
    })
}

fn ensure_workspace_for_root(
    state: &DogfoodOperatorEndpointState,
    workspace_root: String,
) -> JsonResponse {
    let canonical_root = match canonicalize_workspace_root(&workspace_root) {
        Ok(root) => root,
        Err(error) => return json_error(400, "invalid_workspace_root", error),
    };
    let canonical_root_key = canonical_path_key(&canonical_root);
    let workspace_root = display_path(&canonical_root);
    let service = match workspace_service(&state.db_path) {
        Ok(service) => service,
        Err(error) => return json_error(500, "backend_unavailable", error),
    };
    let context = match service
        .ensure_dogfood_operator_workspace_for_root(&canonical_root_key, &workspace_root)
    {
        Ok(context) => context,
        Err(error) => return json_error(400, "workspace_ensure_failed", error.to_string()),
    };
    if let Err(error) = service.open_workspace(&context.workspace_id) {
        return json_error(400, "workspace_open_failed", error.to_string());
    }
    state.active_workspace.set_context(ActiveWorkspaceContext {
        workspace_id: context.workspace_id.clone(),
        workspace_resolution_method: context.workspace_resolution_method.clone(),
        workspace_root: Some(context.workspace_root.clone()),
    });

    json_ok(json!({
        "ok": true,
        "operatorContext": {
            "contextSource": "running_app_endpoint",
            "workspaceId": context.workspace_id,
            "workspaceResolutionMethod": context.workspace_resolution_method,
            "databasePath": Value::Null,
            "usedDirectDatabasePath": false,
            "profileMode": state.profile_mode,
            "endpointKind": state.endpoint_kind,
            "endpointPid": state.endpoint_pid,
            "workspaceRoot": context.workspace_root
        },
        "dogfoodBindingReused": context.dogfood_binding_reused,
        "dogfoodWorkspaceCreated": context.dogfood_workspace_created,
        "warnings": context.warnings
    }))
}

fn provider_readiness(state: &DogfoodOperatorEndpointState, provider_id: String) -> JsonResponse {
    let service = match workspace_service(&state.db_path) {
        Ok(service) => service,
        Err(error) => return json_error(500, "backend_unavailable", error),
    };
    let readiness = match provider_readiness_summary(state, &service, provider_id) {
        Ok(readiness) => readiness,
        Err(error) => return json_error(400, "provider_readiness_failed", error),
    };

    json_ok(json!({
        "ok": true,
        "operatorContext": endpoint_context(state).ok(),
        "providerReadiness": readiness
    }))
}

fn provider_auth_context(
    state: &DogfoodOperatorEndpointState,
    request: EndpointProviderAuthContextRequest,
) -> JsonResponse {
    let service = match workspace_service(&state.db_path) {
        Ok(service) => service,
        Err(error) => return json_error(500, "backend_unavailable", error),
    };
    let auth_context = match service.check_queue_local_provider_auth_context(
        CheckQueueLocalProviderAuthContextInput {
            provider_id: request.provider_id,
            profile_mode: Some(state.profile_mode.clone()),
            operator_environment_summary: request.operator_environment_summary,
        },
    ) {
        Ok(auth_context) => auth_context,
        Err(error) => return json_error(400, "provider_auth_context_failed", error.to_string()),
    };

    json_ok(json!({
        "ok": true,
        "operatorContext": endpoint_context(state).ok(),
        "providerAuthContext": auth_context
    }))
}

fn provider_readiness_summary(
    state: &DogfoodOperatorEndpointState,
    service: &hobit_app::WorkspaceService,
    provider_id: String,
) -> Result<QueueLocalProviderReadinessSummary, String> {
    match &state.provider_readiness_mode {
        DogfoodOperatorEndpointProviderReadinessMode::Real => service
            .check_queue_local_provider_readiness(CheckQueueLocalProviderReadinessInput {
                provider_id,
                profile_mode: Some(state.profile_mode.clone()),
            })
            .map_err(|error| error.to_string()),
        #[cfg(test)]
        DogfoodOperatorEndpointProviderReadinessMode::Fake(readiness) => {
            if provider_id.trim() != readiness.provider_id {
                return Err(format!(
                    "unsupported queue_local provider id: {provider_id}"
                ));
            }
            Ok(readiness.clone())
        }
    }
}

fn run_pack_operation(
    state: &DogfoodOperatorEndpointState,
    pack_path: String,
    preview: bool,
    materialize: bool,
    start_pack_task_id: Option<String>,
    retry_pack_task_id: Option<String>,
    allow_real_worker: bool,
    allow_unknown_provider_readiness: bool,
) -> JsonResponse {
    let pack_path = match normalize_endpoint_pack_path(&pack_path) {
        Ok(pack_path) => pack_path,
        Err(error) => return json_error(400, "invalid_pack_path", error),
    };
    let active_workspace = match state.active_workspace.current() {
        Some(active_workspace) => active_workspace,
        None => return json_error(409, "no_active_workspace", NO_ACTIVE_WORKSPACE_MESSAGE),
    };
    let service = match workspace_service(&state.db_path) {
        Ok(service) => service,
        Err(error) => return json_error(500, "backend_unavailable", error),
    };

    let provider_readiness =
        if allow_real_worker && (start_pack_task_id.is_some() || retry_pack_task_id.is_some()) {
            match provider_readiness_summary(state, &service, "codex".to_owned()) {
                Ok(readiness) => Some(readiness),
                Err(error) => return json_error(400, "provider_readiness_failed", error),
            }
        } else {
            None
        };

    let worker_mode = state.worker_mode.clone();
    let evidence = run_dogfood_operator_for_app_workspace_with_runner(
        &service,
        DogfoodOperatorAppWorkspaceRunInput {
            workspace_id: active_workspace.workspace_id,
            workspace_resolution_method: active_workspace.workspace_resolution_method,
            workspace_root: active_workspace.workspace_root,
            pack_path,
            preview,
            materialize,
            start_pack_task_id,
            retry_pack_task_id,
            allow_worker_start: allow_real_worker,
            endpoint_kind: Some(state.endpoint_kind.clone()),
            endpoint_pid: Some(state.endpoint_pid),
            profile_mode: Some(state.profile_mode.clone()),
            provider_readiness,
            allow_unknown_provider_readiness,
        },
        move |service, start| run_worker(&worker_mode, service, start),
    );
    match evidence {
        Ok(evidence) => json_ok(serde_json::to_value(evidence).unwrap_or_else(|error| {
            json!({
                "serializationError": error.to_string()
            })
        })),
        Err(error) if error == NO_ACTIVE_WORKSPACE_MESSAGE => {
            json_error(409, "no_active_workspace", error)
        }
        Err(error) => json_error(400, "operation_failed", error),
    }
}

fn dogfood_plan_operation(
    state: &DogfoodOperatorEndpointState,
    pack_path: String,
    allow_unknown_provider_readiness: bool,
) -> JsonResponse {
    let pack_path = match normalize_endpoint_pack_path(&pack_path) {
        Ok(pack_path) => pack_path,
        Err(error) => return json_error(400, "invalid_pack_path", error),
    };
    let active_workspace = match state.active_workspace.current() {
        Some(active_workspace) => active_workspace,
        None => return json_error(409, "no_active_workspace", NO_ACTIVE_WORKSPACE_MESSAGE),
    };
    let service = match workspace_service(&state.db_path) {
        Ok(service) => service,
        Err(error) => return json_error(500, "backend_unavailable", error),
    };
    let provider_readiness = match provider_readiness_summary(state, &service, "codex".to_owned()) {
        Ok(readiness) => readiness,
        Err(error) => return json_error(400, "provider_readiness_failed", error),
    };
    let plan = run_dogfood_plan_for_app_workspace(
        &service,
        DogfoodOperatorAppWorkspaceRunInput {
            workspace_id: active_workspace.workspace_id,
            workspace_resolution_method: active_workspace.workspace_resolution_method,
            workspace_root: active_workspace.workspace_root,
            pack_path,
            preview: false,
            materialize: false,
            start_pack_task_id: None,
            retry_pack_task_id: None,
            allow_worker_start: false,
            endpoint_kind: Some(state.endpoint_kind.clone()),
            endpoint_pid: Some(state.endpoint_pid),
            profile_mode: Some(state.profile_mode.clone()),
            provider_readiness: Some(provider_readiness),
            allow_unknown_provider_readiness,
        },
    );
    match plan {
        Ok(plan) => json_ok(serde_json::to_value(plan).unwrap_or_else(|error| {
            json!({
                "serializationError": error.to_string()
            })
        })),
        Err(error) if error == NO_ACTIVE_WORKSPACE_MESSAGE => {
            json_error(409, "no_active_workspace", error)
        }
        Err(error) => json_error(400, "operation_failed", error),
    }
}

fn resume_dogfood_operation(
    state: &DogfoodOperatorEndpointState,
    pack_path: String,
    allow_real_worker: bool,
    allow_unknown_provider_readiness: bool,
    recover_stale_dogfood_run: bool,
    run_link_id: Option<String>,
) -> JsonResponse {
    if !allow_real_worker && !recover_stale_dogfood_run {
        return json_error(
            400,
            "worker_start_not_allowed",
            "refusing to resume dogfood without allowRealWorker",
        );
    }
    let pack_path = match normalize_endpoint_pack_path(&pack_path) {
        Ok(pack_path) => pack_path,
        Err(error) => return json_error(400, "invalid_pack_path", error),
    };
    let active_workspace = match state.active_workspace.current() {
        Some(active_workspace) => active_workspace,
        None => return json_error(409, "no_active_workspace", NO_ACTIVE_WORKSPACE_MESSAGE),
    };
    let service = match workspace_service(&state.db_path) {
        Ok(service) => service,
        Err(error) => return json_error(500, "backend_unavailable", error),
    };
    let provider_readiness = match provider_readiness_summary(state, &service, "codex".to_owned()) {
        Ok(readiness) => readiness,
        Err(error) => return json_error(400, "provider_readiness_failed", error),
    };
    let worker_mode = state.worker_mode.clone();
    let recover_run_link_id = run_link_id.clone();
    let evidence = run_dogfood_resume_for_app_workspace_with_runner(
        &service,
        DogfoodOperatorAppWorkspaceRunInput {
            workspace_id: active_workspace.workspace_id,
            workspace_resolution_method: active_workspace.workspace_resolution_method,
            workspace_root: active_workspace.workspace_root,
            pack_path,
            preview: true,
            materialize: true,
            start_pack_task_id: None,
            retry_pack_task_id: None,
            allow_worker_start: allow_real_worker,
            endpoint_kind: Some(state.endpoint_kind.clone()),
            endpoint_pid: Some(state.endpoint_pid),
            profile_mode: Some(state.profile_mode.clone()),
            provider_readiness: Some(provider_readiness),
            allow_unknown_provider_readiness,
        },
        move |service, start| run_worker(&worker_mode, service, start),
        recover_stale_dogfood_run,
        recover_run_link_id.as_deref(),
    );
    match evidence {
        Ok(evidence) => json_ok(serde_json::to_value(evidence).unwrap_or_else(|error| {
            json!({
                "serializationError": error.to_string()
            })
        })),
        Err(error) if error == NO_ACTIVE_WORKSPACE_MESSAGE => {
            json_error(409, "no_active_workspace", error)
        }
        Err(error) => json_error(400, "operation_failed", error),
    }
}

fn run_detail(
    state: &DogfoodOperatorEndpointState,
    request: EndpointRunDetailRequest,
) -> JsonResponse {
    let active_workspace = match state.active_workspace.current() {
        Some(active_workspace) => active_workspace,
        None => return json_error(409, "no_active_workspace", NO_ACTIVE_WORKSPACE_MESSAGE),
    };
    if request.run_link_id.is_some() == request.queue_task_id.is_some() {
        return json_error(
            400,
            "invalid_request",
            "provide exactly one of runLinkId or queueTaskId",
        );
    }
    let service = match workspace_service(&state.db_path) {
        Ok(service) => service,
        Err(error) => return json_error(500, "backend_unavailable", error),
    };

    let run_link = match request.run_link_id.as_deref() {
        Some(run_link_id) => match service
            .get_agent_queue_task_run_link_by_id(&active_workspace.workspace_id, run_link_id)
        {
            Ok(Some(link)) => link,
            Ok(None) => return json_error(404, "run_link_not_found", "run link not found"),
            Err(error) => return json_error(400, "run_detail_failed", error.to_string()),
        },
        None => {
            let queue_task_id = request.queue_task_id.as_deref().unwrap_or_default();
            match service
                .get_latest_agent_queue_task_run_link(&active_workspace.workspace_id, queue_task_id)
            {
                Ok(Some(link)) => link,
                Ok(None) => {
                    return json_error(404, "run_link_not_found", "queue task has no run links");
                }
                Err(error) => return json_error(400, "run_detail_failed", error.to_string()),
            }
        }
    };
    let task = match service
        .get_agent_queue_task(&active_workspace.workspace_id, &run_link.queue_task_id)
    {
        Ok(Some(task)) => task,
        Ok(None) => return json_error(404, "queue_task_not_found", "queue task not found"),
        Err(error) => return json_error(400, "run_detail_failed", error.to_string()),
    };
    let dependent_tasks = match service.list_agent_queue_tasks(&active_workspace.workspace_id) {
        Ok(tasks) => tasks
            .into_iter()
            .filter(|candidate| {
                candidate
                    .depends_on
                    .iter()
                    .any(|dependency| dependency == &task.queue_item_id)
            })
            .collect::<Vec<_>>(),
        Err(error) => return json_error(400, "run_detail_failed", error.to_string()),
    };
    let dependent_auto_started = dependent_tasks.iter().any(|dependent| {
        service
            .list_agent_queue_task_run_links(
                &active_workspace.workspace_id,
                &dependent.queue_item_id,
            )
            .map(|links| !links.is_empty())
            .unwrap_or(false)
    });
    let dependent_eligibility = if dependent_tasks.is_empty() {
        "no_dependents"
    } else if task.status == "failed" || run_link.status == AgentQueueTaskRunStatus::Failed {
        "blocked_failed_upstream"
    } else if run_link.status == AgentQueueTaskRunStatus::Completed {
        "blocked_until_accepted_completion"
    } else {
        "blocked_dependency_waiting"
    };
    let retryability = if run_link.status == AgentQueueTaskRunStatus::Running {
        "already_running"
    } else if run_link.status == AgentQueueTaskRunStatus::Completed || task.status == "completed" {
        "already_succeeded"
    } else if task.status == "failed"
        && run_link.status == AgentQueueTaskRunStatus::Failed
        && run_link.executor_widget_id == QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID
    {
        "retryable_failed_task"
    } else if run_link.status == AgentQueueTaskRunStatus::Unknown {
        "unknown"
    } else {
        "not_retryable"
    };
    let failure_reason = if run_link.status == AgentQueueTaskRunStatus::Failed {
        Some("run link terminalized as failed; historical backend-owned queue_local worker stdout/stderr was not persisted before run-detail capture")
    } else {
        None
    };

    json_ok(json!({
        "ok": true,
        "operatorContext": endpoint_context(state).ok(),
        "runDetail": {
            "queueTaskId": task.queue_item_id,
            "queueTaskStatus": task.status,
            "runLinkId": run_link.link_id.as_str(),
            "runLinkStatus": run_link.status.as_str(),
            "completionStatus": run_link.status.as_str(),
            "directWorkRunId": run_link.direct_work_run_id,
            "source": run_link.source.as_str(),
            "startedAt": run_link.started_at,
            "completedAt": run_link.completed_at,
            "reviewStatus": run_link.review_status.map(|status| status.as_str()),
            "validationStatus": run_link.validation_status,
            "failureReason": failure_reason,
            "workerExitCode": Value::Null,
            "workerStdoutTail": Value::Null,
            "workerStderrTail": Value::Null,
            "workerOutputAvailable": false,
            "outputArtifact": Value::Null,
            "retryability": retryability,
            "completionBridgeTerminalizedRun": run_link.status != AgentQueueTaskRunStatus::Running,
            "dependentTaskIds": dependent_tasks
                .iter()
                .map(|task| task.queue_item_id.clone())
                .collect::<Vec<_>>(),
            "dependentEligibility": dependent_eligibility,
            "dependentAutoStarted": dependent_auto_started,
            "createdWidgetRun": false,
            "usedWidgetIdentity": false,
            "schedulerAutodispatch": false
        }
    }))
}

fn run_worker(
    worker_mode: &DogfoodOperatorEndpointWorkerMode,
    service: &hobit_app::WorkspaceService,
    start: &SelectedAgentQueueTaskLocalStartSummary,
) -> Result<DogfoodOperatorWorkerOutcome, String> {
    match worker_mode {
        DogfoodOperatorEndpointWorkerMode::Real => real_worker_runner(service, start),
        #[cfg(test)]
        DogfoodOperatorEndpointWorkerMode::FakeCompletedForTests(status) => {
            fake_finish_runner(service, start, status)
        }
    }
}

#[cfg(test)]
fn fake_finish_runner(
    service: &hobit_app::WorkspaceService,
    start: &SelectedAgentQueueTaskLocalStartSummary,
    direct_work_status: &str,
) -> Result<DogfoodOperatorWorkerOutcome, String> {
    let run_id = start
        .run_id
        .clone()
        .ok_or_else(|| "fake endpoint runner missing run id".to_owned())?;
    let task = service
        .finish_assigned_agent_queue_task_run(FinishAssignedAgentQueueTaskRunInput {
            workspace_id: start.workspace_id.clone(),
            queue_item_id: start.queue_item_id.clone(),
            executor_widget_instance_id: start.executor_widget_instance_id.clone(),
            run_id,
            direct_work_status: direct_work_status.to_owned(),
        })
        .map_err(|error| error.to_string())?;
    Ok(DogfoodOperatorWorkerOutcome {
        worker_mode: "fake_headless".to_owned(),
        fake_worker_used: true,
        real_codex_invoked: false,
        completion_status: Some(direct_work_status.to_owned()),
        terminal_queue_task_status: Some(task.status),
        worker_exit_code: None,
        worker_stdout_tail: None,
        worker_stderr_tail: None,
        worker_error_message: None,
    })
}

fn workspace_service(db_path: &Path) -> Result<hobit_app::WorkspaceService, String> {
    SqliteStore::open(db_path)
        .map(hobit_app::WorkspaceService::new)
        .map_err(|error| error.to_string())
}

fn normalize_endpoint_pack_path(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err("workspace-relative prompt-pack path is required".to_owned());
    }
    let path = Path::new(value);
    if path.is_absolute() {
        return Err("endpoint accepts workspace-relative pack path only".to_owned());
    }

    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => normalized.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("endpoint accepts workspace-relative pack path only".to_owned());
            }
        }
    }
    if normalized.as_os_str().is_empty() {
        return Err("workspace-relative prompt-pack path is required".to_owned());
    }
    normalized
        .to_str()
        .map(|path| path.replace('\\', "/"))
        .ok_or_else(|| "prompt-pack path must be valid UTF-8".to_owned())
}

fn canonicalize_workspace_root(value: &str) -> Result<PathBuf, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err("workspace root is required".to_owned());
    }
    let path = Path::new(value);
    if !path.is_absolute() {
        return Err("workspace root must be an existing absolute directory".to_owned());
    }
    let canonical = fs::canonicalize(path).map_err(|error| {
        format!(
            "workspace root must be an existing directory: {} ({error})",
            path.display()
        )
    })?;
    if !canonical.is_dir() {
        return Err(format!(
            "workspace root must be an existing directory: {}",
            canonical.display()
        ));
    }
    Ok(canonical)
}

fn canonical_path_key(path: &Path) -> String {
    let normalized = display_path(path).replace('\\', "/");
    if cfg!(windows) {
        normalized.to_ascii_lowercase()
    } else {
        normalized
    }
}

fn display_path(path: &Path) -> String {
    let value = path.display().to_string();
    value
        .strip_prefix(r"\\?\")
        .unwrap_or(value.as_str())
        .to_owned()
}

fn read_http_request(stream: &mut TcpStream) -> Result<HttpRequest, String> {
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .map_err(|error| error.to_string())?;
    let mut bytes = Vec::new();
    let mut buffer = [0u8; 4096];
    loop {
        let read = stream
            .read(&mut buffer)
            .map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        bytes.extend_from_slice(&buffer[..read]);
        if bytes.len() > MAX_HTTP_REQUEST_BYTES {
            return Err("dogfood operator request is too large".to_owned());
        }
        if let Some(header_end) = find_header_end(&bytes) {
            let header_text = std::str::from_utf8(&bytes[..header_end])
                .map_err(|_| "dogfood operator request headers must be UTF-8".to_owned())?;
            let mut lines = header_text.lines();
            let request_line = lines
                .next()
                .ok_or_else(|| "dogfood operator request is missing request line".to_owned())?;
            let mut request_line_parts = request_line.split_whitespace();
            let method = request_line_parts
                .next()
                .ok_or_else(|| "dogfood operator request is missing method".to_owned())?
                .to_owned();
            let path = request_line_parts
                .next()
                .ok_or_else(|| "dogfood operator request is missing path".to_owned())?
                .to_owned();
            let headers = parse_headers(lines)?;
            let content_length = header_value(&headers, "content-length")
                .and_then(|value| value.parse::<usize>().ok())
                .unwrap_or(0);
            let body_start = header_end + 4;
            let total_length = body_start + content_length;
            while bytes.len() < total_length {
                let read = stream
                    .read(&mut buffer)
                    .map_err(|error| error.to_string())?;
                if read == 0 {
                    break;
                }
                bytes.extend_from_slice(&buffer[..read]);
                if bytes.len() > MAX_HTTP_REQUEST_BYTES {
                    return Err("dogfood operator request is too large".to_owned());
                }
            }
            if bytes.len() < total_length {
                return Err("dogfood operator request body was incomplete".to_owned());
            }
            return Ok(HttpRequest {
                method,
                path,
                headers,
                body: bytes[body_start..total_length].to_vec(),
            });
        }
    }
    Err("dogfood operator request was incomplete".to_owned())
}

fn find_header_end(bytes: &[u8]) -> Option<usize> {
    bytes.windows(4).position(|window| window == b"\r\n\r\n")
}

fn parse_headers<'a>(
    lines: impl Iterator<Item = &'a str>,
) -> Result<Vec<(String, String)>, String> {
    let mut headers = Vec::new();
    for line in lines {
        let Some((name, value)) = line.split_once(':') else {
            return Err("dogfood operator request had an invalid header".to_owned());
        };
        headers.push((name.trim().to_ascii_lowercase(), value.trim().to_owned()));
    }
    Ok(headers)
}

fn header_value<'a>(headers: &'a [(String, String)], name: &str) -> Option<&'a str> {
    let name = name.to_ascii_lowercase();
    headers
        .iter()
        .find(|(header_name, _)| header_name == &name)
        .map(|(_, value)| value.as_str())
}

fn parse_json_body<T: for<'de> Deserialize<'de>>(body: &[u8]) -> Result<T, String> {
    serde_json::from_slice(body).map_err(|error| error.to_string())
}

struct JsonResponse {
    status: u16,
    body: Value,
}

fn json_ok(body: Value) -> JsonResponse {
    JsonResponse { status: 200, body }
}

fn json_error(status: u16, code: impl Into<String>, message: impl Into<String>) -> JsonResponse {
    JsonResponse {
        status,
        body: json!({
            "ok": false,
            "error": {
                "code": code.into(),
                "message": message.into()
            }
        }),
    }
}

fn write_json_response(stream: &mut TcpStream, status: u16, body: &Value) -> Result<(), String> {
    let payload = serde_json::to_vec(body).map_err(|error| error.to_string())?;
    let status_text = match status {
        200 => "OK",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        409 => "Conflict",
        _ => "Internal Server Error",
    };
    let headers = format!(
        "HTTP/1.1 {status} {status_text}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        payload.len()
    );
    stream
        .write_all(headers.as_bytes())
        .and_then(|_| stream.write_all(&payload))
        .map_err(|error| error.to_string())
}

fn write_rendezvous_file(
    path: &Path,
    rendezvous: &DogfoodOperatorEndpointRendezvous,
) -> Result<(), String> {
    if let Some(parent) = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let payload = serde_json::to_string_pretty(rendezvous).map_err(|error| error.to_string())?;
    fs::write(path, payload).map_err(|error| error.to_string())
}

fn generate_token() -> String {
    format!(
        "hobit-dogfood-{}-{}",
        std::process::id(),
        timestamp_millis()
    )
}

fn timestamp_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    use hobit_app::WorkspaceService;
    use serde_json::Value;

    const DOGFOOD_PACK: &str = "docs/dogfood/queue-prompt-packs/hobit-queue-dogfood-next.json";

    #[test]
    fn dogfood_operator_endpoint_health_returns_context() {
        let fixture = EndpointFixture::with_active_workspace(false);

        let response = request_json(&fixture.server, "GET", "/health", None, Some("test-token"));

        assert_eq!(response.status, 200);
        assert_eq!(
            response.body["operatorContext"]["contextSource"],
            "running_app_endpoint"
        );
        assert_eq!(
            response.body["operatorContext"]["workspaceResolutionMethod"],
            "app_current_workspace"
        );
        assert_eq!(
            response.body["operatorContext"]["usedDirectDatabasePath"],
            false
        );
        assert_eq!(
            response.body["operatorContext"]["endpointKind"],
            ENDPOINT_KIND
        );
        assert_eq!(response.body["operatorContext"]["profileMode"], "dogfood");
    }

    #[test]
    fn dogfood_operator_endpoint_health_works_through_rendezvous_token() {
        let fixture = EndpointFixture::with_active_workspace(false);
        let rendezvous: DogfoodOperatorEndpointRendezvous =
            serde_json::from_str(&fs::read_to_string(&fixture.rendezvous_path).expect("file"))
                .expect("rendezvous");

        let response = request_json(
            &fixture.server,
            "GET",
            "/health",
            None,
            Some(&rendezvous.auth_token),
        );

        assert_eq!(response.status, 200);
        assert_eq!(
            response.body["operatorContext"]["endpointKind"],
            ENDPOINT_KIND
        );
    }

    #[test]
    fn dogfood_operator_endpoint_requires_auth_token() {
        let fixture = EndpointFixture::with_active_workspace(false);

        let response = request_json(&fixture.server, "GET", "/health", None, None);

        assert_eq!(response.status, 401);
        assert_eq!(response.body["error"]["code"], "unauthorized");
    }

    #[test]
    fn dogfood_operator_endpoint_rejects_invalid_token() {
        let fixture = EndpointFixture::with_active_workspace(false);

        let response = request_json(&fixture.server, "GET", "/health", None, Some("wrong-token"));

        assert_eq!(response.status, 401);
        assert_eq!(response.body["error"]["code"], "unauthorized");
    }

    #[test]
    fn dogfood_operator_endpoint_binds_only_local_and_writes_rendezvous() {
        let fixture = EndpointFixture::with_active_workspace(false);

        assert!(fixture.server.local_addr().ip().is_loopback());
        let rendezvous: DogfoodOperatorEndpointRendezvous =
            serde_json::from_str(&fs::read_to_string(&fixture.rendezvous_path).expect("file"))
                .expect("rendezvous");
        assert_eq!(rendezvous.endpoint_kind, ENDPOINT_KIND);
        assert_eq!(rendezvous.host, "127.0.0.1");
        assert_eq!(rendezvous.auth_token, "test-token");
        assert_eq!(rendezvous.port, fixture.server.local_addr().port());
    }

    #[test]
    fn dogfood_operator_endpoint_preview_calls_backend_preview_without_queue_mutation() {
        let fixture = EndpointFixture::with_active_workspace(false);

        let response = request_json(
            &fixture.server,
            "POST",
            "/preview_prompt_pack_file",
            Some(json!({ "packPath": DOGFOOD_PACK })),
            Some("test-token"),
        );

        assert_eq!(response.status, 200);
        assert_eq!(
            response.body["operatorContext"]["contextSource"],
            "running_app_endpoint"
        );
        assert_eq!(
            response.body["preview"]["packId"],
            "hobit-queue-dogfood-next"
        );
        assert_eq!(response.body["preview"]["wouldMutateQueue"], false);
        let service = workspace_service(&fixture.db_path).expect("service");
        assert!(service
            .list_agent_queue_tasks(&fixture.workspace_id)
            .expect("tasks")
            .is_empty());
    }

    #[test]
    fn dogfood_operator_endpoint_ensure_workspace_for_root_uses_backend_context() {
        let fixture = EndpointFixture::without_active_workspace();
        let repo_root = repo_root_for_test();

        let response = request_json(
            &fixture.server,
            "POST",
            "/ensure_workspace_for_root",
            Some(json!({ "workspaceRoot": repo_root.display().to_string() })),
            Some("test-token"),
        );

        assert_eq!(response.status, 200);
        assert_eq!(
            response.body["operatorContext"]["contextSource"],
            "running_app_endpoint"
        );
        assert_eq!(
            response.body["operatorContext"]["usedDirectDatabasePath"],
            false
        );
        assert!(response.body["operatorContext"]["workspaceId"]
            .as_str()
            .is_some());
        assert!(matches!(
            response.body["operatorContext"]["workspaceResolutionMethod"].as_str(),
            Some("ensure_dogfood_workspace") | Some("persisted_dogfood_binding")
        ));
        assert_eq!(
            fixture
                .server_context()
                .current()
                .expect("active workspace")
                .workspace_id,
            response.body["operatorContext"]["workspaceId"]
                .as_str()
                .expect("workspace id")
        );
    }

    #[test]
    fn dogfood_operator_endpoint_ensure_workspace_for_root_rejects_invalid_root() {
        let fixture = EndpointFixture::without_active_workspace();

        let response = request_json(
            &fixture.server,
            "POST",
            "/ensure_workspace_for_root",
            Some(json!({ "workspaceRoot": "relative/path" })),
            Some("test-token"),
        );

        assert_eq!(response.status, 400);
        assert_eq!(response.body["error"]["code"], "invalid_workspace_root");
    }

    #[test]
    fn dogfood_operator_endpoint_materialize_calls_backend_materialization_without_runs() {
        let fixture = EndpointFixture::with_active_workspace(false);

        let response = request_json(
            &fixture.server,
            "POST",
            "/materialize_prompt_pack_file",
            Some(json!({ "packPath": DOGFOOD_PACK })),
            Some("test-token"),
        );

        assert_eq!(response.status, 200);
        assert_eq!(
            response.body["materialization"]["materializationStatus"],
            "created"
        );
        assert_eq!(response.body["materialization"]["createdCount"], 5);
        assert_eq!(response.body["boundaries"]["widgetRunsCreated"], false);
        assert_no_widget_runs(&fixture.db_path);
    }

    #[test]
    fn dogfood_operator_endpoint_plan_is_read_only_with_per_task_state() {
        let fixture = EndpointFixture::with_active_workspace(false);
        let materialized = request_json(
            &fixture.server,
            "POST",
            "/materialize_prompt_pack_file",
            Some(json!({ "packPath": DOGFOOD_PACK })),
            Some("test-token"),
        );
        assert_eq!(materialized.status, 200, "{}", materialized.body);
        let service = workspace_service(&fixture.db_path).expect("service");
        let foundation_queue_task_id =
            response_queue_task_id(&materialized.body, "dogfood-foundation-checkpoint");
        let before = service
            .get_agent_queue_task(&fixture.workspace_id, &foundation_queue_task_id)
            .expect("task before")
            .expect("task before");

        let plan = request_json(
            &fixture.server,
            "POST",
            "/dogfood_plan",
            Some(json!({ "packPath": DOGFOOD_PACK })),
            Some("test-token"),
        );

        assert_eq!(plan.status, 200, "{}", plan.body);
        assert_eq!(plan.body["nextAction"]["kind"], "start_task");
        assert_eq!(plan.body["usedDirectDatabasePath"], false);
        assert_eq!(plan.body["widgetRunsCreated"], false);
        assert_eq!(plan.body["schedulerAutodispatch"], false);
        assert_eq!(
            plan.body["taskStates"]
                .as_array()
                .expect("task states")
                .len(),
            5
        );
        assert_eq!(
            plan.body["taskStates"][0]["packTaskId"],
            "dogfood-foundation-checkpoint"
        );
        assert!(plan.body["taskStates"][0]["startEligible"]
            .as_bool()
            .expect("start eligible"));

        let after = service
            .get_agent_queue_task(&fixture.workspace_id, &foundation_queue_task_id)
            .expect("task after")
            .expect("task after");
        assert_eq!(after.status, before.status);
        assert!(service
            .list_agent_queue_task_run_links(&fixture.workspace_id, &foundation_queue_task_id)
            .expect("run links")
            .is_empty());
        assert_no_widget_runs(&fixture.db_path);
    }

    #[test]
    fn dogfood_operator_endpoint_plan_reports_materialize_when_pack_missing() {
        let fixture = EndpointFixture::with_active_workspace(false);

        let plan = request_json(
            &fixture.server,
            "POST",
            "/dogfood_plan",
            Some(json!({ "packPath": DOGFOOD_PACK })),
            Some("test-token"),
        );

        assert_eq!(plan.status, 200, "{}", plan.body);
        assert_eq!(plan.body["nextAction"]["kind"], "materialize_pack");
        assert_eq!(plan.body["materializationStatus"], "not_materialized");
        let service = workspace_service(&fixture.db_path).expect("service");
        assert!(service
            .list_agent_queue_tasks(&fixture.workspace_id)
            .expect("tasks")
            .is_empty());
        assert_no_widget_runs(&fixture.db_path);
    }

    #[test]
    fn dogfood_operator_endpoint_selected_start_uses_backend_fake_launcher_in_tests() {
        let fixture = EndpointFixture::with_active_workspace(true);

        let response = request_json(
            &fixture.server,
            "POST",
            "/start_pack_task",
            Some(json!({
                "packPath": DOGFOOD_PACK,
                "packTaskId": "dogfood-foundation-checkpoint",
                "allowRealWorker": true
            })),
            Some("test-token"),
        );

        assert_eq!(response.status, 200);
        assert_eq!(response.body["selectedTask"]["launchStatus"], "launched");
        assert!(response.body["selectedTask"]["runLinkId"]
            .as_str()
            .is_some());
        assert_eq!(response.body["selectedTask"]["createdWidgetRun"], false);
        assert_eq!(response.body["selectedTask"]["usedWidgetIdentity"], false);
        assert_eq!(
            response.body["selectedTask"]["schedulerAutodispatch"],
            false
        );
        assert_eq!(response.body["selectedTask"]["fakeWorkerUsed"], true);
        assert_eq!(response.body["selectedTask"]["realCodexInvoked"], false);
        assert_eq!(response.body["providerReadiness"]["status"], "ready");
        assert_eq!(
            response.body["providerReadiness"]["usedDirectDatabasePath"],
            false
        );
        assert_eq!(
            response.body["selectedTask"]["completionStatus"],
            "completed"
        );
        assert_no_widget_runs(&fixture.db_path);
    }

    #[test]
    fn dogfood_operator_endpoint_resume_starts_at_most_one_task_without_dependents() {
        let fixture = EndpointFixture::with_active_workspace(true);
        let materialized = request_json(
            &fixture.server,
            "POST",
            "/materialize_prompt_pack_file",
            Some(json!({ "packPath": DOGFOOD_PACK })),
            Some("test-token"),
        );
        assert_eq!(materialized.status, 200, "{}", materialized.body);

        let response = request_json(
            &fixture.server,
            "POST",
            "/resume_dogfood",
            Some(json!({
                "packPath": DOGFOOD_PACK,
                "allowRealWorker": true
            })),
            Some("test-token"),
        );

        assert_eq!(response.status, 200, "{}", response.body);
        assert_eq!(
            response.body["dogfoodPlan"]["nextAction"]["kind"],
            "start_task"
        );
        assert_eq!(response.body["resumeDogfood"]["status"], "started_one_task");
        assert_eq!(response.body["resumeDogfood"]["startedNewWorkerCount"], 1);
        assert_eq!(
            response.body["resumeDogfood"]["selectedPackTaskId"],
            "dogfood-foundation-checkpoint"
        );
        assert_eq!(response.body["selectedTask"]["launchStatus"], "launched");
        assert_eq!(response.body["selectedTask"]["fakeWorkerUsed"], true);
        assert_eq!(response.body["selectedTask"]["realCodexInvoked"], false);
        assert_eq!(response.body["selectedTask"]["createdWidgetRun"], false);
        assert_eq!(
            response.body["resumeDogfood"]["schedulerAutodispatchUsed"],
            false
        );
        assert_eq!(
            response.body["resumeDogfood"]["dependentsAutoStarted"],
            false
        );
        assert_eq!(response.body["boundaries"]["widgetRunsCreated"], false);
        assert_eq!(
            response.body["boundaries"]["schedulerAutodispatchUsed"],
            false
        );

        let dependent_queue_task_id =
            response_queue_task_id(&response.body, "dogfood-file-import-hardening");
        let service = workspace_service(&fixture.db_path).expect("service");
        assert!(service
            .list_agent_queue_task_run_links(&fixture.workspace_id, &dependent_queue_task_id)
            .expect("dependent run links")
            .is_empty());
        assert_no_widget_runs(&fixture.db_path);
    }

    #[test]
    fn dogfood_operator_endpoint_resume_accepts_completed_dependency_before_dependent() {
        let fixture = EndpointFixture::with_active_workspace(true);
        let first = request_json(
            &fixture.server,
            "POST",
            "/start_pack_task",
            Some(json!({
                "packPath": DOGFOOD_PACK,
                "packTaskId": "dogfood-foundation-checkpoint",
                "allowRealWorker": true
            })),
            Some("test-token"),
        );
        assert_eq!(first.status, 200, "{}", first.body);
        assert_eq!(first.body["selectedTask"]["completionStatus"], "completed");

        let response = request_json(
            &fixture.server,
            "POST",
            "/resume_dogfood",
            Some(json!({
                "packPath": DOGFOOD_PACK,
                "allowRealWorker": true
            })),
            Some("test-token"),
        );

        assert_eq!(response.status, 200, "{}", response.body);
        assert_eq!(
            response.body["dogfoodPlan"]["nextAction"]["kind"],
            "finalize_completed_dependency"
        );
        assert_eq!(
            response.body["resumeDogfood"]["status"],
            "finalize_completed_dependency"
        );
        assert_eq!(response.body["resumeDogfood"]["startedNewWorkerCount"], 0);
        assert_eq!(
            response.body["resumeDogfood"]["selectedPackTaskId"],
            Value::Null
        );
        assert!(response.body["selectedTask"].is_null());
        let accepted = response.body["resumeDogfood"]["acceptedDependencies"]
            .as_array()
            .expect("accepted dependencies");
        assert_eq!(accepted.len(), 1);
        assert_eq!(accepted[0]["packTaskId"], "dogfood-foundation-checkpoint");
        assert!(matches!(
            accepted[0]["status"].as_str(),
            Some("succeeded") | Some("already_done")
        ));
        assert_eq!(accepted[0]["safeToFinalize"], true);
        assert_eq!(
            response.body["resumeDogfood"]["dependentsAutoStarted"],
            false
        );
        assert_eq!(response.body["resumeDogfood"]["widgetRunsCreated"], false);
        assert_eq!(
            response.body["resumeDogfood"]["schedulerAutodispatchUsed"],
            false
        );

        let foundation_queue_task_id =
            response_queue_task_id(&response.body, "dogfood-foundation-checkpoint");
        let next_dependent_queue_task_id =
            response_queue_task_id(&response.body, "dogfood-selected-task-run-report");
        let service = workspace_service(&fixture.db_path).expect("service");
        let foundation = service
            .get_queue_item_aggregate(&fixture.workspace_id, &foundation_queue_task_id)
            .expect("foundation aggregate")
            .expect("foundation aggregate");
        assert_eq!(foundation.ticket_state.as_str(), "done");
        assert!(service
            .list_agent_queue_task_run_links(&fixture.workspace_id, &next_dependent_queue_task_id)
            .expect("next dependent run links")
            .is_empty());

        let plan = request_json(
            &fixture.server,
            "POST",
            "/dogfood_plan",
            Some(json!({ "packPath": DOGFOOD_PACK })),
            Some("test-token"),
        );
        assert_eq!(plan.status, 200, "{}", plan.body);
        assert_eq!(plan.body["nextAction"]["kind"], "start_task");
        assert_eq!(
            plan.body["nextAction"]["packTaskId"],
            "dogfood-file-import-hardening"
        );

        let next = request_json(
            &fixture.server,
            "POST",
            "/resume_dogfood",
            Some(json!({
                "packPath": DOGFOOD_PACK,
                "allowRealWorker": true
            })),
            Some("test-token"),
        );
        assert_eq!(next.status, 200, "{}", next.body);
        assert_eq!(next.body["resumeDogfood"]["status"], "started_one_task");
        assert_eq!(
            next.body["selectedTask"]["selectedPackTaskId"],
            "dogfood-file-import-hardening"
        );
        assert_no_widget_runs(&fixture.db_path);
    }

    #[test]
    fn dogfood_operator_endpoint_provider_readiness_returns_context_without_secrets() {
        let fixture = EndpointFixture::with_active_workspace(false);

        let response = request_json(
            &fixture.server,
            "POST",
            "/provider_readiness",
            Some(json!({ "providerId": "codex" })),
            Some("test-token"),
        );

        assert_eq!(response.status, 200);
        assert_eq!(
            response.body["operatorContext"]["usedDirectDatabasePath"],
            false
        );
        assert_eq!(response.body["providerReadiness"]["providerId"], "codex");
        assert_eq!(
            response.body["providerReadiness"]["executionTarget"],
            "queue_local"
        );
        assert_eq!(response.body["providerReadiness"]["status"], "ready");
        assert_eq!(
            response.body["providerReadiness"]["environmentSummary"][0]["name"],
            "OPENAI_API_KEY"
        );
        let serialized = serde_json::to_string(&response.body).expect("response json");
        assert!(!serialized.contains("secret-value"));
        assert!(!serialized.contains("sk-"));
        assert_no_widget_runs(&fixture.db_path);
    }

    #[test]
    fn dogfood_operator_selected_task_provider_readiness_block_does_not_create_run_link_or_worker()
    {
        let db_path = unique_test_db_path();
        let workspace_id = create_test_workspace(&db_path);
        let active_workspace = ActiveWorkspaceRegistry::default();
        active_workspace.set(workspace_id.clone());
        let fixture = EndpointFixture::start_with_provider_readiness(
            db_path,
            active_workspace,
            workspace_id.clone(),
            Some("completed"),
            fake_provider_readiness("blocked", "unauthorized", vec!["codex_auth_unauthorized"]),
        );

        let response = request_json(
            &fixture.server,
            "POST",
            "/start_pack_task",
            Some(json!({
                "packPath": DOGFOOD_PACK,
                "packTaskId": "dogfood-foundation-checkpoint",
                "allowRealWorker": true
            })),
            Some("test-token"),
        );

        assert_eq!(response.status, 200, "{}", response.body);
        assert_eq!(
            response.body["selectedTask"]["launchStatus"],
            "provider_readiness_blocked"
        );
        assert_eq!(
            response.body["selectedTask"]["blockerCode"],
            "codex_auth_unauthorized"
        );
        assert!(response.body["selectedTask"]["runLinkId"].is_null());
        assert_eq!(response.body["selectedTask"]["createdRunLink"], false);
        assert_eq!(response.body["selectedTask"]["wouldStartWorkers"], false);
        assert_eq!(response.body["selectedTask"]["fakeWorkerUsed"], false);
        assert_eq!(response.body["selectedTask"]["realCodexInvoked"], false);
        assert_eq!(response.body["providerReadiness"]["status"], "blocked");
        assert_eq!(
            response.body["providerReadiness"]["authStatus"],
            "unauthorized"
        );
        let queue_task_id = response.body["selectedTask"]["selectedQueueTaskId"]
            .as_str()
            .expect("queue task id");
        let service = workspace_service(&fixture.db_path).expect("service");
        let links = service
            .list_agent_queue_task_run_links(&fixture.workspace_id, queue_task_id)
            .expect("run links");
        assert!(links.is_empty());
        assert_no_widget_runs(&fixture.db_path);
    }

    #[test]
    fn dogfood_operator_endpoint_plan_provider_block_only_when_start_eligible() {
        let db_path = unique_test_db_path();
        let workspace_id = create_test_workspace(&db_path);
        let active_workspace = ActiveWorkspaceRegistry::default();
        active_workspace.set(workspace_id.clone());
        let fixture = EndpointFixture::start_with_provider_readiness(
            db_path,
            active_workspace,
            workspace_id,
            Some("completed"),
            fake_provider_readiness("blocked", "unauthorized", vec!["codex_auth_unauthorized"]),
        );
        let queue_task_id = materialize_foundation_queue_task_id(&fixture);

        let plan = request_json(
            &fixture.server,
            "POST",
            "/dogfood_plan",
            Some(json!({ "packPath": DOGFOOD_PACK })),
            Some("test-token"),
        );

        assert_eq!(plan.status, 200, "{}", plan.body);
        assert_eq!(
            plan.body["nextAction"]["kind"],
            "start_task_blocked_by_provider"
        );
        assert_eq!(plan.body["nextAction"]["queueTaskId"], queue_task_id);
        let service = workspace_service(&fixture.db_path).expect("service");
        assert!(service
            .list_agent_queue_task_run_links(&fixture.workspace_id, &queue_task_id)
            .expect("run links")
            .is_empty());
        assert_no_widget_runs(&fixture.db_path);
    }

    #[test]
    fn dogfood_operator_endpoint_plan_waits_for_active_run_before_provider_blocker() {
        let db_path = unique_test_db_path();
        let workspace_id = create_test_workspace(&db_path);
        let active_workspace = ActiveWorkspaceRegistry::default();
        active_workspace.set(workspace_id.clone());
        let fixture = EndpointFixture::start_with_provider_readiness(
            db_path,
            active_workspace,
            workspace_id,
            None,
            fake_provider_readiness("blocked", "unauthorized", vec!["codex_auth_unauthorized"]),
        );
        let queue_task_id = materialize_foundation_queue_task_id(&fixture);
        let active = start_running_queue_local_task(&fixture, &queue_task_id);
        let active_run_link_id = active.run_link_id.as_deref().expect("active run link id");

        let plan = request_json(
            &fixture.server,
            "POST",
            "/dogfood_plan",
            Some(json!({ "packPath": DOGFOOD_PACK })),
            Some("test-token"),
        );

        assert_eq!(plan.status, 200, "{}", plan.body);
        assert_eq!(plan.body["nextAction"]["kind"], "wait_active_run");
        assert_eq!(plan.body["nextAction"]["runLinkId"], active_run_link_id);
        assert_eq!(plan.body["activeRunLinkIds"][0], active_run_link_id);
        assert_eq!(
            plan.body["staleCandidateRunLinkIds"]
                .as_array()
                .unwrap()
                .len(),
            0
        );
        assert_no_widget_runs(&fixture.db_path);
    }

    #[test]
    fn dogfood_operator_endpoint_stale_running_requires_explicit_recovery_then_retries() {
        let fixture = EndpointFixture::with_active_workspace(true);
        let queue_task_id = materialize_foundation_queue_task_id(&fixture);
        let (run_id, run_link_id) = insert_stale_running_queue_local_run(&fixture, &queue_task_id);

        let plan = request_json(
            &fixture.server,
            "POST",
            "/dogfood_plan",
            Some(json!({ "packPath": DOGFOOD_PACK })),
            Some("test-token"),
        );
        assert_eq!(plan.status, 200, "{}", plan.body);
        assert_eq!(
            plan.body["nextAction"]["kind"],
            "recover_stale_running_task"
        );
        assert_eq!(plan.body["nextAction"]["runLinkId"], run_link_id);
        assert_eq!(plan.body["staleCandidateRunLinkIds"][0], run_link_id);

        let no_recovery = request_json(
            &fixture.server,
            "POST",
            "/resume_dogfood",
            Some(json!({
                "packPath": DOGFOOD_PACK,
                "allowRealWorker": true
            })),
            Some("test-token"),
        );
        assert_eq!(no_recovery.status, 200, "{}", no_recovery.body);
        assert_eq!(
            no_recovery.body["resumeDogfood"]["status"],
            "recover_stale_running_task"
        );
        assert!(no_recovery.body["resumeDogfood"]["staleRecovery"].is_null());
        let service = workspace_service(&fixture.db_path).expect("service");
        let running_link = service
            .get_agent_queue_task_run_link_by_id(&fixture.workspace_id, &run_link_id)
            .expect("running link")
            .expect("running link");
        assert_eq!(running_link.status, AgentQueueTaskRunStatus::Running);

        let recovered = request_json(
            &fixture.server,
            "POST",
            "/recover_stale_dogfood_run",
            Some(json!({
                "packPath": DOGFOOD_PACK,
                "runLinkId": run_link_id
            })),
            Some("test-token"),
        );
        assert_eq!(recovered.status, 200, "{}", recovered.body);
        assert_eq!(
            recovered.body["resumeDogfood"]["staleRecovery"]["reason"],
            "stale_running_recovered_by_dogfood_coordinator"
        );
        assert_eq!(
            recovered.body["resumeDogfood"]["staleRecovery"]["createdRunLink"],
            false
        );
        assert_eq!(
            recovered.body["resumeDogfood"]["staleRecovery"]["workerStarted"],
            false
        );
        let failed_link = service
            .get_agent_queue_task_run_link_by_id(&fixture.workspace_id, &run_link_id)
            .expect("failed link")
            .expect("failed link");
        assert_eq!(failed_link.status, AgentQueueTaskRunStatus::Failed);
        assert_eq!(failed_link.direct_work_run_id, run_id);
        let failed_task = service
            .get_agent_queue_task(&fixture.workspace_id, &queue_task_id)
            .expect("failed task")
            .expect("failed task");
        assert_eq!(failed_task.status, "failed");
        assert_eq!(
            service
                .list_agent_queue_task_run_links(&fixture.workspace_id, &queue_task_id)
                .expect("links after recovery")
                .len(),
            1
        );

        let retry_plan = request_json(
            &fixture.server,
            "POST",
            "/dogfood_plan",
            Some(json!({ "packPath": DOGFOOD_PACK })),
            Some("test-token"),
        );
        assert_eq!(retry_plan.status, 200, "{}", retry_plan.body);
        assert_eq!(retry_plan.body["nextAction"]["kind"], "start_task");
        assert_eq!(retry_plan.body["nextAction"]["retryFailed"], true);

        let retry = request_json(
            &fixture.server,
            "POST",
            "/resume_dogfood",
            Some(json!({
                "packPath": DOGFOOD_PACK,
                "allowRealWorker": true
            })),
            Some("test-token"),
        );
        assert_eq!(retry.status, 200, "{}", retry.body);
        assert_eq!(retry.body["resumeDogfood"]["status"], "started_one_task");
        assert_eq!(retry.body["selectedTask"]["fakeWorkerUsed"], true);
        assert_eq!(
            service
                .list_agent_queue_task_run_links(&fixture.workspace_id, &queue_task_id)
                .expect("links after retry")
                .len(),
            2
        );
        assert_no_widget_runs(&fixture.db_path);
    }

    #[test]
    fn dogfood_operator_endpoint_run_detail_reports_failed_selected_task_read_only() {
        let fixture = EndpointFixture::with_active_workspace_fake_status("failed");

        let start = request_json(
            &fixture.server,
            "POST",
            "/start_pack_task",
            Some(json!({
                "packPath": DOGFOOD_PACK,
                "packTaskId": "dogfood-foundation-checkpoint",
                "allowRealWorker": true
            })),
            Some("test-token"),
        );
        assert_eq!(start.status, 200);
        let run_link_id = start.body["selectedTask"]["runLinkId"]
            .as_str()
            .expect("run link id");
        let queue_task_id = start.body["selectedTask"]["selectedQueueTaskId"]
            .as_str()
            .expect("queue task id");

        let service = workspace_service(&fixture.db_path).expect("service");
        let links_before = service
            .list_agent_queue_task_run_links(&fixture.workspace_id, queue_task_id)
            .expect("links before");

        let detail = request_json(
            &fixture.server,
            "POST",
            "/run_detail",
            Some(json!({ "runLinkId": run_link_id })),
            Some("test-token"),
        );

        assert_eq!(detail.status, 200);
        assert_eq!(
            detail.body["operatorContext"]["usedDirectDatabasePath"],
            false
        );
        assert_eq!(detail.body["runDetail"]["runLinkId"], run_link_id);
        assert_eq!(detail.body["runDetail"]["queueTaskId"], queue_task_id);
        assert_eq!(detail.body["runDetail"]["runLinkStatus"], "failed");
        assert_eq!(detail.body["runDetail"]["queueTaskStatus"], "failed");
        assert_eq!(detail.body["runDetail"]["completionStatus"], "failed");
        assert_eq!(
            detail.body["runDetail"]["retryability"],
            "retryable_failed_task"
        );
        assert_eq!(detail.body["runDetail"]["workerOutputAvailable"], false);
        assert_eq!(detail.body["runDetail"]["createdWidgetRun"], false);
        assert_eq!(detail.body["runDetail"]["usedWidgetIdentity"], false);
        assert_eq!(detail.body["runDetail"]["schedulerAutodispatch"], false);
        assert_eq!(detail.body["runDetail"]["dependentAutoStarted"], false);

        let links_after = service
            .list_agent_queue_task_run_links(&fixture.workspace_id, queue_task_id)
            .expect("links after");
        assert_eq!(links_after.len(), links_before.len());
        assert_no_widget_runs(&fixture.db_path);
    }

    #[test]
    fn dogfood_operator_endpoint_run_detail_rejects_unknown_run_link() {
        let fixture = EndpointFixture::with_active_workspace(false);

        let response = request_json(
            &fixture.server,
            "POST",
            "/run_detail",
            Some(json!({ "runLinkId": "missing-run-link" })),
            Some("test-token"),
        );

        assert_eq!(response.status, 404);
        assert_eq!(response.body["error"]["code"], "run_link_not_found");
    }

    #[test]
    fn dogfood_operator_endpoint_retry_pack_task_uses_backend_fake_launcher() {
        let fixture = EndpointFixture::with_active_workspace_fake_status("failed");

        let first = request_json(
            &fixture.server,
            "POST",
            "/start_pack_task",
            Some(json!({
                "packPath": DOGFOOD_PACK,
                "packTaskId": "dogfood-foundation-checkpoint",
                "allowRealWorker": true
            })),
            Some("test-token"),
        );
        assert_eq!(first.status, 200);
        let first_run_link_id = first.body["selectedTask"]["runLinkId"]
            .as_str()
            .expect("first run link id")
            .to_owned();
        let queue_task_id = first.body["selectedTask"]["selectedQueueTaskId"]
            .as_str()
            .expect("queue task id")
            .to_owned();

        let retry = request_json(
            &fixture.server,
            "POST",
            "/retry_pack_task",
            Some(json!({
                "packPath": DOGFOOD_PACK,
                "packTaskId": "dogfood-foundation-checkpoint",
                "allowRealWorker": true
            })),
            Some("test-token"),
        );

        assert_eq!(retry.status, 200, "{}", retry.body);
        assert_eq!(retry.body["selectedTask"]["launchStatus"], "launched");
        assert_eq!(
            retry.body["selectedTask"]["selectedQueueTaskId"],
            queue_task_id
        );
        assert_eq!(retry.body["selectedTask"]["createdWidgetRun"], false);
        assert_eq!(retry.body["selectedTask"]["usedWidgetIdentity"], false);
        assert_eq!(retry.body["selectedTask"]["schedulerAutodispatch"], false);
        assert_eq!(retry.body["selectedTask"]["fakeWorkerUsed"], true);
        assert_eq!(retry.body["selectedTask"]["realCodexInvoked"], false);
        let retry_run_link_id = retry.body["selectedTask"]["runLinkId"]
            .as_str()
            .expect("retry run link id");
        assert_ne!(retry_run_link_id, first_run_link_id);

        let service = workspace_service(&fixture.db_path).expect("service");
        let links = service
            .list_agent_queue_task_run_links(&fixture.workspace_id, &queue_task_id)
            .expect("run links");
        assert_eq!(links.len(), 2);
        assert!(links.iter().any(|link| {
            link.link_id.as_str() == first_run_link_id
                && link.status == AgentQueueTaskRunStatus::Failed
        }));
        assert_no_widget_runs(&fixture.db_path);
    }

    #[test]
    fn dogfood_operator_endpoint_rejects_arbitrary_overrides() {
        let fixture = EndpointFixture::with_active_workspace(false);

        let response = request_json(
            &fixture.server,
            "POST",
            "/preview_prompt_pack_file",
            Some(json!({
                "packPath": DOGFOOD_PACK,
                "workspaceRoot": "C:/tmp",
                "executablePath": "codex.cmd"
            })),
            Some("test-token"),
        );

        assert_eq!(response.status, 400);
        assert_eq!(response.body["error"]["code"], "invalid_request");
    }

    #[test]
    fn dogfood_operator_endpoint_rejects_operation_without_active_workspace() {
        let fixture = EndpointFixture::without_active_workspace();

        let response = request_json(
            &fixture.server,
            "POST",
            "/preview_prompt_pack_file",
            Some(json!({ "packPath": DOGFOOD_PACK })),
            Some("test-token"),
        );

        assert_eq!(response.status, 409);
        assert_eq!(
            response.body["error"]["message"],
            NO_ACTIVE_WORKSPACE_MESSAGE
        );
    }

    #[test]
    fn dogfood_operator_node_default_path_does_not_require_database_or_workspace_id() {
        let script = fs::read_to_string(
            repo_root_for_test().join("scripts/hobit/run-queue-dogfood-operator.mjs"),
        )
        .expect("operator script");

        assert!(script.contains("--operator-health"));
        assert!(script.contains("--provider-readiness"));
        assert!(script.contains("--provider-auth-context"));
        assert!(script.contains("--run-detail"));
        assert!(script.contains("--dogfood-plan"));
        assert!(script.contains("--recover-stale-dogfood-run"));
        assert!(script.contains("--retry-pack-task"));
        assert!(script.contains("--resume-dogfood"));
        assert!(script.contains("running_app_endpoint"));
        assert!(script.contains("usedDirectDatabasePath"));
        assert!(script.contains("--direct-database-diagnostic"));
        assert!(script.contains("/run_detail"));
        assert!(script.contains("/dogfood_plan"));
        assert!(script.contains("/recover_stale_dogfood_run"));
        assert!(script.contains("/retry_pack_task"));
        assert!(script.contains("/resume_dogfood"));
        assert!(script.contains("/provider_readiness"));
        assert!(script.contains("/provider_auth_context"));
        assert!(script.contains("operatorEnvironmentSummary"));
        assert!(script.contains("allowUnknownProviderReadiness"));
        assert!(script.contains("formatTaskStateTable"));
        assert!(script.contains("nextAction.kind"));
        assert!(script.contains("stale candidates"));
    }

    #[test]
    fn dogfood_operator_node_does_not_fallback_to_direct_database_when_endpoint_is_missing() {
        let script = fs::read_to_string(
            repo_root_for_test().join("scripts/hobit/run-queue-dogfood-operator.mjs"),
        )
        .expect("operator script");

        assert!(script.contains("Hobit app-owned dogfood operator endpoint is not running."));
        assert!(script.contains("Endpoint rendezvous file is invalid or stale."));
        assert!(!script.contains("process.env.HOBIT_DOGFOOD_DATABASE"));
        assert!(!script.contains("process.env.HOBIT_DOGFOOD_WORKSPACE_ID"));
    }

    #[test]
    fn dogfood_operator_node_launch_command_is_safe_and_mockable() {
        let script = fs::read_to_string(
            repo_root_for_test().join("scripts/hobit/run-queue-dogfood-operator.mjs"),
        )
        .expect("operator script");

        assert!(script.contains("--no-launch-app"));
        assert!(script.contains("--launch-app-if-needed"));
        assert!(script.contains("npm.cmd"));
        assert!(script.contains("tauri:dev"));
        assert!(script.contains("HOBIT_DOGFOOD_PROFILE"));
        assert!(script.contains("HOBIT_DOGFOOD_PROFILE_DIR"));
        assert!(script.contains("HOBIT_DOGFOOD_OPERATOR_ENDPOINT_FILE"));
        assert!(script.contains("HOBIT_DOGFOOD_WORKSPACE_ROOT"));
        assert!(script.contains("dogfoodOperatorEndpointFile"));
        assert!(script.contains("os.tmpdir()"));
        assert!(script.contains("assertPathOutsideRepo"));
        assert!(script.contains("cleanupLegacyRepoLocalEndpointFile"));
        assert!(!script.contains("dogfoodProfileEndpointFile"));
        assert!(script.contains(r#""run","#));
        assert!(script.contains(r#""tauri:dev","#));
        assert!(script.contains(r#""--prefix","#));
        assert!(script.contains(r#""apps/desktop/frontend","#));
        assert!(script.contains(r#""--no-dev-server-wait","#));
        assert!(script.contains("tauri-dogfood-operator.json"));
        assert!(script.contains("CARGO_TARGET_DIR"));
        assert!(script.contains("HOBIT_DOGFOOD_OPERATOR_MOCK_LAUNCH"));
        assert!(script.contains("only --provider-readiness codex is supported"));
        assert!(script.contains("only --provider-auth-context codex is supported"));
        assert!(!script.contains("process.env.HOBIT_DOGFOOD_DATABASE"));
        assert!(!script.contains("process.env.HOBIT_DOGFOOD_WORKSPACE_ID"));
    }

    struct EndpointFixture {
        db_path: PathBuf,
        rendezvous_path: PathBuf,
        workspace_id: String,
        active_workspace: ActiveWorkspaceRegistry,
        server: DogfoodOperatorEndpointServer,
    }

    impl EndpointFixture {
        fn with_active_workspace(fake_worker: bool) -> Self {
            let db_path = unique_test_db_path();
            let workspace_id = create_test_workspace(&db_path);
            let active_workspace = ActiveWorkspaceRegistry::default();
            active_workspace.set(workspace_id.clone());
            let fake_worker_status = fake_worker.then_some("completed");
            Self::start(db_path, active_workspace, workspace_id, fake_worker_status)
        }

        fn with_active_workspace_fake_status(status: &'static str) -> Self {
            let db_path = unique_test_db_path();
            let workspace_id = create_test_workspace(&db_path);
            let active_workspace = ActiveWorkspaceRegistry::default();
            active_workspace.set(workspace_id.clone());
            Self::start(db_path, active_workspace, workspace_id, Some(status))
        }

        fn without_active_workspace() -> Self {
            let db_path = unique_test_db_path();
            let workspace_id = create_test_workspace(&db_path);
            Self::start(
                db_path,
                ActiveWorkspaceRegistry::default(),
                workspace_id,
                None,
            )
        }

        fn start(
            db_path: PathBuf,
            active_workspace: ActiveWorkspaceRegistry,
            workspace_id: String,
            fake_worker_status: Option<&str>,
        ) -> Self {
            Self::start_with_provider_readiness(
                db_path,
                active_workspace,
                workspace_id,
                fake_worker_status,
                fake_provider_readiness("ready", "ready", Vec::new()),
            )
        }

        fn start_with_provider_readiness(
            db_path: PathBuf,
            active_workspace: ActiveWorkspaceRegistry,
            workspace_id: String,
            fake_worker_status: Option<&str>,
            provider_readiness: QueueLocalProviderReadinessSummary,
        ) -> Self {
            let rendezvous_path = unique_rendezvous_path();
            let mut config = DogfoodOperatorEndpointConfig::new(
                db_path.clone(),
                "dogfood".to_owned(),
                active_workspace.clone(),
                rendezvous_path.clone(),
            )
            .with_token("test-token")
            .with_fake_provider_readiness(provider_readiness);
            if let Some(status) = fake_worker_status {
                config = config.with_fake_worker_status(status);
            }
            let server = DogfoodOperatorEndpointServer::start(config).expect("endpoint");
            Self {
                db_path,
                rendezvous_path,
                workspace_id,
                active_workspace,
                server,
            }
        }

        fn server_context(&self) -> ActiveWorkspaceRegistry {
            self.active_workspace.clone()
        }
    }

    impl Drop for EndpointFixture {
        fn drop(&mut self) {
            remove_test_db_files(&self.db_path);
            let _ = fs::remove_file(&self.rendezvous_path);
        }
    }

    fn fake_provider_readiness(
        status: &str,
        auth_status: &str,
        blockers: Vec<&str>,
    ) -> QueueLocalProviderReadinessSummary {
        QueueLocalProviderReadinessSummary {
            provider_id: "codex".to_owned(),
            execution_target: "queue_local".to_owned(),
            status: status.to_owned(),
            codex_executable_resolved: true,
            codex_executable_summary: Some("codex.cmd".to_owned()),
            codex_version: Some("codex-cli test".to_owned()),
            auth_status: auth_status.to_owned(),
            auth_source_summary: "environment_present".to_owned(),
            auth_source_fingerprint: None,
            environment_summary: vec![QueueLocalProviderEnvironmentSummary {
                name: "OPENAI_API_KEY".to_owned(),
                present: true,
            }],
            readiness_check_method: "auth_status_command".to_owned(),
            last_known_provider_failure: blockers.first().map(|blocker| (*blocker).to_owned()),
            blockers: blockers.into_iter().map(ToOwned::to_owned).collect(),
            warnings: Vec::new(),
            used_direct_database_path: false,
            profile_mode: Some("dogfood".to_owned()),
        }
    }

    struct TestResponse {
        status: u16,
        body: Value,
    }

    fn request_json(
        server: &DogfoodOperatorEndpointServer,
        method: &str,
        path: &str,
        body: Option<Value>,
        token: Option<&str>,
    ) -> TestResponse {
        let payload = body
            .map(|body| serde_json::to_vec(&body).expect("body"))
            .unwrap_or_default();
        let mut headers = format!(
            "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: {}\r\n",
            payload.len()
        );
        if let Some(token) = token {
            headers.push_str(&format!("{AUTH_HEADER}: {token}\r\n"));
        }
        headers.push_str("\r\n");

        let mut stream = TcpStream::connect(server.local_addr()).expect("connect");
        stream.write_all(headers.as_bytes()).expect("headers");
        stream.write_all(&payload).expect("payload");
        stream
            .set_read_timeout(Some(Duration::from_secs(5)))
            .expect("timeout");
        let mut response = Vec::new();
        stream.read_to_end(&mut response).expect("response");
        parse_test_response(&response)
    }

    fn parse_test_response(response: &[u8]) -> TestResponse {
        let header_end = find_header_end(response).expect("header end");
        let header = std::str::from_utf8(&response[..header_end]).expect("header");
        let status = header
            .lines()
            .next()
            .expect("status line")
            .split_whitespace()
            .nth(1)
            .expect("status")
            .parse::<u16>()
            .expect("status number");
        let body = serde_json::from_slice(&response[header_end + 4..]).expect("json body");
        TestResponse { status, body }
    }

    fn create_test_workspace(db_path: &Path) -> String {
        let store = SqliteStore::open(db_path).expect("open store");
        store.init_schema().expect("init schema");
        let service = WorkspaceService::new(store);
        let workspace = service
            .create_empty_workspace_with_root_path(
                "Dogfood endpoint workspace",
                None,
                Some(repo_root_for_test().display().to_string()),
            )
            .expect("create workspace");
        service
            .enable_agent_queue_manual_control(
                workspace.id.clone(),
                Some("dogfood-operator-endpoint-test".to_owned()),
                Some("dogfood operator endpoint fixture".to_owned()),
                None,
            )
            .expect("enable manual control");
        workspace.id
    }

    fn assert_no_widget_runs(db_path: &Path) {
        let store = SqliteStore::open(db_path).expect("open store");
        assert!(store
            .list_widget_runs_for_widget(hobit_app::QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID)
            .expect("widget runs")
            .is_empty());
    }

    fn response_queue_task_id(body: &Value, pack_task_id: &str) -> String {
        body["materialization"]["mappings"]
            .as_array()
            .expect("materialization mappings")
            .iter()
            .find(|mapping| mapping["packTaskId"] == pack_task_id)
            .and_then(|mapping| mapping["queueTaskId"].as_str())
            .unwrap_or_else(|| panic!("missing queue task id for {pack_task_id}"))
            .to_owned()
    }

    fn materialize_foundation_queue_task_id(fixture: &EndpointFixture) -> String {
        let materialized = request_json(
            &fixture.server,
            "POST",
            "/materialize_prompt_pack_file",
            Some(json!({ "packPath": DOGFOOD_PACK })),
            Some("test-token"),
        );
        assert_eq!(materialized.status, 200, "{}", materialized.body);
        response_queue_task_id(&materialized.body, "dogfood-foundation-checkpoint")
    }

    fn start_running_queue_local_task(
        fixture: &EndpointFixture,
        queue_task_id: &str,
    ) -> SelectedAgentQueueTaskLocalStartSummary {
        let service = workspace_service(&fixture.db_path).expect("service");
        service
            .start_selected_agent_queue_task_local(
                hobit_app::StartSelectedAgentQueueTaskLocalInput {
                    workspace_id: fixture.workspace_id.clone(),
                    queue_item_id: queue_task_id.to_owned(),
                },
            )
            .expect("start selected task without launcher")
    }

    fn insert_stale_running_queue_local_run(
        fixture: &EndpointFixture,
        queue_task_id: &str,
    ) -> (String, String) {
        let store = SqliteStore::open(&fixture.db_path).expect("open store");
        store.init_schema().expect("init schema");
        let run_id = "stale-dogfood-run".to_owned();
        let run_link_id = "stale-dogfood-run-link".to_owned();
        store
            .insert_agent_queue_task_run_link(NewAgentQueueTaskRunLink {
                link_id: &run_link_id,
                workspace_id: &fixture.workspace_id,
                queue_task_id,
                executor_widget_id: QUEUE_LOCAL_BACKEND_EXECUTION_TARGET_ID,
                direct_work_run_id: &run_id,
                source: "manual",
                status: AgentQueueTaskRunStatus::Running.as_str(),
                started_at: Some("1.000000000"),
                completed_at: None,
                validation_status: None,
                review_status: None,
                created_at: Some("1.000000000"),
                updated_at: Some("1.000000000"),
            })
            .expect("insert stale run link");
        store
            .update_agent_queue_task_status(
                &fixture.workspace_id,
                queue_task_id,
                "running",
                Some("1.000000000"),
            )
            .expect("mark task running")
            .expect("running task row");
        (run_id, run_link_id)
    }

    fn repo_root_for_test() -> PathBuf {
        let mut current = env::current_dir().expect("current dir");
        loop {
            if current.join("AGENTS.md").is_file() && current.join("Cargo.toml").is_file() {
                return current;
            }
            current = current
                .parent()
                .unwrap_or_else(|| panic!("repo root not found from current dir"))
                .to_path_buf();
        }
    }

    fn unique_test_db_path() -> PathBuf {
        env::temp_dir().join(format!(
            "hobit-dogfood-endpoint-{}-{}.sqlite3",
            std::process::id(),
            unique_test_suffix()
        ))
    }

    fn unique_rendezvous_path() -> PathBuf {
        env::temp_dir()
            .join(format!(
                "hobit-dogfood-endpoint-rendezvous-{}-{}",
                std::process::id(),
                unique_test_suffix()
            ))
            .join(DOGFOOD_OPERATOR_ENDPOINT_FILE_NAME)
    }

    fn unique_test_suffix() -> u128 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos()
    }

    fn remove_test_db_files(db_path: &Path) {
        let _ = fs::remove_file(db_path);
        let _ = fs::remove_file(db_path.with_extension("sqlite3-wal"));
        let _ = fs::remove_file(db_path.with_extension("sqlite3-shm"));
    }
}
