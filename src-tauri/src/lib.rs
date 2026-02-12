use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let context = tauri::generate_context!();
  
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .setup(|app| {
      // Initialize updater plugin
      let _ = app.handle().plugin(tauri_plugin_updater::Builder::new().build());
      
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Get the main window and center it
      if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.center();
      }

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![resize_window_for_app, get_app_data_dir])
    .run(context)
    .expect("error while running tauri application");
}

/// Maximizes the window after login and enables resizing
#[tauri::command]
async fn resize_window_for_app(app: tauri::AppHandle<tauri::Wry>) -> Result<(), String> {
  let window = app
    .get_webview_window("main")
    .ok_or_else(|| "Main window not found".to_string())?;

  // Enable resizing
  window
    .set_resizable(true)
    .map_err(|e: tauri::Error| e.to_string())?;

  // Maximize the window (fullscreen)
  window
    .maximize()
    .map_err(|e: tauri::Error| e.to_string())?;

  // Update title
  window
    .set_title("Kloak")
    .map_err(|e: tauri::Error| e.to_string())?;

  Ok(())
}

/// Gets the app data directory path for debugging
#[tauri::command]
async fn get_app_data_dir(app: tauri::AppHandle<tauri::Wry>) -> Result<String, String> {
  match app.path().app_data_dir() {
    Ok(path) => Ok(path.to_string_lossy().to_string()),
    Err(e) => Err(format!("Failed to get app data dir: {:?}", e)),
  }
}
