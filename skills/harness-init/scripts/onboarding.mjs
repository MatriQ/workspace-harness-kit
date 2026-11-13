#!/usr/bin/env node
// Generated from TypeScript by scripts/build.mjs. Do not edit.

// src/adapters/files.ts
import fs from "node:fs";

// src/core/json.ts
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function fullMatch(pattern, value) {
  return pattern.exec(value)?.[0] === value;
}

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
function validateHarnessSelection(value) {
  shape(value, "harness", ["layout", "targets", "artifacts"]);
  if ("layout" in value) requireHarness(value.layout === "centralized" || value.layout === "native", "Choose centralized or native harness layout");
  if ("targets" in value) targets(value.targets);
  if ("artifacts" in value) {
    shape(value.artifacts, "harness.artifacts", [...HARNESS_PARTS]);
    requireHarness(Object.values(value.artifacts).every((item) => typeof item === "boolean"), "Artifact choices must be booleans; omit unanswered choices");
    if (value.layout === "centralized") requireHarness(!["settings", "hooks", "ci"].some((part) => value.artifacts[part] === true), "Centralized layout does not register native settings, hooks or CI; choose native layout for those integrations");
  }
}

// src/core/onboarding.ts
var ACTIVITIES = ["development", "testing", "deployment", "operations"];
var OnboardingError = class extends Error {
  name = "OnboardingError";
};
function requireProfile(condition, message) {
  if (!condition) throw new OnboardingError(message);
}
function shape2(value, name, fields) {
  requireProfile(isObject(value), `${name} must be an object`);
  requireProfile(Object.keys(value).every((key) => fields.includes(key)), `${name} has unknown fields`);
}
function nonempty(value, name) {
  requireProfile(typeof value === "string" && value.trim() && value.length <= 2e3, `${name} must be nonempty text of at most 2000 characters`);
}
function names(value, name) {
  requireProfile(Array.isArray(value), `${name} must be a list`);
  for (const item of value) nonempty(item, name);
  requireProfile(new Set(value).size === value.length, `${name} contains duplicates`);
}
function relative(value) {
  requireProfile(typeof value === "string" && !/[\\:\x00-\x1f\x7f]/.test(value) && value.split("/").every((part) => part && ![".", "..", ".git", "node_modules"].includes(part)), "Documentation paths must be normalized relative paths outside Git metadata and dependencies");
}
function validateOnboarding(value) {
  shape2(value, "onboarding", ["schema_version", "language", "background", "activities", "platforms", "tool_policy", "documentation", "harness"]);
  requireProfile(value.schema_version === 1, "Expected onboarding schema_version 1");
  if ("language" in value) requireProfile(value.language === "en" || value.language === "zh-CN", "Choose en or zh-CN for generated harness prose");
  if ("harness" in value) validateHarnessSelection(value.harness);
  if ("background" in value) nonempty(value.background, "background");
  if ("activities" in value) {
    shape2(value.activities, "activities", [...ACTIVITIES]);
    requireProfile(Object.values(value.activities).every((item) => typeof item === "boolean"), "Activity choices must be booleans; omit unanswered choices");
  }
  if ("tool_policy" in value) requireProfile(["install-missing", "inspect-only"].includes(value.tool_policy), "Unknown tool_policy");
  if ("documentation" in value) {
    shape2(value.documentation, "documentation", ["placement", "root", "entrypoint", "existing_documents"]);
    requireProfile(["coordinator", "members"].includes(value.documentation.placement), "Choose coordinator or members documentation placement");
    relative(value.documentation.root);
    if ("entrypoint" in value.documentation) relative(value.documentation.entrypoint);
    if ("existing_documents" in value.documentation) {
      requireProfile(Array.isArray(value.documentation.existing_documents), "existing_documents must be a list of explicit choices");
      const seen = /* @__PURE__ */ new Set(), destinations = /* @__PURE__ */ new Set();
      for (const choice of value.documentation.existing_documents) {
        shape2(choice, "existing document choice", ["member", "path", "action", "destination"]);
        requireProfile(typeof choice.member === "string" && fullMatch(/^[a-z0-9][a-z0-9._-]*$/, choice.member), "Existing documents need a stable member ID");
        relative(choice.path);
        const key = JSON.stringify([choice.member, choice.path]);
        requireProfile(!seen.has(key), "Repeated existing document choice");
        seen.add(key);
        requireProfile(choice.action === "keep" || choice.action === "move", "Choose keep or move for each existing document");
        if (choice.action === "move") {
          relative(choice.destination);
          requireProfile(choice.destination.startsWith(`${value.documentation.root}/`) && choice.destination !== choice.path, "Move destinations must be inside the documentation root and differ from the source");
          const destination = JSON.stringify([choice.member, choice.destination]);
          requireProfile(!destinations.has(destination), "Multiple documents cannot move to the same destination");
          destinations.add(destination);
        } else requireProfile(!("destination" in choice), "Kept documents do not have a move destination");
      }
    }
  }
  if ("platforms" in value) {
    requireProfile(Array.isArray(value.platforms), "platforms must be a list");
    const seen = /* @__PURE__ */ new Set();
    for (const platform of value.platforms) {
      shape2(platform, "platform", ["id", "provider", "name", "services", "environments", "access", "delivery", "tools"]);
      requireProfile(typeof platform.id === "string" && fullMatch(/^[a-z0-9][a-z0-9._-]*$/, platform.id) && !seen.has(platform.id), "Platform IDs must be unique lowercase identifiers");
      seen.add(platform.id);
      requireProfile(["aws", "azure", "gcp", "other"].includes(platform.provider), "Unknown provider; use other with its actual name");
      if ("name" in platform) nonempty(platform.name, "platform.name");
      if (platform.provider === "other") nonempty(platform.name, "platform.name");
      for (const field of ["services", "environments", "tools"]) if (field in platform) names(platform[field], `platform.${field}`);
      if ("access" in platform) requireProfile(["cli", "existing-tools", "documentation-only"].includes(platform.access), "Unknown platform access mode");
      if ("delivery" in platform) requireProfile(["github-actions", "azure-pipelines", "gitlab-ci", "manual", "other"].includes(platform.delivery), "Unknown delivery method; use other for a project-owned workflow");
    }
  }
}
var TOOL_CATALOG = [
  { id: "aws", executable: "aws", version_args: ["--version"], minimum_major: 2, install_url: "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html" },
  { id: "azure", executable: "az", version_args: ["version", "--output", "json"], minimum_major: 2, install_url: "https://learn.microsoft.com/en-us/cli/azure/install-azure-cli" },
  { id: "gcloud", executable: "gcloud", version_args: ["version", "--format=json"], install_url: "https://docs.cloud.google.com/sdk/docs/install-sdk" },
  { id: "gh", executable: "gh", version_args: ["--version"], install_url: "https://github.com/cli/cli#installation" },
  { id: "kubectl", executable: "kubectl", version_args: ["version", "--client=true", "--output=json"], install_url: "https://kubernetes.io/docs/tasks/tools/" },
  { id: "helm", executable: "helm", version_args: ["version", "--short"], install_url: "https://helm.sh/docs/intro/install/" },
  { id: "terraform", executable: "terraform", version_args: ["version", "-json"], install_url: "https://developer.hashicorp.com/terraform/install" },
  { id: "docker", executable: "docker", version_args: ["--version"], install_url: "https://docs.docker.com/get-started/get-docker/" }
];
function planOnboarding(input) {
  validateOnboarding(input);
  const profile = input, activities = profile.activities ?? {}, platforms = profile.platforms ?? [];
  const remote = activities.deployment === true || activities.operations === true;
  const questions = [];
  if (!profile.language) questions.push({ id: "language", prompt: "Which language should the generated harness documents and agent instructions use?", choices: ["English (en)", "简体中文 (zh-CN)"] });
  if (!profile.background) questions.push({
    id: "background",
    prompt: "What role should this workspace serve? In an empty directory, choose its role before describing an application; an existing project can supply background from its sources.",
    choices: [
      "Harness documentation hub — keep shared harness guides here and connect other repositories by Git URL or local directory",
      "Monorepo — initialize the harness here and add application code to this repository later",
      "Existing or other project — use confirmed project context or describe another setup"
    ]
  });
  const unanswered = ACTIVITIES.filter((activity) => activities[activity] === void 0);
  if (unanswered.length) questions.push({ id: "activities", prompt: `Which of these activities should initialization cover: ${unanswered.join(", ")}? Record each as needed or not needed.` });
  if (remote && !platforms.length) questions.push({ id: "platforms", prompt: "Which platforms host the environments you want to deploy to or operate? Multiple platforms are supported.", choices: ["AWS", "Azure", "Google Cloud", "Other / self-hosted"] });
  if (remote) for (const platform of platforms) {
    if (!platform.services?.length || !platform.environments?.length) questions.push({ id: `${platform.id}.targets`, prompt: `For ${platform.name ?? platform.provider}, which services and environments are in scope? Reuse confirmed repository configuration where possible.` });
    if (platform.access === void 0) questions.push({ id: `${platform.id}.access`, prompt: `How should the harness access ${platform.id}?`, choices: ["Provider CLI", "Existing tools or connector", "Documentation only"] });
    if (activities.deployment && platform.delivery === void 0) questions.push({ id: `${platform.id}.delivery`, prompt: `How are releases to ${platform.id} performed?`, choices: ["GitHub Actions", "Azure Pipelines", "GitLab CI", "Manual procedure", "Other"] });
    if (platform.provider === "other" && platform.access === "cli" && !platform.tools?.length) questions.push({ id: `${platform.id}.tools`, prompt: `Which vendor CLI or project-owned tools are needed for ${platform.name}? Supply their official installation documentation during setup.` });
  }
  const preparesTools = activities.development || activities.testing || remote && platforms.some((platform) => platform.access === "cli");
  if (preparesTools && !profile.tool_policy) questions.push({ id: "tool_policy", prompt: "Should setup install missing tools, or only inspect and document prerequisites?", choices: ["Install missing tools", "Inspect only"] });
  if (profile.harness) {
    if (!profile.harness.targets?.length) questions.push({ id: "harness.targets", prompt: "Which local agents should load the generated harness?", choices: ["Codex", "Claude Code", "Both"] });
    const missing = HARNESS_PARTS.filter((part) => profile.harness.artifacts?.[part] === void 0);
    if (missing.length) questions.push({ id: "harness.artifacts", prompt: `Which harness parts should be generated or refreshed: ${missing.join(", ")}? Reuse existing components where suitable.` });
  }
  const requirements = /* @__PURE__ */ new Map();
  const addTool = (id, reason) => requirements.set(id, [.../* @__PURE__ */ new Set([...requirements.get(id) ?? [], reason])]);
  if (remote) {
    for (const platform of platforms) if (platform.access === "cli") {
      if (platform.provider !== "other") addTool({ aws: "aws", azure: "azure", gcp: "gcloud" }[platform.provider], `${platform.id}: provider access`);
      if (activities.deployment && platform.delivery === "github-actions") addTool("gh", `${platform.id}: release workflow inspection`);
      if (activities.deployment && platform.delivery === "azure-pipelines") addTool("azure", `${platform.id}: pipeline access; verify the Azure DevOps extension separately`);
      for (const tool of platform.tools ?? []) addTool(tool, `${platform.id}: explicitly selected tool`);
    }
  }
  const scope = profile.documentation?.placement === "members" ? "selected-members" : "workspace";
  const root = profile.documentation?.root ?? (profile.harness?.layout === "centralized" ? ".harness/docs" : "docs/harness");
  const documents = [{ scope, path: `${root}/index.md`, topic: "Background, selected repositories, requested activities, task routing, sources and unresolved decisions" }];
  if (activities.development) documents.push({ scope, path: `${root}/development.md`, topic: "Project runtimes, installation, configuration, startup and a representative local smoke check" });
  if (activities.testing) documents.push({ scope, path: `${root}/testing.md`, topic: "Native test entry points, scope, fixtures, CI gates and report locations" });
  if (remote) documents.push({ scope, path: `${root}/environments.md`, topic: "Per-platform environment identity, services, regions, access method and evidence sources" });
  if (activities.deployment) documents.push({ scope, path: `${root}/release.md`, topic: "Release trigger, artifact, ordering, authorization, runtime verification and rollback" });
  if (activities.operations) documents.push({ scope, path: `${root}/operations.md`, topic: "Logs, metrics, alerts, queues, dependencies, investigation steps and escalation" });
  if (ACTIVITIES.some((activity) => activities[activity])) documents.push({ scope, path: `${root}/toolchain.md`, topic: "Selected tools, authoritative installation methods, version constraints and access verification procedures" });
  if (profile.documentation?.entrypoint) documents.push({ scope, path: profile.documentation.entrypoint, topic: "Short task router linking existing and generated authoritative guides" });
  return {
    status: questions.length ? "needs-input" : "planned",
    language: profile.language ?? "undecided",
    questions,
    tools: [...requirements].map(([id, reasons]) => {
      const definition = TOOL_CATALOG.find((tool) => tool.id === id);
      return { id, reasons, definition: definition ? structuredClone(definition) : null };
    }),
    tool_policy: profile.tool_policy ?? "undecided",
    documents,
    platform_guides: remote ? platforms.map((platform) => ({ platform: platform.id, reference: `references/providers/${platform.provider}.md` })) : [],
    ...profile.harness ? { harness: { layout: profile.harness.layout ?? "native", targets: [...profile.harness.targets ?? []], artifacts: HARNESS_PARTS.filter((part) => profile.harness.artifacts?.[part]), reference: "references/generation.md", activation: "not run" } } : {},
    execution: { installation: "not run", authentication: "not run", target_access: "not run", documentation: "not run" }
  };
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

// src/adapters/onboarding.ts
import { spawnSync } from "node:child_process";
var localProbe = (tool) => {
  const result = spawnSync(tool.executable, [...tool.version_args], {
    encoding: "utf8",
    timeout: 1e4,
    maxBuffer: 256 * 1024,
    shell: false,
    env: {
      ...process.env,
      AWS_PAGER: "",
      CLOUDSDK_CORE_DISABLE_PROMPTS: "1",
      CLOUDSDK_COMPONENT_MANAGER_DISABLE_UPDATE_CHECK: "true",
      GH_NO_UPDATE_NOTIFIER: "1",
      GH_PROMPT_DISABLED: "1"
    }
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: result.error };
};
function parseVersion(id, result) {
  const output = result.stdout.trim();
  let value;
  if (["azure", "gcloud", "kubectl", "terraform"].includes(id)) {
    try {
      const object2 = JSON.parse(output);
      if (!isObject(object2)) return void 0;
      if (id === "azure") value = object2["azure-cli"];
      else if (id === "gcloud") value = object2["Google Cloud SDK"];
      else if (id === "terraform") value = object2.terraform_version;
      else if (isObject(object2.clientVersion)) value = object2.clientVersion.gitVersion;
    } catch {
      return void 0;
    }
  } else {
    const text2 = output || result.stderr.trim();
    const pattern = {
      aws: /^aws-cli\/([^\s]+)/,
      gh: /^gh version ([^\s]+)/,
      docker: /^Docker version ([^,\s]+)/,
      helm: /^(v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?)/
    }[id];
    value = pattern?.exec(text2)?.[1];
  }
  return typeof value === "string" && /^v?\d+(?:\.\d+){1,3}(?:[-+][a-zA-Z0-9.-]+)?$/.test(value) && !/[\r\n]/.test(value) ? value : void 0;
}
function inspectToolchain(profile, probe = localProbe) {
  const plan = planOnboarding(profile);
  const tools = plan.tools.map((requirement) => {
    const definition = requirement.definition;
    if (!definition) return { id: requirement.id, status: "manual", version: null, reason: "Use the vendor or project documentation; this tool has no maintained probe" };
    const result = probe(definition);
    if (result.error?.code === "ENOENT") return { id: requirement.id, status: "missing", version: null, reason: "Executable is not on PATH" };
    const version = parseVersion(definition.id, result);
    if (result.error || result.status !== 0 || !version) return { id: requirement.id, status: "unverified", version: null, reason: "Version check did not produce a recognized successful result" };
    if (definition.minimum_major !== void 0 && Number(version.replace(/^v/, "").split(".")[0]) < definition.minimum_major) return { id: requirement.id, status: "incompatible", version, reason: `Requires major version ${definition.minimum_major} or newer; reconcile project constraints before changing an existing installation` };
    return { id: requirement.id, status: "available", version, reason: "Local version probe passed; check project-specific version constraints separately" };
  });
  return {
    status: plan.status === "planned" && tools.every((tool) => tool.status === "available") ? "checked" : "pending",
    tools,
    installation: "not run",
    authentication: "not run",
    target_access: "not run",
    next_questions: plan.questions
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

// src/cli/onboarding.ts
function onboardingMain(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage: onboarding plan PROFILE_JSON | tools PROFILE_JSON\nplan reports unanswered questions, required tools and document topics.\ntools runs only local version probes; it does not install tools or authenticate.");
    return 0;
  }
  try {
    const [command, ...args] = argv;
    if (!["plan", "tools"].includes(command)) throw new UsageError("Expected plan or tools");
    const { positionals: [file] } = parse(args, {}, 1), profile = readJson(file);
    const result = command === "plan" ? planOnboarding(profile) : inspectToolchain(profile);
    console.log(JSON.stringify(result, null, 2));
    return command === "tools" && result.status === "pending" ? 2 : 0;
  } catch (error) {
    console.log(JSON.stringify({ status: "invalid", error: error.message }));
    return 2;
  }
}

// src/entries/onboarding.ts
process.exitCode = onboardingMain(process.argv.slice(2));
