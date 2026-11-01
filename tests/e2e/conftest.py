"""Fixtures for the TransReader API tests.

The app under test is the *debug* build, started by tauri-driver with its own
identifier (com.minhct.transreader.e2e), so its SQLite file, localStorage and
IndexedDB never touch your real library. Third-party APIs are replaced by a
local stub through TRANSREADER_*_URL variables.

Build once (run-api-tests.ps1 -Build does this):
    npx tauri build --debug --no-bundle --config src-tauri/tauri.e2e.conf.json
"""

from __future__ import annotations

import contextlib
import json
import os
import socket
import sqlite3
import subprocess
import time
from pathlib import Path

import pytest
from selenium import webdriver
from selenium.webdriver.common.options import ArgOptions

from fixtures import make_pdfs
from helpers.mock_api import MockApi

ROOT = Path(__file__).resolve().parents[2]
EXE = ROOT / "src-tauri" / "target" / "debug" / "minhct-transreader.exe"
IDENTIFIER = "com.minhct.transreader.e2e"
DRIVER_PORT = 4444
FIXTURE_API = Path(__file__).parent / "fixtures" / "api"
REPORTS = Path(__file__).parent / "reports"


def data_dir() -> Path:
    """Where Tauri keeps the e2e app's reader.db (app_data_dir)."""
    if os.name == "nt":
        return Path(os.environ["APPDATA"]) / IDENTIFIER
    return Path.home() / ".local" / "share" / IDENTIFIER


def db_path() -> Path:
    return data_dir() / "reader.db"


def _wait_for_port(port: int, timeout: float = 20.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with socket.socket() as sock:
            if sock.connect_ex(("127.0.0.1", port)) == 0:
                return
        time.sleep(0.2)
    raise TimeoutError(f"tauri-driver did not open port {port}")


class App:
    """One running instance of the app plus its WebDriver session."""

    def __init__(self):
        self.driver: webdriver.Remote | None = None
        self.start()

    def start(self):
        options = ArgOptions()
        options.set_capability("browserName", "wry")
        options.set_capability("tauri:options", {"application": str(EXE)})
        self.driver = webdriver.Remote(f"http://127.0.0.1:{DRIVER_PORT}", options=options)
        # The Rust HTTP client gives up after 10 s; leave room above that.
        self.driver.set_script_timeout(25)

    def stop(self):
        if self.driver is not None:
            with contextlib.suppress(Exception):
                self.driver.quit()
            self.driver = None

    def restart(self, kill: bool = False):
        """kill=True simulates a crash: the process dies without a clean shutdown."""
        if kill:
            subprocess.run(["taskkill", "/F", "/IM", EXE.name], check=False, capture_output=True)
            time.sleep(1.0)
        self.stop()
        self.start()


def pytest_configure(config):
    REPORTS.mkdir(exist_ok=True)


@pytest.fixture(scope="session")
def mock_api():
    with MockApi() as api:
        yield api


@pytest.fixture(scope="session")
def pdfs() -> dict[str, Path]:
    return make_pdfs.build_all()


@pytest.fixture(scope="session")
def app(mock_api):
    if not EXE.exists():
        pytest.exit(
            "Debug build not found. Run: run-api-tests.ps1 -Build "
            "(npx tauri build --debug --no-bundle --config src-tauri/tauri.e2e.conf.json)",
            returncode=2,
        )
    env = {
        **os.environ,
        # tauri:options has no env field, so the app inherits these from tauri-driver.
        "TRANSREADER_DICTIONARY_URL": f"{mock_api.url}/dictionary",
        "TRANSREADER_GOOGLE_TRANSLATE_URL": f"{mock_api.url}/google",
        "TRANSREADER_LIBRE_TRANSLATE_URL": f"{mock_api.url}/libre",
    }
    driver_process = subprocess.Popen(["tauri-driver", "--port", str(DRIVER_PORT)], env=env)
    instance = None
    try:
        _wait_for_port(DRIVER_PORT)
        instance = App()
        yield instance
    finally:
        if instance is not None:
            instance.stop()
        driver_process.terminate()


@pytest.fixture(autouse=True)
def clean_state(app, mock_api):
    """Every test starts from an empty library and a quiet stub."""
    mock_api.reset()
    with sqlite3.connect(db_path(), timeout=10) as db:
        db.executescript(
            "DELETE FROM book_annotations; DELETE FROM books; DELETE FROM dictionary_cache;"
        )
    yield


@pytest.fixture
def driver(app):
    return app.driver


def _load(name: str):
    return json.loads((FIXTURE_API / name).read_text(encoding="utf-8"))


@pytest.fixture
def hello_entry():
    return _load("dictionary_hello.json")


@pytest.fixture
def dont_entry():
    return _load("dictionary_dont.json")


@pytest.fixture
def google_ok():
    return _load("google_ok.json")


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    if report.when == "call" and report.failed:
        app = item.funcargs.get("app")
        if app is not None and app.driver is not None:
            with contextlib.suppress(Exception):
                name = item.nodeid.replace("/", "_").replace("::", "__").replace(" ", "_")
                app.driver.save_screenshot(str(REPORTS / f"{name}.png"))