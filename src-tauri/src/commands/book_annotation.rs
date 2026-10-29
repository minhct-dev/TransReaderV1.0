use tauri::State;

use crate::models::book_annotation::BookAnnotation;
use crate::storage::book_annotation as storage;
use crate::storage::db::Db;
use crate::utils::error::AppError;

/// Store a highlight or note. The annotation must already carry its id and
/// timestamps, which the frontend generates when the selection is made.
#[tauri::command]
pub fn add_annotation(db: State<'_, Db>, annotation: BookAnnotation) -> Result<(), AppError> {
    storage::add_annotation(&db, &annotation)
}

/// Every highlight and note in a book, ordered by page.
#[tauri::command]
pub fn get_annotations_by_book(
    db: State<'_, Db>,
    book_id: String,
) -> Result<Vec<BookAnnotation>, AppError> {
    storage::get_annotations_by_book(&db, &book_id)
}

/// Every highlight and note on one page of a book.
#[tauri::command]
pub fn get_annotations_by_page(
    db: State<'_, Db>,
    book_id: String,
    page_number: i64,
) -> Result<Vec<BookAnnotation>, AppError> {
    storage::get_annotations_by_page(&db, &book_id, page_number)
}

/// Set or clear the note attached to an existing highlight.
#[tauri::command]
pub fn update_annotation_note(
    db: State<'_, Db>,
    annotation_id: String,
    note_text: Option<String>,
) -> Result<(), AppError> {
    storage::update_annotation_note(&db, &annotation_id, note_text)
}

/// Permanently remove a highlight or note.
#[tauri::command]
pub fn delete_annotation(db: State<'_, Db>, annotation_id: String) -> Result<(), AppError> {
    storage::delete_annotation(&db, &annotation_id)
}
