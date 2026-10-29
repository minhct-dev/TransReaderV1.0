use tauri::State;

use crate::api::api_dictionary as api_dict;
use crate::models::dictionary::DictionaryEntry;
use crate::models::dictionary_cache::DictionaryCache;
use crate::storage::db::Db;
use crate::storage::dictionary_cache as dict_storage;
use crate::utils::error::AppError;

/// Look a word up in the local cache first, then fall back to the free
/// dictionary API and remember its raw payload for the next time.
#[tauri::command]
pub async fn lookup_dictionary(
    word: String,
    db: State<'_, Db>,
) -> Result<Vec<DictionaryEntry>, AppError> {
    let clean_word = normalize_word(&word)
        .ok_or_else(|| AppError::invalid_input("Please select a single English word."))?;

    if let Ok(cached_json) = dict_storage::lookup_word_in_cache(&db, &clean_word)
        && let Ok(entries) = serde_json::from_str::<Vec<DictionaryEntry>>(&cached_json)
        && !entries.is_empty()
    {
        return Ok(entries);
    }

    let json_text = api_dict::get_dictionary_data_by_word(&clean_word).await?;

    let entries: Vec<DictionaryEntry> = serde_json::from_str(&json_text).map_err(|e| {
        AppError::invalid_response(format!("Cannot read the dictionary entries: {e}"))
    })?;

    if entries.is_empty() {
        return Err(AppError::word_not_found(&clean_word));
    }

    let new_cache = DictionaryCache::new(&clean_word, &json_text);
    if let Err(e) = dict_storage::add_dictionary_cache(&db, &new_cache) {
        eprintln!("Warning: failed to cache dictionary entry '{clean_word}': {e}");
    }

    Ok(entries)
}

/// Trim, lowercase and reject anything that is not a single word made of
/// letters, apostrophes or hyphens. This keeps arbitrary text out of the API
/// URL and out of the cache.
fn normalize_word(word: &str) -> Option<String> {
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
    use super::normalize_word;

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
