# Greeting API

Run `python3 serve.py` from this repository. Python 3.9 or later is sufficient.
The server listens on loopback only. Set `GREETING_PORT` in your shell to
change the port, or pass `--port` for a one-off override. The sample environment
file lists the default, and the app reads the shell environment at startup.

- `GET /health` checks availability.
- `GET /version` reports the revision supplied at startup.
- `GET /v1/greetings?name=Casey` returns `{"message": "Hello, Casey!"}`.

Use the sibling `e2e` repository to test a real request through the client.
The revision endpoint identifies the source version in this example.

The optional claim scenario uses the source in `claims.py` (API), `sync_claims.py`
(worker) and `business.py` (e2e), in their respective repositories. Inspect actual
entry points before choosing commands. The e2e scenario owns a disposable SQLite
database and loopback server, distinguishes health/request/final outcome and checks
worker replay without claiming production access.
