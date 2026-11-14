#!/usr/bin/env python3
"""Exercise initialization, discovery, reviews, installation and release verdicts in isolation."""

import json
from pathlib import Path
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[1]


def run(script, *args, expected=0):
    runtime = "node" if Path(script).suffix == ".mjs" else sys.executable
    result = subprocess.run([runtime, str(script), *map(str, args)], capture_output=True, text=True, timeout=60)
    if result.returncode != expected:
        raise RuntimeError(f"{Path(script).name} returned {result.returncode}, expected {expected}:\n{result.stderr}\n{result.stdout}")
    return result.stdout


def main():
    run(ROOT / "examples/test_loopback.py")
    with tempfile.TemporaryDirectory(prefix="workspace-harness-check-") as temporary:
        root = Path(temporary).resolve()
        demo = root / "workspace"
        run(ROOT / "examples/materialize.py", demo)
        install = ROOT / "scripts/install.mjs"
        plan_path = root / "install-plan.json"
        plan_path.write_text(run(install, "plan", "--destination", root / "installed"))
        run(install, "apply", "--plan", plan_path)
        run(install, "check", "--destination", root / "installed")
        helper = root / "installed/harness-init/scripts/workspace.mjs"
        onboarding = root / "installed/harness-init/scripts/onboarding.mjs"
        generator = root / "installed/harness-init/scripts/harness.mjs"
        evaluator = root / "installed/harness-verify-release/scripts/evidence.mjs"
        profile_path = root / "profile.json"
        profile = {"schema_version": 1, "language": "en", "background": "Develop and test a synthetic greeting API, client and worker locally.",
                   "activities": {"development": True, "testing": True, "deployment": False, "operations": False},
                   "tool_policy": "inspect-only"}
        profile_path.write_text(json.dumps(profile, indent=2))
        onboarding_plan = json.loads(run(onboarding, "plan", profile_path))
        assert onboarding_plan["status"] == "planned"
        assert onboarding_plan["tools"] == []
        assert onboarding_plan["platform_guides"] == []
        assert all(status == "not run" for status in onboarding_plan["execution"].values())
        discovered = json.loads(run(helper, "discover", "--directory", demo, "--depth", 1))
        assert len(discovered["repositories"]) == 5
        args = []
        for name, mode in (("api", "init"), ("client", "analyze"), ("worker", "analyze"),
                           ("e2e", "register"), ("product-docs", "analyze")):
            args.extend(["--member", name, mode, demo / name])
        plan_path = root / "workspace-plan.json"
        plan_path.write_text(run(helper, "plan", "--workspace", demo, "--profile", profile_path, *args,
                                 "--review-document", "api", "README.md"))
        run(helper, "apply", "--plan", plan_path)
        manifest_path = demo / ".harness/workspace.json"
        manifest = json.loads(manifest_path.read_text())
        assert manifest["onboarding"] == profile
        manifest["capabilities"] = [{"id": "greeting", "requires": ["api", "client", "worker"]}, {"id": "local-claim-fixture", "requires": ["api", "worker"], "scope": "Disposable local SQLite/outbox scenario; hosted dependencies unverified"}]
        manifest["relationships"] = [{"from": "client", "to": "api", "type": "starts_after"},
                                     {"from": "worker", "to": "client", "type": "consumes"}, {"from": "worker", "to": "api", "type": "consumes"}, {"from": "api", "to": "e2e", "type": "validated_by"}]
        manifest_path.write_text(json.dumps(manifest, indent=2))
        checked = json.loads(run(helper, "check", "--workspace", demo, "--local", "--strict"))
        assert checked["document_reviews"][0]["status"] == "current"
        assert checked["onboarding"]["status"] == "planned"
        # A separate coordinator owns the generated configuration and maps external members locally.
        coordinator = root / "coordinator"
        coordinator.mkdir()
        (coordinator / "README.md").write_text(
            "# Greeting services\n\nAn API, client and worker form a synthetic greeting journey. "
            "Hosted deployment is not configured. Shared-history rewrites are excluded by this synthetic team.\n")
        full_profile = dict(profile, harness={"targets": ["codex", "claude-code"], "artifacts": {
            name: True for name in ("documents", "skills", "commands", "agents", "rules", "settings", "hooks", "ci")}})
        full_profile["background"] += " Include local release rehearsal and investigation guides; hosted targets remain unconfigured."
        full_profile["activities"] = dict(profile["activities"], deployment=True, operations=True)
        full_profile["platforms"] = [{"id": "fixture", "provider": "other", "name": "Local fixture",
                                      "services": ["local processes"], "environments": ["local"],
                                      "access": "documentation-only", "delivery": "manual"}]
        full_profile_path = root / "full-profile.json"
        full_profile_path.write_text(json.dumps(full_profile, indent=2))
        assert json.loads(run(onboarding, "plan", full_profile_path))["status"] == "planned"
        plan_path.write_text(run(helper, "plan", "--workspace", coordinator, "--profile", full_profile_path,
                                 "--member", "api", "analyze", demo / "api",
                                 "--member", "client", "analyze", demo / "client",
                                 "--member", "worker", "analyze", demo / "worker",
                                 "--member", "e2e", "analyze", demo / "e2e",
                                 "--member", "product-docs", "analyze", demo / "product-docs"))
        run(helper, "apply", "--plan", plan_path)
        coordinator_path = coordinator / ".harness/workspace.json"
        coordinator_manifest = json.loads(coordinator_path.read_text())
        coordinator_manifest["capabilities"] = manifest["capabilities"]
        coordinator_manifest["relationships"] = manifest["relationships"]
        coordinator_path.write_text(json.dumps(coordinator_manifest, indent=2))
        spec = json.loads((root / "installed/harness-init/assets/harness-complete.json").read_text())
        spec["sources"].append({"member": "api", "path": "README.md"})
        for member, source in (("api", "serve.py"), ("client", "greet.py"), ("worker", "consume.py"), ("e2e", "smoke.py"), ("api", "claims.py"), ("worker", "sync_claims.py"), ("e2e", "business.py")):
            spec["sources"].append({"member": member, "path": source})
        spec["documents"][1]["body"] += "\n\nFrom the e2e checkout run `python3 smoke.py --json`."
        spec["command_checks"] = [{"document": "docs/harness/development.md", "command": "python3 smoke.py --json", "member": "e2e"}]
        spec["provenance"] = [{"output": "docs/harness/development.md", "sources": spec["sources"][1:]}]
        observed_target = {"environment": "local", "identity": "synthetic/greeting"}
        expected_artifacts = {member: {"kind": "git_commit", "value": subprocess.check_output(
            ["git", "-C", str(demo / member), "rev-parse", "HEAD"], text=True).strip()} for member in ("api", "client", "worker")}
        spec["verification"] = {"max_age_seconds": 3600, "checks": [
            {"id": "python-runtime", "layer": "tool", "target": {"environment": "local", "identity": "python"},
             "criterion": "The synthetic application's Python runtime executes", "probe": {"argv": ["python3", "--version"], "timeout_seconds": 5}},
            {"id": "greeting-smoke", "layer": "smoke", "target": observed_target,
             "criterion": "The API, client and worker accept a greeting at their selected source revisions",
             "probe": {"argv": ["python3", "smoke.py", "--json"], "member": "e2e", "timeout_seconds": 30,
                       "expect_json": {"target": observed_target, "artifacts": expected_artifacts, "accepted": True, "status": "passed"}}}
        ]}
        spec_path = root / "harness-spec.json"
        spec_path.write_text(json.dumps(spec, indent=2))
        plan_path.write_text(run(generator, "plan", "--workspace", coordinator, "--spec", spec_path))
        assert json.loads(plan_path.read_text())["conflicts"] == []
        run(generator, "apply", "--plan", plan_path)
        harness = json.loads(run(generator, "check", "--workspace", coordinator, "--local"))
        assert harness["status"] == "passed"
        assert all(case["status"] == "passed" for case in harness["hook_cases"])
        assert all(item["status"] == "not run" for item in harness["activation"])
        shared = json.loads(run(coordinator / ".harness/runtime/check.mjs", "--workspace", coordinator))
        assert shared["status"] == "passed" and len(shared["pending"]) >= 1
        doctor = json.loads(run(generator, "doctor", "--workspace", coordinator, "--run-probe", "python-runtime",
                                "--run-probe", "greeting-smoke", expected=2))
        assert doctor["status"] == "pending"
        assert all(item["status"] == "passed" for item in doctor["checks"] if item["layer"] in ("tool", "smoke"))
        assert all(item["status"] == "pending" for item in doctor["checks"] if item["layer"] in ("agent", "hook", "ci"))
        business = json.loads(run(demo / "e2e/business.py"))
        assert business["cases"]["denied"]["technical"] == "passed"
        assert business["cases"]["denied"]["business"] == "failed"
        outcomes = {}
        for scenario, code in (("expected", 0), ("stale", 1), ("skipped", 2), ("business-failed", 1)):
            record = root / f"{scenario}.json"
            run(demo / "e2e/smoke.py", "--scenario", scenario, "--evidence", record, expected=code)
            result = json.loads(run(evaluator, record, "--workspace", demo, expected=code))
            outcomes[scenario] = result["verdict"]
        print(json.dumps({"repositories": 5, "installed_skills": 5, "onboarding": "local profile planned and persisted",
                          "generated_harness": {"files": harness["files"], "hook_cases": len(harness["hook_cases"]),
                                                "artifacts": harness["status"], "agent_activation": "not run",
                                                "doctor_application_smoke": "passed", "doctor_overall": doctor["status"]},
                          "document_review": "current", "business_boundaries": {name: value["business"] for name, value in business["cases"].items()}, "release_scenarios": outcomes}, indent=2))


if __name__ == "__main__":
    main()
