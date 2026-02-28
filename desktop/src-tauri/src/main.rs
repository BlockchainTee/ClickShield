use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::{Manager, WindowEvent};

const SHUTDOWN_MARKER_FILE: &str = "shutdown.intent";
const STALE_MARKER_MAX_AGE: Duration = Duration::from_secs(60);

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if !cfg!(debug_assertions) {
                if let Err(error) = spawn_watchdog(app.handle()) {
                    eprintln!("failed to spawn watchdog: {error}");
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                let app_handle = window.app_handle();
                if let Err(error) = write_shutdown_marker(&app_handle) {
                    eprintln!("failed to write shutdown marker: {error}");
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn spawn_watchdog(app_handle: &tauri::AppHandle) -> io::Result<()> {
    let marker_path = shutdown_marker_path(app_handle)?;
    remove_stale_marker_if_needed(&marker_path, STALE_MARKER_MAX_AGE)?;

    let app_exe = std::env::current_exe()?;
    let watchdog_exe = locate_watchdog_binary(&app_exe)?;
    let parent_pid = std::process::id().to_string();

    let mut command = Command::new(watchdog_exe);
    command
        .arg("--parent-pid")
        .arg(parent_pid)
        .arg("--exe")
        .arg(&app_exe)
        .arg("--marker")
        .arg(&marker_path);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
        command.creation_flags(CREATE_NEW_PROCESS_GROUP);
    }

    command.spawn()?;
    Ok(())
}

fn write_shutdown_marker(app_handle: &tauri::AppHandle) -> io::Result<()> {
    let marker_path = shutdown_marker_path(app_handle)?;
    fs::write(marker_path, iso8601_utc_now())
}

fn shutdown_marker_path(app_handle: &tauri::AppHandle) -> io::Result<PathBuf> {
    let mut app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| io::Error::other(error.to_string()))?;
    fs::create_dir_all(&app_data_dir)?;
    app_data_dir.push(SHUTDOWN_MARKER_FILE);
    Ok(app_data_dir)
}

fn remove_stale_marker_if_needed(marker_path: &Path, max_age: Duration) -> io::Result<()> {
    let metadata = match fs::metadata(marker_path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error),
    };

    let modified = match metadata.modified() {
        Ok(modified) => modified,
        Err(_) => return Ok(()),
    };

    let age = match SystemTime::now().duration_since(modified) {
        Ok(age) => age,
        Err(_) => Duration::ZERO,
    };

    if age > max_age {
        let _ = fs::remove_file(marker_path);
    }

    Ok(())
}

fn locate_watchdog_binary(app_exe: &Path) -> io::Result<PathBuf> {
    let app_dir = app_exe.parent().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::NotFound,
            "failed to resolve parent directory for app executable",
        )
    })?;

    let expected_path = app_dir.join(watchdog_binary_name());
    if expected_path.exists() {
        return Ok(expected_path);
    }

    for entry in fs::read_dir(app_dir)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        if !file_type.is_file() {
            continue;
        }

        let file_name = entry.file_name();
        let file_name = file_name.to_string_lossy();
        if file_name.starts_with("clickshield_watchdog") {
            return Ok(entry.path());
        }
    }

    Err(io::Error::new(
        io::ErrorKind::NotFound,
        "watchdog binary not found next to app executable",
    ))
}

fn watchdog_binary_name() -> &'static str {
    #[cfg(windows)]
    {
        "clickshield_watchdog.exe"
    }
    #[cfg(not(windows))]
    {
        "clickshield_watchdog"
    }
}

fn iso8601_utc_now() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO);
    let total_secs = now.as_secs() as i64;
    let millis = now.subsec_millis();

    let days = total_secs.div_euclid(86_400);
    let seconds_of_day = total_secs.rem_euclid(86_400);
    let hour = seconds_of_day / 3_600;
    let minute = (seconds_of_day % 3_600) / 60;
    let second = seconds_of_day % 60;
    let (year, month, day) = civil_from_days(days);

    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{millis:03}Z")
}

fn civil_from_days(days_since_unix_epoch: i64) -> (i32, u32, u32) {
    let z = days_since_unix_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let day_of_era = z - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    let year = year + if month <= 2 { 1 } else { 0 };

    (year as i32, month as u32, day as u32)
}
