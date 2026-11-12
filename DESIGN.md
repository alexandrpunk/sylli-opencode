# Sylli: EGM Kickoff Agent, Security Plugin & Enhanced Council Bundle for oh-my-opencode-slim

* **Author:** alexandrpunk
* **Agent Name:** `sylli`
* **Status:** frozen
* **Version:** 0.2.0
* **Date:** 2026-11-12
* **Frozen-Hash:** `d9ea50f2c63df61ba2f29fb08b64227a5ed5ac27cf6835025974aec274c56c93`
* **Frozen-Date:** 2026-11-12T00:55:00Z
* **Source:** `concepts_brief.md`, `SECURITY.md`, `miqdadbadjuber/anti-slop`

---

## Overview

**Sylli** is a comprehensive enhancement system for OpenCode v2 running `oh-my-opencode-slim` (omo-slim). It combines three cooperative layers:

1. **`sylli` (Custom Council Agent)**: The kickoff architect operating under the Elephant-Goldfish Model (EGM). It acts as the project's Elephant — taking raw goals, running brainstorming/ideation, drafting structured `DESIGN.md` specifications, coordinating parallel Goldfish reviewer subagents in isolated contexts, and managing the human freeze gate before implementation begins.
2. **Deterministic Security & Rule Ingestion Plugin**: A lightweight OpenCode plugin that programmatically enforces the security constraints in `SECURITY.md` (blocking access to system paths like `/etc`, `/usr`, and `.env` credentials, enforcing dry-run confirmations) and dynamically injects project-specific language standards from `rules/` (TypeScript/JS, Python, Go, Rust, C#, PHP) into implementing agents.
3. **Enhanced Role-Bound Skill & Anti-Slop Matrix**: A curated, role-scoped distribution of ~30 domain skills plus the `miqdadbadjuber/anti-slop` catalog (`antislop` Core Delivery Gate, `antislop-ui`, `antislop-human`, `antislop-layoutmobile`, `antislop-copywriting`, `antislop-code`), granting specialized intelligence to `designer`, `fixer`, `oracle`, and `orchestrator` without polluting unrelated agent contexts.

---

## The Problem

Solo developers using AI coding councils face three recurring friction points:

1. **Premature Implementation without Architecture**: Council agents tend to jump straight into code editing without structured requirements elicitation, leading to architectural debt, scope drift, and frequent rewrites.
2. **Prompt-Only Security Vulnerability**: Security instructions in plain prompts can be bypassed by hallucination, model drift, or prompt injection. Relying only on text instructions cannot deterministically guarantee that an agent will not inspect `.env` files, run destructive `rm` commands, or touch system directories.
3. **AI Slop & Generic Code**: Unconstrained models produce generic UI patterns (cliché purple gradients, excessive glassmorphism, broken keyboard navigation, `div`s pretending to be buttons) and noisy code comments.

Sylli solves all three: `sylli` governs design before construction, the security plugin enforces boundaries at the tool execution level, and the anti-slop skill matrix ensures high craft across design, copy, accessibility, and code hygiene.

---

## Goals & Non-Goals

### In-Scope Goals

* **`sylli` Custom Agent**: Registered as an omo-slim council agent with custom prompt, routing triggers (`@sylli`), and model fallback chains. Conducts kickoff interviews, produces `DESIGN.md`, and runs 3-lens Goldfish reviews (`design_critic`, `zoom_out`, `implementation_readiness`).
* **`DESIGN.md` Lifecycle Contract**: State machine (`draft` → `review` → `frozen` → `archived`), SHA-256 content-hash stamping at freeze time, thaw/delta re-review path, and a ~500-line soft cap.
* **Deterministic Security Plugin (`SECURITY.md`)**: Tool-interceptor plugin (`tool.execute.before`) that blocks prohibited system paths (`/etc`, `/usr`, `/boot`, `/root`, `.env`, ssh keys), requires explicit confirmation for destructive commands, and enforces dry-run visibility.
* **Dynamic Stack Rule Injection**: Automatically detects the project's dominant programming language and injects the corresponding self-checks from `rules/` (`typescript.md`, `python.md`, `go.md`, `rust.md`, `csharp.md`, `php.md`) directly into `fixer` and `council`.
* **Integrated Anti-Slop Matrix**: Incorporates the full `miqdadbadjuber/anti-slop` suite alongside domain skills (MengTo UI, CSS Stylelint, HTML validator, animations, error handling, database patterns), mapped strictly by agent role.
* **Idempotent Setup & Verification**: Single-command install and uninstall that merges configuration additively into `oh-my-opencode-slim.jsonc`, validates schema compatibility, and checks for skill namespace collisions.

### Out-of-Scope Non-Goals

* No monkey-patching or code fork of upstream `oh-my-opencode-slim`.
* No dual-primary orchestrator; `sylli` is an architectural delegate, not a competing root orchestrator.
* No replacement of `opencode-mem`; existing persistent memory is preserved untouched.
* No hard-blocking of code edits if the user explicitly chooses to bypass `DESIGN.md` (advisory warning with user override).

---

## Critical User Journeys (CUJs)

### CUJ 1: Greenfield Kickoff with Sylli
* **Given**: A new repository or feature request with unrefined requirements.
* **When**: The user calls `@sylli` or the Orchestrator delegates project kickoff.
* **Then**: `sylli` conducts a focused requirements interview, drafts `DESIGN.md` in `draft` state, spawns 3 Goldfish reviewers in isolated contexts, synthesizes findings, and waits at the freeze gate. Once confirmed by the user, `DESIGN.md` transitions to `frozen` with a stamped SHA-256 hash.

### CUJ 2: Safe Implementation Guarded by Security Plugin
* **Given**: A frozen `DESIGN.md` ready for implementation by `fixer`.
* **When**: An agent attempts to run a shell command touching `/etc`, modifying `.env`, or executing an unvetted remote script (`curl | sh`).
* **Then**: The security plugin intercepts the execution before execution occurs, halts the tool call, and demands explicit user confirmation showing the exact target and command.

### CUJ 3: Anti-Slop Delivery Verification
* **Given**: `designer` or `fixer` completing a UI component or backend module.
* **When**: The agent declares the task done.
* **Then**: The assigned anti-slop gate checks the output:
  * For UI: validates accessibility (WCAG 2.2, keyboard focus, semantic HTML) and rejects AI design cliches via `antislop-ui` and `antislop-human`.
  * For Code: executes Oxlint / Stylelint / HTML-validate according to stack rules, requiring clean gate reports before final handoff.

---

## Proposed Architecture (Technical Plan)

```text
┌────────────────────────────────────────────────────────────────────────┐
│ OpenCode Runtime                                                       │
│                                                                        │
│  ┌───────────────────────┐         ┌────────────────────────────────┐  │
│  │ omo-slim Orchestrator │────────>│ Custom Agent: sylli            │  │
│  │ (Primary Coordinator) │ Routing │ (Elephant: Kickoff & Specs)    │  │
│  └───────────┬───────────┘ Block   └───────────────┬────────────────┘  │
│              │                                     │ Subagent          │
│              │ Delegates                           │ Review            │
│              ▼ Implementation                      ▼ (Isolated)        │
│  ┌─────────────────────────────────┐       ┌────────────────────────┐  │
│  │ Council Agents (fixer, designer,│       │ 3 Goldfish Reviewers   │  │
│  │ oracle, explorer)               │       │ - design_critic        │  │
│  └─────────────────┬───────────────┘       │ - zoom_out             │  │
│                    │                       │ - impl_readiness       │  │
│                    ▼ Tool Calls            └────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Sylli Security & Rules Plugin (tool.execute.before)              │  │
│  │  - Path Whitelist / Blacklist (/etc, .env, credentials blocked)  │  │
│  │  - Destructive Command Interceptor (Dry-Run by default)          │  │
│  │  - Dynamic Rule Ingestion (Injects rules/*.md for project stack) │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. The Sylli Agent Configuration (`agents.sylli`)

Defined in `oh-my-opencode-slim.jsonc`:
```jsonc
{
  "agents": {
    "sylli": {
      "model": "omniroute/auto/best-reasoning",
      "variant": "high",
      "description": "Architect and EGM Kickoff coordinator for project requirements, DESIGN.md specs, and Goldfish reviews.",
      "prompt": "agents/sylli.md",
      "skills": [
        "brainstorming",
        "writing-plans",
        "context-hygiene"
      ]
    }
  }
}
```

### 2. Security Plugin Contract (`SECURITY.md` Enforcement)

The security plugin hooks into OpenCode's tool execution cycle:

* **Forbidden File System Targets**:
  `/etc/**`, `/usr/**`, `/bin/**`, `/sbin/**`, `/boot/**`, `/root/**`, `**/.env*`, `**/.ssh/**`, `**/.gnupg/**`.
* **Dangerous Command Detection**:
  Commands containing `curl | sh`, `wget | bash`, `rm -rf /`, `mkfs`, `dd`, or unverified global package installations trigger a mandatory interactive dry-run gate.
* **Audit Trail**: Every intercepted or confirmed action writes a structured record to `.opencode/security_audit.log`.

### 3. Role-Bound Skill & Anti-Slop Matrix

| Council Agent | Ported Domain Skills (`skills/`) | Anti-Slop Suite (`miqdadbadjuber/anti-slop`) | Stack Rules (`rules/`) |
| :--- | :--- | :--- | :--- |
| **`designer`** | `mengto-ui`, `mengto-web`, `design-system`, `animate`, `animation-vocabulary`, `find-animation-opportunities`, `improve-animations` | `antislop-ui`, `antislop-human`, `antislop-layoutmobile`, `antislop-copywriting` | `anti-slop-css`, `anti-slop-html` |
| **`fixer`** | `error-handling`, `backend-patterns`, `frontend-patterns`, `database-migrations`, `postgres-patterns`, `redis-patterns`, `deployment-patterns` | `antislop-code`, `antislop-human` | Dominant `rules/*.md` (e.g. `typescript.md`, `python.md`, `go.md`, `rust.md`) |
| **`oracle`** | `systematic-debugging`, `review-animations`, `thermos-quality` | `antislop` (Core Delivery Gate), `antislop-code` | Stack gate review |
| **`orchestrator`** | `writing-plans`, `test-driven-development` | `antislop-copywriting` | Context guidelines |
| **`all agents`** | `context-hygiene` | — | — |

---

## Alternatives Considered

### 1. Pure Markdown Skill Bundle without Plugin
* **Description**: Ship all security and kickoff behaviors as prompt-only skills without an OpenCode plugin.
* **Pros**: Zero JavaScript/TypeScript dependencies; runs anywhere plain skills run.
* **Cons**: Security is non-deterministic (LLMs can hallucinate past prompt instructions and access `.env` or critical files); no automatic stack detection.
* **Reason for Rejection**: Rejected by author. Security requirements in `SECURITY.md` demand programmatic, tool-level interception.

### 2. Hard Blocking of Code Edits When Spec is Unfrozen
* **Description**: Security plugin throws a hard fatal error on any file write if `DESIGN.md` status is not `frozen`.
* **Pros**: Absolute compliance with the design-first philosophy.
* **Cons**: Cripples developer flow during rapid prototyping, emergency bugfixes, or exploratory spikes.
* **Reason for Rejection**: Rejected by EGM consensus. Advisory routing warnings with explicit bypass preserve velocity while maintaining design visibility.

### 3. Full 10-Persona Goldfish Swarm on Every Kickoff
* **Description**: Dispatch all 10 EGM personas on every requirements draft.
* **Pros**: Maximum possible edge-case detection.
* **Cons**: Consumes 300K–600K tokens per cold start; significant latency; high finding redundancy.
* **Reason for Rejection**: Rejected by author. A 3-lens default (`design_critic`, `zoom_out`, `implementation_readiness`) delivers 85%+ coverage at minimal token cost.

---

## Risks & Mitigations

1. **Plugin API Evolution in OpenCode v2**:
   * *Risk*: Upstream changes to OpenCode plugin hooks could disable interceptors.
   * *Mitigation*: Pin to standard OpenCode plugin interfaces, provide graceful fallback reporting, and include an automated `verify` healthcheck.
2. **False Positives in Security Interceptor**:
   * *Risk*: Legitimate development commands (e.g., editing `.env.example`) might be accidentally blocked.
   * *Mitigation*: Distinguish between live secrets (`.env`, `.env.local`) and templates (`.env.example`), and provide a granular `approve-once` user prompt.
3. **Skill Namespace Collisions**:
   * *Risk*: Ported skills or `anti-slop` skills might overwrite user-installed skills of the same name.
   * *Mitigation*: Pre-installation namespace scan that alerts on collisions before any file writes.
4. **Subagent Model Availability**:
   * *Risk*: Subagents failing due to missing provider configurations (e.g. Anthropic defaults).
   * *Mitigation*: Explicit model configuration pointing to active `omniroute` tiers (`auto/best-reasoning`, `auto/fast`).

---

## Detailed Implementation Plan

### Target Files to Create / Modify

#### 1. `plugin/index.ts` & `plugin/package.json` (Create)
* **Type**: Local OpenCode Plugin.
* **Scope**: Security interceptor (`tool.execute.before`), path blacklisting, dry-run prompt handler, and automatic `rules/` loader based on repository file inspection.

#### 2. `agents/sylli.md` (Create)
* **Type**: Agent Persona Prompt.
* **Scope**: System prompt for `sylli`, encoding Elephant kickoff rules, requirements elicitation interview protocol, Goldfish swarm dispatch, and freeze gate handling.

#### 3. `skills/antislop-*` (Integrate)
* **Type**: Skills Catalog.
* **Scope**: Incorporate `antislop`, `antislop-ui`, `antislop-human`, `antislop-layoutmobile`, `antislop-copywriting`, and `antislop-code` into the managed bundle directory.

#### 4. `templates/DESIGN.template.md` (Create)
* **Type**: Template.
* **Scope**: Reusable structure for target repositories containing header metadata, CUJs, technical plan, alternatives, and risks sections.

#### 5. `install.sh` & `verify.sh` (Create)
* **Type**: Shell Automation.
* **Scope**: Additive merger into `~/.config/opencode/oh-my-opencode-slim.jsonc`, collision validation, plugin build, and health reporting.

---

## Verification Plan

* **Security Interceptor Unit Tests**:
  * Attempt read/write on `/etc/hosts` → assert tool call is blocked with security alert.
  * Attempt write to `.env` → assert interactive approval prompt is raised.
  * Run harmless `npm test` → assert passes without interruption.
* **Language Rule Ingestion Verification**:
  * Open a project with `tsconfig.json` → assert `rules/typescript.md` is appended to fixer prompt.
  * Open a project with `Cargo.toml` → assert `rules/rust.md` is appended.
* **Sylli Kickoff End-to-End Simulation**:
  * Call `@sylli` with a sample feature prompt.
  * Assert `DESIGN.md` is created in `draft` state.
  * Assert 3 Goldfish subagents are dispatched with `omniroute` models and return reviews.
  * Confirm freeze command stamps SHA-256 hash and updates status to `frozen`.
* **Anti-Slop Delivery Gate Test**:
  * Create a mock UI with `<div onClick>` and low contrast → assert `antislop-human` fails delivery gate.

---

*Drafted with EGM & Sylli Architecture*
