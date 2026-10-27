import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, MessageSquare, Pencil, Trash2, X } from "lucide-react";
import type { BookAnnotation } from "../../types/annotation";
import { errorMessage } from "./annotationUtils";

interface AnnotationPopoverProps {
  annotation: BookAnnotation;
  /** Viewport coordinates of the clicked highlight or note bubble. */
  x: number;
  y: number;
  onClose: () => void;
  onSaveNote: (noteText: string | null) => Promise<void>;
  onDelete: () => Promise<void>;
}

export default function AnnotationPopover({
  annotation,
  x,
  y,
  onClose,
  onSaveNote,
  onDelete,
}: AnnotationPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(annotation.noteText ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasNote = Boolean(annotation.noteText?.trim());

  useEffect(() => {
    setDraft(annotation.noteText ?? "");
    setIsEditing(false);
    setConfirmDelete(false);
    setError(null);
  }, [annotation.id, annotation.noteText]);

  useLayoutEffect(() => {
    const element = popoverRef.current;
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
  }, [x, y, isEditing, confirmDelete, annotation.noteText, error]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (popoverRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const handleScroll = (event: Event) => {
      if (popoverRef.current?.contains(event.target as Node)) return;
      onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSaveNote(draft.trim() || null);
      setIsEditing(false);
    } catch (saveError) {
      setError(errorMessage(saveError, "Could not save the note."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setError(null);
    try {
      await onDelete();
    } catch (deleteError) {
      setError(errorMessage(deleteError, "Could not delete the highlight."));
      setIsDeleting(false);
    }
  };

  const startEditing = () => {
    setDraft(annotation.noteText ?? "");
    setIsEditing(true);
    setConfirmDelete(false);
    setError(null);
  };

  const cancelEditing = () => {
    setDraft(annotation.noteText ?? "");
    setIsEditing(false);
    setError(null);
  };

  return (
    <div
      ref={popoverRef}
      data-annotation-popover
      role="dialog"
      aria-label="Highlight details"
      style={{ left: position.left, top: position.top }}
      className="fixed z-[1200] w-[320px] rounded-xl border border-[var(--r-border)] bg-[var(--r-surface)] p-3 text-[var(--r-ink)] shadow-2xl"
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1 size-2.5 shrink-0 rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: annotation.color }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--r-muted)]">
            Page {annotation.pageNumber}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-[var(--r-ink)]">
            <MessageSquare size={11} />
            {hasNote ? "Note" : "Highlight"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close note"
          onClick={onClose}
          className="grid size-6 shrink-0 place-items-center rounded text-[var(--r-muted)] transition-colors hover:bg-[var(--r-tint)] hover:text-[var(--r-ink)]"
        >
          <X size={13} />
        </button>
      </div>

      <p
        className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap border-l-2 pl-2 text-[11.5px] italic leading-snug text-[var(--r-muted)]"
        style={{ borderColor: annotation.color }}
      >
        {annotation.selectedText}
      </p>

      {isEditing ? (
        <div className="mt-3">
          <textarea
            autoFocus
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            rows={4}
            maxLength={2000}
            placeholder="Write a note…"
            aria-label="Note text"
            className="w-full resize-none rounded-lg border border-[var(--r-border)] bg-transparent px-2.5 py-2 text-[12px] leading-relaxed text-[var(--r-ink)] outline-none placeholder:text-[var(--r-muted)] focus:border-blue-400"
          />
          <p className="mt-1 text-[10px] text-[var(--r-muted)]">
            Leave empty to remove the note.
          </p>
        </div>
      ) : hasNote ? (
        <p className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--r-ink)]">
          {annotation.noteText}
        </p>
      ) : (
        <p className="mt-3 text-[11.5px] text-[var(--r-muted)]">No note yet.</p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[11px] text-red-500">
          {error}
        </p>
      )}

      {confirmDelete ? (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2">
          <p className="text-[11px] text-[var(--r-ink)]">
            Delete this highlight{hasNote ? " and its note" : ""}?
          </p>
          <div className="mt-2 flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={isDeleting}
              className="rounded-md px-2.5 py-1 text-[11px] font-medium text-[var(--r-muted)] transition-colors hover:bg-[var(--r-tint)] hover:text-[var(--r-ink)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-red-500 transition-colors hover:bg-red-500/10"
          >
            <Trash2 size={12} />
            Delete
          </button>

          {isEditing ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={cancelEditing}
                disabled={isSaving}
                className="rounded-md px-2.5 py-1 text-[11px] font-medium text-[var(--r-muted)] transition-colors hover:bg-[var(--r-tint)] hover:text-[var(--r-ink)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check size={12} />
                {isSaving ? "Saving…" : "Save"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className="flex items-center gap-1 rounded-md bg-[var(--r-tint)] px-2.5 py-1 text-[11px] font-semibold text-[var(--r-ink)] transition-colors hover:bg-[var(--r-border)]"
            >
              <Pencil size={12} />
              {hasNote ? "Edit" : "Add note"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
