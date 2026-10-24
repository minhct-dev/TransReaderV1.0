import { useState } from "react";
import type { Book } from "../../types/book";

/** Human-readable badge text per format. */
const formatLabel = (f: Book["format"]) =>
  f === "DOCX" ? ".DOCX" : f === "TXT" ? ".TXT" : ".PDF";

export default function BookCard({ book }: { book: Book }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <a
      href={`#book-${book.id}`}
      className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
    >
      {/* Cover */}
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-white shadow-sm transition duration-300 ease-out group-hover:scale-105 group-hover:shadow-md group-focus-visible:scale-105">
        {imgFailed || !book.coverUrl ? (
          <div className="flex h-full flex-col justify-between bg-gradient-to-br from-stone-200 to-stone-100 p-4">
            <span className="text-xs uppercase tracking-widest text-muted">
              {book.topic}
            </span>
            <span className="text-base font-semibold leading-snug">
              {book.title}
            </span>
          </div>
        ) : (
          <img
            src={book.coverUrl}
            alt={`Cover of ${book.title}`}
            loading="lazy"
            draggable={false}
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
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
