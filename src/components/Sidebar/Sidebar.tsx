import { LibraryIcon, SettingsIcon } from "../icons";
import "./Sidebar.css";

export default function Sidebar() {
  return (
    <aside className="sidebar">
      {/* Top section */}
      <div>
        {/* Brand */}
        <div className="sidebar__brand">
          <span className="sidebar__logo">T</span>
          <span className="sidebar__title">TransReader</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar__nav" aria-label="Main">
          <a href="#library" className="sidebar__link sidebar__link--active">
            <span className="sidebar__link-icon"><LibraryIcon /></span>
            <span className="sidebar__link-label">Library</span>
          </a>
        </nav>
      </div>

      {/* Bottom section */}
      <div className="sidebar__bottom">
        <a href="#settings" className="sidebar__link">
          <span className="sidebar__link-icon"><SettingsIcon /></span>
          <span className="sidebar__link-label">Settings</span>
        </a>
      </div>
    </aside>
  );
}
