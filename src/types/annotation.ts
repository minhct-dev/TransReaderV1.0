/** A highlight or note anchored to a page, matching the Rust `BookAnnotation`. */
export interface BookAnnotation {
  id: string;
  bookId: string;
  pageNumber: number;
  selectedText: string;
  color: string;
  noteText?: string | null;
  /** JSON array of percentage rects: [{ x, y, w, h }], each value in 0–100. */
  rectsJson: string;
  createdAt: string;
  updatedAt: string;
}

/** One line fragment of a highlight, relative to the page text box. */
export interface AnnotationRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
