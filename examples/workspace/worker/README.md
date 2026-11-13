# Greeting Worker

Process one synthetic greeting from standard input with Python 3.9 or later:

```sh
printf '%s\n' '{"message":"Hello, Casey!"}' | python3 consume.py --revision development
```

Expect an accepted receipt containing the greeting and the supplied source revision.
The cross-repository smoke supplies a full Git revision and verifies the receipt.
`--reject` is a deliberate business-failure fixture. No data is persisted.

The optional claim scenario uses the source in `claims.py` (API), `sync_claims.py`
(worker) and `business.py` (e2e), in their respective repositories. Inspect actual
entry points before choosing commands. The e2e scenario owns a disposable SQLite
database and loopback server, distinguishes health/request/final outcome and checks
worker replay without claiming production access.
