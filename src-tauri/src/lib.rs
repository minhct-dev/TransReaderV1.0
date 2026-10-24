// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod commands;
mod models;
mod storage;
mod utils;
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::library::get_library_books,
            commands::library::add_book_dialog
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
