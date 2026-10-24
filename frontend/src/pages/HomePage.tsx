import { useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import BookGrid from "../components/BookGrid";
import { books } from "../data/books";

export default function HomePage() {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter((b) =>
      [b.title, b.author, b.topic].some((s) => s.toLowerCase().includes(q)),
    );
  }, [query]);

  return (
    <div className="min-h-full bg-canvas">
      <Sidebar />
      <div className="pl-16 md:pl-56">
        <Header query={query} onQueryChange={setQuery} />
        <main id="library" className="mx-auto max-w-7xl px-6 pb-16 pt-2 md:px-10">
          <div className="mb-8 flex items-center gap-3">
            <h1 className="rounded-full bg-ink/[0.06] px-4 py-1.5 text-sm font-medium">
              My Library
            </h1>
            <span className="text-xs text-muted">{visible.length} books</span>
          </div>
          <BookGrid books={visible} />
        </main>
      </div>
    </div>
  );
}
