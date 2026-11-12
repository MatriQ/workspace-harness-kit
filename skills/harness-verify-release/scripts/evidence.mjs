#!/usr/bin/env node
// Generated from TypeScript by scripts/build.mjs. Do not edit.

// src/cli/evidence.ts
import path from "node:path";

// src/adapters/files.ts
import fs from "node:fs";

// src/core/json.ts
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, sorted(item)]));
  }
  return value;
}
function equal(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function fullMatch(pattern, value) {
  return pattern.exec(value)?.[0] === value;
}

// src/core/evidence.ts
var CHECKS = ["business", "deployment", "technical", "version"];
var STATUSES = ["passed", "failed", "pending", "not run"];
var ARTIFACTS = ["git_commit", "oci_manifest_digest", "oci_index_digest", "package_version", "runtime_revision"];
var EvidenceError = class extends Error {
  name = "EvidenceError";
};
function requireEvidence(condition, message) {
  if (!condition) throw new EvidenceError(message);
}
function object(value, name, required, optional2 = []) {
  requireEvidence(isObject(value), `${name} must be an object`);
  requireEvidence(required.every((key) => Object.hasOwn(value, key)), `${name} is missing required fields`);
  requireEvidence(Object.keys(value).every((key) => [...required, ...optional2].includes(key)), `${name} has unknown fields`);
}
function text(value, name) {
  requireEvidence(
    typeof value === "string" && value.trim() && [...value].length <= 2e3,
    `${name} must be nonempty text (at most 2000 characters)`
  );
}
function identifier(value, name) {
  requireEvidence(typeof value === "string" && fullMatch(/^[a-z0-9][a-z0-9._-]*$/, value), `Invalid ${name}`);
}
function timestamp(value) {
  text(value, "timestamp");
  const match = /^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  requireEvidence(match && match[0] === value, "Timestamp must be an ISO 8601 datetime with a timezone");
  const [, y, m, d, h, min, s, fraction = "", zone] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  requireEvidence(year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] && Number(h) < 24 && Number(min) < 60 && Number(s) < 60 && (zone === "Z" || Number(zone.slice(1, 3)) < 24 && Number(zone.slice(4)) < 60), "Invalid timestamp");
  const milliseconds = Date.parse(`${y}-${m}-${d}T${h}:${min}:${s}${zone}`) + Number(`0.${fraction || "0"}`) * 1e3;
  requireEvidence(Number.isFinite(milliseconds), "Invalid timestamp");
  return milliseconds;
}
function isoTime(time) {
  const seconds = Math.floor(time / 1e3) * 1e3;
  const fraction = Math.round((time - seconds) * 1e3);
  return new Date(seconds).toISOString().replace(".000Z", fraction ? `.${String(fraction).padStart(6, "0")}+00:00` : "+00:00");
}
function validateTarget(value) {
  object(value, "target", ["environment", "identity"]);
  for (const [key, item] of Object.entries(value)) text(item, `target.${key}`);
}
function validateArtifact(value) {
  object(value, "artifact", ["kind", "value"], ["platform"]);
  requireEvidence(typeof value.kind === "string" && ARTIFACTS.includes(value.kind), "Unsupported artifact identity kind; mutable tags are not evidence");
  text(value.value, "artifact.value");
  if ("platform" in value) text(value.platform, "artifact.platform");
  if (value.kind === "git_commit") requireEvidence(fullMatch(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/, value.value), "git_commit requires a full lowercase SHA");
  else if (value.kind.startsWith("oci_")) requireEvidence(fullMatch(/^sha256:[a-f0-9]{64}$/, value.value), "OCI identities require a sha256 digest");
  else requireEvidence(!["latest", "main", "master", "head", "unknown"].includes(value.value.toLowerCase()) && !/[\s*^~<>=]/.test(value.value), "Artifact must be an exact resolved version or revision");
}
function validateRefs(values) {
  requireEvidence(Array.isArray(values), "Evidence references must be a list");
  for (const value of values) {
    text(value, "evidence reference");
    requireEvidence(!/[\r\n]/.test(value) && [...value].length <= 500, "Use short evidence references, not raw logs");
    if (value.includes("://")) {
      let url;
      try {
        url = new URL(value);
      } catch {
        throw new EvidenceError("Invalid evidence URL");
      }
      requireEvidence(
        !url.username && !url.password && !url.search && !url.hash,
        "Evidence URLs must not contain user credentials, queries, or fragments"
      );
    }
  }
}
function uniqueNames(values, name) {
  requireEvidence(Array.isArray(values), `${name} must be a list`);
  for (const value of values) identifier(value, name);
  requireEvidence(values.length === new Set(values).size, `Repeated ${name}`);
}
function group(item) {
  return JSON.stringify([item.component === void 0 ? "journey" : "component", item.component ?? item.journey, item.check]);
}
function validateEvidence(record) {
  object(record, "record", ["schema_version", "release", "scope", "observations"], ["capability"]);
  requireEvidence(record.schema_version === 1, "Expected evidence schema_version 1");
  text(record.release, "release");
  if ("capability" in record) identifier(record.capability, "capability");
  const scope = record.scope;
  object(scope, "scope", ["target", "max_age_seconds", "components", "journeys"]);
  validateTarget(scope.target);
  requireEvidence(Number.isSafeInteger(scope.max_age_seconds) && Number(scope.max_age_seconds) > 0, "max_age_seconds must be a positive integer");
  requireEvidence(Array.isArray(scope.components) && scope.components.length, "Scope needs at least one required component");
  const components = /* @__PURE__ */ new Map();
  for (const component of scope.components) {
    object(component, "component", ["id", "artifact", "required_checks", "not_applicable", "criteria"]);
    identifier(component.id, "component ID");
    requireEvidence(!components.has(component.id), `Repeated component: ${component.id}`);
    validateArtifact(component.artifact);
    uniqueNames(component.required_checks, "required check");
    const required = component.required_checks, excluded = component.not_applicable;
    requireEvidence(isObject(excluded), "not_applicable must map check names to reasons");
    requireEvidence(!required.some((key) => Object.hasOwn(excluded, key)) && equal([...required, ...Object.keys(excluded)].sort(), CHECKS), "Every component must explicitly classify all four checks");
    requireEvidence(required.includes("version"), "Running artifact verification is required for every release component");
    for (const reason of Object.values(excluded)) text(reason, "not_applicable reason");
    requireEvidence(isObject(component.criteria) && equal(Object.keys(component.criteria).sort(), [...required].sort()), "criteria must define every required check and no others");
    for (const criterion of Object.values(component.criteria)) text(criterion, "criterion");
    components.set(component.id, component);
  }
  requireEvidence(Array.isArray(scope.journeys), "journeys must be a list");
  const journeys = /* @__PURE__ */ new Map();
  for (const journey of scope.journeys) {
    object(journey, "journey", ["id", "components", "criterion"]);
    identifier(journey.id, "journey ID");
    requireEvidence(!journeys.has(journey.id), `Repeated journey: ${journey.id}`);
    uniqueNames(journey.components, "journey component");
    requireEvidence(journey.components.length && journey.components.every((key) => components.has(key)), "Journey needs known participating components");
    text(journey.criterion, "journey criterion");
    journeys.set(journey.id, journey);
  }
  requireEvidence(Array.isArray(record.observations), "observations must be a list");
  const attempts = /* @__PURE__ */ new Map();
  for (const item of record.observations) {
    object(item, "observation", ["check", "attempt", "status", "target", "observed_at", "summary", "evidence"], ["component", "journey", "artifact", "artifacts"]);
    requireEvidence("component" in item !== "journey" in item, "Observation needs exactly one component or journey");
    const key = "component" in item ? item.component : item.journey;
    identifier(key, "subject");
    requireEvidence(typeof item.check === "string" && CHECKS.includes(item.check), "Unknown observation check");
    if ("component" in item) {
      const component = components.get(key);
      requireEvidence(component, `Observation has unknown component: ${key}`);
      requireEvidence(component.required_checks.includes(item.check), "Observation conflicts with scope's not_applicable decision");
      requireEvidence(!("artifacts" in item), "Only journeys carry an artifacts map");
      requireEvidence(!("artifact" in item) || ["version", "technical", "business"].includes(item.check), "Only version, technical and component business checks carry an artifact");
    } else {
      requireEvidence(journeys.has(key) && item.check === "business", "Journey observations must be business checks of a known journey");
      requireEvidence(!("artifact" in item), "Journeys use an artifacts map");
    }
    requireEvidence(Number.isSafeInteger(item.attempt) && Number(item.attempt) > 0, "attempt must be a positive integer");
    requireEvidence(typeof item.status === "string" && STATUSES.includes(item.status), "Unknown observation status");
    validateTarget(item.target);
    const time = timestamp(item.observed_at);
    text(item.summary, "summary");
    validateRefs(item.evidence);
    if (item.status !== "pending") requireEvidence(item.evidence.length, "An asserted result needs evidence references");
    if ("artifact" in item) validateArtifact(item.artifact);
    if ("artifacts" in item) {
      requireEvidence(isObject(item.artifacts), "artifacts must be a component-to-identity map");
      const participants = journeys.get(key).components;
      requireEvidence(Object.keys(item.artifacts).every((id2) => participants.includes(id2)), "Journey has unexpected component identities");
      for (const artifact of Object.values(item.artifacts)) validateArtifact(artifact);
    }
    const id = group(item);
    const bucket = attempts.get(id) ?? /* @__PURE__ */ new Map();
    requireEvidence(!bucket.has(Number(item.attempt)), `Repeated attempt: ${id}`);
    bucket.set(Number(item.attempt), time);
    attempts.set(id, bucket);
  }
  for (const bucket of attempts.values()) {
    const times = [...bucket].sort(([a], [b]) => a - b).map(([, time]) => time);
    requireEvidence(times.every((time, i) => i === 0 || time >= times[i - 1]), "Later attempts cannot predate earlier attempts");
  }
}
function compareArtifacts(expected, actual) {
  if (!actual) return ["pending", "Running artifact identity is unavailable"];
  if (expected.kind !== actual.kind || expected.platform !== actual.platform) return ["pending", "Artifact identities have different kinds or platform scopes; supply a trusted same-kind mapping"];
  if (expected.value !== actual.value) return ["failed", "Observed artifact differs from the expected artifact"];
  return ["passed", "Observed artifact matches"];
}
function evaluate(record, at = /* @__PURE__ */ new Date()) {
  validateEvidence(record);
  const now = at instanceof Date ? at.getTime() : timestamp(at);
  requireEvidence(Number.isFinite(now), "Invalid evaluation time");
  const { scope } = record;
  const components = new Map(scope.components.map((item) => [item.id, item]));
  const journeys = new Map(scope.journeys.map((item) => [item.id, item]));
  const attempts = /* @__PURE__ */ new Map();
  for (const item of record.observations) attempts.set(group(item), [...attempts.get(group(item)) ?? [], item]);
  function observationResult(item) {
    let status = item.status, reason = item.summary;
    const age = (now - timestamp(item.observed_at)) / 1e3;
    if (!equal(item.target, scope.target)) [status, reason] = ["failed", "Observed target differs from the requested target"];
    else if (age < 0 || age > scope.max_age_seconds) [status, reason] = ["pending", "Observation is from the future or outside the freshness window"];
    else if (status === "passed") {
      if (item.component !== void 0 && ["version", "technical", "business"].includes(item.check)) [status, reason] = compareArtifacts(components.get(item.component).artifact, item.artifact);
      else if (item.journey !== void 0) {
        const comparisons = journeys.get(item.journey).components.map((key) => compareArtifacts(components.get(key).artifact, item.artifacts?.[key]));
        if (comparisons.some(([value]) => value === "failed")) [status, reason] = ["failed", "Journey exercised a different component artifact"];
        else if (comparisons.some(([value]) => value === "pending")) [status, reason] = ["pending", "Journey lacks comparable identities for all participating components"];
      }
    }
    return {
      attempt: item.attempt,
      status,
      reported_status: item.status,
      reason,
      summary: item.summary,
      target: item.target,
      observed_at: item.observed_at,
      evidence: item.evidence,
      ...item.artifact ? { artifact: item.artifact } : {},
      ...item.artifacts ? { artifacts: item.artifacts } : {}
    };
  }
  const rows = [];
  function add(subject, key, check, criterion) {
    const history = (attempts.get(JSON.stringify([subject, key, check])) ?? []).sort((a, b) => a.attempt - b.attempt).map(observationResult);
    const latest = history.at(-1) ?? { status: "pending", reason: "Required observation is missing" };
    const row = {
      subject,
      id: key,
      check,
      criterion,
      status: latest.status,
      reason: latest.reason,
      attempts: history,
      recovered: latest.status === "passed" && history.slice(0, -1).some((item) => item.status === "failed")
    };
    if (subject === "component" && ["version", "technical", "business"].includes(check)) row.expected_artifact = components.get(key).artifact;
    else if (subject === "journey") row.expected_artifacts = Object.fromEntries(journeys.get(key).components.map((name) => [name, components.get(name).artifact]));
    rows.push(row);
  }
  for (const component of scope.components) for (const check of CHECKS) {
    if (Object.hasOwn(component.not_applicable, check)) rows.push({
      subject: "component",
      id: component.id,
      check,
      status: "not applicable",
      reason: component.not_applicable[check],
      attempts: [],
      recovered: false
    });
    else add("component", component.id, check, component.criteria[check]);
  }
  for (const journey of scope.journeys) add("journey", journey.id, "business", journey.criterion);
  const verdict = rows.some((row) => row.status === "failed") ? "failed" : rows.every((row) => ["passed", "not applicable"].includes(row.status)) ? "passed" : "pending";
  return structuredClone({ schema_version: 1, release: record.release, target: scope.target, evaluated_at: isoTime(now), verdict, checks: rows });
}
function markdown(result) {
  const cell = (value) => String(value).replaceAll("|", "\\|").replace(/[\n\r]/g, " ");
  const lines = [`Release: ${cell(result.release)}`, `Verdict: **${result.verdict}**`, "", "| Subject | Check | Status | Reason |", "| --- | --- | --- | --- |"];
  for (const row of result.checks) lines.push(`| ${[row.id, row.check, row.status, row.reason].map(cell).join(" | ")} |`);
  lines.push("", "Attempt history:");
  for (const row of result.checks) for (const item of row.attempts) {
    lines.push(`- ${cell(row.id)}/${row.check} attempt ${item.attempt}: ${item.status}; ${cell(item.observed_at)}; ${cell(item.evidence.join("; "))}; ${cell(item.reason)}; observation: ${cell(item.summary)}`);
    if (item.artifact || item.artifacts) lines.push(`  Observed: ${cell(JSON.stringify(sorted(item.artifact ?? item.artifacts)))}`);
  }
  return lines.join("\n");
}

