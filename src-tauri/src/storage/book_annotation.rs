use rusqlite::{Connection, params};

use crate::models::book_annotation::BookAnnotation;
use crate::storage::db::Db;

const COLS: &str =
    "id, book_id, page_number, selected_text, color, note_text, rects_json, created_at, updated_at";

const INSERT_SQL: &str = "INSERT INTO book_annotations
    (id, book_id, page_number, selected_text, color, note_text, rects_json, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)";

/// Store a new highlight or note.
pub fn add_annotation(db: &Db, annotation: &BookAnnotation) -> Result<(), String> {
    add_annotation_conn(&db.conn(), annotation)
}

/// Every annotation of a book, ordered by page and then creation time.
pub fn get_annotations_by_book(db: &Db, book_id: &str) -> Result<Vec<BookAnnotation>, String> {
    get_annotations_by_book_conn(&db.conn(), book_id)
}

/// Every annotation on one page of a book.
pub fn get_annotations_by_page(
    db: &Db,
    book_id: &str,
    page_number: i64,
) -> Result<Vec<BookAnnotation>, String> {
    get_annotations_by_page_conn(&db.conn(), book_id, page_number)
}

/// Replace the note attached to an annotation, or clear it with `None`.
pub fn update_annotation_note(
    db: &Db,
    annotation_id: &str,
    note_text: Option<String>,
) -> Result<(), String> {
    update_annotation_note_conn(&db.conn(), annotation_id, note_text.as_deref())
}

/// Remove an annotation permanently.
pub fn delete_annotation(db: &Db, annotation_id: &str) -> Result<(), String> {
    delete_annotation_conn(&db.conn(), annotation_id)
}

fn add_annotation_conn(conn: &Connection, annotation: &BookAnnotation) -> Result<(), String> {
    conn.execute(
        INSERT_SQL,
        params![
            annotation.id,
            annotation.book_id,
            annotation.page_number,
            annotation.selected_text,
            annotation.color,
            annotation.note_text,
            annotation.rects_json,
            annotation.created_at,
            annotation.updated_at,
        ],
    )
    .map(|_| ())
    .map_err(|e| format!("Cannot add annotation {}: {e}", annotation.id))
}

fn get_annotations_by_book_conn(
    conn: &Connection,
    book_id: &str,
) -> Result<Vec<BookAnnotation>, String> {
    let sql = format!(
        "SELECT {COLS} FROM book_annotations
          WHERE book_id = ?1
          ORDER BY page_number ASC, created_at ASC, id ASC"
    );
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Cannot read annotations: {e}"))?;
    let rows = stmt
        .query_map(params![book_id], row_to_annotation)
        .map_err(|e| format!("Cannot read annotations: {e}"))?;

    rows.collect::<rusqlite::Result<Vec<BookAnnotation>>>()
        .map_err(|e| format!("Cannot read annotations: {e}"))
}

fn get_annotations_by_page_conn(
    conn: &Connection,
    book_id: &str,
    page_number: i64,
) -> Result<Vec<BookAnnotation>, String> {
    let sql = format!(
        "SELECT {COLS} FROM book_annotations
          WHERE book_id = ?1 AND page_number = ?2
          ORDER BY created_at ASC, id ASC"
    );
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Cannot read annotations: {e}"))?;
    let rows = stmt
        .query_map(params![book_id, page_number], row_to_annotation)
        .map_err(|e| format!("Cannot read annotations: {e}"))?;

    rows.collect::<rusqlite::Result<Vec<BookAnnotation>>>()
        .map_err(|e| format!("Cannot read annotations: {e}"))
}

fn update_annotation_note_conn(
    conn: &Connection,
    annotation_id: &str,
    note_text: Option<&str>,
) -> Result<(), String> {
    let updated = conn
        .execute(
            "UPDATE book_annotations
                SET note_text = ?2, updated_at = ?3
              WHERE id = ?1",
            params![annotation_id, note_text, chrono::Utc::now().to_rfc3339()],
        )
        .map_err(|e| format!("Cannot update annotation {annotation_id}: {e}"))?;

    if updated == 0 {
        Err(format!("No annotation found with id {annotation_id}"))
    } else {
        Ok(())
    }
}

