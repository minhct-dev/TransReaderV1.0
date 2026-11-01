"""lookup_dictionary: cache behaviour, error mapping, input rules."""

import sqlite3

import pytest

from conftest import db_path
from helpers.ipc import invoke, invoke_expect_error, invoke_parallel


def lookup(driver, word):
    return invoke(driver, "lookup_dictionary", {"word": word})


@pytest.mark.smoke
def test_lookup_returns_entries(driver, mock_api, hello_entry):
    mock_api.respond("/dictionary/hello", json_body=hello_entry)

    entries = lookup(driver, "hello")

    assert entries[0]["word"] == "hello"
    assert entries[0]["meanings"][0]["partOfSpeech"] == "interjection"


def test_cache_is_shared_across_letter_case(driver, mock_api, hello_entry):  # API-09
    mock_api.respond("/dictionary/hello", json_body=hello_entry)

    lookup(driver, "Hello")
    lookup(driver, "hello")
    lookup(driver, "  HELLO ")

    assert mock_api.count("/dictionary/hello") == 1


def test_cached_word_works_offline(driver, mock_api, hello_entry):  # API-10
    mock_api.respond("/dictionary/hello", json_body=hello_entry)
    lookup(driver, "hello")

    mock_api.offline = True

    assert lookup(driver, "hello")[0]["word"] == "hello"


def test_unknown_word_maps_to_word_not_found(driver, mock_api):  # API-11
    mock_api.respond("/dictionary/zzzzqx", status=404, json_body={"title": "No Definitions Found"})

    assert invoke_expect_error(driver, "lookup_dictionary", {"word": "zzzzqx"}).code == "WORD_NOT_FOUND"


def test_html_with_status_200_maps_to_invalid_response(driver, mock_api):  # API-11
    mock_api.respond("/dictionary/oops", text="<html>maintenance</html>", content_type="text/html")

    assert invoke_expect_error(driver, "lookup_dictionary", {"word": "oops"}).code == "INVALID_RESPONSE"


def test_server_error_maps_to_http_request_failed(driver, mock_api):
    mock_api.respond("/dictionary/boom", status=503, text="unavailable")

    assert invoke_expect_error(driver, "lookup_dictionary", {"word": "boom"}).code == "HTTP_REQUEST_FAILED"


def test_corrupt_cache_row_is_ignored_and_refetched(driver, mock_api, hello_entry):  # API-11
    mock_api.respond("/dictionary/hello", json_body=hello_entry)
    lookup(driver, "hello")
    with sqlite3.connect(db_path(), timeout=10) as db:
        db.execute("UPDATE dictionary_cache SET data_json = 'not json' WHERE word = 'hello'")

    assert lookup(driver, "hello")[0]["word"] == "hello"
    assert mock_api.count("/dictionary/hello") == 2


@pytest.mark.parametrize("word", ["", "   ", "two words", "123", "a/b"])
def test_input_that_is_not_one_word_is_rejected(driver, word):  # API-12
    assert invoke_expect_error(driver, "lookup_dictionary", {"word": word}).code == "INVALID_INPUT"


def test_punctuation_around_a_word_is_trimmed(driver, mock_api, hello_entry):
    mock_api.respond("/dictionary/hello", json_body=hello_entry)

    assert lookup(driver, "hello,")[0]["word"] == "hello"


@pytest.mark.xfail(reason="BUG-05: backend rejects the curly apostrophe U+2019")
def test_curly_apostrophe_counts_as_one_word(driver, mock_api, dont_entry):  # API-13
    mock_api.respond("/dictionary/don't", json_body=dont_entry)

    assert lookup(driver, "don\u2019t")[0]["word"] == "don't"


def test_connection_cut_mid_response_is_reported(driver, mock_api):  # RES-02
    mock_api.respond("/dictionary/cutoff", text="[]", drop=True)

    assert invoke_expect_error(driver, "lookup_dictionary", {"word": "cutoff"}).code == "HTTP_REQUEST_FAILED"


def test_offline_then_online_recovers(driver, mock_api, hello_entry):  # RES-02
    mock_api.respond("/dictionary/hello", json_body=hello_entry)
    mock_api.offline = True
    assert invoke_expect_error(driver, "lookup_dictionary", {"word": "hello"}).code == "HTTP_REQUEST_FAILED"

    mock_api.offline = False
    assert lookup(driver, "hello")[0]["word"] == "hello"


@pytest.mark.parametrize("status", [429, 502, 503])
def test_transient_errors_are_not_cached(driver, mock_api, hello_entry, status):  # RES-03
    mock_api.respond("/dictionary/hello", status=status, text="try later")
    assert invoke_expect_error(driver, "lookup_dictionary", {"word": "hello"}).code == "HTTP_REQUEST_FAILED"

    mock_api.respond("/dictionary/hello", json_body=hello_entry)
    assert lookup(driver, "hello")[0]["word"] == "hello"


def test_fifty_parallel_lookups_keep_one_cache_row(driver, mock_api, hello_entry):  # RES-04
    mock_api.respond("/dictionary/hello", json_body=hello_entry)

    results = invoke_parallel(driver, "lookup_dictionary", [{"word": "hello"}] * 50)

    assert all(r["ok"] for r in results), [r for r in results if not r["ok"]][:3]
    with sqlite3.connect(db_path(), timeout=10) as db:
        rows = db.execute("SELECT COUNT(*) FROM dictionary_cache WHERE word = 'hello'").fetchone()[0]
    assert rows == 1, "upsert must keep one row per word"
    # Informational: identical in-flight requests are not merged, so up to 50 reach the stub.
    print(f"RES-04 upstream hits for 50 parallel lookups: {mock_api.count('/dictionary/hello')}")