use crate::api::translation as api_translation;
use crate::models::translation_result::TranslationResult;
use crate::utils::error::AppError;
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

    let json_text = api_translation::google_translate_text(&text, &target_language).await?;

    let json_value: serde_json::Value = serde_json::from_str(&json_text).map_err(|e| {
        AppError::invalid_response(format!("Cannot read the translation response: {e}"))
    })?;
    let mut translated_text = String::new();
    if let Some(sentences) = json_value[0].as_array() {
        for sentence in sentences {
            if let Some(part) = sentence[0].as_str() {
                translated_text.push_str(part);
            }
        }
    }
    if translated_text.is_empty() {
        return Err(AppError::http_request_failed(
            "Failed to extract translated text from JSON.".to_string(),
        ));
    }
    Ok(TranslationResult {
        original_text: text,
        translated_text,
        target_language,
    })
}