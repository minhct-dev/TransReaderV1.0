"""translate_with_google: validation, provider fallback, known provider bugs."""

import pytest

from helpers.ipc import invoke, invoke_expect_error


def translate(driver, text, lang="vi"):
    return invoke(driver, "translate_with_google", {"text": text, "targetLanguage": lang})


@pytest.mark.smoke
def test_translate_uses_google_first(driver, mock_api, google_ok):
    mock_api.respond("/google", json_body=google_ok)

    result = translate(driver, "hello world")

    assert result["translatedText"] == "Xin chào thế giới"
    assert result["originalText"] == "hello world"
    assert mock_api.count("/libre") == 0


@pytest.mark.parametrize(
    "text, lang",
    [("", "vi"), ("   ", "vi"), ("x" * 10_001, "vi"), ("hello", "fr")],
    ids=["empty", "blank", "10001-chars", "unsupported-language"],
)
def test_invalid_input_is_rejected_before_any_request(driver, mock_api, text, lang):  # API-14
    error = invoke_expect_error(driver, "translate_with_google", {"text": text, "targetLanguage": lang})

    assert error.code == "INVALID_INPUT"
    assert mock_api.count() == 0


def test_google_failure_falls_back_to_libre(driver, mock_api):  # API-15
    mock_api.respond("/google", status=500, text="boom")
    mock_api.respond("/libre", json_body={"translatedText": "Xin chào"})

    assert translate(driver, "hello")["translatedText"] == "Xin chào"
    assert mock_api.count("/google") == 1 and mock_api.count("/libre") == 1


def test_fallback_when_google_drops_the_connection(driver, mock_api):  # RES-02
    mock_api.respond("/google", text="[]", drop=True)
    mock_api.respond("/libre", json_body={"translatedText": "Xin chào"})

    assert translate(driver, "hello")["translatedText"] == "Xin chào"


def test_fallback_when_google_returns_no_sentences(driver, mock_api):
    mock_api.respond("/google", json_body=[[]])
    mock_api.respond("/libre", json_body={"translatedText": "Xin chào"})

    assert translate(driver, "hello")["translatedText"] == "Xin chào"


def test_both_providers_failing_reports_both(driver, mock_api):
    mock_api.respond("/google", status=500, text="boom")
    mock_api.respond("/libre", status=500, text="boom")

    error = invoke_expect_error(driver, "translate_with_google", {"text": "hello", "targetLanguage": "vi"})

    assert error.code == "HTTP_REQUEST_FAILED"
    assert "Google Translate failed" in error.message and "LibreTranslate failed" in error.message


def test_only_the_selected_text_is_sent_upstream(driver, mock_api, google_ok, pdfs):  # RES-08
    mock_api.respond("/google", json_body=google_ok)
    book = invoke(driver, "e2e_import_book", {"filePath": str(pdfs["short-en"])})
    translate(driver, "hello world")

    sent = mock_api.hits("/google")[0]
    leaked = [v for v in sent.query.values() if "short-en" in v or "\\" in v or ".pdf" in v]
    assert not leaked, f"request leaked local data: {leaked}"
    assert book["id"] not in str(sent.query)


@pytest.mark.xfail(reason="BUG-01: LibreTranslate now requires an api_key and the app sends none")
def test_libre_request_carries_an_api_key(driver, mock_api):  # API-16
    mock_api.respond("/google", status=500, text="boom")
    mock_api.respond("/libre", json_body={"translatedText": "x"})
    translate(driver, "hello")

    assert "api_key" in mock_api.hits("/libre")[0].form


@pytest.mark.xfail(reason="BUG-02: Chinese maps to zh-Hant on Libre but simplified on Google")
def test_chinese_fallback_uses_simplified(driver, mock_api):  # API-17
    mock_api.respond("/google", status=500, text="boom")
    mock_api.respond("/libre", json_body={"translatedText": "电脑"})
    translate(driver, "computer", "zh")

    assert mock_api.hits("/libre")[0].form["target"] == "zh-Hans"


@pytest.mark.xfail(reason="BUG-03: long text is sent as a GET query; Google rejects it")
def test_long_text_is_not_sent_in_the_url(driver, mock_api, google_ok):  # API-18
    mock_api.respond("/google", json_body=google_ok)
    translate(driver, "\u6d4b" * 2500)

    assert mock_api.hits("/google")[0].url_length < 8000


@pytest.mark.xfail(reason="BUG-04: the error shown to the user can contain raw HTML")
def test_error_message_has_no_html(driver, mock_api):  # API-19
    html = "<!DOCTYPE html><html><title>Error 400</title></html>"
    mock_api.respond("/google", status=400, text=html, content_type="text/html")
    mock_api.respond("/libre", status=400, text=html, content_type="text/html")

    error = invoke_expect_error(driver, "translate_with_google", {"text": "hello", "targetLanguage": "vi"})

    assert "<" not in error.message