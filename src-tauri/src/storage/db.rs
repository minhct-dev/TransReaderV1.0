use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};

use rusqlite::{Connection, ErrorCode, params};
use tauri::{AppHandle, Manager};

use crate::models::book::Book;

const SCHEMA: &str = r#"
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS books (
    id          TEXT    PRIMARY KEY NOT NULL,
    title       TEXT    NOT NULL,
    author      TEXT    NOT NULL,
    topic       TEXT    NOT NULL,
    format      TEXT    NOT NULL,
    file_path   TEXT    NOT NULL,
    file_id     TEXT,                                  -- NTFS id, NULL off-Windows
    progress    INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    cover_url   TEXT,                                  -- NULLABLE
    is_deleted  INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    created_at  TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS book_annotations (
    id            TEXT    PRIMARY KEY NOT NULL,
    book_id       TEXT    NOT NULL,
    page_number   INTEGER NOT NULL,
    selected_text TEXT    NOT NULL,
    color         TEXT    NOT NULL,
    note_text     TEXT,
    rects_json    TEXT    NOT NULL,
    created_at    TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS dictionary_cache (
    id            TEXT    PRIMARY KEY NOT NULL,
    word          TEXT    NOT NULL UNIQUE,
    data_json    TEXT    NOT NULL,
    last_accessed_at    TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_annotations_book_page
    ON book_annotations (book_id, page_number);

-- A path may appear only once among non-deleted rows, so deleting a book lets
-- the same file be imported again (see `revive_book`).
CREATE UNIQUE INDEX IF NOT EXISTS idx_books_file_path_active
    ON books (file_path) WHERE is_deleted = 0;

CREATE INDEX IF NOT EXISTS idx_books_is_deleted ON books (is_deleted);
"#;

const COLS: &str = "id, title, author, topic, format, file_path, file_id, progress, cover_url, is_deleted, created_at";

const INSERT_SQL: &str = "INSERT INTO books (id, title, author, topic, format, file_path, file_id, progress, cover_url, is_deleted, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)";

/// Shared SQLite handle registered with Tauri as managed state.
/// `Connection` is `Send` but not `Sync`, so it lives behind a mutex.
pub struct Db(Mutex<Connection>);

impl Db {
    pub fn new(conn: Connection) -> Self {
        Self(Mutex::new(conn))
    }

    /// A poisoned lock still holds a usable connection, so recover instead of panicking.
    pub(crate) fn conn(&self) -> MutexGuard<'_, Connection> {
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }
}

/// `%APPDATA%\com.minhct.transreader\reader.db` on Windows (or the OS equivalent).
pub fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Cannot create {}: {e}", dir.display()))?;
    Ok(dir.join("reader.db"))
}

/// Open (creating if needed) the database, apply the schema and any migration.
pub fn init(app: &AppHandle) -> Result<Db, String> {
    let path = db_path(app)?;
    let conn =
        Connection::open(&path).map_err(|e| format!("Cannot open {}: {e}", path.display()))?;
    apply_schema(&conn)?;

    let db = Db::new(conn);
    import_legacy_json(app, &db);
    Ok(db)
}

/// In-memory database with the production schema, for unit tests in other
/// storage modules.
#[cfg(test)]
pub(crate) fn test_db() -> Db {
    let conn = Connection::open_in_memory().expect("open in-memory database");
    apply_schema(&conn).expect("apply schema");
    Db::new(conn)
}

/// An existing reader.db is not changed by `CREATE TABLE IF NOT EXISTS`, so
/// columns added after the first release need an explicit ALTER TABLE.
fn apply_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(SCHEMA)
        .map_err(|e| format!("Cannot initialise schema: {e}"))?;

    let has_file_id = conn
        .prepare("PRAGMA table_info(books)")
        .and_then(|mut stmt| {
            stmt.query_map([], |row| row.get::<_, String>(1))?
                .collect::<rusqlite::Result<Vec<String>>>()
        })
        .map_err(|e| format!("Cannot inspect books table: {e}"))?
        .iter()
        .any(|column| column == "file_id");

    if !has_file_id {
        conn.execute("ALTER TABLE books ADD COLUMN file_id TEXT", [])
            .map_err(|e| format!("Cannot add books.file_id: {e}"))?;
    }

    // Older builds created dictionary_cache without a unique word column, so
    // the upsert in `storage::dictionary_cache` needs this index. Keep only the
    // newest row per word before creating it.
    conn.execute(
        "DELETE FROM dictionary_cache
          WHERE rowid NOT IN (
                SELECT MAX(rowid) FROM dictionary_cache GROUP BY word
          )",
        [],
    )
    .map_err(|e| format!("Cannot clean dictionary cache: {e}"))?;
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_dictionary_cache_word
            ON dictionary_cache (word)",
        [],
    )
    .map_err(|e| format!("Cannot index dictionary cache: {e}"))?;

    Ok(())
}

