use std::time::Duration;

use reqwest::Client;

use crate::utils::error::AppError;

const GOOGLE_TRANSLATE_API: &str = "https://translate.googleapis.com/translate_a/single";
const TIMEOUT_SECS: u64 = 10;

fn map_language_code(language: &str) -> &str {
    match language {
        "en" => "en",
        "ja" => "ja",
        "vi" => "vi",
        "zh" => "zh",
        "zh-CN" => "zh-CN",
        _ => "vi", // Default to auto-detect if the language is not recognized
    }
}

/// Fetch the raw JSON array the free dictionary API returns for `word`.
pub async fn google_translate_text(text: &str, target_language: &str) -> Result<String, AppError> {
    if text.is_empty() {
        return Err(AppError::invalid_input("Please select a single word."));
    }
    let target_lang_code = map_language_code(target_language);
    let client = Client::builder()
        .timeout(Duration::from_secs(TIMEOUT_SECS))
        .user_agent("TransReader/0.1 (+https://github.com/minhct/transreader)")
        .build()
        .map_err(|e| {
            AppError::failed_to_build_http_client(format!("Cannot build the HTTP client: {e}"))
        })?;

    let response = client
        .get(GOOGLE_TRANSLATE_API)
        .query(&[
            ("client", "gtx"),
            ("sl", "auto"),
            ("tl", target_lang_code),
            ("dt", "t"),
            ("q", text),
        ])
        .send()
        .await
        .map_err(|e| AppError::http_request_failed(format!("The dictionary is unreachable: {e}")))?;

    
    response
        .text()
        .await
        .map_err(|e| AppError::http_request_failed(format!("Failed to read the translation response: {e}")))
}
