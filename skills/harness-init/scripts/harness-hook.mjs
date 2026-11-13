#!/usr/bin/env node
// Generated from TypeScript by scripts/build.mjs. Do not edit.

// src/entries/harness-hook.ts
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

// src/core/local-context.ts
var LEGACY_LOCAL_CONTEXT = ".harness/workspace.local.json";
function isLocalResource(file) {
  return file.endsWith(".local.md") || file.endsWith(".local.json") || file === LEGACY_LOCAL_CONTEXT || file.startsWith(".harness/local-backups/") || file.startsWith(".harness/local-evidence/");
}

// src/core/verification.ts
function validateDiagnosticSpec(value, relative) {
  object(value, "verification", ["max_age_seconds", "checks"]);
  requireEvidence(Number.isSafeInteger(value.max_age_seconds) && Number(value.max_age_seconds) > 0, "max_age_seconds must be positive");
  requireEvidence(Array.isArray(value.checks), "checks must be a list");
  const ids = /* @__PURE__ */ new Set();
  for (const check of value.checks) {
    object(check, "diagnostic check", ["id", "layer", "target", "criterion"], ["artifact", "probe", "platform"]);
    identifier(check.id, "check ID");
    requireEvidence(!check.id.startsWith("harness-") && !ids.has(check.id), "Duplicate or reserved check ID");
    ids.add(check.id);
    requireEvidence(["tool", "access", "smoke", "ci"].includes(String(check.layer)), "Native agent and hook activation require session attestations, not command probes");
    validateTarget(check.target);
    text(check.criterion, "criterion");
    if ("artifact" in check) validateArtifact(check.artifact);
    if ("platform" in check) identifier(check.platform, "platform");
    if ("probe" in check) {
      requireEvidence(check.layer !== "ci", "CI execution requires an actual CI run reference");
      object(check.probe, "probe", ["argv", "timeout_seconds"], ["cwd", "member", "expect_json"]);
      requireEvidence(Array.isArray(check.probe.argv) && check.probe.argv.length > 0 && check.probe.argv.length <= 100, "Probe argv must be nonempty");
      for (const arg of check.probe.argv) requireEvidence(typeof arg === "string" && arg.length > 0 && arg.length <= 2e3 && !/[\x00-\x1f]/.test(arg), "Use literal bounded probe arguments without secrets");
      requireEvidence(Number.isSafeInteger(check.probe.timeout_seconds) && Number(check.probe.timeout_seconds) > 0 && Number(check.probe.timeout_seconds) <= 60, "Probe timeout must be between 1 and 60 seconds");
      if ("cwd" in check.probe) relative(check.probe.cwd);
      if ("member" in check.probe) identifier(check.probe.member, "probe member");
      if ("expect_json" in check.probe) requireEvidence(isObject(check.probe.expect_json) && Object.keys(check.probe.expect_json).length > 0, "expect_json must be a nonempty object");
      if (check.layer === "access" || check.layer === "smoke") requireEvidence(isObject(check.probe.expect_json) && equal(check.probe.expect_json.target, check.target), "Access and smoke probes must assert the observed target in expect_json.target");
      if (check.artifact) requireEvidence(isObject(check.probe.expect_json) && equal(check.probe.expect_json.artifact, check.artifact), "Artifact-bound probes must assert expect_json.artifact");
    }
  }
}

// src/core/documentation.ts
var DOCUMENT_TOPICS = ["index", "development", "testing", "environments", "release", "operations", "toolchain"];

