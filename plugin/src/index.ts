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

export const SylliPlugin: Plugin = async ({ directory }) => {
  const auditLogPath = path.join(directory, ".opencode", "security_audit.log")

  function logSecurityEvent(level: "BLOCKED" | "WARNING" | "INFO", message: string, details?: any) {
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

  function validateTargetFilePath(targetPath: string, tool: string): void {
    if (!targetPath || typeof targetPath !== "string") return

    const normalized = path.isAbsolute(targetPath)
      ? path.normalize(targetPath)
      : path.normalize(path.resolve(directory, targetPath))

    // 1. Check prohibited system prefixes
    for (const prefix of FORBIDDEN_PATH_PREFIXES) {
      if (normalized === prefix || normalized.startsWith(prefix + "/")) {
        const errorMsg = `[SECURITY VIOLATION] Access to system path '${normalized}' is prohibited by SECURITY.md (Tool: ${tool}).`
        logSecurityEvent("BLOCKED", errorMsg, { tool, targetPath: normalized })
        throw new Error(errorMsg)
      }
    }

    // 2. Check forbidden file patterns (secrets, credentials, raw .env)
    for (const pattern of FORBIDDEN_FILE_PATTERNS) {
      if (pattern.test(normalized)) {
        const errorMsg = `[SECURITY VIOLATION] Access to protected credentials/secret '${normalized}' is prohibited by SECURITY.md (Tool: ${tool}).`
        logSecurityEvent("BLOCKED", errorMsg, { tool, targetPath: normalized })
        throw new Error(errorMsg)
      }
    }
  }

  function validateShellCommand(command: string): void {
    if (!command || typeof command !== "string") return

    for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
      if (pattern.test(command)) {
        const errorMsg = `[SECURITY INTERCEPT] Potentially destructive command blocked by SECURITY.md: "${command.slice(0, 120)}...". Explicit user authorization required.`
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

      // Advisory check for EGM DESIGN.md state
      const designState = checkDesignDocState()
      if (designState.exists && designState.status && ["draft", "review", "proposed"].includes(designState.status)) {
        output.system.push(
          `\n[Sylli Notice]: Project DESIGN.md is currently in '${designState.status}' state (not frozen). If planning new major implementation, summon @sylli to complete the kickoff and freeze the design specification first.`
        )
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
