---
name: modern-web-guidance
description: Consult official Chrome/Edge/Firefox/MDN web platform guidance (262 feature guides, 204 use cases) on demand via the modern-web-guidance CLI, before hand-rolling UI patterns, forms, a11y work, or CSS/JS solutions, and to detect legacy patterns. Use when building or reviewing web UI, components, forms, accessibility, or when modernizing legacy web code.
---

# Modern Web Guidance

Before implementing a web UI pattern, component, form behavior, accessibility fix, or CSS/JS API solution from scratch — or when reviewing existing web code for legacy patterns — consult the official guidance from the `modern-web-guidance` project (stewarded by the Chrome, Edge, Firefox and MDN teams). Guidance is optimized for coding agents: token-efficient, eval-pruned markdown.

## Commands

All commands run on demand via npx; nothing is vendored in this repo. English queries only.

```
npx -y modern-web-guidance@latest search "<english query>"   # find guide IDs for a use case
npx -y modern-web-guidance@latest retrieve <id>[,<id2>]      # fetch full guide(s) by ID
npx -y modern-web-guidance@latest list                       # list all available use cases
npx -y modern-web-guidance@latest legacy-scan <path>         # detect legacy web platform patterns in code
```

`search` returns JSON on stdout: `[{"id": "...", "description": "..."}]`. `retrieve` accepts comma-separated IDs and writes the full guide to a temp file whose path it prints — read that file with your file-reading tool before implementing.

## When to use

1. **Building a UI pattern** (tabs, menus, tooltips, dialogs, breadcrumbs, carousels, toasts...): `search` the pattern name, `retrieve` the top match, prefer the platform-native solution (e.g. Popover, Dialog, Details, anchor positioning, scroll-driven animations) over JS libraries or custom code.
2. **Forms**: search for the input/validation behavior; prefer native constraint validation and modern field types.
3. **Accessibility work**: retrieve the `accessibility` guide; also `search` the specific interaction (focus management, keyboard nav, ARIA).
4. **Modernizing/reviewing legacy code**: run `legacy-scan <path>` to flag legacy patterns, then `retrieve` the relevant guides for replacements.
5. **Area overviews**: retrieve topic guides such as `css`, `html`, `js`, `accessibility`, `performance`, `forms`, `built-in-ai` when doing broad work in that area.

## Rules

- Read a guide **before** writing the implementation, not after.
- Prefer the platform-native approach the guide shows over adding dependencies. If a dependency is genuinely better for this project, say why.
- `retrieve` only the 1–3 IDs you need; do not dump `list` into context.
- Guidance does not override project conventions (design system, existing patterns) — reconcile conflicts and flag them.
- If `npx` is unavailable, fall back to reading https://developer.chrome.com/docs/modern-web-guidance via web fetch.
