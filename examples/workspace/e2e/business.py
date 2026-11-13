#!/usr/bin/env python3
"""Exercise real local claim behavior; health, acceptance and completion stay separate."""

import importlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener


WORKSPACE = Path(__file__).resolve().parents[1]


def request(url, payload=None, signature="request-v1"):
    query = Request(url, data=json.dumps(payload).encode() if payload is not None else None,
                    headers={"Content-Type": "application/json", "X-Signature-Kind": signature})
    try:
        with build_opener(ProxyHandler({})).open(query, timeout=5) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        return error.code, json.load(error)


def exercise(enabled=True, signature="request-v1", worker_region="eu"):
    sys.path.insert(0, str(WORKSPACE / "api"))
    with tempfile.TemporaryDirectory(prefix="synthetic-claims-") as temporary:
        database = str(Path(temporary) / "claims.sqlite")
        server = importlib.import_module("serve").make_server("127.0.0.1", 0, "synthetic", database=database, claims_enabled=enabled)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        with server:
            thread.start()
            try:
                base = f"http://127.0.0.1:{server.server_port}"
                health = request(base + "/health")
                accepted = request(base + "/v1/claims", {"id": "case-1", "region": "eu"}, signature)
                before = request(base + "/v1/claims?id=case-1")[1]
                worker = subprocess.run([sys.executable, str(WORKSPACE / "worker/sync_claims.py"), "--database", database,
                                         "--region", worker_region], capture_output=True, text=True, timeout=10, check=True)
                after = request(base + "/v1/claims?id=case-1")[1]
                replay = subprocess.run([sys.executable, str(WORKSPACE / "worker/sync_claims.py"), "--database", database,
                                         "--region", worker_region], capture_output=True, text=True, timeout=10, check=True)
                return {"technical": "passed" if health == (200, {"status": "ok"}) else "failed",
                        "request_status": accepted[0], "request": accepted[1], "before": before, "after": after,
                        "worker": json.loads(worker.stdout), "replay": json.loads(replay.stdout),
                        "business": "passed" if after["state"] == "active" else "failed", "cleanup": "completed"}
            finally:
                server.shutdown()
                thread.join(timeout=5)
                assert not thread.is_alive(), "The owned API thread did not stop"


def main():
    cases = {"accepted": exercise(), "denied": exercise(enabled=False),
             "signature-mismatch": exercise(signature="callback-v2"), "wrong-worker-region": exercise(worker_region="us")}
    assert cases["accepted"]["request_status"] == 202 and cases["accepted"]["before"]["state"] == "pending"
    assert cases["accepted"]["after"]["state"] == "active" and cases["accepted"]["replay"]["processed"] == 0
    assert cases["denied"]["request_status"] == 403 and cases["denied"]["business"] == "failed"
    assert cases["signature-mismatch"]["request_status"] == 401
    assert cases["wrong-worker-region"]["request_status"] == 202 and cases["wrong-worker-region"]["after"]["pending_events"] == 1
    assert all(case["technical"] == "passed" for case in cases.values())
    assert all(case["business"] == "failed" for name, case in cases.items() if name != "accepted")
    print(json.dumps({"scope": "isolated SQLite/outbox fixture, not a hosted broker or full external chain", "cases": cases}, indent=2))


if __name__ == "__main__":
    main()
