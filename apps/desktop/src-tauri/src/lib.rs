use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::VecDeque,
    env, fs,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        mpsc::{self, Receiver, RecvTimeoutError},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{
    menu::{AboutMetadata, MenuBuilder, SubmenuBuilder},
    Manager, State,
};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
const STDERR_LINES: usize = 32;

#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "method", content = "params", rename_all = "snake_case")]
enum EvalRequest {
    RankMoves(RankMovesRequest),
    CubeDecision(CubeDecisionRequest),
}

// These mirror `packages/ai/src/protocol.ts`. THAT FILE IS THE DEFINITION; this
// is a reader of it, in a language the TypeScript compiler cannot check. When
// the protocol changes, this does not fail to build — it fails at runtime, in
// the packaged app only, by falling back to the weaker evaluator without
// saying why. It has already happened once: match context was added to the
// cube request and `cube_owned: bool` was left behind here.
//
// Change one, grep the other.
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RankMovesRequest {
    position_id: String,
    dice: [u8; 2],
    plies: u8,
    #[serde(skip_serializing_if = "Option::is_none")]
    match_id: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CubeDecisionRequest {
    position_id: String,
    cube_value: u32,
    /// -1 centred, otherwise the GNU board side that owns it.
    cube_owner: i8,
    match_length: u32,
    /// GNU side 0 (opponent), side 1 (the player the position represents).
    score: [u32; 2],
    crawford: bool,
    jacoby: bool,
    plies: u8,
}

impl EvalRequest {
    fn method(&self) -> &'static str {
        match self {
            Self::RankMoves(_) => "rank_moves",
            Self::CubeDecision(_) => "cube_decision",
        }
    }

    fn params(&self) -> Result<Value, String> {
        match self {
            Self::RankMoves(params) => serde_json::to_value(params),
            Self::CubeDecision(params) => serde_json::to_value(params),
        }
        .map_err(|error| format!("could not encode evaluator request: {error}"))
    }
}

#[derive(Debug, Deserialize)]
struct BridgeResponse {
    id: Option<u64>,
    ok: bool,
    result: Option<Value>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BundledGnubg {
    binary: PathBuf,
    data_directory: PathBuf,
}

struct GnubgLayout {
    binary: PathBuf,
    data: PathBuf,
    bridge: PathBuf,
}

impl GnubgLayout {
    fn discover(resources: &Path) -> Result<Self, String> {
        let root = resources.join("gnubg");
        let manifest_path = root.join("bundle-manifest.json");
        if manifest_path.is_file() {
            let manifest = fs::read_to_string(&manifest_path)
                .map_err(|error| format!("could not read {}: {error}", manifest_path.display()))?;
            let bundled: BundledGnubg = serde_json::from_str(&manifest)
                .map_err(|error| format!("invalid {}: {error}", manifest_path.display()))?;
            return Ok(Self {
                binary: root.join(bundled.binary),
                data: root.join(bundled.data_directory),
                bridge: resources.join("bridge.py"),
            });
        }

        let binary = env::var_os("GNUBG_BINARY").map(PathBuf::from);
        let data = env::var_os("GNUBG_DATA").map(PathBuf::from);
        let bridge = env::var_os("GNUBG_BRIDGE").map(PathBuf::from);
        match (binary, data, bridge) {
            (Some(binary), Some(data), Some(bridge)) => Ok(Self {
                binary,
                data,
                bridge,
            }),
            _ => Err(format!(
                "bundled GNU Backgammon manifest not found at {}",
                manifest_path.display()
            )),
        }
    }
}

#[derive(Debug)]
enum BridgeFailure {
    Backend(String),
    Fatal(String),
}

struct BridgeProcess {
    child: Child,
    stdin: ChildStdin,
    responses: Receiver<BridgeResponse>,
    stderr: Arc<Mutex<VecDeque<String>>>,
}

impl BridgeProcess {
    fn spawn(layout: &GnubgLayout) -> Result<Self, String> {
        if !layout.binary.is_file() {
            return Err(format!(
                "GNU Backgammon executable not found at {}",
                layout.binary.display()
            ));
        }
        if !layout.data.is_dir() {
            return Err(format!(
                "GNU Backgammon data directory not found at {}",
                layout.data.display()
            ));
        }
        if !layout.bridge.is_file() {
            return Err(format!(
                "GNU Backgammon bridge not found at {}",
                layout.bridge.display()
            ));
        }

        let mut command = Command::new(&layout.binary);
        command
            .args(["-q", "-t", "-r", "-P"])
            .arg(&layout.data)
            .arg("-D")
            .arg(&layout.data)
            .arg(format!("--python={}", layout.bridge.display()))
            .current_dir(
                layout.binary.parent().ok_or_else(|| {
                    "GNU Backgammon executable has no parent directory".to_string()
                })?,
            )
            .env("PYTHONIOENCODING", "utf-8")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x0800_0000);
        }

