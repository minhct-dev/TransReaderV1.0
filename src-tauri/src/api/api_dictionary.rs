use std::time::Duration;

use reqwest::Client;

use crate::utils::error::AppError;

const ENDPOINT: &str = "https://api.dictionaryapi.dev/api/v2/entries/en";
const TIMEOUT_SECS: u64 = 10;

/// Fetch the raw JSON array the free dictionary API returns for `word`.
pub async fn get_dictionary_data_by_word(word: &str) -> Result<String, AppError> {
    if word.is_empty() {
        return Err(AppError::invalid_input("Please select a single word."));
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(TIMEOUT_SECS))
        .user_agent("TransReader/0.1 (+https://github.com/minhct/transreader)")
        .build()
        .map_err(|e| {
            AppError::failed_to_build_http_client(format!("Cannot build the HTTP client: {e}"))
        })?;

    let response = client
        .get(format!("{ENDPOINT}/{word}"))
        .send()
        .await
        .map_err(|e| AppError::http_request_failed(format!("The dictionary is unreachable: {e}")))?;

    match response.status() {
        reqwest::StatusCode::OK => {
            let body = response.text().await.map_err(|e| {
                AppError::http_request_failed(format!(
                    "The dictionary response was cut short: {e}"
                ))
            })?;

            serde_json::from_str::<serde_json::Value>(&body).map_err(|e| {
                AppError::invalid_response(format!("The dictionary returned invalid JSON: {e}"))
            })?;

            Ok(body)
        }
        reqwest::StatusCode::NOT_FOUND => Err(AppError::word_not_found(word)),
        status => Err(AppError::http_request_failed(format!(
            "The dictionary answered with {status}."
        ))),
    }
}
