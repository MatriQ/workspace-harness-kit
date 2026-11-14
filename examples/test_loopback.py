#!/usr/bin/env python3
"""Verify the local HTTP fixture without depending on reverse DNS."""

from http.client import HTTPConnection
import json
from pathlib import Path
import sys
import threading
import unittest
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parent / "workspace/api"))
from serve import make_server


class LoopbackServerTest(unittest.TestCase):
    def test_requests_work_when_reverse_dns_is_unavailable(self):
        with patch("socket.gethostbyaddr", side_effect=AssertionError("Reverse DNS is unavailable")):
            with make_server("127.0.0.1", 0, "fixture-revision") as server:
                self.assertEqual(server.server_name, "127.0.0.1")
                self.assertGreater(server.server_port, 0)
                thread = threading.Thread(target=server.serve_forever, daemon=True)
                thread.start()
                connection = HTTPConnection("127.0.0.1", server.server_port, timeout=5)
                try:
                    for endpoint, expected in (("/health", {"status": "ok"}),
                                               ("/version", {"revision": "fixture-revision"})):
                        connection.request("GET", endpoint)
                        response = connection.getresponse()
                        self.assertEqual(response.status, 200)
                        self.assertEqual(json.load(response), expected)
                finally:
                    connection.close()
                    server.shutdown()
                    thread.join(timeout=5)
                    self.assertFalse(thread.is_alive(), "The owned HTTP thread did not stop")


if __name__ == "__main__":
    unittest.main()
