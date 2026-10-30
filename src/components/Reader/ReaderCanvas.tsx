import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowLeft, FileWarning, Loader2, X } from "lucide-react";
import { Document, Page } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { convertFileSrc } from "@tauri-apps/api/core";
import ReaderToolbar from "./ReaderToolbar";
import ReaderSidebar from "./ReaderSidebar";
import SelectionPopover from "./SelectionPopover";
import AnnotationOverlay from "./AnnotationOverlay";
import AnnotationPopover from "./AnnotationPopover";
import NoteComposer from "./NoteComposer";
import DictionaryPopover from "./DictionaryPopover";
import TranslationPopover from "./TranslationPopover";
import { useTextSelection } from "./useTextSelection";
import type { TextSelection } from "./useTextSelection";
import { loadOutline } from "./readerOutline";
import type { TocEntry } from "./readerOutline";
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
  resolveBookPath,
  updateAnnotationNote,
} from "../../services/tauriBridge";
import type { Book } from "../../types/book";
import "./pdfSetup";

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
  isSingleWord: boolean;
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

interface DictionaryTarget {
  word: string;
  x: number;
  y: number;
  singleWord: boolean;
}

const EMPTY_ANNOTATIONS: BookAnnotation[] = [];

/** Used until page 1 has been measured, and for documents that hide its size. */
const FALLBACK_PAGE_SIZE = { width: 595, height: 842 };

/** Pages either side of the current one that hold a live canvas. */
const RENDER_WINDOW = 2;

/** Horizontal breathing room around the page column, in CSS pixels. */
const COLUMN_GUTTER = 48;

