use std::env;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const POLL_INTERVAL: Duration = Duration::from_millis(500);
const MARKER_FRESH_WINDOW: Duration = Duration::from_secs(15);
const RESTART_WINDOW_SECS: u64 = 60;
const MAX_RESTARTS_IN_WINDOW: usize = 3;

struct Config {
    parent_pid: u32,
    exe_path: PathBuf,
    marker_path: PathBuf,
}

fn main() {
    let config = match parse_args() {
        Ok(config) => config,
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    };

    match run(config) {
        Ok(exit_code) => std::process::exit(exit_code),
        Err(error) => {
            eprintln!("watchdog error: {error}");
            std::process::exit(1);
        }
    }
}

fn run(config: Config) -> io::Result<i32> {
    loop {
        if process_exists(config.parent_pid) {
            thread::sleep(POLL_INTERVAL);
            continue;
        }

        if marker_is_fresh(&config.marker_path, MARKER_FRESH_WINDOW) {
            return Ok(0);
        }

        let now = unix_now_secs();
        let restart_log = restart_log_path(&config.marker_path);
        let mut restart_timestamps = load_restart_timestamps(&restart_log, now)?;

        if restart_timestamps.len() >= MAX_RESTARTS_IN_WINDOW {
            save_restart_timestamps(&restart_log, &restart_timestamps)?;
            return Ok(2);
        }

        spawn_app(&config.exe_path)?;
        restart_timestamps.push(now);
        save_restart_timestamps(&restart_log, &restart_timestamps)?;
        return Ok(0);
    }
}

fn parse_args() -> Result<Config, String> {
    let mut parent_pid: Option<u32> = None;
    let mut exe_path: Option<PathBuf> = None;
    let mut marker_path: Option<PathBuf> = None;

    let mut args = env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--parent-pid" => {
                let value = args
                    .next()
                    .ok_or_else(|| "missing value for --parent-pid".to_string())?;
                let parsed = value
                    .parse::<u32>()
                    .map_err(|_| "invalid value for --parent-pid".to_string())?;
                parent_pid = Some(parsed);
            }
            "--exe" => {
                let value = args
                    .next()
                    .ok_or_else(|| "missing value for --exe".to_string())?;
                exe_path = Some(PathBuf::from(value));
            }
            "--marker" => {
                let value = args
                    .next()
                    .ok_or_else(|| "missing value for --marker".to_string())?;
                marker_path = Some(PathBuf::from(value));
            }
            _ => return Err(format!("unknown argument: {arg}")),
        }
    }

    let config = Config {
        parent_pid: parent_pid.ok_or_else(|| "missing required --parent-pid".to_string())?,
        exe_path: exe_path.ok_or_else(|| "missing required --exe".to_string())?,
        marker_path: marker_path.ok_or_else(|| "missing required --marker".to_string())?,
    };

    Ok(config)
}

fn marker_is_fresh(marker_path: &Path, freshness: Duration) -> bool {
    let metadata = match fs::metadata(marker_path) {
        Ok(metadata) => metadata,
        Err(_) => return false,
    };

    let modified_at = match metadata.modified() {
        Ok(modified_at) => modified_at,
        Err(_) => return false,
    };

    let age = match SystemTime::now().duration_since(modified_at) {
        Ok(age) => age,
        Err(_) => Duration::ZERO,
    };

    age <= freshness
}

fn restart_log_path(marker_path: &Path) -> PathBuf {
    let file_name = marker_path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "shutdown.intent".to_string());

    marker_path.with_file_name(format!("{file_name}.restarts.json"))
}

fn load_restart_timestamps(path: &Path, now: u64) -> io::Result<Vec<u64>> {
    let raw = match fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(err) if err.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(err) => return Err(err),
    };

    let mut timestamps = serde_json::from_str::<Vec<u64>>(&raw).unwrap_or_default();
    timestamps.retain(|timestamp| now.saturating_sub(*timestamp) <= RESTART_WINDOW_SECS);
    Ok(timestamps)
}

fn save_restart_timestamps(path: &Path, timestamps: &[u64]) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let payload = serde_json::to_string(timestamps)
        .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err.to_string()))?;
    fs::write(path, payload)
}

fn spawn_app(exe_path: &Path) -> io::Result<()> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
        Command::new(exe_path)
            .creation_flags(CREATE_NEW_PROCESS_GROUP)
            .spawn()?;
    }

    #[cfg(not(windows))]
    {
        Command::new(exe_path).spawn()?;
    }

    Ok(())
}

fn unix_now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_secs()
}

#[cfg(unix)]
fn process_exists(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }

    let result = unsafe { libc::kill(pid as i32, 0) };
    if result == 0 {
        return true;
    }

    match io::Error::last_os_error().raw_os_error() {
        Some(code) if code == libc::EPERM => true,
        _ => false,
    }
}

#[cfg(windows)]
fn process_exists(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }

    type Handle = *mut std::ffi::c_void;

    extern "system" {
        fn OpenProcess(desired_access: u32, inherit_handle: i32, process_id: u32) -> Handle;
        fn GetExitCodeProcess(process: Handle, exit_code: *mut u32) -> i32;
        fn CloseHandle(object: Handle) -> i32;
    }

    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
    const STILL_ACTIVE: u32 = 259;

    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return false;
        }

        let mut exit_code = 0u32;
        let success = GetExitCodeProcess(handle, &mut exit_code as *mut u32) != 0;
        let _ = CloseHandle(handle);

        success && exit_code == STILL_ACTIVE
    }
}
