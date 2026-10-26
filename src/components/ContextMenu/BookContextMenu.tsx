import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Book } from "../../types/book";

interface BookContextMenuProps {
  book: Book;
  /** Viewport coordinates of the right click. */
  x: number;
  y: number;
  onClose: () => void;
  /** Removes the book from the library (backend `delete_book`). */
  onRemoveFromList: (book: Book) => void;
}

interface MenuItem {
  id: string;
  label: string;
  /** Letter drawn with an underline, as Windows does for access keys. */
  accessKey: string;
  onSelect: () => void;
  danger?: boolean;
  separator?: boolean;
}

/** Underlines the first occurrence of the access key, like a Windows menu. */
function AccessLabel({ text, accessKey }: { text: string; accessKey: string }) {
  const index = text.toLowerCase().indexOf(accessKey.toLowerCase());
  if (index < 0) return <span>{text}</span>;

  return (
    <span>
      {text.slice(0, index)}
      <span className="underline underline-offset-2">{text[index]}</span>
      {text.slice(index + 1)}
    </span>
  );
}

export default function BookContextMenu({
  book,
  x,
  y,
  onClose,
  onRemoveFromList,
}: BookContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  // Keep the menu inside the window: clamp against its own size once it is laid out.
  useLayoutEffect(() => {
    const element = menuRef.current;
    if (!element) return;

    const { width, height } = element.getBoundingClientRect();
    const margin = 8;

    setPosition({
      left: Math.max(margin, Math.min(x, window.innerWidth - width - margin)),
      top: Math.max(margin, Math.min(y, window.innerHeight - height - margin)),
    });
  }, [x, y]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const handleDismiss = () => onClose();

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleDismiss);
    // capture: also catches scrolling in inner containers, not just the window
    window.addEventListener("scroll", handleDismiss, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleDismiss);
      window.removeEventListener("scroll", handleDismiss, true);
    };
  }, [onClose]);

  const handleOpen = () => {
    // TODO: Gắn Tauri IPC command vào đây
    console.log("Action: Open", book);
    onClose();
  };

  const handleOpenFileLocation = () => {
    // TODO: Gắn Tauri IPC command vào đây
    console.log("Action: Open file location", book.filePath);
    onClose();
  };

  const handleShare = () => {
    // TODO: Gắn Tauri IPC command vào đây
    console.log("Action: Share", book);
    onClose();
  };

  const handleOpenCopy = () => {
    // TODO: Gắn Tauri IPC command vào đây
    console.log("Action: Open a copy", book);
    onClose();
  };

  const handleDeleteFile = () => {
    // TODO: Gắn Tauri IPC command vào đây
    console.log("Action: Delete file", book.filePath);
    onClose();
  };

  const handleCopyPath = () => {
    // TODO: Gắn Tauri IPC command vào đây
    console.log("Action: Copy path to clipboard", book.filePath);
    onClose();
  };

  const handleAddToFavourites = () => {
    // TODO: Gắn Tauri IPC command vào đây
    console.log("Action: Add to Favourites", book.id);
    onClose();
  };

  const handleRemoveFromList = () => {
    onRemoveFromList(book);
    onClose();
  };

  const items: MenuItem[] = [
    { id: "open", label: "Open", accessKey: "O", onSelect: handleOpen },
    {
      id: "location",
      label: "Open file location",
      accessKey: "l",
      onSelect: handleOpenFileLocation,
    },
    { id: "share", label: "Share", accessKey: "S", onSelect: handleShare },
    {
      id: "copy",
      label: "Open a copy",
      accessKey: "n",
      onSelect: handleOpenCopy,
    },
    {
      id: "delete-file",
      label: "Delete file",
      accessKey: "D",
      onSelect: handleDeleteFile,
      danger: true,
      separator: true,
    },
    {
      id: "copy-path",
      label: "Copy path to clipboard",
      accessKey: "C",
      onSelect: handleCopyPath,
      separator: true,
    },
    {
      id: "favourite",
      label: "Add to Favourites",
      accessKey: "F",
      onSelect: handleAddToFavourites,
    },
    {
      id: "remove",
      label: "Remove from list",
      accessKey: "R",
      onSelect: handleRemoveFromList,
      separator: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Actions for ${book.title}`}
      style={{ left: position.left, top: position.top }}
      onContextMenu={(event) => event.preventDefault()}
      className="fixed z-[1000] min-w-[240px] select-none rounded-md border border-gray-200 bg-white p-1 text-[13px] text-gray-800 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
    >
      {items.map((item) => (
        <Fragment key={item.id}>
          {item.separator && (
            <div className="my-1 h-px bg-gray-200 dark:bg-zinc-700" />
          )}
          <button
            type="button"
            role="menuitem"
            onClick={item.onSelect}
            className={`flex w-full items-center rounded px-3 py-1.5 text-left outline-none transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 dark:hover:bg-zinc-700 dark:focus-visible:bg-zinc-700 ${
              item.danger ? "text-red-600 dark:text-red-400" : ""
            }`}
          >
            <AccessLabel text={item.label} accessKey={item.accessKey} />
          </button>
        </Fragment>
      ))}
    </div>
  );
}
