//! NovelStudio Tauri core.
//!
//! Responsibilities kept in Rust (everything else lives in the Svelte/TypeScript layer):
//! * locating the bundled SpecNovelist toolkit and the embedded Python runtime,
//! * running `specnovel.py` and `git` inside a novel project,
//! * project-scoped file IO (all paths are confined to the project root),
//! * OS keychain access for provider API keys.

use serde::Serialize;
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const KEYCHAIN_SERVICE: &str = "dev.junov.novelstudio";

/// Directory names never listed in the project explorer.
const IGNORED_DIRS: &[&str] = &[".git", "node_modules", "build", "third_party", ".specnovelist", "target"];

#[derive(Serialize)]
pub struct CmdOutput {
    code: i32,
    stdout: String,
    stderr: String,
}

#[derive(Serialize)]
pub struct ToolkitInfo {
    toolkit_path: String,
    python_path: Option<String>,
    python_version: Option<String>,
    git_version: Option<String>,
}

#[derive(Serialize)]
pub struct FileEntry {
    path: String,
    size: u64,
    modified: u64,
}

static PYTHON: OnceLock<Option<(String, Vec<String>, String)>> = OnceLock::new();

fn no_window(cmd: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

/// Resolve the SpecNovelist toolkit: bundled resource first, then the dev submodule checkout.
fn toolkit_dir(app: &AppHandle) -> PathBuf {
    if let Ok(res) = app.path().resource_dir() {
        let bundled = res.join("specnovelist");
        if bundled.join("scripts").join("specnovel.py").is_file() {
            return bundled;
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("third_party")
        .join("specnovelist")
}

fn probe(program: &str, pre_args: &[String]) -> Option<String> {
    let mut cmd = Command::new(program);
    cmd.args(pre_args).arg("--version");
    let out = no_window(&mut cmd).output().ok()?;
    if !out.status.success() {
        return None;
    }
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );
    let text = text.trim().to_string();
    if text.starts_with("Python 3") {
        Some(text)
    } else {
        None
    }
}

/// Find a Python 3 interpreter: embedded runtime, `NOVELSTUDIO_PYTHON`, then system candidates.
fn python(app: &AppHandle) -> Option<(String, Vec<String>, String)> {
    PYTHON
        .get_or_init(|| {
            let mut candidates: Vec<(String, Vec<String>)> = Vec::new();
            if let Ok(res) = app.path().resource_dir() {
                let base = res.join("python");
                for rel in ["python.exe", "bin/python3", "python/python.exe", "python/bin/python3"] {
                    let p = base.join(rel);
                    if p.is_file() {
                        candidates.push((p.to_string_lossy().to_string(), vec![]));
                    }
                }
            }
            if let Ok(p) = std::env::var("NOVELSTUDIO_PYTHON") {
                candidates.push((p, vec![]));
            }
            if cfg!(windows) {
                candidates.push(("py".into(), vec!["-3".into()]));
            }
            candidates.push(("python3".into(), vec![]));
            candidates.push(("python".into(), vec![]));
            for (prog, pre) in candidates {
                if let Some(v) = probe(&prog, &pre) {
                    return Some((prog, pre, v));
                }
            }
            None
        })
        .clone()
}

/// Join `rel` onto `root`, rejecting absolute paths and `..` escapes.
fn confine(root: &str, rel: &str) -> Result<PathBuf, String> {
    let rel_path = Path::new(rel);
    if rel_path.is_absolute() {
        return Err(format!("absolute paths are not allowed: {rel}"));
    }
    for c in rel_path.components() {
        match c {
            Component::Normal(_) | Component::CurDir => {}
            _ => return Err(format!("path escapes the project: {rel}")),
        }
    }
    Ok(Path::new(root).join(rel_path))
}

fn exec_cmd(mut cmd: Command, cwd: &str) -> Result<CmdOutput, String> {
    cmd.current_dir(cwd)
        .env("PYTHONIOENCODING", "utf-8")
        .env("PYTHONUTF8", "1");
    let out = no_window(&mut cmd)
        .output()
        .map_err(|e| format!("failed to start process: {e}"))?;
    Ok(CmdOutput {
        code: out.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&out.stdout).to_string(),
        stderr: String::from_utf8_lossy(&out.stderr).to_string(),
    })
}

#[tauri::command]
fn toolkit_info(app: AppHandle) -> ToolkitInfo {
    let py = python(&app);
    let git_version = {
        let mut c = Command::new("git");
        c.arg("--version");
        no_window(&mut c)
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
    };
    ToolkitInfo {
        toolkit_path: toolkit_dir(&app).to_string_lossy().to_string(),
        python_path: py.as_ref().map(|p| p.0.clone()),
        python_version: py.map(|p| p.2),
        git_version,
    }
}

/// Run `python <toolkit>/scripts/specnovel.py <args>` inside the project directory.
#[tauri::command]
async fn run_specnovel(app: AppHandle, project: String, args: Vec<String>) -> Result<CmdOutput, String> {
    let (prog, pre, _) = python(&app).ok_or_else(|| {
        "Python 3 was not found. Install Python 3 or set NOVELSTUDIO_PYTHON.".to_string()
    })?;
    let script = toolkit_dir(&app).join("scripts").join("specnovel.py");
    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new(prog);
        cmd.args(pre).arg(script).args(args);
        exec_cmd(cmd, &project)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Run `git <args>` inside the project directory.
#[tauri::command]
async fn run_git(project: String, args: Vec<String>) -> Result<CmdOutput, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new("git");
        cmd.args(args);
        exec_cmd(cmd, &project)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Show a native system folder picker dialog.
#[tauri::command]
async fn pick_folder() -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let folder = rfd::FileDialog::new().pick_folder();
        Ok(folder.map(|p| p.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn ensure_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn path_exists(project: String, rel: String) -> Result<bool, String> {
    Ok(confine(&project, &rel)?.exists())
}

#[tauri::command]
fn read_text(project: String, rel: String) -> Result<String, String> {
    let p = confine(&project, &rel)?;
    std::fs::read_to_string(&p).map_err(|e| format!("{}: {e}", p.display()))
}

#[tauri::command]
fn write_text(project: String, rel: String, content: String) -> Result<(), String> {
    let p = confine(&project, &rel)?;
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&p, content).map_err(|e| format!("{}: {e}", p.display()))
}

#[tauri::command]
fn delete_file(project: String, rel: String) -> Result<(), String> {
    let p = confine(&project, &rel)?;
    std::fs::remove_file(&p).map_err(|e| format!("{}: {e}", p.display()))
}

/// Read a file from the bundled SpecNovelist toolkit (read-only; used for skills and references).
#[tauri::command]
fn read_toolkit(app: AppHandle, rel: String) -> Result<String, String> {
    let root = toolkit_dir(&app);
    let p = confine(&root.to_string_lossy(), &rel)?;
    std::fs::read_to_string(&p).map_err(|e| format!("{}: {e}", p.display()))
}

/// Read a binary file (e.g. graphics) as base64-free byte vector for display.
#[tauri::command]
fn read_bytes(project: String, rel: String) -> Result<Vec<u8>, String> {
    let p = confine(&project, &rel)?;
    std::fs::read(&p).map_err(|e| format!("{}: {e}", p.display()))
}

/// Recursively list project files (forward-slash relative paths), skipping VCS/build folders.
#[tauri::command]
fn list_files(project: String) -> Result<Vec<FileEntry>, String> {
    let root = PathBuf::from(&project);
    if !root.is_dir() {
        return Err(format!("not a directory: {project}"));
    }
    let mut out = Vec::new();
    let walker = walkdir::WalkDir::new(&root).into_iter().filter_entry(|e| {
        e.depth() == 0
            || !(e.file_type().is_dir()
                && IGNORED_DIRS.contains(&e.file_name().to_string_lossy().as_ref()))
    });
    for entry in walker.flatten() {
        if !entry.file_type().is_file() {
            continue;
        }
        let rel = entry
            .path()
            .strip_prefix(&root)
            .unwrap_or(entry.path())
            .to_string_lossy()
            .replace('\\', "/");
        let meta = entry.metadata().ok();
        out.push(FileEntry {
            path: rel,
            size: meta.as_ref().map(|m| m.len()).unwrap_or(0),
            modified: meta
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0),
        });
    }
    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}

#[derive(Serialize)]
pub struct MarkdownFile {
    path: String,
    content: String,
}

/// Read every markdown file in the project in one call (used to build the wiki-link index).
#[tauri::command]
async fn scan_markdown(project: String) -> Result<Vec<MarkdownFile>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let files = list_files(project.clone())?;
        Ok(files
            .into_iter()
            .filter(|f| f.path.ends_with(".md"))
            .filter_map(|f| {
                let content = std::fs::read_to_string(Path::new(&project).join(&f.path)).ok()?;
                Some(MarkdownFile { path: f.path, content })
            })
            .collect())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn secret_set(name: String, value: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &name).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
fn secret_get(name: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &name).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

static INTERVIEW_PROMPT: OnceLock<Mutex<Option<String>>> = OnceLock::new();
static INTERVIEW_ANSWERS: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn prompt_mutex() -> &'static Mutex<Option<String>> {
    INTERVIEW_PROMPT.get_or_init(|| Mutex::new(None))
}

fn answers_mutex() -> &'static Mutex<Option<String>> {
    INTERVIEW_ANSWERS.get_or_init(|| Mutex::new(None))
}

