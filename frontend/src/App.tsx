import { useMemo, useState } from "react";
import Sidebar from "./components/Sidebar/Sidebar";
import Header from "./components/Header/Header";
import BookGrid from "./components/BookGrid/BookGrid";
import { books as initialBooks } from "./data/books";
import type { Book, BookFormat } from "./types/book";
import "./App.css";

/** Derive a BookFormat from a file extension. */
function formatFromName(name: string): BookFormat {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "docx" || ext === "doc") return "DOCX";
  if (ext === "txt") return "TXT";
  return "PDF";
}

export default function App() {
  const [books, setBooks] = useState<Book[]>(initialBooks);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter((b) =>
      [b.title, b.author, b.topic].some((s) => s.toLowerCase().includes(q)),
    );
  }, [query, books]);

  /** Append a new book from a local file pick. */
  const handleAddFile = (file: File) => {
    const newBook: Book = {
      id: crypto.randomUUID(),
      title: file.name.replace(/\.[^.]+$/, ""),
      author: "Unknown",
      topic: "Imported",
      format: formatFromName(file.name),
      progress: 0,
      coverUrl: "",
      filePath: file.name,
    };
    setBooks((prev) => [newBook, ...prev]);
  };

  return (
    <div className="app-container">
      <Sidebar />

      <main className="main-content">
        <div className="content-wrapper">
          <Header
            query={query}
            onQueryChange={setQuery}
            bookCount={visible.length}
            onAddFile={handleAddFile}
          />

          <section id="library" aria-label="Book library">
            <BookGrid books={visible} />
          </section>
        </div>
      </main>
    </div>
  );
}
