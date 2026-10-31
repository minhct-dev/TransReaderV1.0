use crate::api::translation as api_translation;
use crate::models::translation_result::TranslationResult;
use crate::utils::error::AppError;

fn parse_translation_response(
    body: &str,
    provider: &str,
    libre_format: bool,
) -> Result<String, AppError> {
    let json_value = serde_json::from_str::<serde_json::Value>(body.trim_start_matches('\u{feff}'))
        .map_err(|e| {
            let preview: String = body.chars().take(160).collect();
            AppError::invalid_response(format!(
                "Cannot read the {provider} response: {e}. Response: {preview}"
            ))
        })?;

    let translated = if libre_format {
        json_value
            .get("translatedText")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .to_string()
    } else {
        json_value
            .as_array()
            .and_then(|root| root.first())
            .and_then(serde_json::Value::as_array)
            .map(|sentences| {
                sentences
                    .iter()
                    .filter_map(|sentence| sentence.get(0).and_then(serde_json::Value::as_str))
                    .collect::<String>()
            })
            .unwrap_or_default()
    };

    if translated.trim().is_empty() {
        return Err(AppError::invalid_response(format!(
            "{provider} returned no translated text."
        )));
    }
    Ok(translated)
}

#[tauri::command]
pub async fn translate_with_google(
    text: String,
    target_language: String,
) -> Result<TranslationResult, AppError> {
    let text = text.trim().to_string();
    if text.is_empty() || text.chars().count() > 10_000 {
        return Err(AppError::invalid_input(
            "Please select between 1 and 10,000 characters.",
        ));
    }
    if !matches!(target_language.as_str(), "vi" | "en" | "zh" | "ja") {
        return Err(AppError::invalid_input("Unsupported target language."));
    }

    // Try Google first; use LibreTranslate for quota, 5xx, timeout, or bad JSON.
    let google_result = match api_translation::google_translate_text(&text, &target_language).await
    {
        Ok(body) => parse_translation_response(&body, "Google Translate", false),
        Err(error) => Err(error),
    };

    let translated_text = match google_result {
        Ok(text) => text,
        Err(google_error) => {
            eprintln!("Google Translate failed: {google_error}; trying LibreTranslate");
            let body = api_translation::libre_translate_text(&text, &target_language)
                .await
                .map_err(|libre_error| {
                    AppError::http_request_failed(format!(
                        "Google Translate failed ({google_error}); LibreTranslate failed ({libre_error})."
                    ))
                })?;
            parse_translation_response(&body, "LibreTranslate", true).map_err(|libre_error| {
                AppError::invalid_response(format!(
                    "Google Translate failed ({google_error}); {libre_error}"
                ))
            })?
        }
    };
    Ok(TranslationResult {
        original_text: text,
        translated_text,
        target_language,
    })
}
