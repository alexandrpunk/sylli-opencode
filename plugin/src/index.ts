import type { Plugin } from "@opencode-ai/plugin"
import * as fs from "fs"
import * as path from "path"

// Prohibited absolute paths and sensitive file patterns per SECURITY.md
const FORBIDDEN_PATH_PREFIXES = [
  "/etc",
  "/usr",
  "/bin",
  "/sbin",
  "/boot",
  "/root",
  "/dev",
  "/proc",
  "/sys",
  "/run",
  "/var",
  "/opt"
]

const FORBIDDEN_FILE_PATTERNS = [
  /(^|\/)\.env(\.(?!example|sample|template)[a-zA-Z0-9._-]+)?$/, // Blocks .env, .env.local, .env.production, but permits .env.example
  /(^|\/)\.ssh\//,
  /(^|\/)\.gnupg\//,
  /(^|\/)id_rsa(\.pub)?$/,
  /(^|\/)id_ed25519(\.pub)?$/,
  /(^|\/)\.bash_history$/,
  /(^|\/)\.zsh_history$/,
  /(^|\/)shadow$/
]

// Dangerous shell command patterns that require explicit user intervention
const DANGEROUS_COMMAND_PATTERNS = [
  /curl\s+[^|]+\|\s*(ba)?sh/,
  /wget\s+[^|]+\|\s*(ba)?sh/,
  /\brm\s+-[rf]{1,2}\s+(\/|~|\$HOME|\.\.)(\s|$)/,
  /\bmkfs\b/,
  /\bdd\s+if=/,
  /\bchmod\s+(-R\s+)?777\b/
]

/**
 * ── BYPASS MECHANISMS ────────────────────────────────────────────────
 * Security restrictions can be lifted in three ways, from broadest
 * to most surgical:
 *
 * 1. SYLLI_DISABLE=1 env var   → disables every interceptor entirely.
 * 2. .opencode/sylli.allow file → persistent, per-project exceptions:
 *      path:/etc/hosts          → allow this exact path (and below)
 *      path-re:/etc/nginx/.*    → allow by regex
 *      cmd-re:curl -sS .*       → allow matching commands by regex
 *      til:2026-11-12T18:00     → allowlist auto-expires at this ISO time
 * 3. ask the agent to "bypass sylli for <X>" → the agent appends a
 *    line to .opencode/sylli.allow (still user-visible in git/review).
 * ─────────────────────────────────────────────────────────────────────
 */

type AllowRule =
  | { kind: "path"; value: string }
  | { kind: "path-re"; value: RegExp }
  | { kind: "cmd-re"; value: RegExp }

interface AllowlistState {
  rules: AllowRule[]
  expiresAt: number | null
  mtimeMs: number
}

