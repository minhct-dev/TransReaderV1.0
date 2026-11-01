"""A stub for the third-party APIs, driven by the tests.

Routes: /dictionary/<word>, /google, /libre. Each can return a canned body,
add a delay, cut the connection, or go offline. Every request is recorded.
"""

from __future__ import annotations

import json
import threading
import time
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse


@dataclass
class Rule:
    status: int = 200
    body: bytes = b"{}"
    content_type: str = "application/json"
    delay: float = 0.0
    drop: bool = False  # promise a long body, send 5 bytes, close the socket


@dataclass
class Hit:
    method: str
    path: str
    query: dict
    form: dict
    url_length: int


@dataclass
class MockApi:
    _rules: dict = field(default_factory=dict)
    _hits: list = field(default_factory=list)
    _lock: threading.Lock = field(default_factory=threading.Lock)
    offline: bool = False
    _server: ThreadingHTTPServer | None = None

    def __enter__(self) -> "MockApi":
        api = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *_):  # keep pytest output clean
                pass

            def _handle(self):
                parsed = urlparse(self.path)
                length = int(self.headers.get("Content-Length") or 0)
                raw = self.rfile.read(length).decode("utf-8", "replace") if length else ""
                hit = Hit(
                    method=self.command,
                    path=unquote(parsed.path),
                    query={k: v[0] for k, v in parse_qs(parsed.query).items()},
                    form={k: v[0] for k, v in parse_qs(raw).items()},
                    url_length=len(self.path),
                )
                with api._lock:
                    api._hits.append(hit)
                    rule = api._match(hit.path)
                    offline = api.offline

                if offline:
                    self.close_connection = True
                    self.connection.close()
                    return
                if rule.delay:
                    time.sleep(rule.delay)
                if rule.drop:
                    self.send_response(rule.status)
                    self.send_header("Content-Length", str(len(rule.body) + 1000))
                    self.end_headers()
                    self.wfile.write(rule.body[:5])
                    self.wfile.flush()
                    self.close_connection = True
                    self.connection.close()
                    return
                self.send_response(rule.status)
                self.send_header("Content-Type", rule.content_type)
                self.send_header("Content-Length", str(len(rule.body)))
                self.end_headers()
                self.wfile.write(rule.body)

            do_GET = do_POST = _handle

        self._server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self._server.daemon_threads = True
        threading.Thread(target=self._server.serve_forever, daemon=True).start()
        return self

    def __exit__(self, *_):
        if self._server:
            self._server.shutdown()
            self._server.server_close()

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self._server.server_address[1]}"

    def respond(self, path: str, *, status: int = 200, json_body=None, text: str | None = None,
                content_type: str | None = None, delay: float = 0.0, drop: bool = False):
        """Register what `path` answers. A trailing * matches any suffix."""
        if json_body is not None:
            body, ctype = json.dumps(json_body).encode(), "application/json"
        else:
            body, ctype = (text or "").encode(), content_type or "text/plain"
        with self._lock:
            self._rules[path] = Rule(status, body, content_type or ctype, delay, drop)

    def hits(self, path_prefix: str = "") -> list[Hit]:
        with self._lock:
            return [h for h in self._hits if h.path.startswith(path_prefix)]

    def count(self, path_prefix: str = "") -> int:
        return len(self.hits(path_prefix))

    def reset(self):
        with self._lock:
            self._rules.clear()
            self._hits.clear()
            self.offline = False

    def _match(self, path: str) -> Rule:
        if path in self._rules:
            return self._rules[path]
        for pattern, rule in self._rules.items():
            if pattern.endswith("*") and path.startswith(pattern[:-1]):
                return rule
        return Rule(status=404, body=b'{"title":"No Definitions Found"}')