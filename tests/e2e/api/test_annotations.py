"""Highlights and notes through the IPC layer."""

import pytest

from helpers.ipc import invoke, invoke_expect_error, invoke_parallel

STAMP = "2026-01-01T00:00:00+00:00"


def make_annotation(book_id: str, ann_id: str, page: int = 1, **overrides) -> dict:
    base = {
        "id": ann_id, "bookId": book_id, "pageNumber": page, "selectedText": "quick brown fox",
        "color": "#facc15", "noteText": None, "rectsJson": '[{"x":10,"y":20,"w":30,"h":5}]',
        "createdAt": STAMP, "updatedAt": STAMP,
    }
    return {**base, **overrides}


@pytest.fixture
def book(driver, pdfs):
    return invoke(driver, "e2e_import_book", {"filePath": str(pdfs["ten-pages"])})


@pytest.mark.smoke
def test_annotations_come_back_in_page_order(driver, book):  # API-06
    invoke(driver, "add_annotation", {"annotation": make_annotation(book["id"], "late", 4)})
    invoke(driver, "add_annotation", {"annotation": make_annotation(book["id"], "early", 1)})

    found = invoke(driver, "get_annotations_by_book", {"bookId": book["id"]})
    assert [a["id"] for a in found] == ["early", "late"]

    page4 = invoke(driver, "get_annotations_by_page", {"bookId": book["id"], "pageNumber": 4})
    assert [a["id"] for a in page4] == ["late"]


def test_note_can_be_set_changed_and_cleared(driver, book):  # API-06
    invoke(driver, "add_annotation", {"annotation": make_annotation(book["id"], "n1")})

    invoke(driver, "update_annotation_note", {"annotationId": "n1", "noteText": "worth quoting"})
    stored = invoke(driver, "get_annotations_by_book", {"bookId": book["id"]})[0]
    assert stored["noteText"] == "worth quoting"
    assert stored["updatedAt"] != STAMP

    invoke(driver, "update_annotation_note", {"annotationId": "n1", "noteText": None})
    assert invoke(driver, "get_annotations_by_book", {"bookId": book["id"]})[0]["noteText"] is None


def test_delete_annotation_then_delete_again_fails(driver, book):  # API-06
    invoke(driver, "add_annotation", {"annotation": make_annotation(book["id"], "gone")})
    invoke(driver, "delete_annotation", {"annotationId": "gone"})

    assert invoke_expect_error(driver, "delete_annotation", {"annotationId": "gone"}).code == "ANNOTATION_NOT_FOUND"


def test_annotation_for_unknown_book_is_rejected(driver):  # API-07
    error = invoke_expect_error(
        driver, "add_annotation", {"annotation": make_annotation("no-such-book", "orphan")}
    )
    assert error.code == "DATABASE_ERROR"


def test_update_unknown_annotation_is_rejected(driver):
    error = invoke_expect_error(
        driver, "update_annotation_note", {"annotationId": "missing", "noteText": "x"}
    )
    assert error.code == "ANNOTATION_NOT_FOUND"


def test_twenty_parallel_writes_are_all_stored(driver, book):  # RES-05
    batch = [{"annotation": make_annotation(book["id"], f"p-{i}", 1 + i % 10)} for i in range(20)]

    results = invoke_parallel(driver, "add_annotation", batch)

    assert all(r["ok"] for r in results), [r for r in results if not r["ok"]][:3]
    assert len(invoke(driver, "get_annotations_by_book", {"bookId": book["id"]})) == 20


@pytest.mark.xfail(reason="BUG-09: add_annotation does not validate its input")
@pytest.mark.parametrize(
    "overrides",
    [
        {"pageNumber": 0},
        {"pageNumber": -3},
        {"selectedText": "x" * 1_000_000},
        {"rectsJson": "this is not json"},
        {"color": "javascript:alert(1)"},
    ],
    ids=["page-zero", "page-negative", "text-1MB", "rects-not-json", "color-not-hex"],
)
def test_invalid_annotation_is_rejected(driver, book, overrides):  # API-08
    error = invoke_expect_error(
        driver, "add_annotation", {"annotation": make_annotation(book["id"], "bad", **overrides)}
    )
    assert error.code == "INVALID_INPUT"