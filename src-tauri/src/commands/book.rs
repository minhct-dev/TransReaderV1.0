use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

use crate::models::book::Book;
use crate::storage::db::{self, Db};
use crate::utils::error::AppError;
use crate::utils::file_parser;
use crate::utils::win_file_id;

/// Every non-deleted book in the library, newest first.
#[tauri::command]
pub fn get_all_books(db: State<'_, Db>) -> Result<Vec<Book>, AppError> {
    db::get_books(&db)
}

/// Open the native file picker, resolve the file's NTFS id, then store it.
/// Returns `Ok(None)` only when the user cancels; re-importing a file that is
/// already in the library returns that book instead of creating a duplicate.
#[tauri::command]
pub async fn add_book(app: AppHandle, db: State<'_, Db>) -> Result<Option<Book>, AppError> {
    let Some(file_path) = pick_document(&app).await? else {
        return Ok(None);
    };
    // `None` off-Windows or when the volume has no file ids; the book is still importable.
    let file_id = win_file_id::get_file_id(&file_path);
    // Importing a file that was removed earlier restores the old row instead of
    // adding a duplicate. An already-active book comes back too, so the
    // frontend can dedupe it by path.
    if let Some(existing) = db::revive_book(&db, &file_id, &file_path)? {
        return Ok(Some(existing));
    }
    let book = Book {
        id: Uuid::new_v4().to_string(),
        title: file_parser::parse_title_from_path(&file_path),
        author: "Local File".to_string(),
        topic: "Unknown".to_string(),
        format: file_parser::parse_format_from_path(&file_path),
        file_path,
        file_id,
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

//Delete book
#[tauri::command]
pub fn delete_book(db: State<'_, Db>, book_id: String) -> Result<(), AppError> {
    db::delete_book(&db, &book_id)
}

/// Absolute path of a library book, for the webview to turn into an asset URL.
#[tauri::command]
pub fn resolve_book_path(db: State<'_, Db>, book_id: String) -> Result<String, AppError> {
    db::book_path(&db, &book_id)
}

async fn pick_document(app: &AppHandle) -> Result<Option<String>, AppError> {
    let (tx, rx) = tokio::sync::oneshot::channel();

    app.dialog()
        .file()
        .add_filter("Supported Documents", &["pdf", "docx", "txt", "doc"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });

    let picked = rx
        .await
        .map_err(|_| AppError::file_dialog_error("The file dialog closed unexpectedly."))?;

    Ok(picked.map(|path| path.to_string()))
}
