import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Copy, FileText, X } from "lucide-react";
import { translateText } from "../../services/tauriBridge";
import { errorMessage } from "./annotationUtils";

export type TargetLanguage = "vi" | "en" | "zh" | "ja";

interface TranslationPopoverProps {
  text: string;
  x: number;
  y: number;
  onClose: () => void;
  onSave: (text: string) => void;
}

const LANGUAGES: Array<{ code: TargetLanguage; label: string }> = [
  { code: "vi", label: "VI" },
  { code: "en", label: "EN" },
  { code: "zh", label: "中" },
  { code: "ja", label: "日" },
];
const TARGET_KEY = "transreader_target_lang";

export default function TranslationPopover({ text, x, y, onClose, onSave }: TranslationPopoverProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [language, setLanguage] = useState<TargetLanguage>(() => {
    const stored = window.localStorage.getItem(TARGET_KEY);
    return LANGUAGES.some((item) => item.code === stored) ? (stored as TargetLanguage) : "vi";
  });
  const [translated, setTranslated] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState({ left: x, top: y + 14 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(TARGET_KEY, language);
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTranslated("");
    translateText(text, language)
      .then((result) => { if (!cancelled) setTranslated(result.translatedText); })
      .catch((reason) => { if (!cancelled) setError(errorMessage(reason, "Translation is unavailable right now.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [text, language]);

  useLayoutEffect(() => {
    const element = cardRef.current;
    if (!element) return;
    const { width, height } = element.getBoundingClientRect();
    const margin = 12;
    const below = y + 14;
    const above = y - height - 14;
    const top = below + height + margin <= window.innerHeight ? below : above;
    setPosition({
      left: Math.max(margin, Math.min(x, window.innerWidth - width - margin)),
      top: Math.max(margin, Math.min(top, window.innerHeight - height - margin)),
    });
  }, [x, y, loading, error, translated]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-translation-popover]")) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("mousedown", handlePointerDown); document.removeEventListener("keydown", handleKeyDown); };
  }, [onClose]);

  const copy = async () => {
    if (!translated) return;
    await navigator.clipboard.writeText(translated);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div ref={cardRef} data-translation-popover role="dialog" aria-label="Translation" style={{ left: position.left, top: position.top }} className="fixed z-[1200] w-[380px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-slate-200 bg-white/95 text-slate-900 shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100" onMouseDown={(event) => event.stopPropagation()}>
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Translation</span>
        <div className="ml-auto flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800" role="tablist" aria-label="Target language">
          {LANGUAGES.map((item) => <button key={item.code} type="button" role="tab" aria-selected={language === item.code} onClick={() => setLanguage(item.code)} className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${language === item.code ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}>{item.label}</button>)}
        </div>
        <button type="button" aria-label="Close translation" onClick={onClose} className="grid size-7 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"><X size={15} /></button>
      </header>
      <div className="space-y-3 px-4 py-3">
        <p className="max-h-20 overflow-y-auto text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">{text}</p>
        <div className="border-t border-slate-200 dark:border-slate-800" />
        {loading ? <div className="space-y-2 py-1" aria-label="Loading translation"><div className="h-3 w-11/12 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /><div className="h-3 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /><div className="h-3 w-2/5 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /></div> : error ? <p role="alert" className="text-[12px] leading-relaxed text-rose-600 dark:text-rose-400">{error}</p> : <p className="max-h-32 overflow-y-auto text-[15px] leading-relaxed text-slate-900 dark:text-slate-100">{translated}</p>}
      </div>
      <footer className="flex items-center justify-end gap-1 border-t border-slate-200 px-3 py-2 dark:border-slate-800">
        <button type="button" disabled={!translated} onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy translation"}</button>
        <button type="button" disabled={!translated} onClick={() => onSave(translated)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-slate-700 disabled:opacity-40 dark:bg-white dark:text-slate-900"><FileText size={13} />Save to Notes</button>
      </footer>
    </div>
  );
}
