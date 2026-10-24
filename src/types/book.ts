export type BookFormat = "PDF" | "DOCX" | "TXT";

/** Rust backend DTO (snake_case) */
export interface BookDto {
  id: string;
  title: string;
  author: string;
  topic: string;
  format: string;
  file_path: string;
  progress: number;
  cover_url?: string | null;
}

/** Frontend model */
export interface Book {
  id: string;
  title: string;
  author: string;
  topic: string;
  format: BookFormat;
  /** Reading progress, 0 – 100. */
  progress: number;
  cover_url?: string | null;
  /** Alias for backward compatibility */
  coverUrl?: string | null;
  /** Local file path (set when imported via Add Book). */
  filePath?: string;
}

