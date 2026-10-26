import { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar/Sidebar";
import Header from "./components/Header/Header";
import BookGrid from "./components/BookGrid/BookGrid";
import ReaderCanvas from "./components/Reader/ReaderCanvas";
import { getLibraryBooks, addBookDialog, deleteBook } from "./services/tauriBridge";
import type { Book } from "./types/book";
import "./App.css";

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState("");
  /** Book open in the reader; `null` shows the library. */
  const [reading, setReading] = useState<Book | null>(null);

  useEffect(() => {
    getLibraryBooks()
      .then(setBooks)
      .catch((err) => console.error("Failed to load books:", err));
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter((b) =>
      [b.title, b.author, b.topic].some((s) => s.toLowerCase().includes(q))
    );
  }, [query, books]);

  const handleAddBook = async () => {
    try {
      const newBook = await addBookDialog();
      if (newBook) {
        setBooks((prev) => {
          // Avoid duplicate entries if book with same path is already present
          if (prev.some((b) => b.filePath && b.filePath === newBook.filePath)) {
            return prev;
          }
          return [newBook, ...prev];
        });
      }
    } catch (err) {
      console.error("Failed to add book:", err);
    }
  };

  const handleRemoveBook = async (book: Book) => {
    try {
      await deleteBook(book.id);
      setBooks((prev) => prev.filter((b) => b.id !== book.id));
    } catch (err) {
      console.error("Failed to remove book:", err);
      window.alert(`Cannot remove "${book.title}" from the library.`);
    }
  };

  return (
    <div className="app-container">
      <Sidebar />

      <Header
        query={query}
        onQueryChange={setQuery}
        bookCount={visible.length}
        onAddBook={handleAddBook}
      />

      <main className="main-content">
        <div className="content-wrapper">
          <section id="library" aria-label="Book library">
            <BookGrid
              books={visible}
              onOpenBook={setReading}
              onRemoveBook={handleRemoveBook}
            />
          </section>
        </div>
      </main>

      {reading && <ReaderCanvas book={reading} onClose={() => setReading(null)} />}
    </div>
  );
}
