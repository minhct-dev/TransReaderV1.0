import type { Book } from "../../types/book";
import BookCard from "./BookCard";
import "./BookGrid.css";

interface BookGridProps {
  books: Book[];
}

export default function BookGrid({ books }: BookGridProps) {
  if (books.length === 0) {
    return (
      <p className="book-grid__empty">
        No books match your search.
      </p>
    );
  }

  return (
    <ul className="book-grid">
      {books.map((book) => (
        <li key={book.id}>
          <BookCard book={book} />
        </li>
      ))}
    </ul>
  );
}
