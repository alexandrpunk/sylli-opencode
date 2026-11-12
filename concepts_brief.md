# EGM Kickoff Agent + Skill Bundle for oh-my-opencode-slim

* **Author:** alexandrpunk
* **Date:** 2026-11-10

## Overview

A config-plus-skill package that augments oh-my-opencode-slim (omo-slim) on OpenCode v2 with two independent pieces:

1. **`egm-kickoff` agent** — a custom council agent that runs project kickoff through the Elephant-Goldfish Model: rough requirements in → Elephant-style `DESIGN.md` draft (scope, slices, acceptance criteria) → parallel fresh-context Goldfish review on a lens subset → human freezes the spec → the existing omo-slim council implements against the frozen design.
2. **Skill bundle** — a full port of `/home/alexandr/proyects/omp-harness/skills/` (~30 skills plus 6 per-stack rules) into omo-slim, organized as role-bound domain manifests: interface design, animation, code quality/anti-slop (7 languages + install + thermos gate), error handling, context hygiene, data/backend patterns, and process skills (brainstorming, writing-plans, systematic-debugging, test-driven-development).

Delivery is **zero TypeScript**: omo-slim natively supports custom agents via `agents.<name>` in `oh-my-opencode-slim.json[c]` (user-level or `.opencode/` project-local), `orchestratorPrompt` routing blocks, and per-agent skill grants. Nothing in the package edits omo-slim files, so plugin updates never clobber it.

## Analysis

Seven Goldfish lenses reviewed the concept. Key findings after deduplication:

**Architecture (design-critic, structural, inventive-catalyst).** The original framing ("agent that joins the council and drives kickoff") risked a dual-orchestrator collision with omo-slim's Orchestrator. Resolution: `egm-kickoff` is a *delegate*, never a peer `primary`. The Orchestrator routes to it via an `orchestratorPrompt` block (must start with `@egm-kickoff`) listing "Delegate when: greenfield project, new major feature needing requirements/design clarification; Don't delegate when: bugfix, small change, refactor". Users can also invoke it directly. Integration touches only documented surfaces: the plugin config schema, prompt-file lookup paths, and `.opencode/skills/` discovery — the maintenance-safe boundary the structural lens demanded.

**Token economics (design-critic, inventive-catalyst).** A full 10-persona swarm per kickoff would cost 300–600K tokens — the most expensive possible cold-start path. The cost driver is the reviewed artifact re-read per lens, not session size. Resolutions: (a) ship a default **3-lens subset** — `design_critic` (reasoning tier), `zoom_out` (reasoning), `implementation_readiness` (cheap) — with optional lenses (`comprehension`, `codebase_details`) behind config; (b) model tiering per lens via the custom-agent `model` fallback chains; (c) a hard size cap on `DESIGN.md` (suggested ~500 lines) enforced at freeze time; (d) goldfish read the design + referenced files only, on a bounded read budget.

**Lifecycle (comprehension, codebase-details, inventive-catalyst).** "Frozen" must be a real state machine, not a word: `draft → review → frozen → archived`, with a one-command thaw (reopens, re-runs the goldfish pass on the delta, re-freezes). Freeze stamps a content hash + timestamp in the doc header so stale drafts are detectable. The `DESIGN.md` header is the **single state store** — `egm-kickoff` resumes by reading the status field, so an interrupted kickoff (session death mid-review) re-enters at the right stage without re-paying completed stages. Drift after implementation is handled by the already-installed `egm-drift-report` skill — freeze becomes a checkpoint with proportional enforcement, not a terminal state. Enforcement stays **advisory** by necessity as much as preference: hard blocking requires a TypeScript plugin hook, and the zero-TS delivery decision (D1) rules that out. The advisory mechanism is the routing block itself — the Orchestrator's `egm-kickoff` delegation text instructs it to check `DESIGN.md` status when implementing in a project that has one and surface a warning on unfrozen/stale specs. This keeps omo-slim's low-friction defaults for a solo developer while making the gate visible.

**UX (comprehension).** Exactly one documented entry: ask the Orchestrator to start a project, or `@egm-kickoff` directly. Complexity threshold is stated in the routing block so day-to-day edits never inherit ceremony. First-use mental model fits one screen: "one agent, one artifact (`DESIGN.md`), one gate (you freeze it)". Everything else (lens selection, presets, skill grants) ships invisible until needed.

