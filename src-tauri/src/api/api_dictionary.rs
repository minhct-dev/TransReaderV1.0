use std::time::Duration;

use reqwest::Client;

const ENDPOINT: &str = "https://api.dictionaryapi.dev/api/v2/entries/en";
const TIMEOUT_SECS: u64 = 10;

/// Fetch the raw JSON array the free dictionary API returns for `word`.
pub async fn get_dictionary_data_by_word(word: &str) -> Result<String, String> {
    if word.is_empty() {
        return Err("Word cannot be empty".to_string());
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(TIMEOUT_SECS))
        .user_agent("TransReader/0.1 (+https://github.com/minhct/transreader)")
        .build()
        .map_err(|e| format!("Cannot build HTTP client: {e}"))?;

    let response = client
        .get(format!("{ENDPOINT}/{word}"))
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {e}"))?;

    match response.status() {
        reqwest::StatusCode::OK => {
            let body = response
                .text()
                .await
                .map_err(|e| format!("Failed to read response body: {e}"))?;

            serde_json::from_str::<serde_json::Value>(&body)
                .map_err(|e| format!("Dictionary service returned invalid JSON: {e}"))?;

            Ok(body)
        }
        reqwest::StatusCode::NOT_FOUND => {
            Err(format!("Word '{word}' was not found in the dictionary."))
        }
        status => Err(format!("Dictionary service returned {status}.")),
    }
}
