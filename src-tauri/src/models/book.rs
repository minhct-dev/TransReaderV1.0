use serde ::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct Book {
    pub id: String,
    pub title: String,
    pub author: String,
    pub topic: String,
    pub format: String,
    pub file_path: String,
    pub progress: u8,    
    pub cover_url: Option<String>,
}