**YAGNI audit (zoom-out, codebase-details).** OpenCode already loads agents/skills from `.opencode/`, and global skills (`codemap`, `simplify`, `reflect`, `clonedeps`) plus omo-slim's bundled skills cover part of the territory. The Goldfish lenses recommended porting only missing domains. The author overrode this: **the full omp-harness catalog ports** — every skill is considered additive value for omo-slim, and token economy is delegated to the skills themselves (`context-hygiene` discipline) rather than to curation. Residual mitigations kept from the review: explicit per-agent grants so irrelevant domains never enter a non-matching agent's context, and an install-time collision check against `~/.config/opencode/skills/` and omo-slim's bundled list. Grant mapping: design/UI + mengto + animation → `designer`; anti-slop ×7 + `anti-slop-install` + `thermos-quality` → `fixer` + `orchestrator`; `context-hygiene` → all writing agents (`orchestrator`, `fixer`, `designer`); `error-handling` + pattern skills (frontend/backend, database-migrations, postgres, redis, deployment) → `fixer` (+ `oracle` for review contexts); process skills → `brainstorming`/`writing-plans` → `orchestrator`, `systematic-debugging` → `oracle` + `fixer`, `test-driven-development` → `fixer`; review family (`review-animations`, `audit-ai-design-slop`) → `oracle`. The `egm-*` skills stay project-local where they exist; the bundle ships its own persona files so consumers without this project's `.opencode/` still get a working flow.

**Observability (codebase-details).** The kickoff flow runs through omo-slim's native background task board (task_status/task_result) — lens progress and failures are visible without new telemetry. Residual risk (silent skill-name collisions) is handled at install: the installer checks `~/.config/opencode/skills/` and the bundled omo-slim skill list, and refuses/warns on same-name conflicts instead of silently overriding.

**Inventive transforms applied.** (1) *Extraction + intermediary*: the bundle declares bindings by role through omo-slim's config surface rather than patching upstream files — an omo-slim upgrade swaps its agents and the bundle re-binds. Trade-off: upstream role renames silently drop bindings. Mitigations: all grants live in **one config fragment per domain manifest** (a rename fix is a one-file edit), the installer ships a **`verify` step** that checks every granted agent name against the installed omo-slim config/schema and reports unbound skills, and the README pins the **tested omo-slim version range**. (2) *Dynamics*: gate weight scales with blast radius — full EGM at kickoff, delta re-freeze for later changes. (3) *Cheap dispensables*: goldfish are ephemeral readers of a length-capped artifact; review cost scales with spec size, not repo size.

## Goals vs. Non-Goals

* **In-Scope Goals:**
  * Custom agent `egm-kickoff` registered through omo-slim config (user-level snippet + project-local variant), with prompt file, routing block, and model fallback chain.
  * Kickoff flow: requirements interview → `DESIGN.md` draft (versioned template: scope, slices, acceptance criteria, risks, trade-offs) → 3-lens parallel goldfish review → synthesis of findings → human freeze gate.
  * `DESIGN.md` lifecycle contract: states, freeze hash stamp, thaw/re-freeze procedure, size cap.
  * Skill bundle: **full port of the omp-harness catalog** (~30 skills + 6 per-stack `rules/*.md`), organized as role-bound domain manifests with explicit `skills`/`skills_add` grants per agent (mapping in Analysis); `rules/*.md` shipped as per-language self-check instructions loaded by the dominant stack of the target project.
  * Token economy delegated to the ported `context-hygiene` skill discipline rather than bundle curation; no per-skill gating beyond role-bound grants.
  * Installer: idempotent config merge into `oh-my-opencode-slim.json[c]` + skill/persona file placement + collision check; uninstall = remove entries.
