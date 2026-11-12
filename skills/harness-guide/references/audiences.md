# Guide by audience

The user can ask in natural language. Choose the details that answer the question, and point to the authoritative sources for follow-up.

| Audience or task | Start with | Answer with |
| --- | --- | --- |
| Marketing or business development | Approved product materials, release evidence, confirmed audience or region | Availability, eligible audience, confirmed launch timing, and approved wording or the approval owner. |
| Product or design | Requirement, feature map, delivery links, acceptance criteria | Components and dependencies, decisions and owners, environment, criteria, and acceptance evidence. |
| Engineering | Workspace member registry, component docs, native commands and repository rules | Repository or module, working directory, applicable constraints, setup, and fast or required checks. |
| QA | Change set, test guide, data policy, environment and runtime observation | Impacted scenarios, test selection, target version, setup or fixtures, expected result, and coverage gaps. |
| Operations | Release job, runtime identity, monitors and rollback runbook | Deployment order, observed artifact, service state, observation window, technical smoke, and recovery checks. |
| Support or delivery | Product behavior, approved troubleshooting guide, issue and release records | Affected users, where to report, known workaround when sourced, and the environment where a fix was verified. |

A capability spanning multiple repositories inherits the state of its required dependencies. A merged pull request establishes merge state. An executed deployment and an observed runtime version establish deployment and version states. A tested business flow and any required approval establish acceptance. Quote each state from its evidence and avoid guessing public availability from technical health.
