"""Call Tauri commands from Python through the webview."""

from __future__ import annotations

from typing import Any


class IpcError(Exception):
    """A command rejected. `code` is the Rust AppError code, e.g. INVALID_INPUT."""

    def __init__(self, error: Any):
        super().__init__(error)
        self.error = error
        self.code = error.get("code") if isinstance(error, dict) else None
        self.message = error.get("message") if isinstance(error, dict) else str(error)


_INVOKE_JS = """
const done = arguments[arguments.length - 1];
window.__TAURI_INTERNALS__.invoke(arguments[0], arguments[1])
  .then(ok => done({ ok }), err => done({ err }));
"""

# Fire many invokes at once and report which succeeded.
_PARALLEL_JS = """
const done = arguments[arguments.length - 1];
const [cmd, argsList] = [arguments[0], arguments[1]];
Promise.allSettled(argsList.map(a => window.__TAURI_INTERNALS__.invoke(cmd, a)))
  .then(results => done(results.map(r => r.status === 'fulfilled'
      ? { ok: true } : { ok: false, error: r.reason })));
"""


def invoke(driver, cmd: str, args: dict | None = None) -> Any:
    """Same entry point @tauri-apps/api uses (core.js). It is an internal API,
    so keep every use of it in this module."""
    result = driver.execute_async_script(_INVOKE_JS, cmd, args or {})
    if "err" in result:
        raise IpcError(result["err"])
    return result.get("ok")


def invoke_expect_error(driver, cmd: str, args: dict | None = None) -> IpcError:
    """Return the IpcError, or fail the test when the command succeeds."""
    try:
        value = invoke(driver, cmd, args)
    except IpcError as error:
        return error
    raise AssertionError(f"{cmd} should have been rejected but returned {value!r}")


def invoke_parallel(driver, cmd: str, args_list: list[dict]) -> list[dict]:
    return driver.execute_async_script(_PARALLEL_JS, cmd, args_list)