/// Insert a book. Returns `false` when an active book already uses that file path.
pub fn insert_book(db: &Db, book: &Book) -> Result<bool, String> {
    insert_conn(&db.conn(), book)
}

/// Soft-delete a book: hide it from the library, keep the row and the file on disk.
pub fn delete_book(db: &Db, book_id: &str) -> Result<(), String> {
    delete_conn(&db.conn(), book_id)
}

/// All non-deleted books, newest first.
pub fn get_books(db: &Db) -> Result<Vec<Book>, String> {
    get_books_conn(&db.conn())
}

/// Absolute path of a book that is still in the library.
pub fn book_path(db: &Db, book_id: &str) -> Result<String, String> {
    book_path_conn(&db.conn(), book_id)
}

fn book_path_conn(conn: &Connection, book_id: &str) -> Result<String, String> {
    conn.query_row(
        "SELECT file_path FROM books WHERE id = ?1 AND is_deleted = 0",
        params![book_id],
        |row| row.get(0),
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => format!("No book found with id {book_id}"),
        other => format!("Cannot read book path: {other}"),
    })
}
/// Bring a previously removed book back when the same file is imported again,
/// so its progress and metadata survive the round trip.
///
/// Matches by NTFS file id first (that is what follows a moved file) and falls
/// back to the path when there is no id. Returns the active row: `Some` means
/// "already in the library, do not insert", `None` means "genuinely new".
pub fn revive_book(
    db: &Db,
    file_id: &Option<String>,
    file_path: &str,
) -> Result<Option<Book>, String> {
    revive_conn(&db.conn(), file_id, file_path)
}

fn revive_conn(
    conn: &Connection,
    file_id: &Option<String>,
    file_path: &str,
) -> Result<Option<Book>, String> {
    // Only revive when the picked path is free. Flipping `is_deleted` while an
    // active row already owns that path trips the partial unique index.
    conn.execute(
        "UPDATE books
            SET is_deleted = 0, file_path = ?2, created_at = ?3
          WHERE id = (
                SELECT id FROM books
                 WHERE is_deleted = 1 AND (file_id = ?1 OR file_path = ?2)
                 ORDER BY created_at DESC
                 LIMIT 1
          )
            AND NOT EXISTS (
                SELECT 1 FROM books a WHERE a.file_path = ?2 AND a.is_deleted = 0
          )",
        params![file_id, file_path, chrono::Utc::now().to_rfc3339()],
    )
    .map_err(|e| format!("Cannot restore book: {e}"))?;

    let sql = format!(
        "SELECT {COLS} FROM books
          WHERE is_deleted = 0 AND (file_id = ?1 OR file_path = ?2)
          ORDER BY created_at DESC
          LIMIT 1"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(params![file_id, file_path], row_to_book)
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(Ok(book)) => Ok(Some(book)),
        Some(Err(e)) => Err(format!("Cannot read restored book: {e}")),
        None => Ok(None),
    }
}
fn insert_conn(conn: &Connection, book: &Book) -> Result<bool, String> {
    let result = conn.execute(
        INSERT_SQL,
        params![
            book.id,
            book.title,
            book.author,
            book.topic,
            book.format,
            book.file_path,
            book.file_id,
            book.progress,
            book.cover_url,
            book.is_deleted as i64,
            book.created_at,
        ],
    );

    match result {
        Ok(_) => Ok(true),
        Err(rusqlite::Error::SqliteFailure(e, _)) if e.code == ErrorCode::ConstraintViolation => {
            Ok(false)
        }
        Err(e) => Err(format!("Cannot insert book: {e}")),
    }
}

fn delete_conn(conn: &Connection, book_id: &str) -> Result<(), String> {
    let result = conn.execute(
        "UPDATE books SET is_deleted = 1 WHERE id = ?1 AND is_deleted = 0",
        params![book_id],
    );

    match result {
        Ok(0) => Err(format!("No active book found with id {book_id}")),
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Cannot delete book {book_id}: {e}")),
    }
}

