"""Synthetic regional claims and shared SQLite outbox; no hosted integration."""

import json
import sqlite3


def connect(database):
    connection = sqlite3.connect(database)
    connection.executescript("""
        CREATE TABLE IF NOT EXISTS licenses (id TEXT PRIMARY KEY, region TEXT, state TEXT);
        CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, region TEXT, payload TEXT);
    """)
    return connection


def claim(database, identity, region, *, enabled=True, signature_kind="request-v1"):
    # The fixture models signature-contract selection, not cryptographic authentication.
    if signature_kind != "request-v1":
        return 401, {"code": "signature_contract_mismatch", "accepted": False}
    if region not in {"eu", "us"}:
        return 400, {"code": "unknown_region", "accepted": False}
    if not enabled:
        return 403, {"code": "claims_disabled", "accepted": False}
    if not isinstance(identity, str) or not identity or len(identity) > 80:
        return 400, {"code": "invalid_id", "accepted": False}
    with connect(database) as connection:
        previous = connection.execute("SELECT region, state FROM licenses WHERE id = ?", (identity,)).fetchone()
        if previous and previous[0] != region:
            return 409, {"code": "region_conflict", "accepted": False}
        connection.execute("INSERT OR IGNORE INTO licenses VALUES (?, ?, 'pending')", (identity, region))
        if not previous or previous[1] != "active":
            connection.execute("INSERT OR IGNORE INTO outbox VALUES (?, ?, ?)", (identity, region, json.dumps({"id": identity})))
    return 202, {"id": identity, "accepted": True, "completed": bool(previous and previous[1] == "active")}


def observe(database, identity):
    with connect(database) as connection:
        row = connection.execute("SELECT region, state FROM licenses WHERE id = ?", (identity,)).fetchone()
        pending = connection.execute("SELECT COUNT(*) FROM outbox WHERE id = ?", (identity,)).fetchone()[0]
    return {"id": identity, "region": row[0] if row else None, "state": row[1] if row else "missing", "pending_events": pending}
