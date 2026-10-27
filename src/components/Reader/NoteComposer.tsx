import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Check, X } from "lucide-react";
import { HIGHLIGHT_COLORS, errorMessage } from "./annotationUtils";

interface NoteComposerProps {
  x: number;
  y: number;
  selectedText: string;
  color: string;
  onColorChange: (color: string) => void;
  onSave: (noteText: string) => Promise<void>;
  onCancel: () => void;
}

export default function NoteComposer({
  x,
  y,
  selectedText,
  color,
  onColorChange,
  onSave,
  onCancel,
}: NoteComposerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const element = formRef.current;
    if (!element) return;

    const { width, height } = element.getBoundingClientRect();
    const margin = 10;
    const left = Math.max(margin, Math.min(x - width / 2, window.innerWidth - width - margin));
    const below = y + 14;
    const top =
      below + height > window.innerHeight - margin
        ? Math.max(margin, y - height - 14)
        : below;

    setPosition({ left, top });
  }, [x, y, error]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (isSaving) return;
      if (formRef.current?.contains(event.target as Node)) return;
      onCancel();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) onCancel();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSaving, onCancel]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const text = note.trim();
    if (!text || isSaving) return;

    setIsSaving(true);
    setError(null);
    try {
      await onSave(text);
    } catch (saveError) {
      setError(errorMessage(saveError, "Could not save the note."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      ref={formRef}
      data-note-composer
      onSubmit={handleSubmit}
      style={{ left: position.left, top: position.top }}
      className="fixed z-[1200] w-[320px] rounded-xl border border-[var(--r-border)] bg-[var(--r-surface)] p-3 text-[var(--r-ink)] shadow-2xl"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--r-muted)]">
          Add note
        </p>
        <button
          type="button"
          aria-label="Cancel note"
          onClick={onCancel}
          disabled={isSaving}
          className="grid size-6 place-items-center rounded text-[var(--r-muted)] transition-colors hover:bg-[var(--r-tint)] hover:text-[var(--r-ink)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X size={13} />
        </button>
      </div>

      <p
        className="mt-2 line-clamp-3 border-l-2 pl-2 text-[11px] italic leading-snug text-[var(--r-muted)]"
        style={{ borderColor: color }}
      >
        “{selectedText}”
      </p>

      <div className="mt-3 flex items-center gap-2">
        {HIGHLIGHT_COLORS.map((option) => {
          const isActive = option.value === color;
          return (
            <button
              key={option.value}
              type="button"
              aria-label={`Use ${option.name} highlight`}
              aria-pressed={isActive}
              onClick={() => onColorChange(option.value)}
              style={{ backgroundColor: option.value }}
              className={`size-5 rounded-full ring-1 ring-black/10 transition ${
                isActive
                  ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-[var(--r-surface)]"
                  : "hover:scale-110"
              }`}
            />
          );
        })}
      </div>

      <textarea
        autoFocus
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
          setError(null);
        }}
        rows={4}
        maxLength={2000}
        placeholder="Write a note…"
        aria-label="Note text"
        className="mt-3 w-full resize-none rounded-lg border border-[var(--r-border)] bg-transparent px-2.5 py-2 text-[12px] leading-relaxed text-[var(--r-ink)] outline-none placeholder:text-[var(--r-muted)] focus:border-blue-400"
      />

      {error && (
        <p role="alert" className="mt-1.5 text-[11px] text-red-500">
          {error}
        </p>
      )}

      <div className="mt-2 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-md px-2.5 py-1 text-[11px] font-medium text-[var(--r-muted)] transition-colors hover:bg-[var(--r-tint)] hover:text-[var(--r-ink)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!note.trim() || isSaving}
          className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check size={12} />
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
