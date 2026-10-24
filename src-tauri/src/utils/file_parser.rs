use std::path::Path;

pub fn parse_title_from_path(file_path: &str) -> String {
    Path::new(file_path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("Unknown Title")
        .to_string()
}

pub fn parse_format_from_path(file_path: &str) -> String {
    Path::new(file_path)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("TXT")
        .to_uppercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_title_from_path() {
        let file_path = "C:/path/to/Clean_Code.pdf";
        assert_eq!(parse_title_from_path(file_path), "Clean_Code");
    }

    #[test]
    fn test_parse_format_from_path() {
        let file_path = "C:/path/to/Clean_Code.pdf";
        assert_eq!(parse_format_from_path(file_path), "PDF");
    }
}