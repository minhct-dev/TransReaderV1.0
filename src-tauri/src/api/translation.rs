use std::time::Duration;

use reqwest::Client;

use crate::utils::error::AppError;

const GOOGLE_TRANSLATE_API: &str = "https://translate.googleapis.com/translate_a/single";
const LIBRE_TRANSLATE_API: &str = "https://libretranslate.com/translate";
const TIMEOUT_SECS: u64 = 10;

fn map_google_language_code(language: &str) -> &str {
    match language {
        "en" | "ja" | "vi" | "zh" | "zh-CN" => language,
        _ => "vi",
    }
}

fn map_libre_language_code(language: &str) -> &str {
    match language {
        "en" | "ja" | "vi" => language,
        "zh" => "zh-Hant",
        "zh-CN" => "zh-Hans",
        _ => "vi",
    }
}

fn http_client() -> Result<Client, AppError> {
    Client::builder()
        .timeout(Duration::from_secs(TIMEOUT_SECS))
        .user_agent("TransReader/0.1 (+https://github.com/minhct/transreader)")
        .build()
        .map_err(|error| {
            AppError::failed_to_build_http_client(format!(
                "Cannot build the translation HTTP client: {error}"
            ))
        })
}

pub async fn google_translate_text(text: &str, target_language: &str) -> Result<String, AppError> {
    if text.is_empty() {
        return Err(AppError::invalid_input("Please select text to translate."));
    }

    let response = http_client()?
        .get(GOOGLE_TRANSLATE_API)
        .query(&[
            ("client", "gtx"),
            ("sl", "auto"),
            ("tl", map_google_language_code(target_language)),
            ("dt", "t"),
            ("ie", "UTF-8"),
            ("oe", "UTF-8"),
            ("q", text),
        ])
        .header(reqwest::header::ACCEPT, "application/json")
        .send()
        .await
        .map_err(|error| {
            AppError::http_request_failed(format!(
                "The Google Translate service is unreachable: {error}"
            ))
        })?;

    let status = response.status();
    let body = response.text().await.map_err(|error| {
        AppError::http_request_failed(format!(
            "Failed to read the Google Translate response: {error}"
        ))
    })?;

    if !status.is_success() {
        return Err(AppError::http_request_failed(format!(
            "Google Translate returned HTTP {status}: {}",
            body.chars().take(160).collect::<String>()
        )));
    }
    if body.trim().is_empty() {
        return Err(AppError::invalid_response("Google Translate returned an empty response."));
    }

    Ok(body)
}

pub async fn libre_translate_text(text: &str, target_language: &str) -> Result<String, AppError> {
    if text.is_empty() {
        return Err(AppError::invalid_input("Please select text to translate."));
    }

    let response = http_client()?
        .post(LIBRE_TRANSLATE_API)
        .form(&[
            ("q", text),
            ("source", "auto"),
            ("target", map_libre_language_code(target_language)),
            ("format", "text"),
        ])
        .send()
        .await
        .map_err(|error| {
            AppError::http_request_failed(format!(
                "The LibreTranslate service is unreachable: {error}"
            ))
        })?;

    let status = response.status();
    let body = response.text().await.map_err(|error| {
        AppError::http_request_failed(format!(
            "Failed to read the LibreTranslate response: {error}"
        ))
    })?;

    if !status.is_success() {
        return Err(AppError::http_request_failed(format!(
            "LibreTranslate returned HTTP {status}: {}",
            body.chars().take(160).collect::<String>()
        )));
    }
    if body.trim().is_empty() {
        return Err(AppError::invalid_response("LibreTranslate returned an empty response."));
    }

    Ok(body)
}
