"""Generate the sample PDFs the API tests import.

The API tests only need real files on disk (path, title, format); the content
matters little. Output goes to fixtures/out/, which is git-ignored.
"""

from __future__ import annotations

from pathlib import Path

from fpdf import FPDF

OUT = Path(__file__).parent / "out"


def _pdf() -> FPDF:
    pdf = FPDF()
    pdf.set_auto_page_break(False)
    pdf.set_font("Helvetica", size=14)
    return pdf


def short_en(path: Path):
    pdf = _pdf()
    pdf.add_page()
    for index, phrase in enumerate(
        ["The quick brown fox jumps over the lazy dog", "hello, world", "A well-known reader"]
    ):
        pdf.set_xy(20, 30 + index * 14)
        pdf.cell(w=170, h=10, text=phrase)
    pdf.output(str(path))


def ten_pages(path: Path):
    pdf = _pdf()
    for number in range(1, 11):
        pdf.add_page()
        pdf.set_xy(20, 30)
        pdf.cell(w=170, h=10, text=f"Marker page {number}")
    pdf.output(str(path))


def build_all() -> dict[str, Path]:
    OUT.mkdir(parents=True, exist_ok=True)
    files = {"short-en": OUT / "short-en.pdf", "ten-pages": OUT / "ten-pages.pdf"}
    short_en(files["short-en"])
    ten_pages(files["ten-pages"])
    return files


if __name__ == "__main__":
    for name, path in build_all().items():
        print(f"{name}: {path} ({path.stat().st_size} bytes)")