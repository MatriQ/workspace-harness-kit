#!/usr/bin/env python3
"""Exercise three real local components and optionally export release evidence v1."""

import argparse
from contextlib import nullcontext, redirect_stdout
import io
from datetime import datetime, timezone
import importlib
import json
import subprocess
import sys
import threading
from pathlib import Path
from urllib.request import urlopen


WORKSPACE = Path(__file__).resolve().parents[1]
API = WORKSPACE / "api"
CLIENT = WORKSPACE / "client"
WORKER = WORKSPACE / "worker"


def read_json(url):
    with urlopen(url, timeout=5) as response:
        return json.load(response)


def command(*args, **kwargs):
    return subprocess.check_output(list(map(str, args)), text=True, timeout=10, **kwargs).strip()


def check(label, actual, expected):
    passed = actual == expected
    print(f"{'PASS' if passed else 'FAIL'} {label}: expected {expected!r}, observed {actual!r}")
    return passed


def identity(revision):
    return {"kind": "git_commit", "value": revision}


def record_for(revisions):
    return {
        "schema_version": 1, "release": "local-greeting-fixture", "capability": "greeting",
        "scope": {
            "target": {"environment": "local", "identity": "synthetic/greeting"}, "max_age_seconds": 3600,
            "components": [{"id": name, "artifact": identity(revision),
                            "required_checks": ["deployment", "version", "technical"],
                            "not_applicable": {"business": "Covered by the greeting journey"},
                            "criteria": {"deployment": "The local fixture was started or invoked",
                                         "version": "Observed source revision matches the selected checkout",
                                         "technical": "The component responds to its representative request"}}
                           for name, revision in revisions.items()],
            "journeys": [{"id": "greeting", "components": list(revisions),
                          "criterion": "The worker accepts the client's Hello, Casey! greeting"}],
        }, "observations": [],
    }


def add(record, name, check_name, status, summary, *, revision=None, artifacts=None, journey=False):
    item = {"journey" if journey else "component": name, "check": check_name, "attempt": 1,
            "status": status, "target": dict(record["scope"]["target"]),
            "observed_at": datetime.now(timezone.utc).isoformat(), "summary": summary,
            "evidence": [f"local-fixture:{name}/{check_name}/1"]}
    if revision is not None:
        item["artifact"] = identity(revision)
    if artifacts is not None:
        item["artifacts"] = {key: identity(value) for key, value in artifacts.items()}
    record["observations"].append(item)


def run_probes(scenario, record, revisions):
    served_revision = "0" * 40 if scenario == "stale" else revisions["api"]
    sys.path.insert(0, str(API))
    server = importlib.import_module("serve").make_server("127.0.0.1", 0, served_revision)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    with server:
        thread.start()
        try:
            base_url = f"http://127.0.0.1:{server.server_port}"
            health = read_json(f"{base_url}/health")
            api_version = read_json(f"{base_url}/version")["revision"]
            greeting = command(sys.executable, CLIENT / "greet.py", "Casey", "--base-url", base_url)
            client_version = command(sys.executable, CLIENT / "greet.py", "--version")
            worker_args = [sys.executable, WORKER / "consume.py", "--revision", revisions["worker"]]
            if scenario == "business-failed":
                worker_args.append("--reject")
            receipt = json.loads(command(*worker_args, input=json.dumps({"message": greeting})))
            observed = {"api": api_version, "client": client_version, "worker": receipt["revision"]}
            technical = {"api": health["status"] == "ok", "client": greeting == "Hello, Casey!",
                         "worker": receipt["message"] == greeting}
            results = []
            for name, revision in revisions.items():
                add(record, name, "deployment", "passed", "Local fixture invocation completed")
                # Collection succeeded; the evidence evaluator compares the identities.
                add(record, name, "version", "passed", "Read the runtime's declared revision", revision=observed[name])
                add(record, name, "technical", "passed" if technical[name] else "failed",
                    "Representative request completed" if technical[name] else "Unexpected probe result", revision=observed[name])
                results.extend([check(f"{name} technical", technical[name], True),
                                check(f"{name} revision", observed[name], revision)])
            accepted = receipt["accepted"] and receipt["message"] == "Hello, Casey!"
            results.append(check("business journey", accepted, True))
            add(record, "greeting", "business", "passed" if accepted else "failed",
                "Worker accepted the greeting" if accepted else "Worker rejected the greeting", artifacts=observed, journey=True)
            return 0 if all(results) else 1
        finally:
            server.shutdown()
            thread.join()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scenario", choices=("expected", "stale", "skipped", "business-failed"), default="expected")
    parser.add_argument("--evidence", type=Path, help="Write a sanitized evidence-v1 JSON record to this local path")
    parser.add_argument("--json", action="store_true", help="Return bounded target and observed artifact assertions for a harness doctor probe")
    args = parser.parse_args()
    revisions = {name: command("git", "-C", WORKSPACE / name, "rev-parse", "HEAD") for name in ("api", "client", "worker")}
    record = record_for(revisions)
    with redirect_stdout(io.StringIO()) if args.json else nullcontext():
        if args.scenario == "skipped":
            for name in revisions:
                add(record, name, "deployment", "not run", "The local deployment fixture was explicitly skipped")
            print("NOT RUN deployment fixture: no runtime was started")
            status = 2
        else:
            status = run_probes(args.scenario, record, revisions)
    if args.evidence:
        args.evidence.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    if args.json:
        journey = next((item for item in record["observations"] if item.get("journey") == "greeting"), {})
        print(json.dumps({"target": record["scope"]["target"], "artifacts": journey.get("artifacts", {}),
                          "accepted": journey.get("status") == "passed", "status": "passed" if status == 0 else "pending" if status == 2 else "failed"}))
    return status


if __name__ == "__main__":
    sys.exit(main())
