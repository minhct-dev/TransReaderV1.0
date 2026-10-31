import { useEffect, useRef, useState } from "react";
import { loadPdfCover } from "../../services/coverCache";
import type { MouseEvent } from "react";
import type { Book } from "../../types/book";
import { DocumentIcon } from "../icons";

/** Human-readable badge text per format. */
const formatLabel = (f: Book["format"]) =>
  f === "DOCX" ? ".DOCX" : f === "TXT" ? ".TXT" : ".PDF";

/** Theme colors for format-based placeholder covers */
const formatTheme: Record<Book["format"], { bg: string; iconBg: string }> = {
  PDF: {
    bg: "#f1e9dd",
    iconBg: "#e5dbcc",
  },
  DOCX: {
    bg: "#e5edf0",
    iconBg: "#d5e2e5",
  },
  TXT: {
    bg: "#e9ede4",
    iconBg: "#dce4d5",
  },
};

interface BookCardProps {
  book: Book;
  onOpen?: (book: Book) => void;
  onContextMenu?: (event: MouseEvent<HTMLAnchorElement>, book: Book) => void;
}

export default function BookCard({ book, onOpen, onContextMenu }: BookCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [generatedCover, setGeneratedCover] = useState<string | null>(null);
  const cardRef = useRef<HTMLAnchorElement>(null);
  const persistedCover = book.cover_url ?? book.coverUrl;
  const coverUrl = persistedCover ?? generatedCover;
  const showImage = Boolean(coverUrl && coverUrl.trim().length > 0 && !imgFailed);
  const theme = formatTheme[book.format] ?? formatTheme.TXT;

  useEffect(() => {
    if (persistedCover || book.format !== "PDF") return;
    let cancelled = false;
    let objectUrl: string | null = null;

    let observer: IntersectionObserver | null = null;
    const generateWhenVisible = () => {
      void loadPdfCover(book.id).then((image) => {
        if (!image || cancelled) return;
        objectUrl = URL.createObjectURL(image);
        setGeneratedCover(objectUrl);
      });
    };

    if ("IntersectionObserver" in window && cardRef.current) {
      observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          observer?.disconnect();
          generateWhenVisible();
        }
      }, { rootMargin: "180px" });
      observer.observe(cardRef.current);
    } else {
      generateWhenVisible();
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [book.id, book.format, persistedCover]);

  return (
    <a
      ref={cardRef}
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
            className="flex h-full w-full flex-col justify-between p-4 text-[#3f4943]"
            style={{ background: `linear-gradient(150deg, ${theme.bg} 0%, #faf7f1 100%)` }}
          >
            <span className="max-w-full truncate text-[9px] font-semibold uppercase tracking-[0.18em] text-[#718078]">
              {formatLabel(book.format).slice(1)}
            </span>

            <div className="my-auto flex flex-col items-center px-1 text-center">
              <div
                className="mb-3 grid size-12 place-items-center rounded-full text-[#596c62]"
                style={{ background: theme.iconBg }}
              >
                <DocumentIcon width={24} height={24} />
              </div>
              <span className="line-clamp-3 text-sm font-semibold leading-snug">
                {book.title}
              </span>
            </div>

            <span className="truncate text-center text-[11px] text-[#718078]">
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
