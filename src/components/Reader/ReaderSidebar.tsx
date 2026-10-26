import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { READER_PAGES, TABLE_OF_CONTENTS } from "./readerContent";
import type { ReaderPage } from "./readerContent";

interface ReaderSidebarProps {
  currentPage: number;
  onSelectPage: (page: number) => void;
  onClose: () => void;
}

type Tab = "contents" | "pages";

export default function ReaderSidebar({ currentPage, onSelectPage, onClose }: ReaderSidebarProps) {
  const [tab, setTab] = useState<Tab>("pages");
  const currentRef = useRef<HTMLButtonElement>(null);

  // Follow the page the reader scrolled to, without yanking the sidebar around.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentPage]);

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-[var(--r-border)] bg-[var(--r-surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--r-border)] px-2.5 py-2">
        <div className="flex flex-1 rounded-lg bg-[var(--r-tint)] p-0.5">
          <TabButton active={tab === "contents"} onClick={() => setTab("contents")}>
            Contents
          </TabButton>
          <TabButton active={tab === "pages"} onClick={() => setTab("pages")}>
            Pages
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
        ) : (
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
      className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
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
