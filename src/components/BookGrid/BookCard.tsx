import { useState } from "react";
import type { MouseEvent } from "react";
import type { Book } from "../../types/book";
import { DocumentIcon } from "../icons";

/** Human-readable badge text per format. */
const formatLabel = (f: Book["format"]) =>
  f === "DOCX" ? ".DOCX" : f === "TXT" ? ".TXT" : ".PDF";

/** Theme colors for format-based placeholder covers */
const formatTheme: Record<Book["format"], { bg: string; text: string; iconBg: string }> = {
  PDF: {
    bg: "from-rose-50 to-red-100/70 border-red-200/60",
    text: "text-red-700",
    iconBg: "bg-red-500/10 text-red-600",
  },
  DOCX: {
    bg: "from-blue-50 to-indigo-100/70 border-blue-200/60",
    text: "text-blue-700",
    iconBg: "bg-blue-500/10 text-blue-600",
  },
  TXT: {
    bg: "from-stone-50 to-amber-100/60 border-amber-200/60",
    text: "text-amber-800",
    iconBg: "bg-amber-500/10 text-amber-700",
  },
};

interface BookCardProps {
  book: Book;
  onOpen?: (book: Book) => void;
  onContextMenu?: (event: MouseEvent<HTMLAnchorElement>, book: Book) => void;
}

export default function BookCard({ book, onOpen, onContextMenu }: BookCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const coverUrl = book.cover_url ?? book.coverUrl;
  const showImage = Boolean(coverUrl && coverUrl.trim().length > 0 && !imgFailed);
  const theme = formatTheme[book.format] ?? formatTheme.TXT;

  return (
    <a
      href={`#book-${book.id}`}
      onClick={(event) => {
        event.preventDefault();
        onOpen?.(book);
      }}
      onContextMenu={(event) => onContextMenu?.(event, book)}
      className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
    >
      {/* Cover container */}
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-white shadow-sm transition duration-300 ease-out group-hover:scale-105 group-hover:shadow-md group-focus-visible:scale-105">
        {showImage ? (
          <img
            src={coverUrl!}
            alt={`Cover of ${book.title}`}
            loading="lazy"
            draggable={false}
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={`flex h-full w-full flex-col justify-between border bg-gradient-to-b p-4 ${theme.bg}`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-semibold tracking-wider uppercase ${theme.text}`}>
                {book.topic || "DOCUMENT"}
              </span>
            </div>

            <div className="my-auto flex flex-col items-center px-1 text-center">
              <div className={`mb-3 grid size-12 place-items-center rounded-2xl ${theme.iconBg}`}>
                <DocumentIcon width={24} height={24} />
              </div>
              <span className="line-clamp-3 text-sm font-semibold leading-snug text-ink">
                {book.title}
              </span>
            </div>

            <span className="text-[11px] truncate text-center text-muted">
              {book.author}
            </span>
          </div>
        )}

        {/* Format badge */}
        <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ink shadow-sm backdrop-blur">
          {formatLabel(book.format)}
        </span>

        {/* Progress bar */}
        {book.progress > 0 && (
          <div
            role="progressbar"
            aria-label="Reading progress"
            aria-valuenow={book.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="absolute inset-x-0 bottom-0 h-1.5 bg-black/20"
          >
            <div
              className="h-full bg-accent"
              style={{ width: `${book.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="mt-3 px-1">
        <h3 className="truncate text-xs font-medium text-ink">{book.title}</h3>
        <p className="mt-0.5 truncate text-[11px] text-muted">
          {book.progress === 100
            ? "Finished"
            : `${book.progress}% · ${book.author}`}
        </p>
      </div>
    </a>
  );
}