// src/core/registry.ts
var RELATIONSHIPS = ["starts_after", "deploys_after", "consumes", "validated_by", "requires"];
var WorkspaceError = class extends Error {
  name = "WorkspaceError";
};
function requireWorkspace(condition, message) {
  if (!condition) throw new WorkspaceError(message);
}
var optional = (value, key, fallback) => Object.hasOwn(value, key) ? value[key] : fallback;
function validateId(value) {
  requireWorkspace(typeof value === "string" && fullMatch(/^[a-z0-9][a-z0-9._-]*$/, value), `Invalid member ID: ${String(value)}. Use lowercase letters, numbers, dots, dashes, or underscores.`);
}
function relativePath(value) {
  requireWorkspace(typeof value === "string" && value.length > 0 && !/[\\:\0]/.test(value) && value.split("/").every((part) => part && part !== "." && part !== ".."), `Invalid relative file reference: ${String(value)}`);
  return value;
}
function componentModel(value, members) {
  const components = /* @__PURE__ */ new Map(), explicitMembers = /* @__PURE__ */ new Set();
  const entries = optional(value, "components", []);
  requireWorkspace(Array.isArray(entries), "Components must be a list.");
  for (const item of entries) {
    requireWorkspace(isObject(item), "Each component must be an object.");
    validateId(item.id);
    validateId(item.member);
    requireWorkspace(!components.has(item.id) && Object.hasOwn(members, item.member), `Repeated component or unknown member: ${item.id}`);
    const path2 = optional(item, "path", ".");
    if (path2 !== ".") relativePath(path2);
    components.set(item.id, { ...item, id: item.id, member: item.member, path: path2 });
    explicitMembers.add(item.member);
  }
  for (const id of Object.keys(members).sort()) if (!explicitMembers.has(id)) {
    requireWorkspace(!components.has(id), `Component shadows an implicit component: ${id}`);
    components.set(id, { id, member: id, path: "." });
  }
  const relationships = optional(value, "relationships", []);
  requireWorkspace(Array.isArray(relationships), "Relationships must be a list.");
  const seen = /* @__PURE__ */ new Set();
  for (const edge of relationships) {
    requireWorkspace(isObject(edge), "Each relationship must be an object.");
    requireWorkspace(typeof edge.type === "string" && typeof edge.from === "string" && typeof edge.to === "string", "A relationship needs string type, from, and to fields.");
    requireWorkspace(RELATIONSHIPS.includes(edge.type), `Unknown relationship type: ${edge.type}`);
    const key = JSON.stringify([edge.type, edge.from, edge.to]);
    requireWorkspace(components.has(edge.from) && components.has(edge.to) && edge.from !== edge.to && !seen.has(key), `Invalid or repeated relationship: ${key}`);
    seen.add(key);
  }
  const orders = { starts_after: [], deploys_after: [] };
  for (const kind of ["starts_after", "deploys_after"]) {
    const remaining = new Map([...components.keys()].map((key) => [key, /* @__PURE__ */ new Set()]));
    for (const edge of relationships) if (edge.type === kind) remaining.get(edge.from).add(edge.to);
    while (remaining.size) {
      const ready = [...remaining].filter(([, deps]) => !deps.size).map(([key]) => key).sort();
      requireWorkspace(ready.length, `Cycle in ${kind}: ${[...remaining.keys()].sort().join(", ")}`);
      orders[kind].push(...ready);
      for (const key of ready) remaining.delete(key);
      for (const dependencies of remaining.values()) for (const key of ready) dependencies.delete(key);
    }
  }
  const capabilities = optional(value, "capabilities", []);
  requireWorkspace(Array.isArray(capabilities), "Capabilities must be a list.");
  seen.clear();
  for (const item of capabilities) {
    requireWorkspace(isObject(item), "Each capability must be an object.");
    validateId(item.id);
    requireWorkspace(!seen.has(item.id) && Array.isArray(item.requires) && item.requires.length, `Invalid or repeated capability: ${item.id}`);
    for (const id of item.requires) {
      validateId(id);
      requireWorkspace(components.has(id), `Unknown component for ${item.id}: ${id}`);
    }
    requireWorkspace(item.requires.length === new Set(item.requires).size, `Repeated required component for ${item.id}`);
    seen.add(item.id);
  }
  return { components: Object.fromEntries(components), orders, capabilities };
}
function checkWorkspaceScope(record, manifest) {
  requireEvidence(isObject(manifest) && manifest.schema_version === 1, "Unsupported workspace schema");
  requireEvidence(record.capability !== void 0, "Workspace-bound evidence needs a capability ID");
  identifier(record.capability, "capability");
  requireEvidence(Array.isArray(manifest.capabilities), "Workspace capabilities must be a list");
  const matches = manifest.capabilities.filter((item) => isObject(item) && item.id === record.capability);
  requireEvidence(matches.length === 1, "Capability must resolve uniquely in the workspace");
  uniqueNames(matches[0].requires, "required capability component");
  const needed = new Set(matches[0].requires);
  requireEvidence(needed.size, "Capability must require components");
  const explicit = manifest.components ?? [];
  requireEvidence(Array.isArray(explicit) && Array.isArray(manifest.members), "Workspace members and components must be lists");
  const memberIds = manifest.members.map((item) => isObject(item) ? item.id : null);
  const componentIds = explicit.map((item) => isObject(item) ? item.id : null);
  uniqueNames(memberIds, "workspace member");
  uniqueNames(componentIds, "workspace component");
  const members = Object.fromEntries(memberIds.map((id) => [id, {}]));
  const model = componentModel(manifest, members);
  const edges = manifest.relationships ?? [];
  let size = 0;
  while (needed.size !== size) {
    size = needed.size;
    for (const edge of edges) if (edge.type === "requires" && needed.has(edge.from)) needed.add(edge.to);
  }
  const selected = new Set(record.scope.components.map((item) => item.id));
  requireEvidence([...needed, ...selected].every((id) => Object.hasOwn(model.components, id)), "Scope or capability references an unknown workspace component");
  const missing = [...needed].filter((id) => !selected.has(id)).sort();
  requireEvidence(!missing.length, `Evidence scope omits required components: ${missing.join(", ")}`);
}

