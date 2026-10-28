use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DictionaryCache {
    pub id: String,
    pub word: String,
    pub data_json: String,
    pub last_accessed_at: String,
}

impl DictionaryCache {
    pub fn new(word: &str, data_json: &str) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            word: word.to_string(),
            data_json: data_json.to_string(),
            last_accessed_at: Utc::now().to_rfc3339(),
        }
    }
}
