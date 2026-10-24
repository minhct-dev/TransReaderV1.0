export type BookFormat = "PDF" | "DOCX" | "TXT";

export interface Book {
  id: string;
  title: string;
  author: string;
  topic: string;
  format: BookFormat;
  /** Reading progress, 0 – 100. */
  progress: number;
  coverUrl: string;
  /** Local file path (set when imported via Add Book). */
  filePath?: string;
}