export const SylliPlugin: Plugin = async ({ directory }) => {
  const auditLogPath = path.join(directory, ".opencode", "security_audit.log")
  const allowlistPath = path.join(directory, ".opencode", "sylli.allow")

  let allowlistCache: AllowlistState | null = null

  function isFullyDisabled(): boolean {
    return process.env.SYLLI_DISABLE === "1" || process.env.SYLLI_DISABLE === "true"
  }

  function logSecurityEvent(level: "BLOCKED" | "WARNING" | "INFO" | "BYPASS", message: string, details?: any) {
    try {
      const dir = path.dirname(auditLogPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const entry = `[${new Date().toISOString()}] [${level}] ${message} ${details ? JSON.stringify(details) : ""}\n`
      fs.appendFileSync(auditLogPath, entry, "utf8")
    } catch {
      // Fail silently to avoid breaking execution if logging fails
    }
  }

  /** Load (and cache by mtime) the .opencode/sylli.allow bypass file. */
  function loadAllowlist(): AllowlistState {
    try {
      const stat = fs.statSync(allowlistPath)
      if (allowlistCache && allowlistCache.mtimeMs === stat.mtimeMs) {
        return allowlistCache
      }
      const rules: AllowRule[] = []
      let expiresAt: number | null = null
      const lines = fs.readFileSync(allowlistPath, "utf8").split("\n")
      for (const raw of lines) {
        const line = raw.trim()
        if (!line || line.startsWith("#")) continue
        if (line.startsWith("til:")) {
          const t = Date.parse(line.slice(4))
          if (!Number.isNaN(t)) expiresAt = t
          continue
        }
        if (line.startsWith("path:")) {
          rules.push({ kind: "path", value: path.normalize(line.slice(5)) })
        } else if (line.startsWith("path-re:")) {
          try { rules.push({ kind: "path-re", value: new RegExp(line.slice(8)) }) } catch { /* invalid regex: ignore */ }
        } else if (line.startsWith("cmd-re:")) {
          try { rules.push({ kind: "cmd-re", value: new RegExp(line.slice(7)) }) } catch { /* invalid regex: ignore */ }
        }
      }
      allowlistCache = { rules, expiresAt, mtimeMs: stat.mtimeMs }
      return allowlistCache
    } catch {
      allowlistCache = { rules: [], expiresAt: null, mtimeMs: -1 }
      return allowlistCache
    }
  }

  function allowlistActive(): boolean {
    const state = loadAllowlist()
    if (state.expiresAt !== null && Date.now() > state.expiresAt) {
      return false // expired: restrictions back in force
    }
    return true
  }

  function isPathAllowed(normalizedPath: string): boolean {
    if (!allowlistActive()) return false
    const { rules } = loadAllowlist()
    for (const rule of rules) {
      if (rule.kind === "path" && (normalizedPath === rule.value || normalizedPath.startsWith(rule.value + "/") || normalizedPath.startsWith(rule.value))) {
        logSecurityEvent("BYPASS", `Path restriction bypassed by allowlist rule.`, { path: normalizedPath, rule: `path:${rule.value}` })
        return true
      }
      if (rule.kind === "path-re" && rule.value.test(normalizedPath)) {
        logSecurityEvent("BYPASS", `Path restriction bypassed by allowlist regex.`, { path: normalizedPath })
        return true
      }
    }
    return false
  }

  function isCommandAllowed(command: string): boolean {
    if (!allowlistActive()) return false
    const { rules } = loadAllowlist()
    for (const rule of rules) {
      if (rule.kind === "cmd-re" && rule.value.test(command)) {
        logSecurityEvent("BYPASS", `Command restriction bypassed by allowlist regex.`, { command: command.slice(0, 120) })
        return true
      }
    }
    return false
  }

  function validateTargetFilePath(targetPath: string, tool: string): void {
    if (!targetPath || typeof targetPath !== "string") return

    const normalized = path.isAbsolute(targetPath)
      ? path.normalize(targetPath)
      : path.normalize(path.resolve(directory, targetPath))

    // 1. Check prohibited system prefixes
    for (const prefix of FORBIDDEN_PATH_PREFIXES) {
      if (normalized === prefix || normalized.startsWith(prefix + "/")) {
        if (isPathAllowed(normalized)) return
        const errorMsg = `[SECURITY VIOLATION] Access to system path '${normalized}' is prohibited by SECURITY.md (Tool: ${tool}). To bypass legitimately: add 'path:${normalized}' to .opencode/sylli.allow or set SYLLI_DISABLE=1.`
        logSecurityEvent("BLOCKED", errorMsg, { tool, targetPath: normalized })
        throw new Error(errorMsg)
      }
    }

    // 2. Check forbidden file patterns (secrets, credentials, raw .env)
    for (const pattern of FORBIDDEN_FILE_PATTERNS) {
      if (pattern.test(normalized)) {
        if (isPathAllowed(normalized)) return
        const errorMsg = `[SECURITY VIOLATION] Access to protected credentials/secret '${normalized}' is prohibited by SECURITY.md (Tool: ${tool}). To bypass legitimately: add 'path:${normalized}' to .opencode/sylli.allow or set SYLLI_DISABLE=1.`
        logSecurityEvent("BLOCKED", errorMsg, { tool, targetPath: normalized })
        throw new Error(errorMsg)
      }
    }
  }

  function validateShellCommand(command: string): void {
    if (!command || typeof command !== "string") return

    for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
      if (pattern.test(command)) {
        if (isCommandAllowed(command)) return
        const errorMsg = `[SECURITY INTERCEPT] Potentially destructive command blocked by SECURITY.md: "${command.slice(0, 120)}...". To bypass legitimately: add 'cmd-re:${pattern.source}' to .opencode/sylli.allow or set SYLLI_DISABLE=1.`
        logSecurityEvent("BLOCKED", errorMsg, { command })
        throw new Error(errorMsg)
      }
    }
  }

  function detectProjectDominantRules(): string | null {
    // Check languages in order of prominence
    const stackMapping: Array<{ check: () => boolean; ruleFile: string }> = [
      {
        check: () => fs.existsSync(path.join(directory, "tsconfig.json")) || fs.existsSync(path.join(directory, "package.json")),
        ruleFile: "typescript.md"
      },
      {
        check: () => fs.existsSync(path.join(directory, "Cargo.toml")),
        ruleFile: "rust.md"
      },
      {
        check: () => fs.existsSync(path.join(directory, "go.mod")),
        ruleFile: "go.md"
      },
      {
        check: () => fs.existsSync(path.join(directory, "pyproject.toml")) || fs.existsSync(path.join(directory, "requirements.txt")) || fs.existsSync(path.join(directory, "setup.py")),
        ruleFile: "python.md"
      },
      {
        check: () => fs.existsSync(path.join(directory, "composer.json")),
        ruleFile: "php.md"
      }
    ]

    for (const stack of stackMapping) {
      if (stack.check()) {
        // Try local rules first, then bundle rules
        const candidatePaths = [
          path.join(directory, "rules", stack.ruleFile),
          path.join(directory, ".opencode", "rules", stack.ruleFile)
        ]
        for (const p of candidatePaths) {
          if (fs.existsSync(p)) {
            try {
              return fs.readFileSync(p, "utf8")
            } catch {
              // continue
            }
          }
        }
      }
    }
    return null
  }

  function checkDesignDocState(): { exists: boolean; status?: string } {
    const designPath = path.join(directory, "DESIGN.md")
    if (!fs.existsSync(designPath)) {
      return { exists: false }
    }
    try {
      const content = fs.readFileSync(designPath, "utf8").slice(0, 500)
      const match = content.match(/Status:\s*([a-zA-Z0-9_-]+)/i)
      return { exists: true, status: match ? match[1].toLowerCase() : "unknown" }
    } catch {
      return { exists: true, status: "unknown" }
    }
  }

  return {
    // 1. Tool execution security interceptor
    "tool.execute.before": async (input, output) => {
      // Full bypass: SYLLI_DISABLE=1
      if (isFullyDisabled()) {
        return
      }

      const toolName = input.tool.toLowerCase()
      const args = output.args || {}

      // Intercept file operations
      if (["read", "write", "edit", "apply_patch"].includes(toolName)) {
        if (args.path) validateTargetFilePath(args.path, input.tool)
        if (args.filePath) validateTargetFilePath(args.filePath, input.tool)
      }

      // Intercept shell executions
      if (["shell", "bash"].includes(toolName)) {
        if (args.command) {
          validateShellCommand(args.command)
        }
      }
    },

    // 2. Dynamic rule injection and EGM kickoff notice
    "experimental.chat.system.transform": async (input, output) => {
      if (!output.system) {
        output.system = []
      }

      // Advisory check for EGM DESIGN.md state (suppressed when fully disabled)
      if (!isFullyDisabled()) {
        const designState = checkDesignDocState()
        if (designState.exists && designState.status && ["draft", "review", "proposed"].includes(designState.status)) {
          output.system.push(
            `\n[Sylli Notice]: Project DESIGN.md is currently in '${designState.status}' state (not frozen). If planning new major implementation, summon @sylli to complete the kickoff and freeze the design specification first.`
          )
        }
      }

      // Dynamic stack rules injection
      const dominantRules = detectProjectDominantRules()
      if (dominantRules) {
        output.system.push(
          `\n[Sylli Stack Self-Checks]: Apply these mandatory language rules before declaring any implementation task done:\n${dominantRules}`
        )
      }
    }
  }
}

export default SylliPlugin
