"""Library commands: import, duplicates, soft delete, path resolution."""

import pytest

from helpers.ipc import invoke, invoke_expect_error


def import_book(driver, pdf_path) -> dict:
    """Add a book without the native file picker (debug-only command)."""
    book = invoke(driver, "e2e_import_book", {"filePath": str(pdf_path)})
    assert book, f"import returned nothing for {pdf_path}"
    return book


@pytest.mark.smoke
def test_import_pdf_fills_defaults(driver, pdfs):  # API-01
    book = import_book(driver, pdfs["short-en"])

    assert book["title"] == "short-en"
    assert book["format"] == "PDF"
    assert book["progress"] == 0
    assert book["file_path"].endswith("short-en.pdf")


def test_importing_the_same_file_twice_returns_the_same_book(driver, pdfs):  # API-02
    first = import_book(driver, pdfs["short-en"])
    second = import_book(driver, pdfs["short-en"])

    assert second["id"] == first["id"]
    assert len(invoke(driver, "get_all_books")) == 1


def test_reimport_after_remove_restores_book_and_highlights(driver, pdfs):  # API-03
    book = import_book(driver, pdfs["short-en"])
    invoke(driver, "add_annotation", {"annotation": {
        "id": "ann-1", "bookId": book["id"], "pageNumber": 1, "selectedText": "quick",
        "color": "#facc15", "noteText": None, "rectsJson": "[]",
        "createdAt": "2026-01-01T00:00:00+00:00", "updatedAt": "2026-01-01T00:00:00+00:00",
    }})

    invoke(driver, "delete_book", {"bookId": book["id"]})
    assert invoke(driver, "get_all_books") == []
    assert pdfs["short-en"].exists(), "removing from the list must not delete the file"

    again = import_book(driver, pdfs["short-en"])
    assert again["id"] == book["id"]
    assert len(invoke(driver, "get_annotations_by_book", {"bookId": book["id"]})) == 1


def test_removed_book_does_not_hand_out_its_path(driver, pdfs):  # API-04
    book = import_book(driver, pdfs["short-en"])
    invoke(driver, "delete_book", {"bookId": book["id"]})

    assert invoke_expect_error(driver, "resolve_book_path", {"bookId": book["id"]}).code == "BOOK_NOT_FOUND"


def test_delete_unknown_book_is_rejected(driver):
    assert invoke_expect_error(driver, "delete_book", {"bookId": "does-not-exist"}).code == "BOOK_NOT_FOUND"


@pytest.mark.xfail(reason="REQ-01: DOCX can be imported but the reader only opens PDF")
def test_docx_is_rejected_at_import(driver, tmp_path):  # API-05
    docx = tmp_path / "notes.docx"
    docx.write_bytes(b"PK\x03\x04 not really a docx")

    assert invoke_expect_error(driver, "e2e_import_book", {"filePath": str(docx)}).code == "INVALID_INPUT"


@pytest.mark.xfail(reason="BUG-11: a path that does not exist is still stored as a book")
def test_missing_file_cannot_be_imported(driver, tmp_path):
    error = invoke_expect_error(driver, "e2e_import_book", {"filePath": str(tmp_path / "ghost.pdf")})
    assert error.code in {"INVALID_INPUT", "FILE_NOT_FOUND"}