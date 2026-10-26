import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import ReaderToolbar from "./ReaderToolbar";
import ReaderSidebar from "./ReaderSidebar";
import SelectionPopover from "./SelectionPopover";
import { READER_PAGES } from "./readerContent";
import { READER_PALETTES } from "./readerTheme";
import type { ReaderTheme } from "./readerTheme";
import type { Book } from "../../types/book";

interface ReaderCanvasProps {
  book: Book;
  onClose: () => void;
}

interface SelectionMenu {
  visible: boolean;
  x: number;
  y: number;
  text: string;
}

const EMPTY_SELECTION: SelectionMenu = { visible: false, x: 0, y: 0, text: "" };

export default function ReaderCanvas({ book, onClose }: ReaderCanvasProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenu>(EMPTY_SELECTION);
  const [fontSize, setFontSize] = useState(19);
  const [theme, setTheme] = useState<ReaderTheme>("light");

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLElement | null)[]>([]);

  const totalPages = READER_PAGES.length;
  const percent = Math.round((currentPage / totalPages) * 100);

  // The page whose top last crossed 40% of the viewport is the one being read.
  // A plain scroll calculation beats an observer here: it stays correct for
  // pages shorter than the screen, which is what clicking a thumbnail produces.
  const updateCurrentPage = useCallback(() => {
    const root = scrollRef.current;
    if (!root) return;

    const line = root.getBoundingClientRect().top + root.clientHeight * 0.4;
    let page = 1;
    for (const element of pageRefs.current) {
      if (element && element.getBoundingClientRect().top <= line) {
        page = Number(element.dataset.page);
      }
    }
    setCurrentPage(page);
  }, []);

  const closeSelectionMenu = useCallback(() => {
    setSelectionMenu((menu) => (menu.visible ? { ...menu, visible: false } : menu));
  }, []);

  useEffect(() => {
    if (!selectionMenu.visible) return;

    const handlePointerDown = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest("[data-selection-popover]")) return;
      closeSelectionMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSelectionMenu();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    // The popover is pinned in viewport coordinates, so scrolling invalidates it.
    scrollRef.current?.addEventListener("scroll", closeSelectionMenu);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      scrollRef.current?.removeEventListener("scroll", closeSelectionMenu);
    };
  }, [selectionMenu.visible, closeSelectionMenu]);

  const scrollToPage = useCallback((page: number) => {
    const root = scrollRef.current;
    const target = pageRefs.current[page - 1];
    if (!root || !target) return;

    const top =
      target.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 16;
    root.scrollTo({ top, behavior: "smooth" });
  }, []);

  const captureSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text) return;

    const range = selection.getRangeAt(0);
    const start = range.getClientRects()[0] ?? range.getBoundingClientRect();
    setSelectionMenu({ visible: true, x: start.left, y: start.top, text });
  };

  const handleSearch = (query: string) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return false;

    const match = READER_PAGES.find((page) =>
      page.paragraphs.join(" ").toLowerCase().includes(needle)
    );
    if (!match) return false;

    scrollToPage(match.page);
    return true;
  };

  const handleHighlight = (color: string) => {
    console.log("Highlight", color, selectionMenu.text);
    closeSelectionMenu();
  };

  const handleAddNote = () => {
    console.log("Add note", selectionMenu.text);
    closeSelectionMenu();
  };

  const handleDictionary = () => {
    console.log("Dictionary", selectionMenu.text);
    closeSelectionMenu();
  };

  const handleShare = () => {
    console.log("Share", selectionMenu.text);
    closeSelectionMenu();
  };

  const palette = READER_PALETTES[theme];
  const variables = {
    "--r-bg": palette.bg,
    "--r-surface": palette.surface,
    "--r-page": palette.page,
    "--r-ink": palette.ink,
    "--r-muted": palette.muted,
    "--r-border": palette.border,
    "--r-tint": palette.tint,
  } as CSSProperties;

  return (
    <div
      style={variables}
      className="fixed inset-0 z-[200] flex flex-col bg-[var(--r-bg)] text-[var(--r-ink)]"
    >
      <ReaderToolbar
        title={book.title}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        theme={theme}
        onThemeChange={setTheme}
        onSearch={handleSearch}
        onClose={onClose}
      />

      <div className="flex min-h-0 flex-1">
        {isSidebarOpen && (
          <ReaderSidebar
            currentPage={currentPage}
            onSelectPage={scrollToPage}
            onClose={() => setIsSidebarOpen(false)}
          />
        )}

        <main
          ref={scrollRef}
          onScroll={updateCurrentPage}
          onMouseUp={captureSelection}
          className="min-w-0 flex-1 overflow-y-auto"
        >
          <div className="mx-auto flex w-full max-w-[46rem] flex-col gap-6 px-6 py-8">
            {READER_PAGES.map((page, index) => (
              <article
                key={page.page}
                data-page={page.page}
                ref={(element) => {
                  pageRefs.current[index] = element;
                }}
                className="rounded-sm bg-[var(--r-page)] px-[clamp(1.75rem,5vw,4rem)] py-[clamp(2.25rem,4vw,3.25rem)] shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
              >
                {page.heading && (
                  <h2 className="mb-5 text-center font-serif text-[11px] uppercase tracking-[0.22em] text-[var(--r-muted)]">
                    {page.heading}
                  </h2>
                )}

                <div
                  className="space-y-5 text-justify font-serif leading-relaxed hyphens-auto"
                  style={{ fontSize }}
                >
                  {page.paragraphs.map((paragraph) => (
                    <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>

      <footer className="shrink-0 border-t border-[var(--r-border)] bg-[var(--r-surface)] px-4 pb-2 pt-1.5">
        <p className="text-center text-[11px] tracking-wide text-[var(--r-muted)]">
          Page {currentPage} of {totalPages} ( {percent}% )
        </p>
      </footer>

      <div className="h-[3px] w-full bg-[var(--r-border)]">
        <div
          role="progressbar"
          aria-label="Reading progress"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ width: `${percent}%` }}
          className="h-full bg-emerald-500 transition-[width] duration-300"
        />
      </div>

      {selectionMenu.visible && (
        <SelectionPopover
          x={selectionMenu.x}
          y={selectionMenu.y}
          onHighlight={handleHighlight}
          onAddNote={handleAddNote}
          onDictionary={handleDictionary}
          onShare={handleShare}
        />
      )}
    </div>
  );
}
