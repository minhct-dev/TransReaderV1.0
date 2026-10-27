import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { X } from "lucide-react";
import ReaderToolbar from "./ReaderToolbar";
import ReaderSidebar from "./ReaderSidebar";
import SelectionPopover from "./SelectionPopover";
import AnnotationOverlay from "./AnnotationOverlay";
import AnnotationPopover from "./AnnotationPopover";
import NoteComposer from "./NoteComposer";
import { READER_PAGES } from "./readerContent";
import { READER_PALETTES } from "./readerTheme";
import type { ReaderTheme } from "./readerTheme";
import { DEFAULT_ZOOM, ZOOM_STEP, clampZoom } from "./readerZoom";
import {
  DEFAULT_HIGHLIGHT_COLOR,
  createAnnotationId,
  errorMessage,
  rectsFromRange,
  serializeRects,
  sortAnnotations,
} from "./annotationUtils";
import type { AnnotationRect, BookAnnotation } from "../../types/annotation";
import {
  addAnnotation,
  deleteAnnotation,
  getAnnotationsByBook,
  updateAnnotationNote,
} from "../../services/tauriBridge";
import type { Book } from "../../types/book";

interface ReaderCanvasProps {
  book: Book;
  onClose: () => void;
}

interface SelectionMenu {
  pageNumber: number;
  text: string;
  rects: AnnotationRect[];
  x: number;
  y: number;
}

interface NoteDraft {
  selection: SelectionMenu;
  color: string;
}

interface ActiveAnnotation {
  annotation: BookAnnotation;
  x: number;
  y: number;
}

const EMPTY_ANNOTATIONS: BookAnnotation[] = [];

