# Derive project knowledge and workflows

Use this analysis when selected repositories form a business system or an existing
harness needs the depth of a team handbook. Scale it to the selected activities;
small projects can keep one guide. Reuse existing authoritative facts and record
which source supports each conclusion.

1. **Map services and responsibilities.** For each selected repository, identify
   entry points, owned behavior, data stores, interfaces and native commands. A
   deployment unit may differ from the repository boundary. Resolve local, CI and
   deployed runtime versions separately.
2. **Follow representative business journeys.** Start with a named user action or
   recurring symptom. Trace request/event boundaries across services, identify the
   owning data and observation points, and record the expected outcome. Investigate
   implementation where configuration cannot explain the path. Mark inferred links.
3. **Map environments.** Use workflows, infrastructure and authorized observations
   to connect environment, account/project, partition, region, resource, logs and
   artifact identity. Keep declared topology separate from live verification. A
   service name is not sufficient evidence for its deployed resource name.
4. **Extract team constraints.** Read contribution rules, release procedures, schema
   migration policy, branch conventions, incident handling and existing task systems.
   Establish where each applies. Business ownership, severity criteria, approval
   requirements and historical exceptions need a source or user input.
5. **Turn repeated work into routes.** Group tasks by their real inputs and outcomes:
   setup, service/flow investigation, bounded user-state lookup, change analysis,
   testing, release verification, schema/config changes, or collaboration. Generate
   only requested useful procedures. A fixed set of legacy Skills is not a universal
   template.
6. **Check the handoffs.** A symptom should lead to a component, source, observation,
   conclusion and next action. A proposed fix should lead to the correct checkout,
   native checks and delivery path. Specialist agents return evidence to that flow;
   they do not silently enlarge the parent task's permissions.

Useful outputs include a service index, service guides, business-flow maps,
cross-service data/API contracts, environment and toolchain guides, development/test
commands, release and operational runbooks, known pitfalls and task routing. Keep a
fact in its authoritative guide and link it from procedures.

For every selected artifact, record its purpose, inputs, sources, output path and
verification method in the generation preview or accompanying analysis. Unknown
facts remain pending with a concrete way to resolve them. The generator can validate
structure and source freshness; semantic accuracy still requires this analysis and
the requested execution checks.
