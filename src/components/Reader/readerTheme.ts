export type ReaderTheme = "light" | "sepia" | "dark";

export interface ReaderPalette {
  /** Backdrop behind the pages. */
  bg: string;
  /** Toolbar and sidebar surface. */
  surface: string;
  /** The paper itself. */
  page: string;
  ink: string;
  muted: string;
  border: string;
  /** Low-alpha wash for hover / pressed / selected backgrounds. */
  tint: string;
}

export const READER_PALETTES: Record<ReaderTheme, ReaderPalette> = {
  light: {
    bg: "#ececeb",
    surface: "#f7f7f5",
    page: "#fffefb",
    ink: "#2c2a27",
    muted: "#8b8f98",
    border: "rgba(0, 0, 0, 0.08)",
    tint: "rgba(0, 0, 0, 0.055)",
  },
  sepia: {
    bg: "#e6dcc8",
    surface: "#f2ead9",
    page: "#faf3e3",
    ink: "#4a3f33",
    muted: "#9a8b76",
    border: "rgba(74, 63, 51, 0.14)",
    tint: "rgba(74, 63, 51, 0.075)",
  },
  dark: {
    bg: "#151515",
    surface: "#1d1d1d",
    page: "#262626",
    ink: "#d2d0cb",
    muted: "#7d7d7d",
    border: "rgba(255, 255, 255, 0.09)",
    tint: "rgba(255, 255, 255, 0.075)",
  },
};
