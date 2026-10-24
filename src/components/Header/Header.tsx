import { SearchIcon, PlusIcon } from "../icons";
import "./Header.css";

interface HeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
  bookCount: number;
  onAddBook: () => void;
}

export default function Header({
  query,
  onQueryChange,
  bookCount,
  onAddBook,
}: HeaderProps) {
  return (
    <header className="header">
      {/* Row 1: Centered Search Bar */}
      <div className="header__search-row">
        <label className="header__search-wrapper">
          <span className="sr-only">Search library</span>
          <SearchIcon className="header__search-icon" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search books, topics, or notes..."
            className="header__search-input"
          />
        </label>
      </div>

      {/* Row 2: Sub-header / Toolbar */}
      <div className="header__toolbar-row">
        <div className="header__toolbar-left">
          <span className="header__badge">My Library</span>
          <span className="header__counter">{bookCount} books</span>
        </div>

        <div className="header__toolbar-right">
          <button
            type="button"
            className="header__add-btn"
            onClick={onAddBook}
          >
            <PlusIcon width={16} height={16} />
            <span>Add Book</span>
          </button>
        </div>
      </div>
    </header>
  );
}