export default function ReaderCanvas({ book, onClose }: ReaderCanvasProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenu | null>(null);
  const [theme, setTheme] = useState<ReaderTheme>("light");
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [annotations, setAnnotations] = useState<BookAnnotation[]>([]);
  const [annotationsLoading, setAnnotationsLoading] = useState(true);
  const [activeAnnotation, setActiveAnnotation] = useState<ActiveAnnotation | null>(null);
  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null);
  const [dictionaryTarget, setDictionaryTarget] = useState<DictionaryTarget | null>(null);
  const [translationTarget, setTranslationTarget] = useState<SelectionMenu | null>(null);
  const [focusedAnnotationId, setFocusedAnnotationId] = useState<string | null>(null);
  const [annotationError, setAnnotationError] = useState<string | null>(null);

  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageSize, setPageSize] = useState(FALLBACK_PAGE_SIZE);
  const [outline, setOutline] = useState<TocEntry[]>([]);
  const [outlineLoading, setOutlineLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLElement | null)[]>([]);
  const focusTimerRef = useRef<number | null>(null);
  const zoomTouchedRef = useRef(false);
  const textCacheRef = useRef(new Map<number, string>());
  const searchTokenRef = useRef(0);

  const totalPages = numPages;
  const percent = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
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

  const pageNumbers = useMemo(
    () => Array.from({ length: numPages }, (_, index) => index + 1),
    [numPages],
  );

  const zoomScale = zoom / 100;
  const pageWidth = Math.round(pageSize.width * zoomScale);
  const pageHeight = Math.round(pageSize.height * zoomScale);
  const pageAspect = pageSize.width / pageSize.height;

  // Ask Rust for the real path, then hand the webview an asset URL it may load.
  useEffect(() => {
    let cancelled = false;

    setAssetUrl(null);
    setUnavailable(null);
    setPdf(null);
    setNumPages(0);
    setOutline([]);
    setOutlineLoading(true);
    setCurrentPage(1);
    setActiveAnnotation(null);
    setNoteDraft(null);
    setSelectionMenu(null);
    setDictionaryTarget(null);
    setTranslationTarget(null);
    textCacheRef.current.clear();
    zoomTouchedRef.current = false;

    if (book.format !== "PDF") {
      setUnavailable(
        `${book.format} files cannot be read yet. Only PDF books open in the reader.`,
      );
      setOutlineLoading(false);
      return;
    }

    resolveBookPath(book.id)
      .then((path) => {
        if (!cancelled) setAssetUrl(convertFileSrc(path));
      })
      .catch((error) => {
        if (cancelled) return;
        setUnavailable(errorMessage(error, "This book's file could not be found."));
        setOutlineLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [book.id, book.format]);

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

  useEffect(() => {
    if (!dictionaryTarget) return;

    const element = scrollRef.current;
    if (!element) return;

    const closeDictionary = () => setDictionaryTarget(null);
    element.addEventListener("scroll", closeDictionary);

    return () => element.removeEventListener("scroll", closeDictionary);
  }, [dictionaryTarget]);

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
    zoomTouchedRef.current = true;
    setZoom((current) => clampZoom(current - ZOOM_STEP));
  }, []);

  const handleZoomIn = useCallback(() => {
    zoomTouchedRef.current = true;
    setZoom((current) => clampZoom(current + ZOOM_STEP));
  }, []);

  const handleZoomReset = useCallback(() => {
    zoomTouchedRef.current = true;
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
      zoomTouchedRef.current = true;
      setZoom((current) =>
        clampZoom(current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)),
      );
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, []);

  // Zoom reflows the page column: re-measure the reading line and drop any
  // popover pinned to the old text position.
  useEffect(() => {
    closeSelectionMenu();
    setActiveAnnotation(null);
    setDictionaryTarget(null);
    updateCurrentPage();
  }, [zoom, closeSelectionMenu, updateCurrentPage]);

  const handleDocumentLoad = useCallback((loaded: PDFDocumentProxy) => {
    setPdf(loaded);
    setNumPages(loaded.numPages);
    setUnavailable(null);

    loaded
      .getPage(1)
      .then((page) => {
        const viewport = page.getViewport({ scale: 1 });
        setPageSize({ width: viewport.width, height: viewport.height });
      })
      .catch(() => setPageSize(FALLBACK_PAGE_SIZE));

    loadOutline(loaded)
      .then(setOutline)
      .catch(() => setOutline([]))
      .finally(() => setOutlineLoading(false));
  }, []);

  // Open at fit-width so a portrait page never starts out cropped; the zoom
  // controls still speak in absolute percentages from here on. The browser has
  // laid the page column out by the time this effect runs, so the measurement
  // is already final.
  useEffect(() => {
    if (numPages === 0 || zoomTouchedRef.current) return;

    const root = scrollRef.current;
    if (!root) return;

    const available = root.clientWidth - COLUMN_GUTTER;
    if (available > 0) {
      setZoom(clampZoom(Math.round((available / pageSize.width) * 100)));
    }
  }, [pageSize, numPages]);

  const handleTextSelected = useCallback((selection: TextSelection, range: Range) => {
    const startNode = range.startContainer;
    const startElement = startNode instanceof Element ? startNode : startNode.parentElement;
    const content = startElement?.closest<HTMLElement>("[data-annotation-content]");
    if (!content) return;

    const pageElement = content.closest<HTMLElement>("[data-page]");
    const pageNumber = Number(pageElement?.dataset.page);
    if (!Number.isFinite(pageNumber)) return;

    const rects = rectsFromRange(range, content);
    if (rects.length === 0) return;

    setSelectionMenu({
      pageNumber,
      text: selection.text,
      rects,
      x: selection.x,
      y: selection.y,
      isSingleWord: selection.isSingleWord,
    });
    setActiveAnnotation(null);
    setTranslationTarget(null);
  }, []);

  useTextSelection({
    containerRef: scrollRef,
    onSelect: handleTextSelected,
    onClear: closeSelectionMenu,
  });

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

  // Search reads each page's text once and remembers it, so a second search in
  // the same book is instant. `searchTokenRef` drops a run the user abandoned.
  const handleSearch = useCallback(
    async (query: string) => {
      const needle = query.trim().toLowerCase();
      if (!needle || !pdf) return false;

      const token = searchTokenRef.current + 1;
      searchTokenRef.current = token;

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        let text = textCacheRef.current.get(pageNumber);
        if (text === undefined) {
          try {
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            text = content.items
              .map((item) => ("str" in item ? item.str : " "))
              .join(" ")
              .toLowerCase();
          } catch {
            text = "";
          }
          textCacheRef.current.set(pageNumber, text);
        }

        if (token !== searchTokenRef.current) return false;

        if (text.includes(needle)) {
          scrollToPage(pageNumber);
          return true;
        }
      }

      return false;
    },
    [pdf, scrollToPage],
  );

  const handleTranslate = () => {
    if (!selectionMenu) return;
    setTranslationTarget(selectionMenu);
    closeSelectionMenu();
    window.getSelection()?.removeAllRanges();
  };

  const handleDictionary = () => {
    if (!selectionMenu) return;

    setDictionaryTarget({
      word: selectionMenu.text,
      x: selectionMenu.x,
      y: selectionMenu.y,
      singleWord: selectionMenu.isSingleWord,
    });
    closeSelectionMenu();
    window.getSelection()?.removeAllRanges();
  };

  const handleShare = () => {
    console.log("Share", selectionMenu?.text);
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
      data-reader-theme={theme}
      className="fixed inset-0 z-[200] flex flex-col bg-[var(--r-bg)] text-[var(--r-ink)]"
    >
      <ReaderToolbar
        title={book.title}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
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
            pdf={pdf}
            numPages={numPages}
            pageAspect={pageAspect}
            outline={outline}
            outlineLoading={outlineLoading}
          />
        )}

        <main
          ref={scrollRef}
          onScroll={updateCurrentPage}
          className="min-w-0 flex-1 overflow-auto"
        >
          {unavailable ? (
            <UnavailableBook message={unavailable} title={book.title} onBack={onClose} />
          ) : !assetUrl ? (
            <Busy label="Finding the file…" />
          ) : (
            <Document
              key={assetUrl}
              file={assetUrl}
              suspense={false}
              onLoadSuccess={handleDocumentLoad}
              onLoadError={(error) =>
                setUnavailable(errorMessage(error, "The PDF could not be read."))
              }
              loading={<Busy label={`Opening “${book.title}”…`} />}
              error={
                <UnavailableBook
                  message="The PDF is damaged, password protected, or not really a PDF."
                  title={book.title}
                  onBack={onClose}
                />
              }
              className="mx-auto flex w-max flex-col items-center gap-6 px-6 py-8"
            >
              {pageNumbers.map((pageNumber) => {
                const isRendered =
                  Boolean(pdf) && Math.abs(pageNumber - currentPage) <= RENDER_WINDOW;

                return (
                  <article
                    key={pageNumber}
                    data-page={pageNumber}
                    ref={(element) => {
                      pageRefs.current[pageNumber - 1] = element;
                    }}
                    style={{ width: pageWidth, minHeight: pageHeight }}
                    className="relative shrink-0 rounded-sm bg-[var(--r-page)] shadow-[0_1px_4px_rgba(0,0,0,0.14)]"
                  >
                    {isRendered && pdf ? (
                      <div data-annotation-content className="relative">
                        <Page
                          pdf={pdf}
                          pageNumber={pageNumber}
                          scale={zoomScale}
                          renderTextLayer
                          renderAnnotationLayer
                          loading={
                            <div
                              style={{ width: pageWidth, height: pageHeight }}
                              className="grid place-items-center bg-[var(--r-page)]"
                            >
                              <Loader2
                                size={18}
                                className="animate-spin text-[var(--r-muted)]"
                              />
                            </div>
                          }
                          error={
                            <div
                              style={{ width: pageWidth, minHeight: 160 }}
                              className="grid place-items-center px-6 py-10 text-center text-[11.5px] text-[var(--r-muted)]"
                            >
                              Page {pageNumber} could not be drawn.
                            </div>
                          }
                        />

                        <AnnotationOverlay
                          annotations={
                            annotationsByPage.get(pageNumber) ?? EMPTY_ANNOTATIONS
                          }
                          focusedId={focusedAnnotationId}
                          layoutKey={`${zoom}:${pageWidth}`}
                          pending={
                            noteDraft && noteDraft.selection.pageNumber === pageNumber
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
                    ) : (
                      <div
                        style={{ height: pageHeight }}
                        className="grid place-items-center bg-[var(--r-page)]"
                      >
                        <span className="text-[11px] tabular-nums text-[var(--r-muted)] opacity-60">
                          {pageNumber}
                        </span>
                      </div>
                    )}
                  </article>
                );
              })}
            </Document>
          )}
        </main>
      </div>

      <footer className="shrink-0 border-t border-[var(--r-border)] bg-[var(--r-surface)] px-4 pb-2 pt-1.5">
        <p className="text-center text-[11px] tracking-wide text-[var(--r-muted)]">
          {totalPages > 0
            ? `Page ${currentPage} of ${totalPages} ( ${percent}% )`
            : "Preparing pages…"}
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
          onTranslate={handleTranslate}
          onShare={handleShare}
        />
      )}

      {dictionaryTarget && (
        <DictionaryPopover
          key={`${dictionaryTarget.word}:${dictionaryTarget.x}:${dictionaryTarget.y}`}
          word={dictionaryTarget.word}
          x={dictionaryTarget.x}
          y={dictionaryTarget.y}
          singleWord={dictionaryTarget.singleWord}
          onClose={() => setDictionaryTarget(null)}
        />
      )}

      {translationTarget && (
        <TranslationPopover
          key={`${translationTarget.text}:${translationTarget.x}:${translationTarget.y}`}
          text={translationTarget.text}
          x={translationTarget.x}
          y={translationTarget.y}
          onClose={() => setTranslationTarget(null)}
          onSave={(translatedText) => {
            window.localStorage.setItem(
              "transreader.translation_notes",
              JSON.stringify({ originalText: translationTarget.text, translatedText, savedAt: new Date().toISOString() }),
            );
          }}
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

function Busy({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-8 py-28 text-[var(--r-muted)]">
      <Loader2 size={22} className="animate-spin" />
      <p className="text-[12px]">{label}</p>
    </div>
  );
}

function UnavailableBook({
  message,
  title,
  onBack,
}: {
  message: string;
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-8 py-24 text-center">
      <FileWarning size={30} className="text-red-500" />
      <h2 className="text-[14px] font-medium text-[var(--r-ink)]">
        This book cannot be opened
      </h2>
      <p className="text-[11.5px] leading-relaxed text-[var(--r-muted)]">
        <span className="font-medium text-[var(--r-ink)]">“{title}”</span> — {message}
      </p>
      <button
        type="button"
        onClick={onBack}
        className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-[var(--r-border)] px-3 py-1.5 text-[11.5px] text-[var(--r-ink)] transition-colors hover:bg-[var(--r-tint)]"
      >
        <ArrowLeft size={13} />
        Back to library
      </button>
    </div>
  );
}
