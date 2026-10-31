import { useState } from "react";
import { BookOpen } from "lucide-react";
import type { Book } from "../../types/book";
import BookCard from "./BookCard";
import BookContextMenu from "../ContextMenu/BookContextMenu";
import "./BookGrid.css";

interface BookGridProps {
  books: Book[];
  onOpenBook: (book: Book) => void;
  onRemoveBook: (book: Book) => void;
  hasQuery?: boolean;
  onAddBook?: () => void;
}

interface MenuState {
  book: Book;
  x: number;
  y: number;
}

export default function BookGrid({
  books,
  onOpenBook,
  onRemoveBook,
  hasQuery = false,
  onAddBook,
}: BookGridProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);

  if (books.length === 0) {
    return hasQuery ? (
      <div className="book-grid__empty">
        <BookOpen size={22} aria-hidden="true" />
        <p>No books match your search.</p>
        <span>Try a different title, author, or topic.</span>
      </div>
    ) : (
      <div className="book-grid__empty book-grid__empty--library">
        <span className="book-grid__empty-art" aria-hidden="true"><BookOpen size={34} /></span>
        <h2>Your reading shelf starts here</h2>
        <p>Add a PDF and its first page will become the cover.</p>
        <button type="button" onClick={onAddBook}>Add your first book</button>
      </div>
    );
  }

  return (
    <>
      <ul className="book-grid">
        {books.map((book) => (
          <li key={book.id}>
            <BookCard
              book={book}
              onOpen={onOpenBook}
              onContextMenu={(event, target) => {
                event.preventDefault();
                setMenu({ book: target, x: event.clientX, y: event.clientY });
              }}
            />
          </li>
        ))}
      </ul>

      {menu && (
        <BookContextMenu
          book={menu.book}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onOpenBook={onOpenBook}
          onRemoveFromList={onRemoveBook}
        />
      )}
    </>
  );
}