fn get_books_conn(conn: &Connection) -> Result<Vec<Book>, String> {
    let sql = format!("SELECT {COLS} FROM books WHERE is_deleted = 0 ORDER BY created_at DESC");
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], row_to_book).map_err(|e| e.to_string())?;

    rows.collect::<rusqlite::Result<Vec<Book>>>()
        .map_err(|e| format!("Cannot read books: {e}"))
}

fn row_to_book(row: &rusqlite::Row<'_>) -> rusqlite::Result<Book> {
    Ok(Book {
        id: row.get(0)?,
        title: row.get(1)?,
        author: row.get(2)?,
        topic: row.get(3)?,
        format: row.get(4)?,
        file_path: row.get(5)?,
        file_id: row.get(6)?,
        progress: row.get(7)?,
        cover_url: row.get(8)?,
        is_deleted: row.get::<_, i64>(9)? != 0,
        created_at: row.get(10)?,
    })
}

/// One-time carry-over from the pre-SQLite store. Never fails the app: on any
/// problem the old file is left untouched and simply ignored.
fn import_legacy_json(app: &AppHandle, db: &Db) {
    let Ok(dir) = app.path().app_data_dir() else {
        return;
    };
    let legacy = dir.join("library.json");
    if !legacy.exists() {
        return;
    }

    let conn = db.conn();
    let existing: i64 = conn
        .query_row("SELECT COUNT(*) FROM books", [], |r| r.get(0))
        .unwrap_or(0);
    if existing > 0 {
        return;
    }

    let Ok(text) = std::fs::read_to_string(&legacy) else {
        return;
    };
    let Ok(books) = serde_json::from_str::<Vec<Book>>(&text) else {
        return;
    };

    let mut imported = 0;
    for mut book in books {
        if book.created_at.is_empty() {
            book.created_at = chrono::Utc::now().to_rfc3339();
        }
        if insert_conn(&conn, &book).unwrap_or(false) {
            imported += 1;
        }
    }
    drop(conn);

    if imported > 0 {
        // Keep the original instead of deleting it, just get it out of the way.
        let _ = std::fs::rename(&legacy, dir.join("library.json.migrated"));
        println!("Imported {imported} book(s) from library.json into reader.db");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seeded() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        apply_schema(&conn).unwrap();
        conn
    }

    fn sample(file_path: &str) -> Book {
        Book {
            id: uuid::Uuid::new_v4().to_string(),
            title: "Clean Code".into(),
            author: "Local File".into(),
            topic: "Unknown".into(),
            format: "PDF".into(),
            file_path: file_path.into(),
            file_id: Some("0000000000000000A1B2C3D4E5F60718".into()),
            progress: 0,
            cover_url: None,
            is_deleted: false,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    #[test]
    fn insert_then_read_roundtrip() {
        let conn = seeded();
        let book = sample("C:/books/clean-code.pdf");

        assert!(insert_conn(&conn, &book).unwrap());

        let found = get_books_conn(&conn).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].title, "Clean Code");
        assert_eq!(found[0].cover_url, None);
        assert_eq!(
            found[0].file_id.as_deref(),
            Some("0000000000000000A1B2C3D4E5F60718")
        );
        assert!(!found[0].is_deleted);
    }

    #[test]
    fn missing_file_id_stays_null() {
        let conn = seeded();
        let mut book = sample("D:/books/on-a-network-share.pdf");
        book.file_id = None;

        insert_conn(&conn, &book).unwrap();

        assert_eq!(get_books_conn(&conn).unwrap()[0].file_id, None);
    }

    #[test]
    fn duplicate_active_path_is_rejected() {
        let conn = seeded();
        assert!(insert_conn(&conn, &sample("C:/books/a.pdf")).unwrap());
        assert!(!insert_conn(&conn, &sample("C:/books/a.pdf")).unwrap());
        assert_eq!(get_books_conn(&conn).unwrap().len(), 1);
    }

    #[test]
    fn soft_deleted_book_is_hidden_and_can_be_reimported() {
        let conn = seeded();
        let book = sample("C:/books/a.pdf");
        insert_conn(&conn, &book).unwrap();
        conn.execute("UPDATE books SET is_deleted = 1", []).unwrap();

        assert!(get_books_conn(&conn).unwrap().is_empty());
        assert!(insert_conn(&conn, &sample("C:/books/a.pdf")).unwrap());
    }

    #[test]
    fn delete_book_soft_deletes_and_rejects_missing_ids() {
        let conn = seeded();
        let book = sample("C:/books/a.pdf");
        insert_conn(&conn, &book).unwrap();

        assert!(delete_conn(&conn, &book.id).is_ok());
        assert!(get_books_conn(&conn).unwrap().is_empty());
        assert!(
            delete_conn(&conn, &book.id).is_err(),
            "second delete has nothing to hide"
        );
        assert!(delete_conn(&conn, "missing-id").is_err());
    }

    #[test]
    fn old_table_without_file_id_is_migrated() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE books (
                id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, author TEXT NOT NULL,
                topic TEXT NOT NULL, format TEXT NOT NULL, file_path TEXT NOT NULL,
                progress INTEGER NOT NULL DEFAULT 0, cover_url TEXT,
                is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
            );",
        )
        .unwrap();

        apply_schema(&conn).unwrap();
        assert!(insert_conn(&conn, &sample("C:/books/a.pdf")).unwrap());
    }

    #[test]
    fn revive_brings_back_a_soft_deleted_book() {
        let conn = seeded();
        let mut book = sample("C:/books/a.pdf");
        book.id = "gone".into();
        insert_conn(&conn, &book).unwrap();
        delete_conn(&conn, "gone").unwrap();
        assert!(get_books_conn(&conn).unwrap().is_empty());

        let revived = revive_conn(&conn, &book.file_id, "C:/books/a.pdf")
            .unwrap()
            .expect("deleted row must be restored");

        assert_eq!(revived.id, "gone");
        assert!(!revived.is_deleted);
        assert_eq!(get_books_conn(&conn).unwrap().len(), 1);
    }

    #[test]
    fn revive_follows_a_moved_file_by_its_file_id() {
        let conn = seeded();
        let mut book = sample("C:/books/old-name.pdf");
        book.id = "moved".into();
        insert_conn(&conn, &book).unwrap();
        delete_conn(&conn, "moved").unwrap();

        let revived = revive_conn(&conn, &book.file_id, "C:/elsewhere/new-name.pdf")
            .unwrap()
            .expect("file id must still match after a move");

        assert_eq!(revived.id, "moved");
        assert_eq!(revived.file_path, "C:/elsewhere/new-name.pdf");
    }

    #[test]
    fn revive_without_a_file_id_falls_back_to_the_path() {
        let conn = seeded();
        let mut book = sample("C:/books/a.pdf");
        book.id = "no-id".into();
        book.file_id = None;
        insert_conn(&conn, &book).unwrap();
        delete_conn(&conn, "no-id").unwrap();

        assert!(
            revive_conn(&conn, &None, "C:/books/a.pdf")
                .unwrap()
                .is_some()
        );
    }

    /// A stale deleted row can share both path and file id with an active row.
    /// Reviving it directly hits the partial unique index; the active row has to
    /// win instead of the import failing with a constraint error.
    #[test]
    fn revive_returns_the_active_book_when_its_path_is_taken() {
        let conn = seeded();
        let active = sample("C:/books/a.pdf");
        insert_conn(&conn, &active).unwrap();

        let mut stale = sample("C:/books/a.pdf");
        stale.id = "stale".into();
        stale.is_deleted = true;
        insert_conn(&conn, &stale).unwrap();

        let found = revive_conn(&conn, &active.file_id, "C:/books/a.pdf")
            .unwrap()
            .expect("the active row is already in the library");

        assert_eq!(found.id, active.id);
        assert_eq!(get_books_conn(&conn).unwrap().len(), 1);
    }

    #[test]
    fn revive_returns_nothing_for_an_unknown_file() {
        let conn = seeded();
        assert!(
            revive_conn(&conn, &Some("UNKNOWN".into()), "C:/books/x.pdf")
                .unwrap()
                .is_none()
        );
    }

    #[test]
    fn book_path_resolves_only_live_books() {
        let conn = seeded();
        let book = sample(r"C:\Users\me\Documents\a.pdf");
        insert_conn(&conn, &book).unwrap();

        assert_eq!(
            book_path_conn(&conn, &book.id).unwrap(),
            r"C:\Users\me\Documents\a.pdf"
        );
        assert!(book_path_conn(&conn, "missing-id").is_err());

        delete_conn(&conn, &book.id).unwrap();
        assert!(
            book_path_conn(&conn, &book.id).is_err(),
            "a removed book must not hand out its path"
        );
    }
}
