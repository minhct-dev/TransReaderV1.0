import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bookmark, BookmarkCheck, ExternalLink, Volume2, X } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { lookupDictionary } from "../../services/tauriBridge";
import { errorMessage } from "./annotationUtils";
import type { DictionaryEntry } from "../../types/dictionary";

interface DictionaryPopoverProps {
  word: string;
  /** Viewport coordinates of the selected word. */
  x: number;
  y: number;
  /** False when the selection is not exactly one word. */
  singleWord: boolean;
  onClose: () => void;
}

type LookupState =
  | { status: "loading" }
  | { status: "ready"; entry: DictionaryEntry }
  | { status: "error"; message: string };

interface VocabWord {
  word: string;
  phonetic: string;
  definition: string;
  savedAt: string;
}

const VOCAB_KEY = "transreader.vocab";
const NOT_FOUND_MESSAGE = "Không tìm thấy từ này trong từ điển";
const MULTI_WORD_MESSAGE = "Hãy bôi đen một từ đơn để tra từ điển";

export default function DictionaryPopover({
  word,
  x,
  y,
  singleWord,
  onClose,
}: DictionaryPopoverProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<LookupState>(
    singleWord ? { status: "loading" } : { status: "error", message: MULTI_WORD_MESSAGE },
  );
  const [saved, setSaved] = useState(false);
  const [position, setPosition] = useState({ left: x, top: y + 14 });

  useEffect(() => {
    if (!singleWord) {
      setState({ status: "error", message: MULTI_WORD_MESSAGE });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    setSaved(false);

    lookupDictionary(word)
      .then((entries) => {
        if (cancelled) return;
        if (entries.length === 0) {
          setState({ status: "error", message: NOT_FOUND_MESSAGE });
          return;
        }
        setState({ status: "ready", entry: entries[0] });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ status: "error", message: errorMessage(error, NOT_FOUND_MESSAGE) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [singleWord, word]);

  useLayoutEffect(() => {
    const element = cardRef.current;
    if (!element) return;

    const { width, height } = element.getBoundingClientRect();
    const margin = 12;
    const below = y + 14;
    const above = y - height - 14;
    const fitsBelow = below + height + margin <= window.innerHeight;

    setPosition({
      left: Math.max(margin, Math.min(x, window.innerWidth - width - margin)),
      top: Math.max(
        margin,
        Math.min(fitsBelow ? below : above, window.innerHeight - height - margin),
      ),
    });
  }, [state.status, x, y]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-dictionary-popover]")) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const entry = state.status === "ready" ? state.entry : null;
  const phonetic = entry ? (entry.phonetic ?? firstPhoneticText(entry) ?? "") : "";
  const audioUrl = entry ? normalizeAudio(firstAudioUrl(entry)) : "";
  const meaning = entry?.meanings[0];
  const definition = meaning?.definitions[0];
  const sourceUrl = entry?.sourceUrls[0] ?? entry?.license?.url ?? "";

  const playPronunciation = useCallback(() => {
    if (!audioUrl) return;
    void new Audio(audioUrl).play().catch(() => undefined);
  }, [audioUrl]);

  const saveToVocab = useCallback(() => {
    if (!entry) return;
    setSaved(saveVocabEntry(entry));
  }, [entry]);

  return (
    <div
      ref={cardRef}
      data-dictionary-popover
      role="dialog"
      aria-label={`Từ điển: ${word}`}
      style={{ left: position.left, top: position.top }}
      className="fixed z-[1200] max-h-[calc(100vh-24px)] w-[340px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95"
    >
      <div className="flex items-start gap-2 border-b border-slate-200 px-4 pb-3 pt-3.5 dark:border-slate-800">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="truncate text-[17px] font-semibold leading-tight text-slate-900 dark:text-slate-100">
              {word}
            </h3>
            {phonetic && (
              <span className="truncate text-[12px] text-slate-500 dark:text-slate-400">
                {phonetic}
              </span>
            )}
          </div>
        </div>

        {audioUrl && (
          <button
            type="button"
            aria-label="Phát âm"
            title="Phát âm"
            onClick={playPronunciation}
            className="grid size-7 shrink-0 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <Volume2 size={15} />
          </button>
        )}

        <button
          type="button"
          aria-label="Đóng"
          onClick={onClose}
          className="grid size-7 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <X size={15} />
        </button>
      </div>

      {state.status === "loading" && <DictionarySkeleton />}

      {state.status === "error" && (
        <div className="px-4 py-5 text-center">
          <p className="text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300">
            {state.message}
          </p>
          <p className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">{word}</p>
        </div>
      )}

      {entry && (
        <div className="px-4 py-3.5">
          {meaning && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {meaning.partOfSpeech}
            </span>
          )}

          {definition ? (
            <>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                {definition.definition}
              </p>
              {definition.example && (
                <p className="mt-2 border-l-2 border-slate-200 pl-2.5 text-[12px] italic leading-relaxed text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  “{definition.example}”
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-[12.5px] text-slate-500 dark:text-slate-400">
              {NOT_FOUND_MESSAGE}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2.5 dark:border-slate-800">
        {sourceUrl ? (
          <button
            type="button"
            onClick={() => void openUrl(sourceUrl).catch(() => undefined)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <ExternalLink size={12} />
            Learn more
          </button>
        ) : (
          <span />
        )}

        <button
          type="button"
          disabled={!entry}
          onClick={saveToVocab}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          {saved ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
          {saved ? "Saved" : "Save to Vocab"}
        </button>
      </div>
    </div>
  );
}

function DictionarySkeleton() {
  return (
    <div role="status" aria-label="Đang tra từ" className="animate-pulse px-4 py-4">
      <div className="flex items-center gap-2">
        <div className="h-5 w-24 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-3 w-14 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-2.5 w-full rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-2.5 w-4/5 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}

function firstPhoneticText(entry: DictionaryEntry): string | undefined {
  return entry.phonetics.find((item) => item.text)?.text ?? undefined;
}

function firstAudioUrl(entry: DictionaryEntry): string {
  return entry.phonetics.find((item) => item.audio)?.audio ?? "";
}

function normalizeAudio(url: string): string {
  if (!url) return "";
  return url.startsWith("//") ? `https:${url}` : url;
}

function saveVocabEntry(entry: DictionaryEntry): boolean {
  const definition = entry.meanings[0]?.definitions[0]?.definition ?? "";
  const phonetic = entry.phonetic ?? firstPhoneticText(entry) ?? "";

  try {
    const raw = window.localStorage.getItem(VOCAB_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const words = Array.isArray(parsed) ? parsed.filter(isVocabWord) : [];
    const exists = words.some(
      (item) => item.word.toLowerCase() === entry.word.toLowerCase(),
    );
    if (exists) return true;

    const next: VocabWord[] = [
      ...words,
      { word: entry.word, phonetic, definition, savedAt: new Date().toISOString() },
    ];
    window.localStorage.setItem(VOCAB_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

function isVocabWord(value: unknown): value is VocabWord {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Record<keyof VocabWord, unknown>>;
  return (
    typeof item.word === "string" &&
    typeof item.phonetic === "string" &&
    typeof item.definition === "string" &&
    typeof item.savedAt === "string"
  );
}
