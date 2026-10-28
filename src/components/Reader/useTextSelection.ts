import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/** A plain snapshot of the browser selection, safe to keep in React state. */
export interface TextSelection {
  text: string;
  /** Viewport X of the selection's bounding box. */
  x: number;
  /** Viewport Y of the selection's bounding box. */
  y: number;
  /** True when the selection is exactly one word, so dictionary lookup fits. */
  isSingleWord: boolean;
}

interface UseTextSelectionOptions {
  /** Element whose mouseup starts a selection; defaults to the whole document. */
  containerRef?: RefObject<HTMLElement | null>;
  enabled?: boolean;
  onSelect?: (selection: TextSelection, range: Range) => void;
  onClear?: () => void;
}

const SINGLE_WORD = /^[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*$/u;

function snapshotSelection(): { selection: TextSelection; range: Range } | null {
  const current = window.getSelection();
  if (!current || current.isCollapsed || current.rangeCount === 0) return null;

  const text = current.toString().trim();
  if (!text) return null;

  const range = current.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  return {
    selection: {
      text,
      x: rect.left,
      y: rect.top,
      isSingleWord: SINGLE_WORD.test(text),
    },
    range,
  };
}

/**
 * Watches a reading surface for text selections. `mouseup` captures the final
 * range immediately, while `selectionchange` handles keyboard selection after a
 * short debounce and clears the snapshot as soon as the selection collapses.
 */
export function useTextSelection({
  containerRef,
  enabled = true,
  onSelect,
  onClear,
}: UseTextSelectionOptions = {}) {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const onSelectRef = useRef(onSelect);
  const onClearRef = useRef(onClear);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onClearRef.current = onClear;
  }, [onClear]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    onClearRef.current?.();
  }, []);

  const captureSelection = useCallback(() => {
    const snapshot = snapshotSelection();
    if (!snapshot) {
      clearSelection();
      return;
    }

    setSelection(snapshot.selection);
    onSelectRef.current?.(snapshot.selection, snapshot.range);
  }, [clearSelection]);

  useEffect(() => {
    if (!enabled) return;

    const target: EventTarget = containerRef?.current ?? document;
    let selectionTimer: number | null = null;

    const cancelPendingCapture = () => {
      if (selectionTimer !== null) {
        window.clearTimeout(selectionTimer);
        selectionTimer = null;
      }
    };

    const handleMouseUp = (event: Event) => {
      if (event.target instanceof Element && event.target.closest("[data-dictionary-popover]")) {
        return;
      }
      cancelPendingCapture();
      window.setTimeout(captureSelection, 0);
    };

    const handleSelectionChange = () => {
      const current = window.getSelection();
      if (!current || current.isCollapsed) {
        cancelPendingCapture();
        clearSelection();
        return;
      }

      cancelPendingCapture();
      selectionTimer = window.setTimeout(() => {
        selectionTimer = null;
        captureSelection();
      }, 180);
    };

    target.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      cancelPendingCapture();
      target.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [containerRef, enabled, captureSelection, clearSelection]);

  return { selection, captureSelection, clearSelection };
}
