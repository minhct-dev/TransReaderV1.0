use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct License {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Phonetic {
    pub text: Option<String>,
    pub audio: Option<String>,
    pub source_url: Option<String>,
    pub license: Option<License>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Definition {
    pub definition: String,
    pub example: Option<String>,
    #[serde(default)]
    pub synonyms: Vec<String>,
    #[serde(default)]
    pub antonyms: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Meaning {
    pub part_of_speech: String,
    pub definitions: Vec<Definition>,
    #[serde(default)]
    pub synonyms: Vec<String>,
    #[serde(default)]
    pub antonyms: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DictionaryEntry {
    pub word: String,
    pub phonetic: Option<String>,
    #[serde(default)]
    pub phonetics: Vec<Phonetic>,
    pub meanings: Vec<Meaning>,
    pub license: Option<License>,
    #[serde(default)]
    pub source_urls: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::DictionaryEntry;

    const PAYLOAD: &str = r#"[
        {
            "word": "hello",
            "phonetics": [
                {
                    "text": "/həˈləʊ/",
                    "audio": "https://api.dictionaryapi.dev/media/pronunciations/en/hello-uk.mp3",
                    "sourceUrl": "https://commons.wikimedia.org/wiki/File:En-uk-hello.ogg",
                    "license": { "name": "BY 3.0 US", "url": "https://creativecommons.org/licenses/by/3.0/us" }
                }
            ],
            "meanings": [
                {
                    "partOfSpeech": "interjection",
                    "definitions": [
                        {
                            "definition": "A greeting said when meeting someone.",
                            "example": "Hello, everyone.",
                            "synonyms": [],
                            "antonyms": []
                        }
                    ],
                    "synonyms": ["greeting"],
                    "antonyms": []
                }
            ],
            "license": { "name": "CC BY-SA 3.0", "url": "https://creativecommons.org/licenses/by-sa/3.0" },
            "sourceUrls": ["https://en.wiktionary.org/wiki/hello"]
        }
    ]"#;

    #[test]
    fn parses_the_api_payload() {
        let entries: Vec<DictionaryEntry> = serde_json::from_str(PAYLOAD).unwrap();
        let entry = &entries[0];

        assert_eq!(entry.word, "hello");
        assert_eq!(entry.phonetics[0].text.as_deref(), Some("/həˈləʊ/"));
        assert_eq!(
            entry.phonetics[0].source_url.as_deref(),
            Some("https://commons.wikimedia.org/wiki/File:En-uk-hello.ogg")
        );
        assert_eq!(entry.meanings[0].part_of_speech, "interjection");
        assert_eq!(
            entry.meanings[0].definitions[0].example.as_deref(),
            Some("Hello, everyone.")
        );
        assert_eq!(entry.source_urls, ["https://en.wiktionary.org/wiki/hello"]);
    }

    #[test]
    fn missing_optional_fields_are_empty() {
        let entries: Vec<DictionaryEntry> =
            serde_json::from_str(r#"[{"word":"hello","meanings":[]}]"#).unwrap();

        assert!(entries[0].phonetic.is_none());
        assert!(entries[0].phonetics.is_empty());
        assert!(entries[0].source_urls.is_empty());
    }
}
