import type { AnnotationRect, BookAnnotation } from "../../types/annotation";

export const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#facc15" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Red", value: "#ef4444" },
] as const;

export const DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHT_COLORS[0].value;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const round = (value: number) => Math.round(value * 1000) / 1000;

/** Read stored percentage rects, dropping anything malformed or off-page. */
export function parseRects(json: string): AnnotationRect[] {
  try {
    const value: unknown = JSON.parse(json);
    if (!Array.isArray(value)) return [];

    const rects: AnnotationRect[] = [];
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const candidate = item as Partial<Record<keyof AnnotationRect, unknown>>;
      const x = Number(candidate.x);
      const y = Number(candidate.y);
      const w = Number(candidate.w);
      const h = Number(candidate.h);
      if (![x, y, w, h].every(Number.isFinite)) continue;

      const left = clamp(x, 0, 100);
      const top = clamp(y, 0, 100);
      const width = clamp(w, 0, 100 - left);
      const height = clamp(h, 0, 100 - top);
      if (width <= 0 || height <= 0) continue;

      rects.push({ x: left, y: top, w: width, h: height });
    }
    return rects;
  } catch {
    return [];
  }
}

export function serializeRects(rects: AnnotationRect[]): string {
  return JSON.stringify(
    rects
      .filter((rect) => rect.w > 0 && rect.h > 0)
      .map((rect) => ({
        x: round(clamp(rect.x, 0, 100)),
        y: round(clamp(rect.y, 0, 100)),
        w: round(clamp(rect.w, 0, 100 - clamp(rect.x, 0, 100))),
        h: round(clamp(rect.h, 0, 100 - clamp(rect.y, 0, 100))),
      })),
  );
}

/**
 * Convert the browser's viewport rects for a selection into percentages of
 * `container`. The container is inside the zoom transform, so both sides of
 * the ratio are already scaled and the stored values survive every zoom level.
 */
export function rectsFromRange(range: Range, container: HTMLElement): AnnotationRect[] {
  const box = container.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return [];

  const source = Array.from(range.getClientRects());
  if (source.length === 0) {
    const fallback = range.getBoundingClientRect();
    if (fallback.width > 0 && fallback.height > 0) source.push(fallback);
  }

  const rects: AnnotationRect[] = [];
  for (const rect of source) {
    const left = Math.max(rect.left, box.left);
    const top = Math.max(rect.top, box.top);
    const right = Math.min(rect.right, box.right);
    const bottom = Math.min(rect.bottom, box.bottom);
    if (right - left < 1 || bottom - top < 1) continue;

    rects.push({
      x: ((left - box.left) / box.width) * 100,
      y: ((top - box.top) / box.height) * 100,
      w: ((right - left) / box.width) * 100,
      h: ((bottom - top) / box.height) * 100,
    });
  }

  return mergeLineFragments(rects);
}

/** A range can report several rects for one visual line; join those. */
function mergeLineFragments(rects: AnnotationRect[]): AnnotationRect[] {
  const sorted = [...rects].sort((left, right) => left.y - right.y || left.x - right.x);
  const merged: AnnotationRect[] = [];

  for (const rect of sorted) {
    const previous = merged[merged.length - 1];
    const sameLine =
      previous !== undefined &&
      Math.abs(previous.y - rect.y) < 0.25 &&
      Math.abs(previous.h - rect.h) < 0.25 &&
      rect.x <= previous.x + previous.w + 0.35;

    if (sameLine) {
      const right = Math.max(previous.x + previous.w, rect.x + rect.w);
      previous.w = right - previous.x;
    } else {
      merged.push({ ...rect });
    }
  }

  return merged;
}

interface TextEntry {
  node: Text;
  start: number;
}

function textPositionAt(entries: TextEntry[], offset: number) {
  for (const entry of entries) {
    const length = entry.node.nodeValue?.length ?? 0;
    if (offset <= entry.start + length) {
      return { node: entry.node, offset: Math.max(0, offset - entry.start) };
    }
  }
  return null;
}

/**
 * Find a stored quote in the page again and measure it in the current layout.
 * Zooming and font-size changes reflow the column, which invalidates the saved
 * percentages, so the text itself is the stable anchor. Returns null when the
 * quote no longer exists in the page, letting the caller fall back to storage.
 */
export function locateTextRects(
  container: HTMLElement,
  selectedText: string,
  fallback: AnnotationRect[] = [],
): AnnotationRect[] | null {
  const needle = selectedText.trim();
  if (!needle) return null;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const entries: TextEntry[] = [];
  let haystack = "";
  let current = walker.nextNode();
  while (current) {
    const value = current.nodeValue ?? "";
    if (value) {
      entries.push({ node: current as Text, start: haystack.length });
      haystack += value;
    }
    current = walker.nextNode();
  }
  if (haystack.length < needle.length) return null;

  const starts: number[] = [];
  let index = haystack.indexOf(needle);
  while (index !== -1 && starts.length < 20) {
    starts.push(index);
    index = haystack.indexOf(needle, index + 1);
  }
  if (starts.length === 0) return null;

  const measure = (start: number): AnnotationRect[] | null => {
    const from = textPositionAt(entries, start);
    const to = textPositionAt(entries, start + needle.length);
    if (!from || !to) return null;

    const range = document.createRange();
    range.setStart(from.node, from.offset);
    range.setEnd(to.node, to.offset);
    const rects = rectsFromRange(range, container);
    return rects.length > 0 ? rects : null;
  };

  if (starts.length === 1) return measure(starts[0]);

  // The same sentence can occur more than once on a page. The saved rects are
  // only stale, not meaningless, so the closest occurrence is the right one.
  let best: AnnotationRect[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const start of starts) {
    const rects = measure(start);
    if (!rects) continue;

    const score =
      fallback.length > 0
        ? Math.abs(rects[0].y - fallback[0].y) + Math.abs(rects[0].x - fallback[0].x)
        : 0;
    if (score < bestScore) {
      best = rects;
      bestScore = score;
    }
  }

  return best;
}

export function sameRect(left: AnnotationRect, right: AnnotationRect): boolean {
  return (
    Math.abs(left.x - right.x) < 0.05 &&
    Math.abs(left.y - right.y) < 0.05 &&
    Math.abs(left.w - right.w) < 0.05 &&
    Math.abs(left.h - right.h) < 0.05
  );
}

export function sameRectList(left: AnnotationRect[], right: AnnotationRect[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((rect, index) => sameRect(rect, right[index]));
}

export function sameRectMap(
  left: Record<string, AnnotationRect[]>,
  right: Record<string, AnnotationRect[]>,
): boolean {
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;
  return leftKeys.every(
    (key) => right[key] !== undefined && sameRectList(left[key], right[key]),
  );
}

export function hexToRgba(hex: string, alpha: number): string {
  const value = hex.trim().replace(/^#/, "");
  const expanded =
    value.length === 3
      ? value
          .split("")
          .map((character) => character + character)
          .join("")
      : value;

  if (!/^[0-9a-f]{6}$/i.test(expanded)) return `rgba(250, 204, 21, ${alpha})`;

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function createAnnotationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `annotation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function sortAnnotations(annotations: BookAnnotation[]): BookAnnotation[] {
  return [...annotations].sort(
    (left, right) =>
      left.pageNumber - right.pageNumber || left.createdAt.localeCompare(right.createdAt),
  );
}

export function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
