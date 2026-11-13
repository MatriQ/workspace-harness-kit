#!/usr/bin/env python3
"""Process the synthetic shared claim outbox for one explicitly selected region."""

import argparse
import json
import sqlite3


def synchronize(database, region):
    processed = 0
    with sqlite3.connect(database) as connection:
        events = connection.execute("SELECT id FROM outbox WHERE region = ? ORDER BY id", (region,)).fetchall()
        for (identity,) in events:
            # Region-scoped writes and the event removal commit together; replay is idempotent.
            connection.execute("UPDATE licenses SET state = 'active' WHERE id = ? AND region = ?", (identity, region))
            connection.execute("DELETE FROM outbox WHERE id = ? AND region = ?", (identity, region))
            processed += 1
    return {"processed": processed, "region": region}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True)
    parser.add_argument("--region", required=True, choices=("eu", "us"))
    args = parser.parse_args()
    print(json.dumps(synchronize(args.database, args.region)))


if __name__ == "__main__":
    main()
