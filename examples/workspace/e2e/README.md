# Cross-Repository Smoke Tests

Run `python3 smoke.py` from this repository. It starts the sibling API
on a free loopback port, invokes the real client and worker, checks reported
revisions against their checkouts, and stops the server.

The `stale` scenario keeps the health and business checks green while
the revision check fails. The `skipped` scenario records that the sample
deployment step did not run. See the example pack's README for exit codes.

`--scenario business-failed` makes the worker reject the greeting while component
versions and technical probes pass. `--evidence /path/to/local-record.json` exports
sanitized evidence v1, including all required components and the business journey.

`--json` replaces progress lines with a bounded JSON result containing the target,
observed component artifacts, acceptance and status. A harness doctor probe can assert
those fields while still executing this real local smoke. It does not contact a cloud
environment or establish native agent activation.

The optional claim scenario uses the source in `claims.py` (API), `sync_claims.py`
(worker) and `business.py` (e2e), in their respective repositories. Inspect actual
entry points before choosing commands. The e2e scenario owns a disposable SQLite
database and loopback server, distinguishes health/request/final outcome and checks
worker replay without claiming production access.
