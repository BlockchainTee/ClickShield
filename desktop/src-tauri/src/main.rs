fn main() {
    tauri::Builder::default()
      // --- ADD THIS LINE ---
      .plugin(tauri_plugin_process::init())
      // --- END ADD ---
      .run(tauri::generate_context!())
      .expect("error while running tauri application");
  }
  