import { useEffect, useRef, useState } from "react";
import { BookOpen, Highlighter, Layers3, LogIn, Settings, X, LibraryBig, Languages } from "lucide-react";
import "./Sidebar.css";

type LibrarySection = "Library" | "Vocab Vault" | "Collections" | "Highlights & Notes" | "Settings";

const sections: { label: LibrarySection; icon: typeof BookOpen }[] = [
  { label: "Library", icon: LibraryBig },
  { label: "Vocab Vault", icon: Languages },
  { label: "Collections", icon: Layers3 },
  { label: "Highlights & Notes", icon: Highlighter },
  { label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const [notice, setNotice] = useState<string | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (showSignIn && !dialog.open) dialog.showModal();
    if (!showSignIn && dialog.open) dialog.close();
  }, [showSignIn]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const activateSection = (section: LibrarySection) => {
    if (section !== "Library") setNotice(`${section} is not available yet.`);
  };

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar__top">
          <div className="sidebar__brand">
            <span className="sidebar__logo" aria-hidden="true">T</span>
            <span className="sidebar__title">TransReader</span>
          </div>

          <nav className="sidebar__nav" aria-label="Main navigation">
            {sections.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                className={`sidebar__link${label === "Library" ? " sidebar__link--active" : ""}`}
                aria-current={label === "Library" ? "page" : undefined}
                aria-label={label}
                title={label}
                onClick={() => activateSection(label)}
              >
                <span className="sidebar__link-icon"><Icon size={19} strokeWidth={1.8} /></span>
                <span className="sidebar__link-label">{label}</span>
                <span className="sidebar__link-label--mobile" aria-hidden="true">
                  {label === "Vocab Vault" ? "Vocab" : label === "Highlights & Notes" ? "Notes" : label}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar__bottom">
          <button type="button" className="sidebar__link sidebar__signin" onClick={() => setShowSignIn(true)}>
            <span className="sidebar__link-icon"><LogIn size={19} strokeWidth={1.8} /></span>
            <span className="sidebar__link-label">Sign in</span>
            <span className="sidebar__link-label--mobile" aria-hidden="true">Sign in</span>
          </button>
        </div>

        {notice && <div className="sidebar__notice" role="status">{notice}</div>}
      </aside>

      <dialog
        ref={dialogRef}
        className="signin-dialog"
        aria-labelledby="signin-title"
        onCancel={(event) => { event.preventDefault(); setShowSignIn(false); }}
        onClick={(event) => { if (event.target === dialogRef.current) setShowSignIn(false); }}
      >
        <button className="signin-dialog__close" type="button" aria-label="Close dialog" onClick={() => setShowSignIn(false)}>
          <X size={18} />
        </button>
        <span className="signin-dialog__icon" aria-hidden="true"><LogIn size={22} /></span>
        <h2 id="signin-title">Your library is already yours</h2>
        <p>Sign-in and cloud sync aren’t available yet. Your books and notes stay on this device.</p>
        <button className="signin-dialog__button" type="button" onClick={() => setShowSignIn(false)}>Got it</button>
      </dialog>
    </>
  );
}
