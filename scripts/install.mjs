#!/usr/bin/env node
// Generated from TypeScript by scripts/build.mjs. Do not edit.

// src/entries/install.ts
import { fileURLToPath } from "node:url";

// src/adapters/install.ts
import fs2 from "node:fs";
import os2 from "node:os";
import path2 from "node:path";

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

// src/adapters/files.ts
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash, randomUUID } from "node:crypto";
function stat(file, follow = true) {
  try {
    return follow ? fs.statSync(file) : fs.lstatSync(file);
  } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes(error.code ?? "")) return void 0;
    throw error;
  }
}
function resolvePath(file) {
  const absolute = path.resolve(file);
  try {
    return fs.realpathSync(absolute);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const parent = path.dirname(absolute);
    if (parent === absolute) throw error;
    return path.join(resolvePath(parent), path.basename(absolute));
  }
}
function expandUser(file) {
  return file === "~" ? os.homedir() : file.startsWith("~/") ? path.join(os.homedir(), file.slice(2)) : file;
}
function isWithin(root, file) {
  const rel = path.relative(root, file);
  return rel === "" || !rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel);
}
function hash(data) {
  return createHash("sha256").update(data).digest("hex");
}
function fileHash(file) {
  return hash(fs.readFileSync(file));
}
function readJson(file, fallback) {
  if (!stat(file) && fallback !== void 0) return structuredClone(fallback);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Could not read JSON from ${file}: ${error.message}`);
  }
}

// src/adapters/install.ts
var RECEIPT = ".workspace-harness-kit-install.json";
var LOCK = ".workspace-harness-kit-install.lock";
var InstallError = class extends Error {
  name = "InstallError";
};
function requireInstall(condition, message) {
  if (!condition) throw new InstallError(message);
}
function inventory(directory) {
  const info = stat(directory, false);
  requireInstall(!info?.isSymbolicLink(), `Expected a regular directory: ${directory}`);
  if (!info) return {};
  requireInstall(info.isDirectory(), `Expected a directory: ${directory}`);
  const entries = [];
  function visit(parent, prefix) {
    for (const child of fs2.readdirSync(parent, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
      if (child.name === "__pycache__" || /\.py[co]$/.test(child.name)) continue;
      const file = path2.join(parent, child.name), relative = prefix + child.name;
      requireInstall(!child.isSymbolicLink(), `Skill contains a symlink: ${file}`);
      if (child.isDirectory()) visit(file, relative + "/");
      else if (child.isFile()) entries.push([relative, fileHash(file)]);
      else throw new InstallError(`Skill contains a non-regular file: ${file}`);
    }
  }
  visit(directory, "");
  return Object.fromEntries(entries);
}
function receipt(destination) {
  const file = path2.join(destination, RECEIPT);
  requireInstall(!stat(file, false)?.isSymbolicLink(), "Installation receipt cannot be a symlink");
  const value = readJson(file, { schema_version: 1, skills: {} });
  requireInstall(isObject(value) && value.schema_version === 1 && isObject(value.skills), "Unsupported installation receipt");
  for (const [name, item] of Object.entries(value.skills)) {
    requireInstall(fullMatch(/^harness-[a-z0-9][a-z0-9-]*$/, name) && isObject(item) && isObject(item.files) && typeof item.version === "string", "Invalid installed Skill record");
    for (const digest of Object.values(item.files)) requireInstall(typeof digest === "string" && fullMatch(/^[a-f0-9]{64}$/, digest), "Invalid installed file hash");
  }
  return value;
}
var Installer = class {
  root;
  constructor(sourceRoot) {
    this.root = resolvePath(sourceRoot);
  }
  get version() {
    return fs2.readFileSync(path2.join(this.root, "VERSION"), "utf8").trim();
  }
  plan(destination, skills = []) {
    destination = path2.resolve(expandUser(destination));
    requireInstall(!stat(destination, false)?.isSymbolicLink(), "Choose a regular destination directory");
    destination = resolvePath(destination);
    requireInstall(!isWithin(this.root, destination), "Choose a destination outside the source checkout");
    requireInstall(!stat(path2.join(destination, LOCK), false), "Installation is locked; inspect the interrupted installer before removing its lock");
    const installed = receipt(destination);
    const available = fs2.readdirSync(path2.join(this.root, "skills")).filter((name) => stat(path2.join(this.root, "skills", name, "SKILL.md"))?.isFile());
    requireInstall(Array.isArray(skills), "Unknown Skill selection");
    const selected = [...new Set(skills.length ? skills : available)].sort();
    requireInstall(selected.every((name) => typeof name === "string" && fullMatch(/^harness-[a-z0-9][a-z0-9-]*$/, name) && available.includes(name)), "Unknown Skill selection");
    const conflicts = [], entries = {};
    for (const name of selected) {
      const current = inventory(path2.join(destination, name));
      const previous = installed.skills[name];
      if (!previous && stat(path2.join(destination, name), false)) conflicts.push(`${name}: destination is not owned by this installer`);
      else if (previous && !equal(current, previous.files)) conflicts.push(`${name}: local files changed; preserve or reconcile them before upgrading`);
      entries[name] = { before: current, after: inventory(path2.join(this.root, "skills", name)) };
    }
    const file = path2.join(destination, RECEIPT);
    return {
      schema_version: 1,
      version: this.version,
      destination,
      skills: selected,
      entries,
      receipt_before: stat(file) ? fileHash(file) : null,
      conflicts
    };
  }
  apply(input) {
    requireInstall(isObject(input) && typeof input.destination === "string" && Array.isArray(input.skills), "Invalid installation plan");
    const fresh = this.plan(input.destination, input.skills);
    requireInstall(equal(fresh, input), "Source or destination changed after preview; create a new plan");
    const plan = fresh;
    requireInstall(!plan.conflicts.length, plan.conflicts.join("; "));
    const destination = plan.destination;
    fs2.mkdirSync(destination, { recursive: true });
    const lock = path2.join(destination, LOCK);
    try {
      fs2.mkdirSync(lock);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      throw new InstallError("Another installer holds the destination lock");
    }
    const changed = [], moved = [], published = [];
    let staging;
    try {
      const installed = receipt(destination), file = path2.join(destination, RECEIPT);
      const oldReceipt = stat(file) ? fs2.readFileSync(file) : null;
      requireInstall((oldReceipt ? hash(oldReceipt) : null) === plan.receipt_before, "Installation receipt changed while acquiring the lock");
      for (const [name, entry] of Object.entries(plan.entries)) requireInstall(equal(inventory(path2.join(destination, name)), entry.before) && equal(inventory(path2.join(this.root, "skills", name)), entry.after), "Skill files changed while acquiring the lock");
      staging = fs2.mkdtempSync(path2.join(destination, ".install-"));
      try {
        for (const [name, entry] of Object.entries(plan.entries)) {
          installed.skills[name] = { version: plan.version, files: entry.after };
          if (equal(entry.before, entry.after)) continue;
          const prepared = path2.join(staging, name), target = path2.join(destination, name);
          fs2.cpSync(path2.join(this.root, "skills", name), prepared, {
            recursive: true,
            dereference: false,
            filter: (source) => path2.basename(source) !== "__pycache__" && !/\.py[co]$/.test(source)
          });
          requireInstall(equal(inventory(prepared), entry.after), "Skill source changed during copying");
          requireInstall(equal(inventory(target), entry.before), "Destination changed during copying");
          if (stat(target, false)) {
            fs2.renameSync(target, path2.join(staging, name + ".backup"));
            moved.push(name);
          }
          fs2.renameSync(prepared, target);
          published.push(name);
          changed.push(name);
        }
        const payload = Buffer.from(json(installed));
        if (!oldReceipt?.equals(payload)) {
          requireInstall(!stat(file, false)?.isSymbolicLink() && (stat(file) ? fileHash(file) : null) === plan.receipt_before, "Installation receipt changed during copying");
          const prepared = path2.join(staging, RECEIPT);
          fs2.writeFileSync(prepared, payload, { flag: "wx" });
          fs2.renameSync(prepared, file);
        }
      } catch (error) {
        const recoveryErrors = [];
        for (const name of published.reverse()) {
          const target = path2.join(destination, name);
          try {
            if (!equal(inventory(target), plan.entries[name].after)) recoveryErrors.push(name);
            else fs2.rmSync(target, { recursive: true });
          } catch {
            recoveryErrors.push(name);
          }
        }
        for (const name of moved.reverse()) {
          const target = path2.join(destination, name);
          try {
            if (stat(target, false)) recoveryErrors.push(name);
            else fs2.renameSync(path2.join(staging, name + ".backup"), target);
          } catch {
            recoveryErrors.push(name);
          }
        }
        if (recoveryErrors.length) {
          const recovery = path2.join(destination, ".workspace-harness-kit-recovery-" + path2.basename(staging).replace(".install-", ""));
          const retained = staging;
          staging = void 0;
          try {
            fs2.renameSync(retained, recovery);
          } catch {
            throw new InstallError(`Files changed during recovery; preserved current files and backups in ${retained}`);
          }
          throw new InstallError(`Files changed during recovery; preserved current files and backups in ${recovery}`);
        }
        throw error;
      }
    } finally {
      try {
        if (staging) fs2.rmSync(staging, { recursive: true, force: true });
      } finally {
        fs2.rmdirSync(lock);
      }
    }
    return { version: plan.version, installed: plan.skills, changed };
  }
};
function checkInstallation(destination) {
  destination = resolvePath(expandUser(destination));
  const installed = receipt(destination);
  requireInstall(Object.keys(installed.skills).length, "No installed Skills recorded");
  const problems = [];
  for (const [name, entry] of Object.entries(installed.skills)) if (!equal(inventory(path2.join(destination, name)), entry.files)) problems.push(`${name}: files differ from the installed version`);
  return { skills: Object.fromEntries(Object.entries(installed.skills).map(([name, item]) => [name, item.version])), problems };
}
function setupInstallation(sourceRoot, options = {}, userDirectory = os2.homedir()) {
  requireInstall(options.agent === void 0 || ["codex", "claude", "both"].includes(options.agent), "Expected agent codex, claude or both");
  requireInstall(options.destination === void 0 || options.agent === void 0, "Use either --agent or --destination, not both");
  const agent = options.agent ?? "codex";
  const destinations = options.destination !== void 0 ? [options.destination] : (agent === "both" ? [".agents", ".claude"] : [agent === "codex" ? ".agents" : ".claude"]).map((folder) => path2.join(userDirectory, folder, "skills"));
  const installer = new Installer(sourceRoot);
  const plans = [...new Map(destinations.map((destination) => {
    const plan = installer.plan(destination, options.skills);
    return [plan.destination, plan];
  })).values()];
  if (options.dryRun) return { dry_run: true, plans };
  const conflicts = plans.flatMap((plan) => plan.conflicts.map((conflict) => `${plan.destination}: ${conflict}`));
  requireInstall(!conflicts.length, conflicts.join("; "));
  const installations = plans.map((plan) => {
    const applied = installer.apply(plan);
    return { destination: plan.destination, ...applied, ...checkInstallation(plan.destination) };
  });
  return { dry_run: false, installations };
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
    const options = Object.fromEntries(Object.entries(specs).map(([name, { type, multiple: multiple2 }]) => [name, { type, multiple: multiple2 ?? false }]));
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
var flag = { type: "boolean" };
var multiple = { type: "string", multiple: true };

// src/cli/install.ts
function installMain(argv, sourceRoot) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage: install --version | setup [--agent codex|claude|both | --destination PATH] [--skill NAME] [--dry-run] | plan --destination PATH [--skill NAME] | apply --plan FILE | check --destination PATH");
    return 0;
  }
  try {
    const installer = new Installer(sourceRoot);
    if (argv.length === 1 && argv[0] === "--version") {
      console.log(installer.version);
      return 0;
    }
    const [command, ...args] = argv;
    let result, status = 0;
    if (command === "setup") {
      const { values } = parse(args, { agent: stringOption, destination: stringOption, skill: multiple, "dry-run": flag });
      if (values.agent !== void 0 && !["codex", "claude", "both"].includes(values.agent)) throw new UsageError("Expected --agent codex, claude or both");
      if (values.agent !== void 0 && values.destination !== void 0) throw new UsageError("Use either --agent or --destination, not both");
      const setup = setupInstallation(sourceRoot, {
        agent: values.agent,
        destination: values.destination,
        skills: values.skill,
        dryRun: values["dry-run"]
      });
      result = setup;
      status = Number(setup.dry_run ? setup.plans.some((plan) => plan.conflicts.length) : setup.installations.some((installation) => installation.problems.length));
    } else if (command === "plan") {
      const { values } = parse(args, { destination: required, skill: multiple });
      const plan = installer.plan(values.destination, values.skill);
      result = plan;
      status = Number(plan.conflicts.length > 0);
    } else if (command === "apply") {
      const { values } = parse(args, { plan: required });
      result = installer.apply(readJson(values.plan));
    } else if (command === "check") {
      const { values } = parse(args, { destination: required });
      const checked = checkInstallation(values.destination);
      result = checked;
      status = Number(checked.problems.length > 0);
    } else throw new UsageError("Expected setup, plan, apply, or check. Use --help for usage.");
    console.log(JSON.stringify(result, null, 2));
    return status;
  } catch (error) {
    console.error(`install: ${error.message}`);
    return error instanceof UsageError ? 2 : 1;
  }
}

// src/entries/install.ts
process.exitCode = installMain(process.argv.slice(2), fileURLToPath(new URL("../", import.meta.url)));
