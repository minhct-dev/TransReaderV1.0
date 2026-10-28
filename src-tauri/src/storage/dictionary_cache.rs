use rusqlite::{Connection, params};

use crate::models::dictionary_cache::DictionaryCache;
use crate::storage::db::Db;

const INSERT_SQL: &str = "INSERT INTO dictionary_cache
    (id, word, data_json, last_accessed_at)
    VALUES (?1, ?2, ?3, ?4)
    ON CONFLICT(word) DO UPDATE SET
        data_json = excluded.data_json,
        last_accessed_at = excluded.last_accessed_at";

/// Store the raw API payload for a word, replacing an older entry for the same
/// word so the cache keeps one row per lookup.
pub fn add_dictionary_cache(db: &Db, cache: &DictionaryCache) -> Result<(), String> {
    add_dictionary_cache_conn(&db.conn(), cache)
}

/// Raw JSON previously cached for `word`, or an error when it is not cached.
pub fn lookup_word_in_cache(db: &Db, word: &str) -> Result<String, String> {
    lookup_word_conn(&db.conn(), word)
}

fn add_dictionary_cache_conn(conn: &Connection, cache: &DictionaryCache) -> Result<(), String> {
    conn.execute(
        INSERT_SQL,
        params![
            cache.id,
            cache.word,
            cache.data_json,
            cache.last_accessed_at,
        ],
    )
    .map(|_| ())
    .map_err(|e| format!("Cannot add dictionary cache {}: {e}", cache.id))
}

fn lookup_word_conn(conn: &Connection, word: &str) -> Result<String, String> {
    conn.query_row(
        "SELECT data_json FROM dictionary_cache WHERE word = ?1",
        params![word],
        |row| row.get::<_, String>(0),
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => format!("Word '{word}' not found in cache"),
        other => format!("Database error: {other}"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::db;

    fn sample(id: &str, word: &str) -> DictionaryCache {
        DictionaryCache {
            id: id.into(),
            word: word.into(),
            data_json: "this is a json string".into(),
            last_accessed_at: "2026-01-01T00:00:00+00:00".into(),
        }
    }

    #[test]
    fn lookup_returns_cached_json() {
        let db = db::test_db();
        add_dictionary_cache(&db, &sample("first", "apple")).unwrap();
        add_dictionary_cache(&db, &sample("second", "hallo")).unwrap();

        let found = lookup_word_in_cache(&db, "apple").unwrap();

        assert_eq!(found, "this is a json string");
    }

    #[test]
    fn lookup_is_case_sensitive_and_reports_misses() {
        let db = db::test_db();
        add_dictionary_cache(&db, &sample("first", "apple")).unwrap();

        assert!(lookup_word_in_cache(&db, "Apple").is_err());
        assert!(lookup_word_in_cache(&db, "pear").is_err());
    }

    #[test]
    fn inserting_same_word_replaces_payload() {
        let db = db::test_db();
        add_dictionary_cache(&db, &sample("first", "apple")).unwrap();
        add_dictionary_cache(
            &db,
            &DictionaryCache {
                data_json: "updated payload".into(),
                ..sample("second", "apple")
            },
        )
        .unwrap();

        assert_eq!(
            lookup_word_in_cache(&db, "apple").unwrap(),
            "updated payload"
        );

        let rows: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM dictionary_cache WHERE word = 'apple'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(rows, 1);
    }
}
