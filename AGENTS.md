# Workspace Harness Kit contributor guide

- Maintain Skill instructions, templates, examples, code, and technical documentation in English. Keep the English and Simplified Chinese READMEs aligned on installation and supported behavior.
- Maintain the shared core in strict TypeScript and distribute bundled ESM JavaScript for Node.js 24+. Keep the core free of third-party runtime dependencies; isolate parsing and I/O in adapters. Skill scripts must run without npm installation. Put operation-specific guidance with the relevant Skill.
- Use synthetic public examples. Keep credentials, personal checkout paths, and raw diagnostic output out of shared fixtures and documentation.
- Run `npm test`, `npm run check:bundles`, and `npm run check:evals` for helper changes. Run `npm run check:examples` for changes to discovery or operational guidance; the synthetic target applications require Python 3.11+ and Git. Regenerate bundled scripts with `npm run build` instead of editing them directly.
- Keep agent behavior consistent with the [workspace and evidence model](docs/design.md).
