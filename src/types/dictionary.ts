/** One entry of the free dictionary API, matching the Rust `DictionaryEntry`. */
export interface DictionaryEntry {
  word: string;
  phonetic?: string | null;
  phonetics: DictionaryPhonetic[];
  meanings: DictionaryMeaning[];
  license?: DictionaryLicense | null;
  sourceUrls: string[];
}

export interface DictionaryLicense {
  name: string;
  url: string;
}

export interface DictionaryPhonetic {
  text?: string | null;
  audio?: string | null;
  sourceUrl?: string | null;
  license?: DictionaryLicense | null;
}

export interface DictionaryMeaning {
  partOfSpeech: string;
  definitions: DictionaryDefinition[];
  synonyms: string[];
  antonyms: string[];
}

export interface DictionaryDefinition {
  definition: string;
  example?: string | null;
  synonyms: string[];
  antonyms: string[];
}
