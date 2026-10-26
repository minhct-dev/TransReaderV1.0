use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Book {
    pub id: String,
    pub title: String,
    pub author: String,
    pub topic: String,
    pub format: String,
    pub file_path: String,
    /// Reading progress, 0 – 100.
    pub progress: u8,
    /// Optional cover image (URL or local path). Stored as SQL NULL when absent.
    pub cover_url: Option<String>,
    /// NTFS 128-bit file id as uppercase hex. SQL NULL when unavailable.
    #[serde(default)]
    pub file_id: Option<String>,
    /// Soft delete flag, stored as INTEGER 0/1.
    #[serde(default)]
    pub is_deleted: bool,
    /// RFC 3339 timestamp, e.g. 2026-10-26T09:30:00.123+00:00.
    #[serde(default)]
    pub created_at: String,
}