export default function ReaderCanvas({ book, onClose }: ReaderCanvasProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenu | null>(null);
  const [fontSize, setFontSize] = useState(19);
  const [theme, setTheme] = useState<ReaderTheme>("light");
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [annotations, setAnnotations] = useState<BookAnnotation[]>([]);
  const [annotationsLoading, setAnnotationsLoading] = useState(true);
  const [activeAnnotation, setActiveAnnotation] = useState<ActiveAnnotation | null>(null);
  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null);
  const [focusedAnnotationId, setFocusedAnnotationId] = useState<string | null>(null);
  const [annotationError, setAnnotationError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLElement | null)[]>([]);
  const focusTimerRef = useRef<number | null>(null);

  const totalPages = READER_PAGES.length;
  const percent = Math.round((currentPage / totalPages) * 100);
  const sortedAnnotations = useMemo(() => sortAnnotations(annotations), [annotations]);
  const annotationsByPage = useMemo(() => {
    const grouped = new Map<number, BookAnnotation[]>();
    for (const annotation of sortedAnnotations) {
      const list = grouped.get(annotation.pageNumber);
      if (list) list.push(annotation);
      else grouped.set(annotation.pageNumber, [annotation]);
    }
    return grouped;
  }, [sortedAnnotations]);

  useEffect(() => {
    let cancelled = false;
    setAnnotations([]);
    setAnnotationsLoading(true);
    setActiveAnnotation(null);
    setNoteDraft(null);

    getAnnotationsByBook(book.id)
      .then((loaded) => {
        if (!cancelled) setAnnotations(loaded);
      })
      .catch((error) => {
        if (!cancelled) {
          setAnnotationError(errorMessage(error, "Could not load highlights."));
        }
      })
      .finally(() => {
        if (!cancelled) setAnnotationsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [book.id]);

  useEffect(() => {
    if (!annotationError) return;
    const timeout = window.setTimeout(() => setAnnotationError(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [annotationError]);

  useEffect(() => {
    return () => {
      if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);
    };
  }, []);

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

  const closeSelectionMenu = useCallback(() => setSelectionMenu(null), []);
  const closeAnnotationPopover = useCallback(() => setActiveAnnotation(null), []);
  const cancelNoteDraft = useCallback(() => setNoteDraft(null), []);

  const flashAnnotation = useCallback((id: string) => {
    setFocusedAnnotationId(id);
    if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);
    focusTimerRef.current = window.setTimeout(() => {
      setFocusedAnnotationId(null);
      focusTimerRef.current = null;
    }, 1600);
  }, []);

  useEffect(() => {
    if (!selectionMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-selection-popover]")) {
        return;
      }
      closeSelectionMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSelectionMenu();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    scrollRef.current?.addEventListener("scroll", closeSelectionMenu);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      scrollRef.current?.removeEventListener("scroll", closeSelectionMenu);
    };
  }, [selectionMenu, closeSelectionMenu]);

  const scrollToPage = useCallback((page: number) => {
    const root = scrollRef.current;
    const target = pageRefs.current[page - 1];
    if (!root || !target) return;

    const top =
      target.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 16;
    root.scrollTo({ top, behavior: "smooth" });
  }, []);

  const scrollToAnnotation = useCallback(
    (annotation: BookAnnotation) => {
      closeAnnotationPopover();
      flashAnnotation(annotation.id);

      const root = scrollRef.current;
      const target = root?.querySelector<HTMLElement>(
        `[data-annotation-id="${CSS.escape(annotation.id)}"]`,
      );

      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      } else {
        scrollToPage(annotation.pageNumber);
      }
    },
    [closeAnnotationPopover, flashAnnotation, scrollToPage],
  );

  const handleZoomOut = useCallback(() => {
    setZoom((current) => clampZoom(current - ZOOM_STEP));
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((current) => clampZoom(current + ZOOM_STEP));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
  }, []);

  // React's onWheel is passive, so a native listener is required to stop the
  // WebView's own zoom while keeping normal scrolling intact.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.deltaY === 0) return;
      event.preventDefault();
      setZoom((current) =>
        clampZoom(current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)),
      );
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, []);

  // Zoom and font size reflow the page column: re-measure the reading line and
  // drop any popover pinned to the old text position.
  useEffect(() => {
    closeSelectionMenu();
    setActiveAnnotation(null);
    updateCurrentPage();
  }, [zoom, fontSize, closeSelectionMenu, updateCurrentPage]);

  const captureSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text) return;

    const range = selection.getRangeAt(0);
    const startNode = range.startContainer;
    const startElement =
      startNode instanceof Element ? startNode : startNode.parentElement;
    const content = startElement?.closest<HTMLElement>("[data-annotation-content]");
    if (!content) return;

    const pageElement = content.closest<HTMLElement>("[data-page]");
    const pageNumber = Number(pageElement?.dataset.page);
    if (!Number.isFinite(pageNumber)) return;

    const rects = rectsFromRange(range, content);
    if (rects.length === 0) return;

    const firstRect = range.getClientRects()[0] ?? range.getBoundingClientRect();
    setSelectionMenu({
      pageNumber,
      text,
      rects,
      x: firstRect.left,
      y: firstRect.top,
    });
    setActiveAnnotation(null);
  }, []);

  const createAnnotation = useCallback(
    async (selection: SelectionMenu, color: string, noteText: string | null) => {
      const now = new Date().toISOString();
      const annotation: BookAnnotation = {
        id: createAnnotationId(),
        bookId: book.id,
        pageNumber: selection.pageNumber,
        selectedText: selection.text,
        color,
        noteText,
        rectsJson: serializeRects(selection.rects),
        createdAt: now,
        updatedAt: now,
      };

      await addAnnotation(annotation);
      setAnnotations((current) => [...current, annotation]);
      return annotation;
    },
    [book.id],
  );

  const handleHighlight = async (color: string) => {
    if (!selectionMenu) return;
    const selection = selectionMenu;
    setSelectionMenu(null);
    window.getSelection()?.removeAllRanges();

    try {
      const annotation = await createAnnotation(selection, color, null);
      flashAnnotation(annotation.id);
    } catch (error) {
      setAnnotationError(errorMessage(error, "Could not save the highlight."));
    }
  };

  const handleAddNote = () => {
    if (!selectionMenu) return;
    setNoteDraft({ selection: selectionMenu, color: DEFAULT_HIGHLIGHT_COLOR });
    setSelectionMenu(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleSaveNoteDraft = async (noteText: string) => {
    if (!noteDraft) return;
    const annotation = await createAnnotation(noteDraft.selection, noteDraft.color, noteText);
    setNoteDraft(null);
    flashAnnotation(annotation.id);
  };

  const handleOpenAnnotation = useCallback(
    (annotation: BookAnnotation, x: number, y: number) => {
      setActiveAnnotation({ annotation, x, y });
      setSelectionMenu(null);
    },
    [],
  );

  const handleUpdateNote = async (noteText: string | null) => {
    if (!activeAnnotation) return;
    const id = activeAnnotation.annotation.id;
    await updateAnnotationNote(id, noteText);

    const updatedAt = new Date().toISOString();
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === id ? { ...annotation, noteText, updatedAt } : annotation,
      ),
    );
    setActiveAnnotation((current) =>
      current && current.annotation.id === id
        ? { ...current, annotation: { ...current.annotation, noteText, updatedAt } }
        : current,
    );
    flashAnnotation(id);
  };

  const handleDeleteAnnotation = async () => {
    if (!activeAnnotation) return;
    const id = activeAnnotation.annotation.id;
    await deleteAnnotation(id);

    setAnnotations((current) => current.filter((annotation) => annotation.id !== id));
    setActiveAnnotation(null);
    setFocusedAnnotationId((current) => (current === id ? null : current));
    if (focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
  };

  const handleSearch = (query: string) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return false;

    const match = READER_PAGES.find((page) =>
      page.paragraphs.join(" ").toLowerCase().includes(needle),
    );
    if (!match) return false;

    scrollToPage(match.page);
    return true;
  };

  const handleDictionary = () => {
    console.log("Dictionary", selectionMenu?.text);
    closeSelectionMenu();
  };

  const handleShare = () => {
    console.log("Share", selectionMenu?.text);
    closeSelectionMenu();
  };

  const palette = READER_PALETTES[theme];
  const zoomScale = zoom / 100;
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
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onSearch={handleSearch}
        onClose={onClose}
      />

      <div className="flex min-h-0 flex-1">
        {isSidebarOpen && (
          <ReaderSidebar
            currentPage={currentPage}
            onSelectPage={scrollToPage}
            onClose={() => setIsSidebarOpen(false)}
            annotations={sortedAnnotations}
            annotationsLoading={annotationsLoading}
            onSelectAnnotation={scrollToAnnotation}
          />
        )}

        <main
          ref={scrollRef}
          onScroll={updateCurrentPage}
          onMouseUp={captureSelection}
          className="min-w-0 flex-1 overflow-y-auto"
        >
          {/* The layer is narrowed as it scales so the page keeps the viewport
              width and only grows vertically, leaving the scrollbar accurate. */}
          <div
            className="mx-auto"
            style={{
              width: `${100 / zoomScale}%`,
              transform: `scale(${zoomScale})`,
              transformOrigin: "top center",
            }}
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

                  <div className="relative" data-annotation-content>
                    <div
                      className="space-y-5 text-justify font-serif leading-relaxed hyphens-auto"
                      style={{ fontSize }}
                    >
                      {page.paragraphs.map((paragraph) => (
                        <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                      ))}
                    </div>

                    <AnnotationOverlay
                      annotations={annotationsByPage.get(page.page) ?? EMPTY_ANNOTATIONS}
                      focusedId={focusedAnnotationId}
                      layoutKey={`${zoom}:${fontSize}`}
                      pending={
                        noteDraft && noteDraft.selection.pageNumber === page.page
                          ? {
                              text: noteDraft.selection.text,
                              rects: noteDraft.selection.rects,
                              color: noteDraft.color,
                            }
                          : null
                      }
                      onOpen={handleOpenAnnotation}
                    />
                  </div>
                </article>
              ))}
            </div>
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

      {selectionMenu && (
        <SelectionPopover
          x={selectionMenu.x}
          y={selectionMenu.y}
          onHighlight={handleHighlight}
          onAddNote={handleAddNote}
          onDictionary={handleDictionary}
          onShare={handleShare}
        />
      )}

      {noteDraft && (
        <NoteComposer
          x={noteDraft.selection.x}
          y={noteDraft.selection.y}
          selectedText={noteDraft.selection.text}
          color={noteDraft.color}
          onColorChange={(color) =>
            setNoteDraft((current) => (current ? { ...current, color } : current))
          }
          onSave={handleSaveNoteDraft}
          onCancel={cancelNoteDraft}
        />
      )}

      {activeAnnotation && (
        <AnnotationPopover
          key={activeAnnotation.annotation.id}
          annotation={activeAnnotation.annotation}
          x={activeAnnotation.x}
          y={activeAnnotation.y}
          onClose={closeAnnotationPopover}
          onSaveNote={handleUpdateNote}
          onDelete={handleDeleteAnnotation}
        />
      )}

      {annotationError && (
        <div
          role="alert"
          style={{ maxWidth: "min(420px, calc(100vw - 32px))" }}
          className="fixed bottom-6 left-1/2 z-[1300] flex w-max -translate-x-1/2 items-start gap-2 rounded-lg bg-red-600 px-3 py-2 text-[11.5px] text-white shadow-xl"
        >
          <span className="min-w-0 flex-1">{annotationError}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setAnnotationError(null)}
            className="grid size-4 shrink-0 place-items-center rounded text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