#[tauri::command]
fn set_interview_prompt(prompt_json: String) -> Result<(), String> {
    let mut lock = prompt_mutex().lock().map_err(|e| e.to_string())?;
    *lock = Some(prompt_json);
    let mut ans_lock = answers_mutex().lock().map_err(|e| e.to_string())?;
    *ans_lock = None;
    Ok(())
}

#[tauri::command]
fn get_interview_prompt() -> Result<Option<String>, String> {
    let lock = prompt_mutex().lock().map_err(|e| e.to_string())?;
    Ok(lock.clone())
}

#[tauri::command]
fn submit_interview_answers(app: AppHandle, answers_json: String) -> Result<(), String> {
    {
        let mut lock = answers_mutex().lock().map_err(|e| e.to_string())?;
        *lock = Some(answers_json);
    }
    if let Ok(mut lock) = prompt_mutex().lock() {
        *lock = None;
    }
    if let Some(w) = app.get_webview_window("interview") {
        let _ = w.close();
    }
    Ok(())
}

#[tauri::command]
fn poll_interview_answers() -> Result<Option<String>, String> {
    let mut lock = answers_mutex().lock().map_err(|e| e.to_string())?;
    let val = lock.take();
    Ok(val)
}

#[tauri::command]
async fn open_settings_window(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(());
    }
    WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App("/#settings".into()))
        .title("NovelStudio Settings")
        .inner_size(700.0, 720.0)
        .min_inner_size(500.0, 500.0)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn open_interview_window(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("interview") {
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(());
    }
    WebviewWindowBuilder::new(&app, "interview", WebviewUrl::App("/#interview".into()))
        .title("Author Interview — NovelStudio")
        .inner_size(740.0, 680.0)
        .min_inner_size(520.0, 480.0)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn close_window(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(&label) {
        let _ = w.close();
    }
    Ok(())
}

#[tauri::command]
fn secret_delete(name: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &name).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            toolkit_info,
            run_specnovel,
            run_git,
            pick_folder,
            ensure_dir,
            path_exists,
            read_text,
            write_text,
            delete_file,
            read_toolkit,
            read_bytes,
            list_files,
            scan_markdown,
            secret_set,
            secret_get,
            secret_delete,
            open_settings_window,
            open_interview_window,
            close_window,
            set_interview_prompt,
            get_interview_prompt,
            submit_interview_answers,
            poll_interview_answers
        ])
        .run(tauri::generate_context!())
        .expect("error while running NovelStudio");
}

#[cfg(test)]
mod tests {
    use super::confine;

    #[test]
    fn confine_rejects_escapes() {
        assert!(confine("/proj", "../etc/passwd").is_err());
        assert!(confine("/proj", "kb/../../x").is_err());
        assert!(confine("/proj", "kb/characters/CHR-001.md").is_ok());
    }
}
