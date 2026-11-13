# Greeting Product Notes

The greeting capability takes a visitor's name in the client and returns
a personalized greeting from the API.

| Audience | Reference |
| --- | --- |
| Product and design | [Acceptance criteria](acceptance.md) |
| Development | The `api` and `client` repository READMEs |
| QA and operations | The `e2e` repository README and probe results |

A release owner confirms the customer rollout separately from the technical
and product acceptance steps.

## Claim handoff tasks

The synthetic claim feature is separate from the greeting acceptance journey.
Use current API and worker sources to establish shared writes, regional processing,
signature-contract selection, request acceptance and eventual completion.
`e2e/business.py` runs disposable SQLite/HTTP scenarios; it does not prove a hosted
broker or any unselected downstream reporting service. A historical handbook says
all regions shared one worker in 2024; treat that as a dated claim to check against
the current region-scoped worker, not current environment evidence.
