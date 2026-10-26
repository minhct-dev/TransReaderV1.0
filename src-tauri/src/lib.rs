use tauri::Manager;

mod commands;
mod models;
mod storage;
mod utils;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Open reader.db before the window appears; a broken DB fails fast
            // here instead of on the first invoke.
            let db = storage::db::init(app.handle()).map_err(std::io::Error::other)?;
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::book::get_all_books,
            commands::book::add_book
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
