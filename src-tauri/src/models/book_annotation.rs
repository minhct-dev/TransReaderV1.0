use serde::{Deserialize, Serialize};

/// A highlight or note anchored to a page of a book.
///
/// Field names travel as camelCase so the React side can pass the object
/// straight through `invoke` without remapping.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BookAnnotation {
    pub id: String,
    pub book_id: String,
    /// 1-based page number inside the book.
    pub page_number: i64,
    pub selected_text: String,
    /// Highlight colour as a CSS value, e.g. `#facc15`.
    pub color: String,
    /// The reader's own note; `None` for a plain highlight.
    #[serde(default)]
    pub note_text: Option<String>,
    /// JSON array of highlight rectangles as percentages of the text box,
    /// e.g. `[{"x":10,"y":20,"w":30,"h":5}]`.
    pub rects_json: String,
    /// RFC 3339 timestamp.
    pub created_at: String,
    /// RFC 3339 timestamp, refreshed whenever the note changes.
    pub updated_at: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> BookAnnotation {
        BookAnnotation {
            id: "annotation-1".into(),
            book_id: "book-1".into(),
            page_number: 12,
            selected_text: "The train pulls out.".into(),
            color: "#facc15".into(),
            note_text: Some("Opening line of the chapter".into()),
            rects_json: r#"[{"x":10,"y":20,"w":30,"h":5}]"#.into(),
            created_at: "2026-01-01T00:00:00+00:00".into(),
            updated_at: "2026-01-01T00:00:00+00:00".into(),
        }
    }

    #[test]
    fn serialises_with_camel_case_keys() {
        let json = serde_json::to_value(sample()).unwrap();

        assert_eq!(json["bookId"], "book-1");
        assert_eq!(json["pageNumber"], 12);
        assert_eq!(json["selectedText"], "The train pulls out.");
        assert_eq!(json["noteText"], "Opening line of the chapter");
        assert_eq!(json["rectsJson"], sample().rects_json);
        assert!(json.get("book_id").is_none());
        assert!(json.get("page_number").is_none());
    }

    #[test]
    fn note_text_may_be_omitted() {
        let json = serde_json::json!({
            "id": "annotation-1",
            "bookId": "book-1",
            "pageNumber": 3,
            "selectedText": "A highlight without a note",
            "color": "#22c55e",
            "rectsJson": "[]",
            "createdAt": "2026-01-01T00:00:00+00:00",
            "updatedAt": "2026-01-01T00:00:00+00:00"
        });

        let annotation: BookAnnotation = serde_json::from_value(json).unwrap();

        assert_eq!(annotation.note_text, None);
        assert_eq!(annotation.page_number, 3);
    }
}
