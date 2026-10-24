export type BookFormat = "PDF" | "DOCX";

export interface Book {
  id: string;
  title: string;
  author: string;
  topic: string;
  format: BookFormat;
  /** Reading progress, 0 to 100. */
  progress: number;
  coverUrl: string;
}
