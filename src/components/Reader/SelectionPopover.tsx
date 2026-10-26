import { useLayoutEffect, useRef, useState } from "react";
import { BookOpen, Plus, Share2 } from "lucide-react";

export const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#facc15" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Red", value: "#ef4444" },
];

interface SelectionPopoverProps {
  /** Viewport coordinates of the first selected line. */
  x: number;
  y: number;
  onHighlight: (color: string) => void;
  onAddNote: () => void;
  onDictionary: () => void;
  onShare: () => void;
}

export default function SelectionPopover({
  x,
  y,
  onHighlight,
  onAddNote,
  onDictionary,
  onShare,
}: SelectionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  // Sits above the selection, then gets nudged back inside the window once its
  // real size is known.
  useLayoutEffect(() => {
    const element = popoverRef.current;
    if (!element) return;

    const { width, height } = element.getBoundingClientRect();
    const margin = 8;

    setPosition({
      left: Math.max(margin, Math.min(x, window.innerWidth - width - margin)),
      top: Math.max(margin, Math.min(y - height - 10, window.innerHeight - height - margin)),
    });
  }, [x, y]);

  return (
    <div
      ref={popoverRef}
      data-selection-popover
      role="toolbar"
      aria-label="Selection actions"
      style={{ left: position.left, top: position.top }}
      // Keeps the text selected while a button is pressed.
      onMouseDown={(event) => event.preventDefault()}
      className="fixed z-[1100] w-[176px] select-none rounded-xl border border-white/10 bg-zinc-900/95 p-2 text-zinc-200 shadow-2xl backdrop-blur"
    >
      <div className="flex items-center justify-between px-1 py-0.5">
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            aria-label={`Highlight ${color.name}`}
            title={color.name}
            onClick={() => onHighlight(color.value)}
            style={{ backgroundColor: color.value }}
            className="size-[18px] rounded-full ring-1 ring-white/25 transition hover:scale-110 hover:ring-white/80"
          />
        ))}
      </div>

      <div className="my-1.5 h-px bg-white/10" />

      <div className="flex flex-col">
        <PopoverAction label="ADD NOTE" icon={<Plus size={13} />} onClick={onAddNote} />
        <PopoverAction label="DICTIONARY" icon={<BookOpen size={13} />} onClick={onDictionary} />
        <PopoverAction label="SHARE" icon={<Share2 size={13} />} onClick={onShare} />
      </div>
    </div>
  );
}

function PopoverAction({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-300 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:bg-white/10"
    >
      <span className="text-zinc-400">{icon}</span>
      {label}
    </button>
  );
}