fn delete_annotation_conn(conn: &Connection, annotation_id: &str) -> Result<(), String> {
    let deleted = conn
        .execute(
            "DELETE FROM book_annotations WHERE id = ?1",
            params![annotation_id],
        )
        .map_err(|e| format!("Cannot delete annotation {annotation_id}: {e}"))?;

    if deleted == 0 {
        Err(format!("No annotation found with id {annotation_id}"))
    } else {
        Ok(())
    }
}

fn row_to_annotation(row: &rusqlite::Row<'_>) -> rusqlite::Result<BookAnnotation> {
    Ok(BookAnnotation {
        id: row.get(0)?,
        book_id: row.get(1)?,
        page_number: row.get(2)?,
        selected_text: row.get(3)?,
        color: row.get(4)?,
        note_text: row.get(5)?,
        rects_json: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::db;

    fn seeded() -> Db {
        let db = db::test_db();
        db.conn()
            .execute(
                "INSERT INTO books
                    (id, title, author, topic, format, file_path, progress, created_at)
                 VALUES (?1, 'The 7:52', 'Local File', 'Fiction', 'TXT', ?2, 0, ?3)",
                params!["book-1", "C:/books/752.txt", "2026-01-01T00:00:00+00:00"],
            )
            .expect("insert seed book");
        db
    }

    fn sample(id: &str, page_number: i64) -> BookAnnotation {
        BookAnnotation {
            id: id.into(),
            book_id: "book-1".into(),
            page_number,
            selected_text: "The train pulls out.".into(),
            color: "#facc15".into(),
            note_text: None,
            rects_json: "[]".into(),
            created_at: "2026-01-01T00:00:00+00:00".into(),
            updated_at: "2026-01-01T00:00:00+00:00".into(),
        }
    }

    #[test]
    fn add_then_read_in_page_order() {
        let db = seeded();
        add_annotation(&db, &sample("second", 4)).unwrap();
        add_annotation(&db, &sample("first", 1)).unwrap();

        let found = get_annotations_by_book(&db, "book-1").unwrap();

        assert_eq!(found.len(), 2);
        assert_eq!(found[0].id, "first");
        assert_eq!(found[1].id, "second");
        assert_eq!(found[0].selected_text, "The train pulls out.");
        assert_eq!(found[0].note_text, None);
    }

    #[test]
    fn reads_only_the_requested_page() {
        let db = seeded();
        add_annotation(&db, &sample("page-1", 1)).unwrap();
        add_annotation(&db, &sample("page-4a", 4)).unwrap();
        add_annotation(&db, &sample("page-4b", 4)).unwrap();

        let found = get_annotations_by_page(&db, "book-1", 4).unwrap();

        assert_eq!(found.len(), 2);
        assert!(found.iter().all(|annotation| annotation.page_number == 4));
    }

    #[test]
    fn updates_a_note_and_its_timestamp() {
        let db = seeded();
        add_annotation(&db, &sample("annotation-1", 2)).unwrap();

        update_annotation_note(&db, "annotation-1", Some("Worth quoting".into())).unwrap();
        let found = get_annotations_by_book(&db, "book-1").unwrap();

        assert_eq!(found[0].note_text.as_deref(), Some("Worth quoting"));
        assert_ne!(found[0].updated_at, "2026-01-01T00:00:00+00:00");

        update_annotation_note(&db, "annotation-1", None).unwrap();
        let cleared = get_annotations_by_book(&db, "book-1").unwrap();
        assert_eq!(cleared[0].note_text, None);
    }

    #[test]
    fn update_rejects_an_unknown_id() {
        let db = seeded();

        assert!(update_annotation_note(&db, "missing", Some("note".into())).is_err());
    }

    #[test]
    fn delete_removes_the_row_and_rejects_unknown_ids() {
        let db = seeded();
        add_annotation(&db, &sample("annotation-1", 2)).unwrap();

        delete_annotation(&db, "annotation-1").unwrap();

        assert!(get_annotations_by_book(&db, "book-1").unwrap().is_empty());
        assert!(delete_annotation(&db, "annotation-1").is_err());
        assert!(delete_annotation(&db, "missing").is_err());
    }

    #[test]
    fn annotation_for_an_unknown_book_is_rejected() {
        let db = seeded();
        let mut orphan = sample("orphan", 1);
        orphan.book_id = "missing-book".into();

        assert!(add_annotation(&db, &orphan).is_err());
        assert!(
            get_annotations_by_book(&db, "missing-book")
                .unwrap()
                .is_empty()
        );
    }
}
