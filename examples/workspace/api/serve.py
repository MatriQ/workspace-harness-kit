#!/usr/bin/env python3
"""Serve a local greeting API for the example workspace."""

import argparse
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit


def make_server(host, port, revision):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            request = urlsplit(self.path)
            if request.path == "/health":
                self.send_json(200, {"status": "ok"})
            elif request.path == "/version":
                self.send_json(200, {"revision": revision})
            elif request.path == "/v1/greetings":
                name = parse_qs(request.query).get("name", ["Visitor"])[0]
                self.send_json(200, {"message": f"Hello, {name}!"})
            else:
                self.send_json(404, {"error": "Not found"})

        def send_json(self, status, payload):
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, format, *args):
            pass

    return ThreadingHTTPServer((host, port), Handler)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=os.environ.get("GREETING_PORT", "8000"))
    parser.add_argument("--revision", default="development")
    arguments = parser.parse_args()
    with make_server("127.0.0.1", arguments.port, arguments.revision) as server:
        print(f"Serving on http://127.0.0.1:{server.server_port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
