import { invoke } from "@tauri-apps/api/core";
import type { Book, BookDto } from "../types/book";

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
  const dtos = await invoke<BookDto[]>("get_library_books");
  return dtos.map(mapBookDtoToBook);
}

/** Open native file dialog via Rust backend and return the imported book */
export async function addBookDialog(): Promise<Book | null> {
  const dto = await invoke<BookDto | null>("add_book_dialog");
  return dto ? mapBookDtoToBook(dto) : null;
}