// src/adapters/files.ts
function stat(file, follow = true) {
  try {
    return follow ? fs.statSync(file) : fs.lstatSync(file);
  } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes(error.code ?? "")) return void 0;
    throw error;
  }
}
function readJson(file, fallback) {
  if (!stat(file) && fallback !== void 0) return structuredClone(fallback);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Could not read JSON from ${file}: ${error.message}`);
  }
}

// src/cli/args.ts
import { parseArgs } from "node:util";
var UsageError = class extends Error {
  name = "UsageError";
};
function parse(argv, specs, count = 0) {
  const normalized = [];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index], option = specs[arg.slice(2)];
    if (arg.startsWith("--") && option?.width) {
      const parts = argv.slice(index + 1, index + 1 + option.width);
      if (parts.length !== option.width || parts.some((part) => part.startsWith("--"))) throw new UsageError(`${arg} needs ${option.width} values`);
      normalized.push(arg, JSON.stringify(parts));
      index += option.width;
    } else normalized.push(arg);
  }
  try {
    const options = Object.fromEntries(Object.entries(specs).map(([name, { type, multiple }]) => [name, { type, multiple: multiple ?? false }]));
    const result = parseArgs({ args: normalized, options, allowPositionals: true, strict: true });
    for (const [name, spec] of Object.entries(specs)) if (spec.required && result.values[name] === void 0) throw new UsageError(`Missing required --${name}`);
    if (result.positionals.length !== count) throw new UsageError(`Expected ${count} positional argument(s)`);
    return result;
  } catch (error) {
    throw new UsageError(error.message);
  }
}
var stringOption = { type: "string" };

// src/cli/evidence.ts
function evidenceMain(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage: evidence RECORD [--at ISO_TIME] [--workspace PATH] [--format json|markdown]");
    return 0;
  }
  try {
    const { values, positionals } = parse(argv, { at: stringOption, workspace: stringOption, format: stringOption }, 1);
    if (values.format !== void 0 && !["json", "markdown"].includes(values.format)) throw new UsageError("--format must be json or markdown");
    const record = readJson(positionals[0]);
    validateEvidence(record);
    if (values.workspace) checkWorkspaceScope(record, readJson(path.join(values.workspace, ".harness/workspace.json")));
    const result = evaluate(record, values.at);
    console.log(values.format === "markdown" ? markdown(result) : JSON.stringify(result, null, 2));
    return { passed: 0, failed: 1, pending: 2 }[result.verdict];
  } catch (error) {
    console.log(JSON.stringify({ verdict: "invalid", error: error.message }));
    return 2;
  }
}

// src/entries/evidence.ts
process.exitCode = evidenceMain(process.argv.slice(2));