// src/core/harness.ts
var HARNESS_TARGETS = ["codex", "claude-code"];
var HARNESS_PARTS = ["documents", "skills", "commands", "agents", "rules", "settings", "hooks", "ci"];
var HarnessError = class extends Error {
  name = "HarnessError";
};
function requireHarness(condition, message) {
  if (!condition) throw new HarnessError(message);
}
function shape(value, name, fields) {
  requireHarness(isObject(value), `${name} must be an object`);
  requireHarness(Object.keys(value).every((key) => fields.includes(key)), `${name} has unknown fields`);
}
function text2(value, name) {
  requireHarness(typeof value === "string" && value.trim() && value.length <= 1e5 && !value.includes("\0"), `${name} must be nonempty text (at most 100000 characters)`);
}
function identifier2(value) {
  requireHarness(typeof value === "string" && value.length <= 64 && fullMatch(/^[a-z][a-z0-9-]*$/, value), "Names must be lowercase hyphenated identifiers of at most 64 characters");
}
function harnessPath(value) {
  requireHarness(typeof value === "string" && !/[\\:\x00-\x1f\x7f]/.test(value) && value.split("/").every((part) => part && part !== "." && part !== ".."), "Expected a normalized relative harness path");
  requireHarness(!isLocalResource(value), "Local context cannot be a shared artifact or source");
  requireHarness(!value.split("/").some((part) => [".git", "node_modules"].includes(part)), "Harness paths cannot address Git metadata or dependencies");
}
function list(value, name) {
  requireHarness(Array.isArray(value), `${name} must be a list`);
}
function unique(values, name) {
  requireHarness(new Set(values).size === values.length, `${name} contains duplicates`);
}
function targets(value) {
  list(value, "targets");
  requireHarness(value.length && value.every((item) => HARNESS_TARGETS.includes(item)), "Select codex, claude-code, or both");
  unique(value, "targets");
}
function resources(value) {
  list(value, "resources");
  for (const item of value) {
    shape(item, "resource", ["path", "body", "executable"]);
    harnessPath(item.path);
    text2(item.body, "resource.body");
    if ("executable" in item) requireHarness(typeof item.executable === "boolean", "executable must be boolean");
  }
  unique(value.map((item) => item.path), "resource paths");
}
function validateHarnessSpec(value) {
  shape(value, "harness spec", ["schema_version", "name", "language", "layout", "documentation_root", "targets", "sources", ...HARNESS_PARTS, "resources", "command_checks", "document_coverage", "provenance", "projections", "verification"]);
  requireHarness(value.schema_version === 1, "Expected harness schema_version 1");
  text2(value.name, "name");
  targets(value.targets);
  if ("language" in value) requireHarness(value.language === "en" || value.language === "zh-CN", "Generated entry-point language must be en or zh-CN");
  if ("layout" in value) requireHarness(value.layout === "centralized" || value.layout === "native", "Choose centralized or native harness layout");
  if ("documentation_root" in value) {
    harnessPath(value.documentation_root);
    requireHarness(value.documentation_root !== ".harness", "Documentation cannot use the harness state root");
    if (value.layout === "centralized") requireHarness(value.documentation_root === ".harness/docs" || value.documentation_root.startsWith(".harness/docs/"), "Centralized documentation_root must be .harness/docs or a subdirectory");
    else requireHarness(!value.documentation_root.startsWith(".harness/") || value.documentation_root === ".harness/docs" || value.documentation_root.startsWith(".harness/docs/"), "Documentation cannot use reserved harness state directories");
  }
  if (value.layout === "centralized") requireHarness(!["settings", "hooks"].some((part) => part in value), "Centralized layout does not register native settings or hooks; choose native layout for those integrations");
  list(value.sources, "sources");
  for (const source of value.sources) {
    shape(source, "source", ["member", "path"]);
    harnessPath(source.path);
    if ("member" in source) {
      text2(source.member, "source.member");
      requireHarness(fullMatch(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, source.member), "Invalid source member");
    }
  }
  unique(value.sources.map((source) => json(source)), "sources");
  if ("verification" in value) validateDiagnosticSpec(value.verification, harnessPath);
  const sourceRef = (source) => {
    shape(source, "source reference", ["member", "path"]);
    harnessPath(source.path);
    if ("member" in source) requireHarness(typeof source.member === "string" && fullMatch(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, source.member), "Invalid member reference");
  };
  if ("command_checks" in value) {
    list(value.command_checks, "command_checks");
    for (const check of value.command_checks) {
      shape(check, "command check", ["document", "command", "member", "cwd", "phase", "reason"]);
      harnessPath(check.document);
      text2(check.command, "command");
      if ("cwd" in check) harnessPath(check.cwd);
      if ("member" in check) sourceRef({ member: check.member, path: "context" });
      if ("phase" in check) requireHarness(["current", "planned"].includes(String(check.phase)), "Command phase must be current or planned");
      if ("reason" in check) text2(check.reason, "command reason");
      if (check.phase === "planned") text2(check.reason, "Planned commands require a reason");
    }
    unique(value.command_checks.map((check) => {
      const item = check;
      return json([item.document, item.command]);
    }), "command contexts");
  }
  if ("document_coverage" in value) {
    list(value.document_coverage, "document_coverage");
    for (const entry of value.document_coverage) {
      shape(entry, "document coverage", ["topic", "path", "heading"]);
      requireHarness(DOCUMENT_TOPICS.includes(entry.topic), "Unknown documentation topic");
      harnessPath(entry.path);
      if ("heading" in entry) text2(entry.heading, "coverage heading");
    }
    unique(value.document_coverage.map((entry) => entry.topic), "document coverage topics");
  }
  if ("provenance" in value) {
    list(value.provenance, "provenance");
    for (const entry of value.provenance) {
      shape(entry, "provenance entry", ["output", "sources"]);
      harnessPath(entry.output);
      list(entry.sources, "provenance sources");
      for (const source of entry.sources) {
        sourceRef(source);
        requireHarness(value.sources.some((item) => json(item) === json(source)), "Provenance must reference a declared source");
      }
      unique(entry.sources.map(json), "provenance sources");
    }
    unique(value.provenance.map((entry) => entry.output), "provenance outputs");
  }
  if ("projections" in value) {
    list(value.projections, "projections");
    for (const entry of value.projections) {
      shape(entry, "projection", ["source", "target"]);
      sourceRef(entry.source);
      sourceRef(entry.target);
      requireHarness(json(entry.source) !== json(entry.target), "A projection needs different source and target files");
      requireHarness(value.sources.some((item) => json(item) === json(entry.source)), "Projection owner must be a declared source");
    }
    unique(value.projections.map((entry) => json(entry.target)), "projection targets");
  }
  for (const kind of ["documents", "resources"]) if (kind in value) {
    resources(value[kind]);
    for (const resource of value[kind]) {
      if (kind === "documents" && value.documentation_root !== void 0) requireHarness(resource.path.startsWith(`${value.documentation_root}/`), "Generated documents must stay inside documentation_root");
      if (value.layout === "centralized") requireHarness(resource.path.startsWith(kind === "documents" ? ".harness/docs/" : ".harness/resources/"), "Centralized documents belong in .harness/docs/ and resources in .harness/resources/");
      else requireHarness(!resource.path.startsWith(".harness/") || kind === "documents" && value.documentation_root !== void 0 && resource.path.startsWith(`${value.documentation_root}/`), "The .harness directory is reserved for generated state and runtimes");
    }
  }
  for (const kind of ["skills", "commands", "agents"]) if (kind in value) {
    list(value[kind], kind);
    for (const item of value[kind]) {
      shape(item, kind, ["name", "description", "body", "resources"]);
      identifier2(item.name);
      text2(item.description, "description");
      text2(item.body, "body");
      if ("resources" in item) {
        requireHarness(kind === "skills", "Only skills can contain portable resources");
        resources(item.resources);
        requireHarness(!item.resources.some((resource) => resource.path === "SKILL.md"), "Skill resources cannot replace SKILL.md");
      }
    }
    unique(value[kind].map((item) => item.name), `${kind} names`);
  }
  unique([...value.skills ?? [], ...value.commands ?? []].map((item) => item.name), "Skill and command names");
  if ("rules" in value) {
    list(value.rules, "rules");
    for (const rule of value.rules) {
      shape(rule, "rule", ["name", "body"]);
      identifier2(rule.name);
      text2(rule.body, "rule.body");
    }
    unique(value.rules.map((rule) => rule.name), "rule names");
  }
  if ("settings" in value) {
    shape(value.settings, "settings", ["commands", "codex", "claude_code"]);
    requireHarness(value.settings.codex !== void 0 || value.settings.claude_code !== void 0 || Array.isArray(value.settings.commands) && value.settings.commands.length > 0, "Settings need a native configuration or nonempty command policies");
    if ("commands" in value.settings) {
      list(value.settings.commands, "settings.commands");
      for (const policy of value.settings.commands) {
        shape(policy, "command policy", ["prefix", "decision", "reason"]);
        list(policy.prefix, "prefix");
        requireHarness(policy.prefix.length && policy.prefix.every((part) => typeof part === "string" && fullMatch(/^[a-zA-Z0-9_./:=@+-]+$/, part)), "Command prefixes require literal tokens without whitespace or shell metacharacters");
        requireHarness(["ask", "deny"].includes(policy.decision), "Command policy must ask or deny");
        text2(policy.reason, "reason");
      }
    }
    if ("codex" in value.settings) {
      requireHarness(value.targets.includes("codex"), "Codex settings require the codex target");
      shape(value.settings.codex, "codex settings", ["sandbox_mode", "approval_policy"]);
      requireHarness(["read-only", "workspace-write"].includes(value.settings.codex.sandbox_mode), "Choose a read-only or workspace-write sandbox");
      requireHarness(["on-request", "never"].includes(value.settings.codex.approval_policy), "Unsupported approval policy");
    }
    if ("claude_code" in value.settings) {
      requireHarness(value.targets.includes("claude-code"), "Claude settings require the claude-code target");
      shape(value.settings.claude_code, "claude_code settings", ["defaultMode"]);
      requireHarness(["default", "plan", "dontAsk"].includes(value.settings.claude_code.defaultMode), "Unsupported Claude permission mode");
    }
  }
  if ("hooks" in value) {
    shape(value.hooks, "hooks", ["guards", "cases"]);
    list(value.hooks.guards, "guards");
    list(value.hooks.cases, "cases");
    requireHarness(value.hooks.guards.length > 0 && value.hooks.cases.length > 1, "Hooks need guards and positive/negative cases");
    for (const guard of value.hooks.guards) {
      shape(guard, "guard", ["id", "contains_all", "reason"]);
      identifier2(guard.id);
      text2(guard.reason, "guard.reason");
      list(guard.contains_all, "contains_all");
      requireHarness(guard.contains_all.length > 0, "A guard needs nonempty command fragments");
      for (const fragment of guard.contains_all) text2(fragment, "command fragment");
    }
    unique(value.hooks.guards.map((guard) => guard.id), "guard IDs");
    for (const example of value.hooks.cases) {
      shape(example, "hook case", ["name", "input", "expected"]);
      text2(example.name, "case.name");
      requireHarness(isObject(example.input), "Hook input must be an object");
      requireHarness(["pass", "deny"].includes(example.expected), "Hook case expects pass or deny");
    }
    const cases = value.hooks.cases, guards = value.hooks.guards;
    unique(cases.map((example) => example.name), "case names");
    requireHarness(cases.some((example) => example.expected === "pass"), "Hooks need a non-blocking case");
    for (const guard of guards) requireHarness(cases.some((example) => example.expected === "deny" && evaluateGuard([guard], example.input).guard === guard.id), `Missing blocking case for guard ${guard.id}`);
  }
  if ("ci" in value) {
    shape(value.ci, "ci", ["provider", "checks"]);
    requireHarness(value.ci.provider === "github-actions", "Currently supported CI provider: github-actions");
    list(value.ci.checks, "ci.checks");
    for (const check of value.ci.checks) {
      shape(check, "CI check", ["name", "run", "working_directory"]);
      text2(check.name, "CI check name");
      text2(check.run, "CI command");
      if ("working_directory" in check) harnessPath(check.working_directory);
    }
  }
}
function evaluateGuard(guards, input) {
  if (!isObject(input)) return { decision: "deny", reason: "Malformed hook input" };
  if (input.hook_event_name !== "PreToolUse") return { decision: "pass" };
  if (!["Bash", "exec_command", "shell_command"].includes(input.tool_name)) return { decision: "pass" };
  const args = input.tool_input;
  const command = isObject(args) ? args.command ?? args.cmd : void 0;
  if (typeof command !== "string" || command.length > 256 * 1024) return { decision: "deny", reason: "Cannot inspect this shell tool input" };
  const normalized = command.replace(/\s+/g, " ");
  const guard = guards.find((item) => item.contains_all.every((fragment) => normalized.includes(fragment.replace(/\s+/g, " "))));
  return guard ? { decision: "deny", reason: guard.reason, guard: guard.id } : { decision: "pass" };
}
function hookOutput(result) {
  return result.decision === "deny" ? { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: result.reason } } : {};
}

// src/entries/harness-hook.ts
try {
  const profile = JSON.parse(fs.readFileSync(new URL("../harness.json", import.meta.url), "utf8"));
  validateHarnessSpec(profile);
  let buffer = "";
  for await (const chunk of process.stdin) {
    buffer += chunk;
    if (buffer.length > 256 * 1024) throw new Error("Hook input too large");
  }
  console.log(JSON.stringify(hookOutput(evaluateGuard(profile.hooks?.guards ?? [], JSON.parse(buffer)))));
} catch {
  console.log(JSON.stringify(hookOutput({ decision: "deny", reason: "Harness hook could not validate its input or configuration" })));
}
