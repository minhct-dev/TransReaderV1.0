import { LibraryIcon, SettingsIcon } from "./icons";

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-16 flex-col items-center justify-between border-r border-black/5 bg-white/70 py-5 backdrop-blur md:w-56 md:items-stretch md:px-4">
      <div className="flex flex-col items-center gap-8 md:items-stretch">
        <div className="flex items-center gap-2 md:px-2">
          <span className="grid size-9 place-items-center rounded-xl bg-ink text-sm font-semibold text-white">
            T
          </span>
          <span className="hidden text-sm font-semibold tracking-tight md:block">
            TransReader
          </span>
        </div>

        <nav aria-label="Main">
          <a
            href="#library"
            aria-current="page"
            className="flex items-center justify-center gap-3 rounded-2xl bg-ink/[0.06] p-3 text-sm font-medium text-ink md:justify-start md:px-3"
          >
            <LibraryIcon />
            <span className="hidden md:inline">Library</span>
          </a>
        </nav>
      </div>

      <button
        type="button"
        aria-label="Settings"
        className="grid size-10 place-items-center rounded-2xl text-muted transition hover:bg-ink/[0.06] hover:text-ink md:self-start"
      >
        <SettingsIcon />
      </button>
    </aside>
  );
}
