import { useLayoutEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import type { AnnotationRect, BookAnnotation } from "../../types/annotation";
import {
  hexToRgba,
  locateTextRects,
  parseRects,
  sameRectList,
  sameRectMap,
} from "./annotationUtils";
import "./readerAnnotations.css";

interface PendingHighlight {
  text: string;
  rects: AnnotationRect[];
  color: string;
}

interface AnnotationOverlayProps {
  annotations: BookAnnotation[];
  focusedId: string | null;
  pending: PendingHighlight | null;
  /** Changes whenever the page layout is expected to reflow. */
  layoutKey: string;
  onOpen: (annotation: BookAnnotation, x: number, y: number) => void;
}

export default function AnnotationOverlay({
  annotations,
  focusedId,
  pending,
  layoutKey,
  onOpen,
}: AnnotationOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [rectsById, setRectsById] = useState<Record<string, AnnotationRect[]>>({});
  const [pendingRects, setPendingRects] = useState<AnnotationRect[]>([]);

  const pendingText = pending?.text ?? null;
  const pendingColor = pending?.color ?? null;
  const pendingFallback = pending?.rects ?? null;

  useLayoutEffect(() => {
    const container = rootRef.current?.parentElement;
    if (!container) return;

    let frame = 0;
    const measure = () => {
      frame = 0;

      const next: Record<string, AnnotationRect[]> = {};
      for (const annotation of annotations) {
        const stored = parseRects(annotation.rectsJson);
        next[annotation.id] =
          locateTextRects(container, annotation.selectedText, stored) ?? stored;
      }
      setRectsById((previous) => (sameRectMap(previous, next) ? previous : next));

      if (pendingText && pendingFallback) {
        const anchored =
          locateTextRects(container, pendingText, pendingFallback) ?? pendingFallback;
        setPendingRects((previous) =>
          sameRectList(previous, anchored) ? previous : anchored,
        );
      } else {
        setPendingRects((previous) => (previous.length === 0 ? previous : []));
      }
    };

    measure();

    const observer = new ResizeObserver(() => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [annotations, pendingText, pendingFallback, layoutKey]);

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-[1]">
      {annotations.map((annotation) => {
        const rects = rectsById[annotation.id] ?? parseRects(annotation.rectsJson);
        if (rects.length === 0) return null;

        const last = rects[rects.length - 1];
        const hasNote = Boolean(annotation.noteText?.trim());
        const isFocused = focusedId === annotation.id;

        return (
          <div key={annotation.id}>
            {rects.map((rect, index) => (
              <button
                key={`${annotation.id}-${index}`}
                type="button"
                data-annotation-id={annotation.id}
                aria-label={`Open highlight on page ${annotation.pageNumber}`}
                title={hasNote ? "Open note" : "Open highlight"}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen(annotation, event.clientX, event.clientY);
                }}
                className={`annotation-hit absolute rounded-[2px] border-0 p-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 ${
                  isFocused ? "annotation-flash" : ""
                }`}
                style={{
                  left: `${rect.x}%`,
                  top: `${rect.y}%`,
                  width: `${rect.w}%`,
                  height: `${rect.h}%`,
                  backgroundColor: hexToRgba(annotation.color, isFocused ? 0.52 : 0.32),
                }}
              />
            ))}

            {hasNote && (
              <button
                type="button"
                data-annotation-id={annotation.id}
                aria-label="Open note"
                title="Open note"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen(annotation, event.clientX, event.clientY);
                }}
                className="pointer-events-auto absolute z-[2] grid size-[18px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500"
                style={{
                  left: `${Math.min(99, last.x + last.w)}%`,
                  top: `${last.y + last.h / 2}%`,
                  color: "var(--r-ink)",
                  backgroundColor: hexToRgba(annotation.color, 0.24),
                  borderColor: hexToRgba(annotation.color, 0.75),
                }}
              >
                <MessageSquare size={10} strokeWidth={2.5} />
              </button>
            )}
          </div>
        );
      })}

      {pendingColor &&
        pendingRects.map((rect, index) => (
          <div
            key={`pending-${index}`}
            aria-hidden="true"
            className="pointer-events-none absolute z-[3] rounded-[2px] border border-dashed"
            style={{
              left: `${rect.x}%`,
              top: `${rect.y}%`,
              width: `${rect.w}%`,
              height: `${rect.h}%`,
              backgroundColor: hexToRgba(pendingColor, 0.22),
              borderColor: hexToRgba(pendingColor, 0.85),
            }}
          />
        ))}
    </div>
  );
}
