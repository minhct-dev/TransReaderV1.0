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

/// Trim, lowercase and reject anything that is not a single word made of
/// letters, apostrophes or hyphens. This keeps arbitrary text out of the API
/// URL and out of the cache.
pub fn normalize_word(word: &str) -> Option<String> {
    let trimmed = word.trim();
    let cleanned = trimmed.trim_matches(|c: char| {
        !c.is_alphabetic() && c!= '\'' && c != '-'
    });
    if cleanned.is_empty() || cleanned.chars().any(char::is_whitespace) {
        return None;
    }

    let mut has_letter = false;
    for character in cleanned.chars() {
        if character.is_alphabetic() {
            has_letter = true;
        } else if character != '\'' && character != '-' {
            return None;
        }
    }

    has_letter.then(|| cleanned.to_lowercase())
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
    #[test]
    fn normalizes_single_words() {
        assert_eq!(normalize_word("  Hello "), Some("hello".to_string()));
        assert_eq!(normalize_word("don't"), Some("don't".to_string()));
        assert_eq!(normalize_word("well-known"), Some("well-known".to_string()));
        assert_eq!(normalize_word(".  hello"), Some("hello".to_string()));
        assert_eq!(normalize_word("well-known???^#"), Some("well-known".to_string()));
    }

    #[test]
    fn rejects_anything_that_is_not_one_word() {
        assert_eq!(normalize_word(""), None);
        assert_eq!(normalize_word("   "), None);
        assert_eq!(normalize_word("two words"), None);
        assert_eq!(normalize_word("123"), None);
    }
}