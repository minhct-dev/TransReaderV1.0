import type { Book } from "../types/book";

// Mock covers come from Open Library by ISBN. BookCard falls back to a
// generated cover if an image fails to load (offline, rate limit).
const cover = (isbn: string) =>
  `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;

export const books: Book[] = [
  { id: "1", title: "Atomic Habits", author: "James Clear", topic: "Self-improvement", format: "PDF", progress: 64, coverUrl: cover("9780735211292") },
  { id: "2", title: "The Design of Everyday Things", author: "Don Norman", topic: "Design", format: "PDF", progress: 12, coverUrl: cover("9780465050659") },
  { id: "3", title: "Sapiens", author: "Yuval Noah Harari", topic: "History", format: "DOCX", progress: 100, coverUrl: cover("9780062316097") },
  { id: "4", title: "Deep Work", author: "Cal Newport", topic: "Productivity", format: "PDF", progress: 38, coverUrl: cover("9781455586691") },
  { id: "5", title: "Clean Code", author: "Robert C. Martin", topic: "Programming", format: "PDF", progress: 81, coverUrl: cover("9780132350884") },
  { id: "6", title: "The Pragmatic Programmer", author: "Andrew Hunt", topic: "Programming", format: "DOCX", progress: 0, coverUrl: cover("9780135957059") },
  { id: "7", title: "Thinking, Fast and Slow", author: "Daniel Kahneman", topic: "Psychology", format: "PDF", progress: 25, coverUrl: cover("9780374533557") },
  { id: "8", title: "The Psychology of Money", author: "Morgan Housel", topic: "Finance", format: "PDF", progress: 92, coverUrl: cover("9780857197689") },
  { id: "9", title: "Dune", author: "Frank Herbert", topic: "Fiction", format: "DOCX", progress: 47, coverUrl: cover("9780441172719") },
  { id: "10", title: "Nineteen Eighty-Four", author: "George Orwell", topic: "Fiction", format: "PDF", progress: 100, coverUrl: cover("9780451524935") },
  { id: "11", title: "Steve Jobs", author: "Walter Isaacson", topic: "Biography", format: "PDF", progress: 5, coverUrl: cover("9781451648539") },
  { id: "12", title: "Educated", author: "Tara Westover", topic: "Memoir", format: "DOCX", progress: 73, coverUrl: cover("9780399590504") },
];
