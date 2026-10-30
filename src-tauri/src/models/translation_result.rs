use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationResult {
    pub original_text: String,
    pub translated_text: String,
    pub target_language: String,
}