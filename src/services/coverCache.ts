import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { pdfjs } from "react-pdf";
import "../components/Reader/pdfSetup";

const DATABASE_NAME = "transreader-cover-cache";
const STORE_NAME = "covers";
const MAX_COVER_WIDTH = 360;
const MAX_COVER_HEIGHT = 540;
const pendingCovers = new Map<string, Promise<Blob | null>>();

interface CoverRecord {
  bookId: string;
  signature: string;
  image: Blob;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "bookId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open cover cache."));
    request.onblocked = () => reject(new Error("Cover cache is blocked by another app window."));
  });
  databasePromise = opening.catch((error: unknown) => {
    databasePromise = null;
    throw error;
  });

  return databasePromise;
}

async function readCover(bookId: string): Promise<CoverRecord | undefined> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(bookId);
    request.onsuccess = () => resolve(request.result as CoverRecord | undefined);
    request.onerror = () => reject(request.error ?? new Error("Could not read cover cache."));
  });
}

async function writeCover(record: CoverRecord): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save cover cache."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Cover cache write was aborted."));
  });
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Could not encode the PDF cover.")),
      "image/webp",
      0.84,
    );
  });
}

/** Load a persisted PDF cover or render page one once, keyed by file metadata. */
export function loadPdfCover(bookId: string): Promise<Blob | null> {
  const pending = pendingCovers.get(bookId);
  if (pending) return pending;

  const load = (async (): Promise<Blob | null> => {
    let signature: string | null = null;
    try {
      signature = await invoke<string>("get_book_file_signature", { bookId });
      const cached = await readCover(bookId);
      if (cached?.signature === signature) return cached.image;
    } catch (error) {
      console.warn(`Could not read the cover cache for book ${bookId}:`, error);
    }

    try {
      const path = await invoke<string>("resolve_book_path", { bookId });
      const loadingTask = pdfjs.getDocument({ url: convertFileSrc(path) });
      try {
        const document = await loadingTask.promise;
        const page = await document.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(
          MAX_COVER_WIDTH / baseViewport.width,
          MAX_COVER_HEIGHT / baseViewport.height,
          1,
        );
        const viewport = page.getViewport({ scale });
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is unavailable for PDF cover rendering.");

        try {
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          const image = await toBlob(canvas);
          if (signature) {
            try {
              await writeCover({ bookId, signature, image });
            } catch (error) {
              console.warn(`Could not save the cover cache for book ${bookId}:`, error);
            }
          }
          return image;
        } finally {
          canvas.width = 0;
          canvas.height = 0;
        }
      } finally {
        await loadingTask.destroy();
      }
    } catch (error) {
      console.warn(`Could not create a cover for book ${bookId}:`, error);
      return null;
    }
  })();

  pendingCovers.set(bookId, load);
  void load.finally(() => pendingCovers.delete(bookId));
  return load;
}
