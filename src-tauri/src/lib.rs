use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .setup(|app| {
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
    .invoke_handler(tauri::generate_handler![resize_window_for_app])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

/// Resizes the window after login to app size and enables resizing
#[tauri::command]
async fn resize_window_for_app(app: tauri::AppHandle) -> Result<(), String> {
  let window = app
    .get_webview_window("main")
    .ok_or_else(|| "Main window not found".to_string())?;

  // Resize to app dimensions
  window
    .set_size(tauri::Size::Logical(tauri::LogicalSize {
      width: 1200.0,
      height: 800.0,
    }))
    .map_err(|e: tauri::Error| e.to_string())?;

  // Enable resizing
  window
    .set_resizable(true)
    .map_err(|e: tauri::Error| e.to_string())?;

  // Center the resized window
  window.center().map_err(|e: tauri::Error| e.to_string())?;

  // Update title
  window
    .set_title("Kloak")
    .map_err(|e: tauri::Error| e.to_string())?;

  Ok(())
}
