#!/usr/bin/env node
// Generated from TypeScript by scripts/build.mjs. Do not edit.

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
function json(value) {
  return JSON.stringify(sorted(value), null, 2) + "\n";
}
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function fullMatch(pattern, value) {
  return pattern.exec(value)?.[0] === value;
}

// src/core/evidence.ts
var ARTIFACTS = ["git_commit", "oci_manifest_digest", "oci_index_digest", "package_version", "runtime_revision"];
var EvidenceError = class extends Error {
  name = "EvidenceError";
};
function requireEvidence(condition, message) {
  if (!condition) throw new EvidenceError(message);
}
function object(value, name, required2, optional = []) {
  requireEvidence(isObject(value), `${name} must be an object`);
  requireEvidence(required2.every((key) => Object.hasOwn(value, key)), `${name} is missing required fields`);
  requireEvidence(Object.keys(value).every((key) => [...required2, ...optional].includes(key)), `${name} has unknown fields`);
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

// src/core/readiness.ts
var READINESS_AREAS = ["artifact", "rollback", "migration", "monitoring", "review"];
function validateReadinessPlan(value) {
  object(value, "readiness plan", ["schema_version", "release", "target", "artifacts", "max_age_seconds", "checks", "not_applicable"]);
  requireEvidence(value.schema_version === 1, "Expected readiness schema_version 1");
  text(value.release, "release");
  validateTarget(value.target);
  requireEvidence(Number.isSafeInteger(value.max_age_seconds) && Number(value.max_age_seconds) > 0, "max_age_seconds must be positive");
  requireEvidence(Array.isArray(value.artifacts) && value.artifacts.length > 0, "Readiness must bind at least one intended artifact");
  const components = /* @__PURE__ */ new Set();
  for (const item of value.artifacts) {
    object(item, "readiness artifact", ["component", "artifact"]);
    identifier(item.component, "component");
    validateArtifact(item.artifact);
    requireEvidence(!components.has(item.component), "Repeated readiness component");
    components.add(item.component);
  }
  requireEvidence(Array.isArray(value.checks) && value.checks.length > 0, "Readiness needs required checks");
  const ids = /* @__PURE__ */ new Set(), areas = /* @__PURE__ */ new Set();
  for (const check of value.checks) {
    object(check, "readiness check", ["id", "area", "criterion"]);
    identifier(check.id, "readiness check");
    text(check.criterion, "criterion");
    requireEvidence(!ids.has(check.id), "Repeated readiness check");
    ids.add(check.id);
    requireEvidence(READINESS_AREAS.includes(check.area), "Unknown readiness area");
    areas.add(String(check.area));
  }
  requireEvidence(isObject(value.not_applicable), "not_applicable must map areas to reasons");
  const exclusions = value.not_applicable;
  for (const [area, reason] of Object.entries(value.not_applicable)) {
    requireEvidence(READINESS_AREAS.includes(area) && !areas.has(area), "Unknown or duplicated readiness classification");
    text(reason, "exclusion reason");
  }
  requireEvidence(areas.has("artifact"), "Artifact readiness is required");
  requireEvidence(READINESS_AREAS.every((area) => areas.has(area) || Object.hasOwn(exclusions, area)), "Classify every readiness area; exclusions require project-specific reasons");
}

// src/core/verification.ts
function validateVerificationRecord(value) {
  object(value, "verification record", ["schema_version", "observations"]);
  requireEvidence(value.schema_version === 1, "Expected verification schema_version 1");
  requireEvidence(Array.isArray(value.observations), "observations must be a list");
  const attempts = /* @__PURE__ */ new Set();
  for (const item of value.observations) {
    object(item, "verification observation", ["check", "attempt", "binding", "status", "target", "observed_at", "summary", "evidence", "method"], ["artifact"]);
    identifier(item.check, "observation check");
    requireEvidence(Number.isSafeInteger(item.attempt) && Number(item.attempt) > 0, "attempt must be positive");
    requireEvidence(typeof item.binding === "string" && fullMatch(/^[a-f0-9]{64}$/, item.binding), "Observation needs its exact configuration binding");
    requireEvidence(["passed", "failed", "pending", "not run"].includes(String(item.status)), "Invalid observation status");
    requireEvidence(["attestation", "probe"].includes(String(item.method)), "Invalid observation method");
    validateTarget(item.target);
    timestamp(item.observed_at);
    text(item.summary, "summary");
    validateRefs(item.evidence);
    if ("artifact" in item) validateArtifact(item.artifact);
    const key = `${item.check}/${item.attempt}`;
    requireEvidence(!attempts.has(key), "Repeated observation attempt");
    attempts.add(key);
  }
}
function evaluateVerification(checks, record, binding, maxAge, at) {
  validateVerificationRecord(record);
  const now = timestamp(at);
  requireEvidence(Array.isArray(checks) && checks.length > 0 && new Set(checks.map((check) => check.id)).size === checks.length, "Verification requires unique nonempty checks");
  requireEvidence(typeof binding === "string" && fullMatch(/^[a-f0-9]{64}$/, binding), "Invalid verification binding");
  requireEvidence(Number.isSafeInteger(maxAge) && maxAge > 0, "Invalid verification age limit");
  for (const check of checks) {
    identifier(check.id, "check ID");
    text(check.layer, "layer");
    text(check.criterion, "criterion");
    validateTarget(check.target);
    if (check.artifact) validateArtifact(check.artifact);
  }
  const ids = new Set(checks.map((check) => check.id));
  for (const observation of record.observations) requireEvidence(ids.has(observation.check), `Unknown verification check: ${observation.check}`);
  const rows = checks.map((check) => {
    const history = record.observations.filter((item) => item.check === check.id).sort((a, b) => a.attempt - b.attempt).map((item) => {
      let status2 = item.status === "failed" ? "failed" : item.status === "passed" ? "passed" : "pending";
      let reason = item.summary;
      const age = now - timestamp(item.observed_at);
      if (!equal(item.target, check.target)) {
        status2 = "failed";
        reason = "Observed target differs from the required target";
      } else if (item.binding !== binding) {
        status2 = "pending";
        reason = "Observation belongs to another configuration or checkout";
      } else if (age < 0 || age > maxAge * 1e3) {
        status2 = "pending";
        reason = "Observation is stale or future-dated";
      } else if (status2 === "passed" && !item.evidence.length) {
        status2 = "pending";
        reason = "A passing observation needs evidence references";
      } else if (status2 === "passed" && check.artifact && !equal(item.artifact, check.artifact)) {
        status2 = item.artifact && item.artifact.kind === check.artifact.kind && item.artifact.platform === check.artifact.platform ? "failed" : "pending";
        reason = "Tested artifact does not establish the required artifact identity";
      }
      if ((check.layer === "agent" || check.layer === "hook") && item.method !== "attestation") {
        status2 = "pending";
        reason = "Direct script execution does not establish native host activation";
      }
      return { ...item, status: status2, reason };
    });
    for (let i = 1; i < history.length; i++) requireEvidence(timestamp(history[i].observed_at) >= timestamp(history[i - 1].observed_at), "Retry times must not move backwards");
    const latest = history.at(-1);
    return { ...check, status: latest?.status ?? "pending", reason: latest?.reason ?? "No observation", recovered: latest?.status === "passed" && history.slice(0, -1).some((item) => item.status === "failed"), history };
  });
  const status = rows.some((row) => row.status === "failed") ? "failed" : rows.some((row) => row.status === "pending") ? "pending" : "passed";
  return { schema_version: 1, binding, evaluated_at: at, status, checks: rows };
}

// src/adapters/files.ts
import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
function stat(file, follow = true) {
  try {
    return follow ? fs.statSync(file) : fs.lstatSync(file);
  } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes(error.code ?? "")) return void 0;
    throw error;
  }
}
function hash(data) {
  return createHash("sha256").update(data).digest("hex");
}
function readJson(file, fallback) {
  if (!stat(file) && fallback !== void 0) return structuredClone(fallback);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Could not read JSON from ${file}: ${error.message}`);
  }
}

// src/adapters/readiness.ts
function evaluateReadiness(plan, record = { schema_version: 1, observations: [] }, at = (/* @__PURE__ */ new Date()).toISOString()) {
  validateReadinessPlan(plan);
  const binding = hash(json(plan));
  const result = evaluateVerification(plan.checks.map((check) => ({ id: check.id, layer: check.area, criterion: check.criterion, target: plan.target })), record, binding, plan.max_age_seconds, at);
  return {
    ...result,
    release: plan.release,
    target: plan.target,
    artifacts: plan.artifacts,
    not_applicable: plan.not_applicable,
    decision: result.status === "passed" ? "ready" : result.status === "failed" ? "not-ready" : "pending",
    authorization: "Use the existing project and session authorization; this evidence decision does not grant deployment permission",
    deployment: "not run",
    record
  };
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
var required = { type: "string", required: true };

// src/cli/readiness.ts
function readinessMain(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage: readiness --plan FILE [--record FILE] [--at ISO_TIME]\nWithout a record, emit the binding and pending checks. Accepts a verification record or a previous readiness report. No deployment commands are executed.");
    return 0;
  }
  try {
    const { values } = parse(argv, { plan: required, record: stringOption, at: stringOption });
    const input = values.record ? readJson(values.record) : void 0;
    const report = evaluateReadiness(readJson(values.plan), isObject(input) && "record" in input ? input.record : input, values.at);
    console.log(JSON.stringify(report, null, 2));
    return report.status === "passed" ? 0 : report.status === "failed" ? 1 : 2;
  } catch (error) {
    console.log(JSON.stringify({ status: "invalid", error: error.message }));
    return 2;
  }
}

// src/entries/readiness.ts
process.exitCode = readinessMain(process.argv.slice(2));
