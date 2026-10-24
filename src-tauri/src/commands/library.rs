use crate::models::book::Book;
use crate::storage::json_db;
use crate::utils::file_parser;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;
// register API command to use in frontend
#[tauri::command]
pub fn get_library_books(app: AppHandle) -> Vec<Book> {
    json_db::load_books(&app)
}

#[tauri::command]
pub async fn add_book_dialog(app: AppHandle) -> Result<Option<Book>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();

    app.dialog()
        .file()
        .add_filter("Supported Documents", &["pdf", "docx", "txt", "doc"])
        .pick_file(move |file_path| {
            let _ = tx.send(file_path);
        });

    let selected_path = rx.await.map_err(|_| "Canceled")?;

    if let Some(path) = selected_path {
        let path_str: String = path.to_string();

        let new_book = Book {
            id: Uuid::new_v4().to_string(),
            title: file_parser::parse_title_from_path(&path_str),
            author: "Local File".to_string(),
            format: file_parser::parse_format_from_path(&path_str),
            file_path: path_str,
            progress: 0,
            cover_url: None,
            topic: "Unknown".to_string(),
        };

        let mut books = json_db::load_books(&app);
        
        // Tránh lưu trùng đường dẫn
        if !books.iter().any(|b| b.file_path == new_book.file_path) {
            books.push(new_book.clone());
            json_db::save_books(&app, &books)?;
        }

        Ok(Some(new_book))
    } else {
        Ok(None)
    }
}