use serde::Serialize;

/// A failure every command may return. Tauri serialises it straight to the
/// frontend as `{ code, message }`, so the UI can branch on `code` and still
/// show `message` to the reader.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
}

impl AppError {
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.to_string(),
            message: message.into(),
        }
    }

    pub fn book_not_found() -> Self {
        Self::new("BOOK_NOT_FOUND", "The requested book was not found.")
    }
    pub fn annotation_not_found(id: &str) -> Self {
        Self::new(
            "ANNOTATION_NOT_FOUND",
            format!("No highlight or note found with id {id}."),
        )
    }
    pub fn word_not_found(word: &str) -> Self {
        Self::new(
            "WORD_NOT_FOUND",
            format!("Word '{word}' was not found in the dictionary."),
        )
    }
    pub fn database_error(message: impl Into<String>) -> Self {
        Self::new("DATABASE_ERROR", message)
    }
    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self::new("INVALID_INPUT", message)
    }
    pub fn invalid_response(message: impl Into<String>) -> Self {
        Self::new("INVALID_RESPONSE", message)
    }
    pub fn http_request_failed(message: impl Into<String>) -> Self {
        Self::new("HTTP_REQUEST_FAILED", message)
    }
    pub fn failed_to_build_http_client(message: impl Into<String>) -> Self {
        Self::new("FAILED_TO_BUILD_HTTP_CLIENT", message)
    }
    pub fn file_dialog_error(message: impl Into<String>) -> Self {
        Self::new("FILE_DIALOG_ERROR", message)
    }
    /// Local storage or startup trouble that has no better code.
    pub fn internal(message: impl Into<String>) -> Self {
        Self::new("INTERNAL", message)
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} ({})", self.message, self.code)
    }
}

impl std::error::Error for AppError {}

#[cfg(test)]
mod tests {
    use super::AppError;

    /// The frontend reads `{ code, message }`; this pins the wire shape.
    #[test]
    fn serialises_to_the_shape_the_frontend_expects() {
        let json = serde_json::to_string(&AppError::book_not_found()).unwrap();

        assert_eq!(
            json,
            r#"{"code":"BOOK_NOT_FOUND","message":"The requested book was not found."}"#
        );
    }
}