* **Out-of-Scope Non-Goals:**
  * No TypeScript plugin, no omo-slim source patches, no fork of omo-slim.
  * No second orchestrator; `egm-kickoff` never runs as `primary`.
  * No memory system (user's existing opencode-mem stays untouched; a lighter memory replacement is a separate future concept).
  * No port of omp-harness's own orchestrator, gates, or extensions (user rejected that approach).
  * No hard blocking of edits against unfrozen designs (advisory only).
  * No full 10-persona swarm by default.

## Alternatives Weighed

* **omp-harness-style custom orchestrator (config.yml + extensions + council).** Rejected by author: result disliked; omo-slim's native orchestrator flow preferred.
* **TypeScript plugin bundling against omo-slim internals.** Rejected by Goldfish (structural, design-critic): guaranteed breakage on upstream releases; EGM's official installer already broke once on OpenCode V1→V2. Native config surface achieves the same registration.
* **`egm-kickoff` as peer `primary` orchestrator.** Rejected by Goldfish (design-critic, comprehension): dual-orchestrator collision, nondeterministic routing, recursive delegation risk.
* **Full 7–10 lens swarm per kickoff.** Rejected by Goldfish (design-critic, inventive-catalyst): unbounded token cost at cold-start frequency; subset + tiering achieves most breadth for a fraction of cost.
* **Porting only the missing domains of the omp-harness catalog (curated 4-family bundle).** Rejected by author: every omp-harness skill is considered additive for omo-slim; token savings come from integrating `context-hygiene` (and sibling discipline skills), not from curation. Full catalog ports with role-bound grants and install-time collision checks instead.
* **Relying on this project's `.opencode/` personas and `egm-*` skills being present.** Rejected by Goldfish (implementation-readiness D3): non-portable; the bundle ships its own persona files and kickoff playbook.
* **Hard freeze enforcement via blocking hooks.** Rejected (comprehension, inventive-catalyst): breaks omo-slim's low-friction defaults for a solo developer; advisory + drift-report chosen instead.

## Key Decisions & Staging for Next Steps

1. **Delivery format: config + skill/persona bundle with a small idempotent installer.** No TS plugin. (Resolves D1.)
2. **Integration: custom agent via `agents.egm-kickoff` + `orchestratorPrompt` routing block + explicit `@egm-kickoff` invocation.** (Resolves D2.)
3. **Casting: `egm-kickoff` plays Elephant; bundled persona files (3 default lenses) play Goldfish as fresh-context subagents; the existing omo-slim council implements.** (Resolves D3.)
4. **`DESIGN.md` at repo root of the target project**, versioned template with status header + freeze hash; `egm-drift-report` reused for post-implementation drift. (Resolves D4.)
5. **Skill grants: full omp-harness catalog ported; `skills`/`skills_add` explicit lists per agent** — design/UI/animation → designer, anti-slop+thermos+error-handling+patterns → fixer+orchestrator, process skills → orchestrator/oracle/fixer, review family → oracle, context-hygiene → orchestrator+fixer+designer. Collision check at install. (Resolves D5.)
6. **Model policy: per-agent fallback chains on the user's omniroute tiers** (reasoning for Elephant + design_critic; cheap for implementation_readiness); no fixed models shipped. (Resolves D6.)
7. **Install/update: repo + installer that merges config additively and never overwrites user edits; uninstall removes only its own keys/files.** (Resolves D7.)

8. **Advisory enforcement is a constraint consequence of the zero-TS decision**, delivered via the routing block (status check + warning), not hooks. Re-entry: `DESIGN.md` header is the sole state store; interrupted kickoffs resume at the recorded stage.
9. **Per-stack `rules/*.md` ship as skills** named `anti-slop-selfcheck-<lang>`, paired with their `anti-slop-<lang>` skill and granted to `fixer` (+ `oracle`) — single delivery mechanism, no `AGENTS.md` mutation (which would violate the no-upstream-edit principle).
10. **Kickoff interview collapses into one artifact**: `egm-kickoff` drafts `DESIGN.md` directly (no intermediate `concepts_brief.md`); the standalone `egm-brainstorm` flow remains available for fuzzier upstream ideation when the user wants it.
11. **`DESIGN.md` size cap warns, never truncates** (suggested threshold ~500 lines): truncation would drop acceptance criteria; the warning nudges the Elephant to split appendices out.

Open questions staged for `/egm-draft`:
* Exact `verify` implementation (schema read vs agent ping vs both) and whether it runs automatically post-update.
* Default lens subset confirmation (3 proposed) and the optional-lens config flag shape.