        let mut child = command
            .spawn()
            .map_err(|error| format!("could not start GNU Backgammon: {error}"))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "GNU Backgammon stdin was unavailable".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "GNU Backgammon stdout was unavailable".to_string())?;
        let child_stderr = child
            .stderr
            .take()
            .ok_or_else(|| "GNU Backgammon stderr was unavailable".to_string())?;

        let (sender, responses) = mpsc::channel();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if !line.trim_start().starts_with('{') {
                    continue;
                }
                if let Ok(response) = serde_json::from_str::<BridgeResponse>(&line) {
                    if sender.send(response).is_err() {
                        break;
                    }
                }
            }
        });

        let stderr = Arc::new(Mutex::new(VecDeque::with_capacity(STDERR_LINES)));
        let stderr_reader = Arc::clone(&stderr);
        thread::spawn(move || {
            for line in BufReader::new(child_stderr).lines().map_while(Result::ok) {
                let Ok(mut tail) = stderr_reader.lock() else {
                    break;
                };
                if tail.len() == STDERR_LINES {
                    tail.pop_front();
                }
                tail.push_back(line);
            }
        });

        Ok(Self {
            child,
            stdin,
            responses,
            stderr,
        })
    }

    fn request(&mut self, id: u64, request: &EvalRequest) -> Result<Value, BridgeFailure> {
        let payload = json!({
            "id": id,
            "method": request.method(),
            "params": request.params().map_err(BridgeFailure::Backend)?,
        });
        serde_json::to_writer(&mut self.stdin, &payload)
            .map_err(|error| BridgeFailure::Fatal(format!("could not write request: {error}")))?;
        self.stdin
            .write_all(b"\n")
            .and_then(|_| self.stdin.flush())
            .map_err(|error| BridgeFailure::Fatal(format!("could not write request: {error}")))?;

        let deadline = Instant::now() + REQUEST_TIMEOUT;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err(BridgeFailure::Fatal(format!(
                    "request {id} timed out after {}ms",
                    REQUEST_TIMEOUT.as_millis()
                )));
            }

            match self.responses.recv_timeout(remaining) {
                Ok(response) if response.id == Some(id) => {
                    if response.ok {
                        return response.result.ok_or_else(|| {
                            BridgeFailure::Backend("GNU Backgammon returned no result".to_string())
                        });
                    }
                    return Err(BridgeFailure::Backend(response.error.unwrap_or_else(
                        || "unknown GNU Backgammon bridge error".to_string(),
                    )));
                }
                Ok(_) => continue,
                Err(RecvTimeoutError::Timeout) => {
                    return Err(BridgeFailure::Fatal(format!(
                        "request {id} timed out after {}ms",
                        REQUEST_TIMEOUT.as_millis()
                    )));
                }
                Err(RecvTimeoutError::Disconnected) => {
                    return Err(BridgeFailure::Fatal(
                        "GNU Backgammon exited before replying".to_string(),
                    ));
                }
            }
        }
    }

    fn stderr_tail(&self) -> String {
        self.stderr
            .lock()
            .map(|lines| lines.iter().cloned().collect::<Vec<_>>().join("\n"))
            .unwrap_or_default()
    }

    fn stop(&mut self) {
        if self.child.try_wait().ok().flatten().is_none() {
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
    }
}

impl Drop for BridgeProcess {
    fn drop(&mut self) {
        self.stop();
    }
}

