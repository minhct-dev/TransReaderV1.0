use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

use crate::models::book::Book;
use crate::storage::db::{self, Db};
use crate::utils::file_parser;

/// Every non-deleted book in the library, newest first.
#[tauri::command]
pub fn get_all_books(db: State<'_, Db>) -> Result<Vec<Book>, String> {
    db::get_books(&db)
}

/// Open the native file picker, then store the chosen document.
/// Returns `Ok(None)` when the user cancels or the file is already in the library.
#[tauri::command]
pub async fn add_book(app: AppHandle, db: State<'_, Db>) -> Result<Option<Book>, String> {
    let Some(file_path) = pick_document(&app).await? else {
        return Ok(None);
    };

    let book = Book {
        id: Uuid::new_v4().to_string(),
        title: file_parser::parse_title_from_path(&file_path),
        author: "Local File".to_string(),
        topic: "Unknown".to_string(),
        format: file_parser::parse_format_from_path(&file_path),
        file_path,
        progress: 0,
        cover_url: None,
        is_deleted: false,
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    // Nothing is held across the await above, so the mutex is only locked here.
    if !db::insert_book(&db, &book)? {
        return Ok(None);
    }

    Ok(Some(book))
}

async fn pick_document(app: &AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();

    app.dialog()
        .file()
        .add_filter("Supported Documents", &["pdf", "docx", "txt", "doc"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });

    let picked = rx
        .await
        .map_err(|_| "The file dialog closed unexpectedly".to_string())?;

    Ok(picked.map(|path| path.to_string()))
}
