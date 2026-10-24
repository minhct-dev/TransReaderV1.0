use crate::models::book::Book;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

pub fn get_storage_path(app: &AppHandle) -> PathBuf {
    let mut path = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("./"));
    if !path.exists() {
        fs::create_dir_all(&path);
    }
    path.push("library.json");
    path
}

pub fn load_books(app: &AppHandle) -> Vec<Book> {
    let storage_path = get_storage_path(app);
    if storage_path.exists() {
        if let Ok(content) = fs::read_to_string(&storage_path) {
            if let Ok(books) = serde_json::from_str::<Vec<Book>>(&content) {
                return books;
            }
        }
    }
    vec![]
}

pub fn save_books(app: &AppHandle, books: &[Book]) -> Result<(), String> {
    let path = get_storage_path(app);
    let json_data = serde_json::to_string_pretty(books).map_err(|e| e.to_string())?;
    fs::write(path, json_data).map_err(|e| e.to_string())
}
