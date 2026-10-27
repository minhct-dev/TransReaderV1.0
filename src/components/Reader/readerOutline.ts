import type { PDFDocumentProxy } from "pdfjs-dist";

/** One clickable line of the PDF's own table of contents. */
export interface TocEntry {
  title: string;
  page: number;
  /** Nesting level: 0 for top-level headings. */
  depth: number;
}

/** Bookmarks can describe a whole book; the sidebar only needs the start. */
const MAX_ENTRIES = 300;
const MAX_DEPTH = 2;

interface RawOutlineNode {
  title?: string;
  dest?: string | unknown[] | null;
  items?: RawOutlineNode[];
}

/**
 * Turn `pdf.getOutline()` into page numbers. Destinations are either a name to
 * look up or an explicit array whose first item is a page reference, which has
 * to be converted back to a page index.
 */
export async function loadOutline(pdf: PDFDocumentProxy): Promise<TocEntry[]> {
  const nodes = (await pdf.getOutline()) as RawOutlineNode[] | null;
  if (!nodes?.length) return [];

  const entries: TocEntry[] = [];

  const pageOf = async (node: RawOutlineNode): Promise<number | null> => {
    try {
      const dest =
        typeof node.dest === "string"
          ? await pdf.getDestination(node.dest)
          : node.dest ?? null;
      if (!Array.isArray(dest) || dest.length === 0) return null;

      const target = dest[0];
      if (typeof target === "number") return target + 1;
      return (await pdf.getPageIndex(target as never)) + 1;
    } catch {
      return null;
    }
  };

  const walk = async (list: RawOutlineNode[], depth: number): Promise<void> => {
    for (const node of list) {
      if (entries.length >= MAX_ENTRIES) return;

      const page = await pageOf(node);
      const title = node.title?.trim();
      if (page !== null && title) entries.push({ title, page, depth });

      if (node.items?.length && depth < MAX_DEPTH) {
        await walk(node.items, depth + 1);
      }
    }
  };

  await walk(nodes, 0);
  return entries;
}
