import { invoke } from "@tauri-apps/api/core";
import type { Book, BookDto } from "../types/book";
import type { BookAnnotation } from "../types/annotation";
import type { DictionaryEntry } from "../types/dictionary";

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  targetLanguage: string;
}

function mapBookDtoToBook(dto: BookDto): Book {
  const cover = dto.cover_url ?? null;
  return {
    id: dto.id,
    title: dto.title,
    author: dto.author,
    topic: dto.topic,
    format: dto.format as Book["format"],
    progress: dto.progress,
    cover_url: cover,
    coverUrl: cover,
    filePath: dto.file_path,
  };
}

/** Fetch all stored books from Rust backend */
export async function getLibraryBooks(): Promise<Book[]> {
  const dtos = await invoke<BookDto[]>("get_all_books");
  return dtos.map(mapBookDtoToBook);
}

/** Open native file dialog via Rust backend and return the imported book */
export async function addBookDialog(): Promise<Book | null> {
  const dto = await invoke<BookDto | null>("add_book");
  return dto ? mapBookDtoToBook(dto) : null;
}

/** Soft-delete a book: hides it from the library, keeps the row and the file on disk. */
export async function deleteBook(id: string): Promise<void> {
  await invoke<void>("delete_book", { bookId: id });
}

/** Absolute path on disk of a book still in the library, for `convertFileSrc`. */
export async function resolveBookPath(bookId: string): Promise<string> {
  return invoke<string>("resolve_book_path", { bookId });
}

/** Persist a new highlight or note. The object must carry its id and timestamps. */
export async function addAnnotation(annotation: BookAnnotation): Promise<void> {
  await invoke<void>("add_annotation", { annotation });
}

/** Every annotation of a book, ordered by page by the Rust side. */
export async function getAnnotationsByBook(bookId: string): Promise<BookAnnotation[]> {
  return invoke<BookAnnotation[]>("get_annotations_by_book", { bookId });
}

/** Every annotation on one page of a book. */
export async function getAnnotationsByPage(
  bookId: string,
  pageNumber: number,
): Promise<BookAnnotation[]> {
  return invoke<BookAnnotation[]>("get_annotations_by_page", { bookId, pageNumber });
}

/** Set or clear the note attached to an existing highlight. */
export async function updateAnnotationNote(
  annotationId: string,
  noteText: string | null,
): Promise<void> {
  await invoke<void>("update_annotation_note", { annotationId, noteText });
}

/** Permanently remove a highlight and its note. */
export async function deleteAnnotation(annotationId: string): Promise<void> {
  await invoke<void>("delete_annotation", { annotationId });
}

/**
 * Look a single word up in the Rust dictionary cache, then the free dictionary
 * API. Resolves with every entry the API returned; the first one is the usual
 * display candidate.
 */
export async function lookupDictionary(word: string): Promise<DictionaryEntry[]> {
  return invoke<DictionaryEntry[]>("lookup_dictionary", { word });
}

export async function translateText(
  text: string,
  targetLanguage: string,
): Promise<TranslationResult> {
  return invoke<TranslationResult>("translate_with_google", {
    text,
    targetLanguage,
  });
}

