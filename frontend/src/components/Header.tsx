import { SearchIcon } from "./icons";

interface HeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
}

export default function Header({ query, onQueryChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-20 items-center justify-center bg-canvas/80 px-6 backdrop-blur">
      <label className="relative w-full max-w-xl">
        <span className="sr-only">Search library</span>
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search books, topics, or notes..."
          className="h-12 w-full rounded-full border border-black/5 bg-white pl-12 pr-5 text-sm shadow-sm outline-none transition placeholder:text-muted focus:border-black/10 focus:shadow-md"
        />
      </label>
    </header>
  );
}
