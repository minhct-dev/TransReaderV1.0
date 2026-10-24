import type { Book } from "../types";
import BookCard from "./BookCard";

export default function BookGrid({ books }: { books: Book[] }) {
  if (books.length === 0) {
    return (
      <p className="py-24 text-center text-sm text-muted">
        No books match your search.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {books.map((book) => (
        <li key={book.id}>
          <BookCard book={book} />
        </li>
      ))}
    </ul>
  );
}
