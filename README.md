# Sylli — Architect Agent, Security Guard & Anti-Slop Council for OpenCode

> **Sylli** turns `oh-my-opencode-slim` (omo-slim) on OpenCode v2 into a design-first, security-guarded, slop-free coding council.

---

## What Sylli Does

### 🐘 1. `sylli` — The Kickoff Architect (EGM)
A custom council agent implementing the **Elephant-Goldfish Model (EGM)**. Before any code is written, `sylli`:

1. **Interviews you** about goals, constraints, non-goals, and user journeys.
2. **Drafts `DESIGN.md`** at the project root (scope, CUJs, architecture, alternatives, risks, implementation plan).
3. **Spawns 3 Goldfish reviewers** in fresh, isolated contexts:
   - `goldfish-design_critic` — hostile architecture & risk audit
   - `goldfish-zoom_out` — simplicity, YAGNI & Heilmeier criteria
   - `goldfish-implementation_readiness` — file coverage & testability
4. **Freezes the spec** with a SHA-256 content hash and timestamp once you approve.
5. **Thaws & re-reviews the delta** when requirements change mid-implementation.

### 🛡️ 2. Deterministic Security Plugin (`SECURITY.md` enforced in code)
Prompt-based security rules can be ignored by a hallucinating model. Sylli's plugin intercepts tool calls **at runtime** (`tool.execute.before`):

- **Blocked paths**: `/etc`, `/usr`, `/bin`, `/boot`, `/root`, `.ssh`, `.gnupg`, and real `.env` secrets (templates like `.env.example` stay editable).
- **Blocked commands**: `curl | sh`, `wget | bash`, `rm -rf /`, `mkfs`, `dd if=`, `chmod 777`.
- **Audit trail**: every interception *and every bypass* logged to `.opencode/security_audit.log`.
- **Stack rules auto-injection**: detects the project's dominant language (`tsconfig.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `composer.json`) and injects the matching self-checks from `rules/` into the system prompt.
- **EGM advisory**: warns when `DESIGN.md` exists but is not `frozen` yet.

### Bypassing restrictions when needed
All restrictions are escap-hatches by design — every bypass is logged with a `[BYPASS]` entry in `.opencode/security_audit.log`:

1. **Surgical (recommended)** — per-project allowlist in `.opencode/sylli.allow`:
   ```
   path:/etc/hosts            # allow exactly this path
   path-re:/etc/nginx/.*      # allow by regex
   cmd-re:^sudo systemctl restart nginx
   til:2026-11-12T18:00       # whole allowlist auto-expires at this time
   ```
   A commented template ships at `templates/sylli.allow.template`.
2. **Session-wide** — launch OpenCode with `SYLLI_DISABLE=1` to disable every interceptor (path blocks, command blocks, and the EGM advisory; stack rules still inject).
3. Blocked tool calls return an error message that names the exact allowlist line to add, so the agent (or you) can unblock a legitimate action in one step.

### ✨ 3. Anti-Slop Skill Matrix (36 skills, role-bound)
Each council agent gets only the skills relevant to its job — no context pollution:

| Agent | Gets |
| :--- | :--- |
| **`designer`** | MengTo UI, animation suite, `antislop-ui`, `antislop-human` (WCAG 2.2), `antislop-layoutmobile`, `antislop-copywriting`, `anti-slop-css`, `anti-slop-html` |
| **`fixer`** | error-handling, backend/frontend patterns, database migrations (postgres/redis), deployment, `antislop-code`, stack rules |
| **`oracle`** | systematic-debugging, thermos-quality gate, `antislop` core Delivery Gate |
| **`orchestrator`** | writing-plans, TDD, `antislop-copywriting`, context-hygiene |

Includes the full [miqdadbadjuber/anti-slop](https://github.com/miqdadbadjuber/anti-slop) suite — killing cliché AI UI (purple gradients, glassmorphism abuse, fake terminals), empty copywriting ("Unlock the power of..."), accessibility failures (`<div onClick>`, removed focus outlines), and noisy code comments.

---

## Quick Install (one command)

```bash
git clone https://github.com/alexandrpunk/sylli-opencode.git ~/sylli && ~/sylli/install.sh
```

This will:
1. Verify `oh-my-opencode-slim` is installed (and register it if missing).
2. Bundle plugin dependencies (`@opencode-ai/plugin`).
3. Deploy 36 skills to `~/.config/opencode/skills/`.
4. Deploy 4 agent personas (`sylli` + 3 Goldfish) to `~/.config/opencode/agents/`.
5. Register the `sylli` agent + role-bound skill grants in `oh-my-opencode-slim.json`.
6. Register the security & rules plugin in `opencode.json`.

**Restart OpenCode** afterwards, then just summon the architect:

```
@sylli help me kick off a new project
```

### Options

```bash
~/sylli/install.sh --dry-run        # Preview everything, write nothing
~/sylli/install.sh --with-linters   # Also install oxlint, stylelint, html-validate globally
~/sylli/install.sh --uninstall      # Cleanly revert every change
~/sylli/verify.sh                   # Healthcheck (files, deps, config, tools)
```

---

## Project Layout

```
├── agents/                  # sylli (Elephant) + 3 Goldfish reviewer personas
├── plugin/                  # Security interceptor & stack-rule injector (TypeScript)
├── skills/                  # 36 role-bound skills (anti-slop, MengTo, patterns)
├── rules/                   # Per-language self-checks (ts, py, go, rust, c#, php)
├── templates/DESIGN.template.md
├── templates/sylli.allow.template  # Bypass allowlist template
├── SECURITY.md              # Security policy (enforced by the plugin)
├── install.sh / install.js  # Idempotent installer (--dry-run, --uninstall)
├── verify.sh                # Healthcheck
└── DESIGN.md                # This project's own frozen spec (dogfooded)
```

## Requirements

- OpenCode v2 with [`oh-my-opencode-slim`](https://github.com/alvinunreal/oh-my-opencode-slim)
- Node.js ≥ 20.12 (or Bun)
- Works with any provider (omniroute, Z.AI, Bailian, etc.) — models configured per agent

## License

Apache-2.0 / MIT
