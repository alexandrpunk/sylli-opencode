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
Prompt-based security rules can be ignored by a hallucinating model. Sylli's plugin intercepts tool calls **at runtime** (`ctx.tool.hook("execute.before")` / `ctx.shell.hook("create.before")`):

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

### ✨ 3. Anti-Slop Skill Matrix (37 skills, role-bound)
Each council agent gets only the skills relevant to its job — no context pollution:

| Agent | Gets |
| :--- | :--- |
| **`designer`** | MengTo UI, animation suite, `antislop-ui`, `antislop-human` (WCAG 2.2), `antislop-layoutmobile`, `antislop-copywriting`, `anti-slop-css`, `anti-slop-html`, `modern-web-guidance` |
| **`fixer`** | error-handling, backend/frontend patterns, database migrations (postgres/redis), deployment, `antislop-code`, stack rules, `modern-web-guidance` |
| **`oracle`** | systematic-debugging, thermos-quality gate, `antislop` core Delivery Gate |
| **`orchestrator`** | writing-plans, TDD, `antislop-copywriting`, context-hygiene |

Includes the full [miqdadbadjuber/anti-slop](https://github.com/miqdadbadjuber/anti-slop) suite — killing cliché AI UI (purple gradients, glassmorphism abuse, fake terminals), empty copywriting ("Unlock the power of..."), accessibility failures (`<div onClick>`, removed focus outlines), and noisy code comments.

Also ships a bridge to [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) (stewarded by the Chrome/Edge/Firefox/MDN teams): before `designer` or `fixer` hand-rolls a UI pattern, form behavior, a11y fix, or CSS/JS solution — or when modernizing legacy web code — they consult the official 262 feature guides / 204 use cases on demand via `npx modern-web-guidance@latest search/retrieve/legacy-scan`. Nothing is vendored, guidance is always current, and native platform solutions (Popover, Dialog, anchor positioning, scroll-driven animations…) are preferred over new dependencies.

### 🎨 4. Vendored Taste Skill (pinned)
Sylli includes Leonxlnx's `design-taste-frontend` skill from [`taste-skill`](https://github.com/leonxlnx/taste-skill), pinned to commit `d1a2bb41d927083ac7118f60cfc9cdf711810ea0`. The complete upstream checkout (including scripts, references, assets, tests and MIT license) is vendored under `vendor/` and exposed at `skills/taste-skill`, preserving relative paths. It is granted to `designer` and `oracle`, not `fixer`. Its browser checks require Node.js 22+ and Chrome, Edge or Chromium (ffmpeg is optional); these are execution-time optional dependencies and are not installed by Sylli. The upstream Claude `Stop` hook is preserved as metadata but OpenCode does not activate Claude hooks automatically; run the documented gate/check commands manually.

### 🧠 5. Automatic Project Memory (0.3.0; included in 0.4.0)
Persistent project context is stored by [`@knikolov/opencode-plugin-simple-memory`](https://www.npmjs.com/package/@knikolov/opencode-plugin-simple-memory) (MIT) as typed records — `decision`, `learning`, `preference`, `blocker`, `context`, `pattern` — in git-trackable `.opencode/memory/YYYY-MM-DD.logfmt` files. `sylli` records every DESIGN.md freeze/thaw (`type=decision`, with the SHA-256 hash) and unresolved Goldfish findings (`type=blocker`), and recalls prior context at kickoff so settled questions are not re-asked. Injection is automatic: each session receives a budget-capped `Relevant Memory:` block (`contextLimit: 5`, `contextMaxChars: 1200`).

The Sylli plugin keeps memory tidy automatically (fail-open, non-blocking):

- **Compact** — once total memory exceeds **1 MB**, records are deduplicated and rewritten in chronological order, spanning daily file boundaries.
- **Purge** — `context`, `blocker`, and `learning` records older than **90 days** are removed (age-only; simple-memory stores no recall timestamps). `decision`, `preference`, and `pattern` records are **never** auto-purged.
- **Audit** — every purge appends a record to `.opencode/memory/deletions.logfmt`. Nothing is silently deleted.

Thresholds are configurable via environment variables:

```bash
SYLLI_MEMORY_COMPACT_BYTES=1048576   # compact threshold in bytes
SYLLI_MEMORY_PURGE_DAYS=90           # purge age for context/blocker/learning
SYLLI_MEMORY_HYGIENE_INTERVAL=200    # tool executions between hygiene passes
```

---

## Quick Install (one command)

```bash
git clone https://github.com/alexandrpunk/sylli-opencode.git ~/sylli && ~/sylli/install.sh
```

This will:
1. Verify `oh-my-opencode-slim` is installed (and register it if missing).
2. Install plugin dependencies (`@opencode/plugin`, the OpenCode V2 plugin SDK).
3. Deploy 37 skills to `~/.config/opencode/skills/`.
4. Deploy 4 agent personas (`sylli` + 3 Goldfish) to `~/.config/opencode/agents/`.
5. Register the `sylli` agent + role-bound skill grants in `oh-my-opencode-slim.json`.
6. Register the security & rules plugin in `opencode.json`.
7. Register the automatic project memory plugin in `opencode.json`.

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
~/sylli/update.sh --check            # Explicitly check release tags (no auto-update)
~/sylli/update.sh --tag 0.4.0        # Inspect a known tag without checking it out
```

### Releases and safe updates

The current plugin release is **0.4.0**. Releases are published on GitHub with a matching `v0.4.0` tag. Updates are manual and opt-in: Sylli never auto-updates, downloads, executes remote code, or sends telemetry.

To check for a release, run `./update.sh --check` intentionally. It fetches tags and displays newer remote commits, but changes no files. Use `--force` only when you understand and accept that the working tree is dirty. To inspect a specific local tag, use `./update.sh --tag 0.4.0`; it does not checkout or install anything. After reviewing and explicitly checking out a release, preview and apply it with:

```bash
./install.sh --dry-run
./install.sh
./verify.sh
```

Restart OpenCode after installing so its plugin and skill configuration is reloaded. See [CHANGELOG.md](CHANGELOG.md) for release notes.

---

## Project Layout

```
├── agents/                  # sylli (Elephant) + 3 Goldfish reviewer personas
├── plugin/                  # Security interceptor & stack-rule injector (TypeScript)
├── skills/                  # 37 role-bound skills (anti-slop, MengTo, patterns, modern-web-guidance)
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
- Node.js ≥ 20.12 (or Bun) for Sylli; Taste Skill browser checks require Node.js ≥ 22
- Chrome, Edge or Chromium for Taste Skill browser checks (optional at install time)
- Works with any provider (omniroute, Z.AI, Bailian, etc.) — models configured per agent

## Credits

Sylli stands on the shoulders of these projects — many thanks to their authors:

### Platform & infrastructure

| Project | What Sylli uses it for | License |
| :--- | :--- | :--- |
| [OpenCode](https://github.com/sst/opencode) · [opencode.ai](https://opencode.ai) | The agent platform and V2 plugin SDK (`@opencode/plugin`) Sylli extends | MIT |
| [oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim) | The upstream agent suite Sylli builds its council, presets and skill grants on | MIT |
| [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) · [docs](https://developer.chrome.com/docs/modern-web-guidance) | Official Chrome/Edge/Firefox/MDN web platform guidance consulted on demand by `designer` and `fixer` (via CLI bridge, nothing vendored) | Apache-2.0 |
| [@knikolov/opencode-plugin-simple-memory](https://www.npmjs.com/package/@knikolov/opencode-plugin-simple-memory) | Automatic typed project memory (`.opencode/memory/`) with Sylli's hygiene on top | MIT |
| [oxlint](https://github.com/oxc-project/oxlint) · [stylelint](https://github.com/stylelint/stylelint) · [html-validate](https://gitlab.com/html-validate/html-validate) | Optional instant anti-slop gates (`--with-linters`), also available via npx | MIT |

### Vendored skills — by upstream origin

| Origin | Skills | License |
| :--- | :--- | :--- |
| [miqdadbadjuber/anti-slop](https://github.com/miqdadbadjuber/anti-slop) | `antislop`, `antislop-code`, `antislop-copywriting`, `antislop-human`, `antislop-layoutmobile`, `antislop-ui` | MIT |
| [Leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill) @ `d1a2bb41d927083ac7118f60cfc9cdf711810ea0` | `design-taste-frontend` (complete vendored checkout) | MIT |
| [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills) (Ady Osmani) | `antislop-ui` & `antislop-human` reference material is adapted from it (license files vendored in-skill) | MIT |
| [emilkowalski/skills](https://github.com/emilkowalski/skills) (Emil Kowalski) | `animate`, `animation-vocabulary`, `find-animation-opportunities`, `improve-animations`, `review-animations` | MIT |
| [MengTo/Skills](https://github.com/MengTo/Skills) (Meng To, Design+Code) | `mengto-ui`, `mengto-web` | MIT |
| [affaan-m/ECC](https://github.com/affaan-m/ECC) | `backend-patterns`, `database-migrations`, `deployment-patterns`, `design-system`, `error-handling`, `frontend-patterns`, `postgres-patterns`, `redis-patterns` | MIT |
| [obra/superpowers](https://github.com/obra/superpowers) (Jesse Vincent) | `writing-plans`, `systematic-debugging`, `test-driven-development` | MIT |
| [anthropics/skills](https://github.com/anthropics/skills) (Anthropic) | `frontend-design` (LICENSE.txt vendored in-skill) | Apache-2.0 |
| [ConardLi/garden-skills](https://github.com/ConardLi/garden-skills) (ConardLi) | `web-design-engineer` | MIT |
| [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) | Oxlint rules wrapped by the `anti-slop-*` install skills | — |

Remaining skills (`anti-slop-install`, `anti-slop-csharp/css/go/html/php/python/rust`, `thermos-quality`, `context-hygiene`, `modern-web-guidance` bridge) are Sylli-original.

## License

Apache-2.0 / MIT
