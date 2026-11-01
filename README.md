# TransReader

A desktop document reader for people reading in a foreign language. Select a word to see its dictionary entry, or select a passage to translate it, without leaving the page.

Built with Tauri v2, a Rust backend with SQLite, and a React + TypeScript frontend.

## Features

- **Library:** import documents, search by title, author or topic, and remove books. Removing a book only hides it; the file stays on disk. Re-importing the same file restores the book and its highlights, even after the file was moved or renamed (tracked by its NTFS file ID).
- **PDF reader:** page thumbnails, table of contents, zoom, in-book search, and light, sepia and dark themes.
- **Highlights and notes:** four highlight colors and a note on each highlight, saved locally.
- **Dictionary:** look up a single English word via the [Free Dictionary API](https://dictionaryapi.dev/). Results are cached in SQLite, so cached words work offline.
- **Translation:** translate a selection into Vietnamese, English, Chinese or Japanese, through Google Translate with LibreTranslate as the fallback.
- **Local-first:** books, highlights and the cache stay on your device. Only the selected text is sent to the dictionary or translation service.

Only PDF files open in the reader for now. DOCX and TXT files can be imported but not read yet.

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 |
| Backend | Rust, SQLite (rusqlite, WAL mode), Tokio, reqwest |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, react-pdf (pdf.js) |
| Testing | Rust unit tests, Python + pytest + Selenium (`tauri-driver`) |
| CI | GitHub Actions: type check, build, Clippy, unit tests, dependency audits |

## Project layout

```
src/                React UI: library, reader, popovers
  services/         tauriBridge.ts (calls into Rust), cover cache
src-tauri/          Tauri shell and Rust backend
  src/commands/     IPC commands called by the frontend
  src/storage/      SQLite schema, migrations, queries
  src/api/          Dictionary and translation HTTP clients
tests/e2e/          pytest + Selenium API regression suite
.github/workflows/  CI pipelines
```

## Getting started

Requirements: [Node.js](https://nodejs.org/) 20+, [Rust](https://rustup.rs/) (stable), and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS. On Windows that means WebView2 and the MSVC build tools.

```powershell
npm install
npm run tauri dev       # run the desktop app with hot reload
npm run tauri build     # build an installer
```

`npm run dev` starts only the frontend in a browser. Anything that calls the Rust backend will not work there.

Your data is stored in `%APPDATA%\com.minhct.transreader\reader.db` on Windows (or the OS equivalent).

## Testing

### Rust unit tests

```powershell
cd src-tauri
cargo test
cargo clippy --all-targets -- -D warnings
```

There are 33 tests. They run against an in-memory SQLite database and cover duplicate imports, moved files, schema migrations, cache upserts and the error format.

### API regression suite (pytest + Selenium)

This suite starts the real debug build of the app through `tauri-driver` and calls the Rust commands over IPC. A local mock server stands in for the dictionary and translation APIs, so it can simulate errors, dropped connections and offline mode. It has 52 tests and runs in about 5 seconds.

Windows only for now. Close the app before running.

```powershell
cd tests\e2e
# First run: installs Python packages, tauri-driver and msedgedriver, then builds the app
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-api-tests.ps1 -Setup -Build

# Later runs
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-api-tests.ps1
```

| Option | Use |
|---|---|
| `-Build` | Rebuild the app first (do this after changing code) |
| `-Marker smoke` | Run only the quick core checks |
| `-K dictionary` | Run only tests whose name matches |
| `-Setup` | Reinstall the test environment, for example after a WebView2 update |

Reading the result:

- `passed`: the test passed.
- `xfailed`: a known bug, failing as expected.
- `failed`: a new problem.

The JUnit report is written to `tests/e2e/reports/junit.xml`.

The suite uses its own app identifier (`com.minhct.transreader.e2e`), so it never touches your real library. It relies on two hooks that exist only in debug builds:

- `TRANSREADER_*_URL` environment variables redirect the external APIs to the mock server.
- The `e2e_import_book` command imports a file without the native file picker, which WebDriver cannot click.

## Known issues

Each known bug is covered by an `xfail` test. When a bug is fixed, its test reports XPASS so the marker can be removed.

| ID | Issue |
|---|---|
| BUG-01 | The LibreTranslate fallback sends no API key, so it is rejected |
| BUG-02 | Chinese is simplified on Google but traditional (`zh-Hant`) on LibreTranslate |
| BUG-03 | Long CJK text is sent in a GET URL and rejected by Google |
| BUG-04 | A failed translation can show raw HTML in the error message |
| BUG-05 | The dictionary rejects words with a curly apostrophe, such as `don’t` |
| BUG-09 | Highlights are stored without validating page number, text length or rectangles |
| BUG-11 | A path that does not exist can still be imported as a book |
| REQ-01 | DOCX and TXT files can be imported but the reader only opens PDF |

Also not done yet: saving reading progress, bookmarks, and several context-menu actions (open file location, share, copy path, delete file).
