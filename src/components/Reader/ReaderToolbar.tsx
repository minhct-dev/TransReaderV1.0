import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Coffee,
  Minus,
  Moon,
  PanelLeft,
  Plus,
  Search,
  Sun,
  X,
} from "lucide-react";
import { READER_PALETTES } from "./readerTheme";
import type { ReaderTheme } from "./readerTheme";

interface ReaderToolbarProps {
  title: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  theme: ReaderTheme;
  onThemeChange: (theme: ReaderTheme) => void;
  /** Returns false when nothing in the book matches. */
  onSearch: (query: string) => boolean;
  onClose: () => void;
}

type Panel = "text" | "search" | null;

const THEME_OPTIONS: { id: ReaderTheme; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "sepia", label: "Sepia", icon: Coffee },
  { id: "dark", label: "Dark", icon: Moon },
];

const MIN_FONT = 14;
const MAX_FONT = 28;

export default function ReaderToolbar({
  title,
  isSidebarOpen,
  onToggleSidebar,
  fontSize,
  onFontSizeChange,
  theme,
  onThemeChange,
  onSearch,
  onClose,
}: ReaderToolbarProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [query, setQuery] = useState("");
  const [noMatch, setNoMatch] = useState(false);
  const clusterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panel) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!clusterRef.current?.contains(event.target as Node)) setPanel(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [panel]);

  const togglePanel = (next: Exclude<Panel, null>) => {
    setPanel((current) => (current === next ? null : next));
    setNoMatch(false);
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (onSearch(query)) {
      setPanel(null);
      setQuery("");
      setNoMatch(false);
    } else {
      setNoMatch(true);
    }
  };

  return (
    <header className="relative z-20 flex h-12 shrink-0 items-center gap-2 border-b border-[var(--r-border)] bg-[var(--r-surface)] px-2">
      <div ref={clusterRef} className="relative flex items-center gap-0.5">
        <ToolbarButton
          label="Toggle page list"
          active={isSidebarOpen}
          onClick={onToggleSidebar}
        >
          <PanelLeft size={16} />
        </ToolbarButton>

        <ToolbarButton label="Search" active={panel === "search"} onClick={() => togglePanel("search")}>
          <Search size={16} />
        </ToolbarButton>

        <ToolbarButton
          label="Bookmark this page"
          active={bookmarked}
          onClick={() => {
            setBookmarked((value) => !value);
            console.log("Bookmark", bookmarked ? "removed" : "added");
          }}
        >
          <Bookmark size={16} className={bookmarked ? "fill-current" : undefined} />
        </ToolbarButton>

        <ToolbarButton label="Text and theme" active={panel === "text"} onClick={() => togglePanel("text")}>
          <span className="text-[13px] font-semibold leading-none">Aa</span>
        </ToolbarButton>

        {panel === "text" && (
          <div className="absolute left-0 top-[calc(100%+8px)] w-[232px] rounded-xl border border-[var(--r-border)] bg-[var(--r-surface)] p-3 shadow-xl">
            <PanelLabel>Text size</PanelLabel>
            <div className="mb-3 flex items-center justify-between rounded-lg border border-[var(--r-border)] px-1 py-0.5">
              <button
                type="button"
                aria-label="Smaller text"
                onClick={() => onFontSizeChange(Math.max(MIN_FONT, fontSize - 1))}
                className="grid size-7 place-items-center rounded text-[var(--r-ink)] transition-colors hover:bg-[var(--r-tint)]"
              >
                <Minus size={14} />
              </button>
              <span className="text-[13px] font-medium tabular-nums text-[var(--r-ink)]">
                {fontSize}px
              </span>
              <button
                type="button"
                aria-label="Larger text"
                onClick={() => onFontSizeChange(Math.min(MAX_FONT, fontSize + 1))}
                className="grid size-7 place-items-center rounded text-[var(--r-ink)] transition-colors hover:bg-[var(--r-tint)]"
              >
                <Plus size={14} />
              </button>
            </div>

            <PanelLabel>Theme</PanelLabel>
            <div className="grid grid-cols-3 gap-1.5">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = option.id === theme;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onThemeChange(option.id)}
                    aria-pressed={isActive}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2 text-[10px] font-medium transition-colors ${
                      isActive
                        ? "border-blue-500 text-[var(--r-ink)]"
                        : "border-[var(--r-border)] text-[var(--r-muted)] hover:text-[var(--r-ink)]"
                    }`}
                  >
                    <span
                      className="grid size-6 place-items-center rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: READER_PALETTES[option.id].page }}
                    >
                      <Icon size={13} className="text-[var(--r-ink)]" />
                    </span>
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {panel === "search" && (
          <form
            onSubmit={handleSearchSubmit}
            className="absolute left-0 top-[calc(100%+8px)] w-[248px] rounded-xl border border-[var(--r-border)] bg-[var(--r-surface)] p-2 shadow-xl"
          >
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setNoMatch(false);
              }}
              placeholder="Search in this book"
              aria-label="Search in this book"
              className="w-full rounded-lg border border-[var(--r-border)] bg-transparent px-2.5 py-1.5 text-[12px] text-[var(--r-ink)] outline-none placeholder:text-[var(--r-muted)] focus:border-blue-400"
            />
            <p className="mt-1.5 px-1 text-[10px] text-[var(--r-muted)]">
              {noMatch ? "No page contains that text." : "Press Enter to jump to the first match."}
            </p>
          </form>
        )}
      </div>

      <h1
        className="pointer-events-none absolute left-1/2 max-w-[46%] -translate-x-1/2 truncate text-[12px] font-medium tracking-wide text-[var(--r-muted)]"
        title={title}
      >
        {title}
      </h1>

      <div className="ml-auto">
        <ToolbarButton label="Close reader" onClick={onClose}>
          <X size={17} />
        </ToolbarButton>
      </div>
    </header>
  );
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-md transition-colors ${
        active
          ? "bg-[var(--r-tint)] text-[var(--r-ink)]"
          : "text-[var(--r-muted)] hover:bg-[var(--r-tint)] hover:text-[var(--r-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--r-muted)]">
      {children}
    </p>
  );
}
