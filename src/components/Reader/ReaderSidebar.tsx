import { useEffect, useRef, useState } from "react";
import { Highlighter, Loader2, MessageSquare, X } from "lucide-react";
import { READER_PAGES, TABLE_OF_CONTENTS } from "./readerContent";
import type { ReaderPage } from "./readerContent";
import type { BookAnnotation } from "../../types/annotation";
import { sortAnnotations } from "./annotationUtils";

interface ReaderSidebarProps {
  currentPage: number;
  onSelectPage: (page: number) => void;
  onClose: () => void;
  annotations: BookAnnotation[];
  annotationsLoading: boolean;
  onSelectAnnotation: (annotation: BookAnnotation) => void;
}

type Tab = "contents" | "pages" | "notes";

export default function ReaderSidebar({
  currentPage,
  onSelectPage,
  onClose,
  annotations,
  annotationsLoading,
  onSelectAnnotation,
}: ReaderSidebarProps) {
  const [tab, setTab] = useState<Tab>("pages");
  const currentRef = useRef<HTMLButtonElement>(null);
  const sortedAnnotations = sortAnnotations(annotations);

  // Follow the page the reader scrolled to, without yanking the sidebar around.
  useEffect(() => {
    if (tab === "pages") currentRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentPage, tab]);

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-[var(--r-border)] bg-[var(--r-surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--r-border)] px-2.5 py-2">
        <div className="flex min-w-0 flex-1 rounded-lg bg-[var(--r-tint)] p-0.5">
          <TabButton active={tab === "contents"} onClick={() => setTab("contents")}>
            Contents
          </TabButton>
          <TabButton active={tab === "pages"} onClick={() => setTab("pages")}>
            Pages
          </TabButton>
          <TabButton active={tab === "notes"} onClick={() => setTab("notes")}>
            Notes
            {sortedAnnotations.length > 0 && (
              <span className="ml-1 rounded-full bg-[var(--r-surface)] px-1 text-[9px] tabular-nums text-[var(--r-muted)]">
                {sortedAnnotations.length}
              </span>
            )}
          </TabButton>
        </div>

        <button
          type="button"
          aria-label="Hide sidebar"
          onClick={onClose}
          className="grid size-6 shrink-0 place-items-center rounded text-[var(--r-muted)] transition-colors hover:bg-[var(--r-tint)] hover:text-[var(--r-ink)]"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "pages" ? (
          <ul className="space-y-4 px-3 py-4">
            {READER_PAGES.map((page) => {
              const isCurrent = page.page === currentPage;
              return (
                <li key={page.page}>
                  <button
                    ref={isCurrent ? currentRef : undefined}
                    type="button"
                    onClick={() => onSelectPage(page.page)}
                    aria-current={isCurrent ? "page" : undefined}
                    className="group block w-full outline-none"
                  >
                    <div
                      className={`rounded-[4px] border-2 p-[3px] transition-colors ${
                        isCurrent
                          ? "border-blue-500"
                          : "border-transparent group-hover:border-[var(--r-muted)] group-focus-visible:border-blue-400"
                      }`}
                    >
                      <div className="aspect-[3/4] overflow-hidden rounded-[2px] bg-[#fdfcf9] shadow-sm">
                        <PagePreview page={page} />
                      </div>
                    </div>
                    <span
                      className={`mt-1.5 block text-center text-[11px] tabular-nums ${
                        isCurrent ? "font-semibold text-blue-500" : "text-[var(--r-muted)]"
                      }`}
                    >
                      {page.page}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : tab === "contents" ? (
          <ul className="px-2 py-3">
            {TABLE_OF_CONTENTS.map((entry) => {
              const isCurrent = entry.page === currentPage;
              return (
                <li key={entry.title}>
                  <button
                    type="button"
                    onClick={() => onSelectPage(entry.page)}
                    className={`flex w-full items-baseline gap-2 rounded-md px-2.5 py-2 text-left transition-colors ${
                      isCurrent
                        ? "bg-[var(--r-tint)] text-[var(--r-ink)]"
                        : "text-[var(--r-ink)] hover:bg-[var(--r-tint)]"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-[12px]">{entry.title}</span>
                    <span className="text-[11px] tabular-nums text-[var(--r-muted)]">
                      {entry.page}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : annotationsLoading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-[11px] text-[var(--r-muted)]">
            <Loader2 size={14} className="animate-spin" />
            Loading notes…
          </div>
        ) : sortedAnnotations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <Highlighter size={20} className="text-[var(--r-muted)]" />
            <p className="text-[11.5px] leading-relaxed text-[var(--r-muted)]">
              No highlights yet.
              <br />
              Select text in the book to add one.
            </p>
          </div>
        ) : (
          <ul className="space-y-2 px-2 py-3">
            {sortedAnnotations.map((annotation) => {
              const hasNote = Boolean(annotation.noteText?.trim());
              return (
                <li key={annotation.id}>
                  <button
                    type="button"
                    onClick={() => onSelectAnnotation(annotation)}
                    className="group w-full rounded-lg border border-l-[3px] border-[var(--r-border)] bg-[var(--r-page)] p-2.5 text-left transition-colors hover:bg-[var(--r-tint)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500"
                    style={{ borderLeftColor: annotation.color }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--r-muted)]">
                        Page {annotation.pageNumber}
                      </span>
                      {hasNote && (
                        <MessageSquare
                          size={11}
                          className="ml-auto shrink-0 text-[var(--r-muted)]"
                        />
                      )}
                    </div>

                    <p className="mt-1.5 line-clamp-3 text-[11.5px] leading-snug text-[var(--r-ink)]">
                      {annotation.selectedText}
                    </p>

                    {hasNote && (
                      <p
                        className="mt-1.5 line-clamp-2 border-l-2 pl-2 text-[11px] italic leading-snug text-[var(--r-muted)]"
                        style={{ borderColor: annotation.color }}
                      >
                        {annotation.noteText}
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 flex-1 truncate rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors ${
        active
          ? "bg-[var(--r-surface)] text-[var(--r-ink)] shadow-sm"
          : "text-[var(--r-muted)] hover:text-[var(--r-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

/** Tiny typeset version of a page: at this size the text reads as a page, which
 *  is all a thumbnail has to do until real page images exist. */
function PagePreview({ page }: { page: ReaderPage }) {
  const text = `${page.heading ? `${page.heading}. ` : ""}${page.paragraphs.join(" ")}`;

  return (
    <div className="h-full w-full overflow-hidden px-[6px] py-[8px]">
      <p className="text-[4.5px] leading-[1.75] text-[#3f3f3f]/85">{text.slice(0, 1600)}</p>
    </div>
  );
}
