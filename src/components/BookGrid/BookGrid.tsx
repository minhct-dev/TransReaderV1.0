import { useState } from "react";
import type { Book } from "../../types/book";
import BookCard from "./BookCard";
import BookContextMenu from "../ContextMenu/BookContextMenu";
import "./BookGrid.css";

interface BookGridProps {
  books: Book[];
  onOpenBook: (book: Book) => void;
  onRemoveBook: (book: Book) => void;
}

interface MenuState {
  book: Book;
  x: number;
  y: number;
}

export default function BookGrid({ books, onOpenBook, onRemoveBook }: BookGridProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);

  if (books.length === 0) {
    return (
      <p className="book-grid__empty">
        No books match your search.
      </p>
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
