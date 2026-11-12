#!/usr/bin/env node
// Generated from TypeScript by scripts/build.mjs. Do not edit.

// src/entries/evals.ts
import { fileURLToPath } from "node:url";

// src/evals.ts
import fs2 from "node:fs";
import path from "node:path";

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
function object(value, name, required, optional = []) {
  requireEvidence(isObject(value), `${name} must be an object`);
  requireEvidence(required.every((key) => Object.hasOwn(value, key)), `${name} is missing required fields`);
  requireEvidence(Object.keys(value).every((key) => [...required, ...optional].includes(key)), `${name} has unknown fields`);
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

// src/evals.ts
var AT = "2026-01-01T12:00:00+00:00";
var CASES = {
  complete: "passed",
  "healthy-old-version": "failed",
  "skipped-deployment": "pending",
  "business-failure": "failed",
  "missing-component": "pending",
  "wrong-target": "failed",
  "expired-observation": "pending",
  "retry-recovered": "passed",
  "incomparable-identities": "pending",
  "component-business-unbound": "pending",
  "component-business-wrong-artifact": "failed",
  "component-business-valid": "passed"
};
function validateMeasurement(value) {
  object(value, "run measurement", ["schema_version", "agent", "model", "variant", "skill_sha256", "elapsed_seconds", "input_tokens", "output_tokens", "cost_usd", "human_interventions", "smoke_executed", "transcript_ref"]);
  requireEvidence(value.schema_version === 1 && ["baseline", "candidate"].includes(String(value.variant)), "Invalid run metadata version or variant");
  text(value.agent, "agent");
  text(value.model, "model");
  requireEvidence(typeof value.skill_sha256 === "string" && /^[a-f0-9]{64}$/.test(value.skill_sha256), "Skill digest must be SHA-256");
  for (const key of ["elapsed_seconds", "input_tokens", "output_tokens", "cost_usd", "human_interventions"]) {
    const item = value[key];
    requireEvidence(["input_tokens", "output_tokens", "cost_usd"].includes(key) && item === null || typeof item === "number" && Number.isFinite(item) && item >= 0 && (!["input_tokens", "output_tokens", "human_interventions"].includes(key) || Number.isSafeInteger(item)), `Invalid ${key}; unavailable measurements must be null`);
  }
  requireEvidence(typeof value.smoke_executed === "boolean" || value.smoke_executed === null, "smoke_executed must be boolean or null");
  validateRefs([value.transcript_ref]);
}
function skillDigest(directory) {
  const entries = [];
  function walk(folder) {
    for (const item of fs2.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (item.name === "__pycache__" || item.name.endsWith(".pyc")) continue;
      const file = path.join(folder, item.name);
      if (item.isDirectory()) walk(file);
      else if (item.isFile()) entries.push([path.relative(directory, file).split(path.sep).join("/"), hash(fs2.readFileSync(file))]);
      else throw new Error("Exercise Skills must contain ordinary files and directories");
    }
  }
  walk(directory);
  return hash(JSON.stringify(entries));
}
var Exercises = class {
  skill;
  constructor(root) {
    this.skill = path.join(root, "skills/harness-verify-release");
  }
  fixture(scenario) {
    if (!Object.hasOwn(CASES, scenario)) throw new Error("Unknown exercise scenario");
    const record = readJson(path.join(this.skill, "assets/example-release.json"));
    validateEvidence(record);
    switch (scenario) {
      case "healthy-old-version":
        record.observations[1].artifact.value = "d".repeat(40);
        break;
      case "skipped-deployment":
        record.observations[0].status = "not run";
        break;
      case "business-failure":
        record.observations.at(-1).status = "failed";
        break;
      case "missing-component":
        record.observations = record.observations.filter((item) => item.component !== "worker");
        break;
      case "wrong-target":
        record.observations[0].target.environment = "other";
        break;
      case "expired-observation":
        record.observations[0].observed_at = "2026-01-01T10:00:00Z";
        break;
      case "retry-recovered": {
        const retry = structuredClone(record.observations[0]);
        retry.attempt = 2;
        record.observations[0].status = "failed";
        record.observations.push(retry);
        break;
      }
      case "incomparable-identities":
        record.observations[1].artifact = { kind: "oci_index_digest", value: "sha256:" + "a".repeat(64) };
        break;
    }
    if (scenario.startsWith("component-business-")) {
      const component = record.scope.components[0];
      component.required_checks.push("business");
      delete component.not_applicable.business;
      component.criteria.business = "The selected API artifact returns the accepted greeting";
      record.observations.push({
        component: component.id,
        check: "business",
        attempt: 1,
        status: "passed",
        target: structuredClone(record.scope.target),
        observed_at: AT,
        summary: "The observed API returned the accepted greeting",
        evidence: ["fixture:api-business-probe"],
        ...scenario === "component-business-unbound" ? {} : { artifact: scenario === "component-business-valid" ? structuredClone(component.artifact) : { kind: "git_commit", value: "d".repeat(40) } }
      });
    }
    return record;
  }
  prepare(scenario, directory, skillSource = this.skill) {
    const record = this.fixture(scenario);
    fs2.mkdirSync(directory, { recursive: true });
    if (fs2.readdirSync(directory).length) throw new Error("Choose an empty exercise directory");
    fs2.writeFileSync(path.join(directory, "release.json"), JSON.stringify(record, null, 2) + "\n");
    const digest = skillDigest(skillSource);
    fs2.cpSync(skillSource, path.join(directory, "skills/harness-verify-release"), {
      recursive: true,
      filter: (file) => path.basename(file) !== "__pycache__" && !file.endsWith(".pyc")
    });
    fs2.writeFileSync(path.join(directory, "request.md"), `Use the harness-verify-release Skill at skills/harness-verify-release/SKILL.md.

Determine whether the release in release.json is ready for its declared target and scope. This is an offline exercise evaluated at ${AT}; use that time for freshness checks. Use only the supplied local evidence. Preserve release.json. Write answer.json using the bundled evaluator's result format, including each check and attempt history. Explain the outcome and the next action in answer.md.
`);
    return { scenario, directory, status: "prepared", agent_run: "not run", skill_sha256: digest };
  }
  assess(scenario, directory) {
    const original = this.fixture(scenario), supplied = readJson(path.join(directory, "release.json"));
    const answer = readJson(path.join(directory, "answer.json")), expected = evaluate(original, AT), failures = [];
    if (!equal(supplied, original)) failures.push("The input evidence or scope was changed");
    if (!equal(answer, expected)) failures.push("The verdict, per-check results, or retained attempt history differs from the independent result");
    const narrative = path.join(directory, "answer.md"), metadata = path.join(directory, "run-metadata.json");
    if (!stat(narrative)?.isFile() || !fs2.readFileSync(narrative, "utf8").trim()) failures.push("Missing human-readable explanation");
    function canonical(value) {
      if (Array.isArray(value)) return "[" + value.map(canonical).join(", ") + "]";
      if (isObject(value)) return "{" + Object.entries(sorted(value)).map(([key, item]) => JSON.stringify(key) + ": " + canonical(item)).join(", ") + "}";
      return JSON.stringify(value);
    }
    let measurement;
    if (stat(metadata)) {
      const value = readJson(metadata);
      validateMeasurement(value);
      measurement = value;
      if (measurement.skill_sha256 !== skillDigest(path.join(directory, "skills/harness-verify-release"))) failures.push("Measured Skill digest differs from the exercised Skill");
    }
    return {
      scenario,
      assessment: failures.length ? "failed" : "passed",
      failures,
      verdict_correct: isObject(answer) && answer.verdict === expected.verdict,
      acceptance_decision_correct: isObject(answer) && ["passed", "failed", "pending", "invalid"].includes(String(answer.verdict)) && answer.verdict === "passed" === (expected.verdict === "passed"),
      false_pass: isObject(answer) && answer.verdict === "passed" && expected.verdict !== "passed",
      measurement: measurement ?? null,
      fixture_sha256: hash(canonical(original)),
      limits: "Deterministic artifact checks; narrative quality and tool-use compliance require transcript review"
    };
  }
  checkFixtures() {
    const fixtures = Object.fromEntries(Object.keys(CASES).map((scenario) => [scenario, evaluate(this.fixture(scenario), AT).verdict]));
    if (!equal(fixtures, CASES)) throw new Error("Fixture verdict mismatch");
    return { fixtures, agent_runs: 0 };
  }
  campaign(runs) {
    if (!Array.isArray(runs) || !runs.length) throw new Error("Campaign requires scenario/directory entries for actual runs");
    const seen = /* @__PURE__ */ new Set();
    const results = runs.map((run) => {
      object(run, "campaign run", ["scenario", "directory"]);
      text(run.scenario, "scenario");
      text(run.directory, "directory");
      const directory = fs2.realpathSync(run.directory);
      requireEvidence(!seen.has(directory), "Cannot count one run twice");
      seen.add(directory);
      const assessment = this.assess(run.scenario, directory);
      requireEvidence(assessment.measurement, "Actual campaigns require measured run metadata, not fixture-only outputs");
      return assessment;
    });
    const variants = ["baseline", "candidate"].map((variant) => {
      const rows = results.filter((row) => row.measurement?.variant === variant);
      const sum = (key) => rows.every((row) => row.measurement[key] !== null) ? rows.reduce((total, row) => total + row.measurement[key], 0) : null;
      return {
        variant,
        agent_runs: rows.length,
        successful_runs: rows.filter((row) => row.assessment === "passed").length,
        correct_verdicts: rows.filter((row) => row.verdict_correct).length,
        correct_acceptance_decisions: rows.filter((row) => row.acceptance_decision_correct).length,
        false_passes: rows.filter((row) => row.false_pass).length,
        smoke_runs: rows.every((row) => row.measurement.smoke_executed !== null) ? rows.filter((row) => row.measurement.smoke_executed).length : null,
        elapsed_seconds: sum("elapsed_seconds"),
        input_tokens: sum("input_tokens"),
        output_tokens: sum("output_tokens"),
        cost_usd: sum("cost_usd"),
        human_interventions: sum("human_interventions")
      };
    });
    const signature = (variant) => results.filter((row) => row.measurement.variant === variant).map((row) => [row.scenario, row.fixture_sha256, row.measurement.agent, row.measurement.model].join(":")).sort();
    return {
      schema_version: 1,
      agent_runs: results.length,
      matched_inputs_and_models: equal(signature("baseline"), signature("candidate")),
      variants,
      results,
      limits: "Metadata and transcripts must come from actual supervised agent runs. Matched inputs/models do not establish equal hidden context or permissions. Small samples do not establish general performance."
    };
  }
};

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

// src/entries/evals.ts
try {
  const [command, ...args] = process.argv.slice(2), exercises = new Exercises(fileURLToPath(new URL("../", import.meta.url)));
  if (["--help", "-h"].includes(command)) console.log("Usage: run check-fixtures | prepare SCENARIO DIRECTORY [--skill-source DIR] | assess SCENARIO DIRECTORY | campaign RUNS_JSON");
  else if (command === "check-fixtures") {
    parse(args, {});
    console.log(JSON.stringify(exercises.checkFixtures(), null, 2));
  } else if (command === "prepare" || command === "assess") {
    const { values, positionals: [scenario, directory] } = parse(args, command === "prepare" ? { "skill-source": stringOption } : {}, 2);
    const result = command === "prepare" ? exercises.prepare(scenario, directory, values["skill-source"]) : exercises.assess(scenario, directory);
    console.log(JSON.stringify(result, null, 2));
    if ("assessment" in result && result.assessment === "failed") process.exitCode = 1;
  } else if (command === "campaign") {
    const { positionals: [file] } = parse(args, {}, 1);
    console.log(JSON.stringify(exercises.campaign(readJson(file)), null, 2));
  } else throw new Error("Expected check-fixtures, prepare, assess or campaign");
} catch (error) {
  console.log(JSON.stringify({ assessment: "invalid", error: error.message }));
  process.exitCode = 2;
}