struct EvaluatorManager {
    layout: Result<GnubgLayout, String>,
    process: Option<BridgeProcess>,
    next_id: u64,
}

impl EvaluatorManager {
    fn new(layout: Result<GnubgLayout, String>) -> Self {
        Self {
            layout,
            process: None,
            next_id: 1,
        }
    }

    fn evaluate(&mut self, request: EvalRequest) -> Result<Value, String> {
        if self.process.is_none() {
            let layout = self.layout.as_ref().map_err(Clone::clone)?;
            self.process = Some(BridgeProcess::spawn(layout)?);
        }
        let id = self.next_id;
        self.next_id = self.next_id.saturating_add(1);

        let result = self
            .process
            .as_mut()
            .expect("process was just initialized")
            .request(id, &request);
        match result {
            Ok(value) => Ok(value),
            Err(BridgeFailure::Backend(message)) => {
                Err(format!("GNU Backgammon bridge error: {message}"))
            }
            Err(BridgeFailure::Fatal(message)) => {
                let mut process = self.process.take().expect("process existed");
                let stderr = process.stderr_tail();
                process.stop();
                if stderr.is_empty() {
                    Err(format!("GNU Backgammon unavailable: {message}"))
                } else {
                    Err(format!("GNU Backgammon unavailable: {message}: {stderr}"))
                }
            }
        }
    }
}

#[derive(Clone)]
struct EvaluatorState {
    manager: Arc<Mutex<EvaluatorManager>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppDataPaths {
    root: String,
    matches: String,
    profile: String,
    drills: String,
}

fn display_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn ensure_app_data(app: &tauri::AppHandle) -> Result<AppDataPaths, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("could not resolve app-data directory: {error}"))?;
    let matches = root.join("matches");
    fs::create_dir_all(&matches)
        .map_err(|error| format!("could not create {}: {error}", matches.display()))?;
    Ok(AppDataPaths {
        root: display_path(&root),
        matches: display_path(&matches),
        profile: display_path(&root.join("profile.json")),
        drills: display_path(&root.join("drills.json")),
    })
}

#[tauri::command]
async fn evaluate(state: State<'_, EvaluatorState>, request: EvalRequest) -> Result<Value, String> {
    let manager = Arc::clone(&state.manager);
    tauri::async_runtime::spawn_blocking(move || {
        manager
            .lock()
            .map_err(|_| "GNU Backgammon process lock was poisoned".to_string())?
            .evaluate(request)
    })
    .await
    .map_err(|error| format!("evaluator task failed: {error}"))?
}

#[tauri::command]
fn local_data_paths(app: tauri::AppHandle) -> Result<AppDataPaths, String> {
    ensure_app_data(&app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let resources = app
                .path()
                .resource_dir()
                .map_err(|error| format!("could not resolve resource directory: {error}"))?;
            ensure_app_data(app.handle())?;
            app.manage(EvaluatorState {
                manager: Arc::new(Mutex::new(EvaluatorManager::new(GnubgLayout::discover(
                    &resources,
                )))),
            });

            let about = AboutMetadata {
                name: Some("nard — نرد".to_string()),
                version: Some(app.package_info().version.to_string()),
                comments: Some(
                    "Includes GNU Backgammon 1.08.003 as a separate GPL-3.0 process. \
                     Corresponding source: gnubg-release-1.08.003-sources.tar.gz"
                        .to_string(),
                ),
                license: Some("nard: MIT; bundled GNU Backgammon: GPL-3.0".to_string()),
                website: Some(
                    "https://ftp.gnu.org/gnu/gnubg/gnubg-release-1.08.003-sources.tar.gz"
                        .to_string(),
                ),
                website_label: Some("GNU Backgammon source 1.08.003".to_string()),
                ..Default::default()
            };
            let file = SubmenuBuilder::new(app, "&File").quit().build()?;
            let help = SubmenuBuilder::new(app, "&Help")
                .about(Some(about))
                .build()?;
            let menu = MenuBuilder::new(app).items(&[&file, &help]).build()?;
            app.set_menu(menu)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![evaluate, local_data_paths])
        .run(tauri::generate_context!())
        .expect("error while running nard");
}
