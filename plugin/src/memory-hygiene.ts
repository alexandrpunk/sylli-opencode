import * as fs from "fs"
import * as path from "path"

export interface MemoryRecord {
  ts: string
  type: string
  content: string
  scope?: string
  issue?: string
  tags?: string
  reason?: string
  ageDays?: number
  [key: string]: any
}

export interface MemoryRecordsResult extends Array<MemoryRecord> {
  records: MemoryRecord[]
  files: string[]
  totalBytes: number
}

export interface PurgeOptions {
  purgeDays?: number
  now?: Date
  protectedTypes?: Set<string> | string[]
}

export interface PurgeCandidatesResult {
  toKeep: MemoryRecord[]
  toPurge: MemoryRecord[]
  candidates: MemoryRecord[]
  kept: MemoryRecord[]
}

export interface HygieneOptions {
  dir: string
  compactBytes?: number
  purgeDays?: number
  now?: Date
  protectedTypes?: Set<string> | string[]
}

export interface HygieneResult {
  compacted: boolean
  purgedCount: number
  skippedReason?: string
  error?: string
}

const DEFAULT_COMPACT_BYTES = 1048576 // 1 MB
const DEFAULT_PURGE_DAYS = 90
const DEFAULT_PROTECTED_TYPES = new Set(["decision", "preference", "pattern"])
const PURGEABLE_TYPES = new Set(["context", "blocker", "learning"])

/**
 * Parses a single logfmt formatted line into a MemoryRecord.
 * Escaped newlines and quotes within values are unescaped.
 */
export function parseLogfmtRecord(line: string): MemoryRecord | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) {
    return null
  }

  const result: Record<string, any> = {}
  let i = 0
  const len = trimmed.length

  while (i < len) {
    while (i < len && (trimmed[i] === " " || trimmed[i] === "\t")) {
      i++
    }
    if (i >= len) break

    const keyStart = i
    while (i < len && trimmed[i] !== "=" && trimmed[i] !== " " && trimmed[i] !== "\t") {
      i++
    }
    const key = trimmed.slice(keyStart, i)
    if (!key) break

    if (i >= len || trimmed[i] !== "=") {
      result[key] = true
      continue
    }

    i++ // Skip '='

    if (i >= len) {
      result[key] = ""
      break
    }

    let value = ""
    if (trimmed[i] === '"') {
      i++ // Skip opening quote
      let escaped = false
      let strVal = ""
      while (i < len) {
        const ch = trimmed[i]
        if (escaped) {
          if (ch === "n") strVal += "\n"
          else if (ch === "r") strVal += "\r"
          else if (ch === "t") strVal += "\t"
          else if (ch === '"') strVal += '"'
          else if (ch === "\\") strVal += "\\"
          else strVal += ch
          escaped = false
        } else if (ch === "\\") {
          escaped = true
        } else if (ch === '"') {
          i++ // Skip closing quote
          break
        } else {
          strVal += ch
        }
        i++
      }
      value = strVal
    } else {
      const valStart = i
      while (i < len && trimmed[i] !== " " && trimmed[i] !== "\t") {
        i++
      }
      value = trimmed.slice(valStart, i)
    }

    if (key === "ageDays" && !isNaN(Number(value))) {
      result[key] = Number(value)
    } else {
      result[key] = value
    }
  }

  if (!result.ts && !result.content && !result.type) {
    return null
  }

  return result as MemoryRecord
}

/**
 * Serializes a MemoryRecord into standard logfmt.
 * `content` is always quoted with escaped newlines and quotes.
 * `scope`, `issue`, `tags` and other values are quoted only when needed.
 */
export function serializeLogfmtRecord(rec: MemoryRecord): string {
  const parts: string[] = []

  function escapeQuoted(str: string): string {
    return str
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t")
  }

  function formatValue(key: string, val: any): string {
    if (key === "content") {
      return `"${escapeQuoted(String(val ?? ""))}"`
    }
    const str = String(val ?? "")
    if (str === "" || /[\s="]/.test(str)) {
      return `"${escapeQuoted(str)}"`
    }
    return str
  }

  const orderedKeys: string[] = []
  if ("ts" in rec && rec.ts !== undefined) orderedKeys.push("ts")
  if ("type" in rec && rec.type !== undefined) orderedKeys.push("type")
  if ("scope" in rec && rec.scope !== undefined) orderedKeys.push("scope")
  if ("content" in rec && rec.content !== undefined) orderedKeys.push("content")

  const handled = new Set(orderedKeys)
  for (const k of Object.keys(rec)) {
    if (!handled.has(k) && rec[k] !== undefined) {
      orderedKeys.push(k)
    }
  }

  for (const k of orderedKeys) {
    parts.push(`${k}=${formatValue(k, rec[k])}`)
  }

  return parts.join(" ")
}

/**
 * Reads all daily YYYY-MM-DD.logfmt files in the specified directory.
 * Ignores deletions.logfmt, locks, and temporary files.
 */
export function readMemoryRecords(dir: string): MemoryRecordsResult {
  const records: MemoryRecord[] = []
  const files: string[] = []
  let totalBytes = 0

  if (!fs.existsSync(dir)) {
    return Object.assign([], { records: [], files: [], totalBytes: 0 })
  }

  let entries: string[] = []
  try {
    entries = fs.readdirSync(dir)
  } catch {
    return Object.assign([], { records: [], files: [], totalBytes: 0 })
  }

  const dateFileRegex = /^\d{4}-\d{2}-\d{2}\.logfmt$/
  const matchedFiles = entries.filter((e) => dateFileRegex.test(e)).sort()

  for (const filename of matchedFiles) {
    const fullPath = path.join(dir, filename)
    try {
      const stat = fs.statSync(fullPath)
      if (!stat.isFile()) continue
      totalBytes += stat.size
      files.push(filename)
      const content = fs.readFileSync(fullPath, "utf8")
      const lines = content.split("\n")
      for (const line of lines) {
        const rec = parseLogfmtRecord(line)
        if (rec) {
          records.push(rec)
        }
      }
    } catch {
      // Fail-open: continue on unreadable files
    }
  }

  return Object.assign([...records], {
    records,
    files,
    totalBytes
  })
}

/**
 * Deduplicates exact matching records and returns them in deterministic chronological order by ts.
 */
export function dedupeAndCompact(records: MemoryRecord[]): MemoryRecord[] {
  const seen = new Set<string>()
  const deduped: MemoryRecord[] = []

  for (const rec of records) {
    const serialized = serializeLogfmtRecord(rec)
    if (!seen.has(serialized)) {
      seen.add(serialized)
      deduped.push(rec)
    }
  }

  deduped.sort((a, b) => {
    const timeA = new Date(a.ts).getTime()
    const timeB = new Date(b.ts).getTime()
    if (isNaN(timeA) && isNaN(timeB)) return 0
    if (isNaN(timeA)) return 1
    if (isNaN(timeB)) return -1
    if (timeA !== timeB) return timeA - timeB
    return serializeLogfmtRecord(a).localeCompare(serializeLogfmtRecord(b))
  })

  return deduped
}

/**
 * Selects candidate records for purging.
 * Protected types (decision, preference, pattern) are NEVER purged regardless of age.
 * Types in {context, blocker, learning} older than purgeDays are purged.
 */
export function selectPurgeCandidates(
  records: MemoryRecord[],
  options?: PurgeOptions
): PurgeCandidatesResult {
  const purgeDays = options?.purgeDays ?? DEFAULT_PURGE_DAYS
  const now = options?.now ?? new Date()
  const protectedSet = options?.protectedTypes
    ? (options.protectedTypes instanceof Set ? options.protectedTypes : new Set(options.protectedTypes))
    : DEFAULT_PROTECTED_TYPES

  const toKeep: MemoryRecord[] = []
  const toPurge: MemoryRecord[] = []

  for (const rec of records) {
    const type = rec.type?.toLowerCase() || ""
    if (protectedSet.has(type)) {
      toKeep.push(rec)
      continue
    }

    if (PURGEABLE_TYPES.has(type)) {
      const recTime = new Date(rec.ts).getTime()
      if (!isNaN(recTime)) {
        const ageMs = now.getTime() - recTime
        const ageDays = ageMs / (1000 * 60 * 60 * 24)
        if (ageDays > purgeDays) {
          toPurge.push(rec)
          continue
        }
      }
    }

    toKeep.push(rec)
  }

  return {
    toKeep,
    toPurge,
    candidates: toPurge,
    kept: toKeep
  }
}

/**
 * Orchestrator: runs automated memory hygiene over `.opencode/memory/`.
 * Ensures atomic writes, concurrency safety, audit trail in deletions.logfmt,
 * and fail-open guarantees.
 */
export async function runMemoryHygiene(options: HygieneOptions): Promise<HygieneResult> {
  const { dir } = options
  const compactBytes = options.compactBytes ?? DEFAULT_COMPACT_BYTES
  const purgeDays = options.purgeDays ?? DEFAULT_PURGE_DAYS
  const now = options.now ?? new Date()
  const protectedTypes = options.protectedTypes ?? DEFAULT_PROTECTED_TYPES

  try {
    if (!fs.existsSync(dir)) {
      return { compacted: false, purgedCount: 0, skippedReason: "no-dir" }
    }

    // Concurrency check (b): skip pass if deletions.logfmt was modified within the last 30 s
    const deletionsPath = path.join(dir, "deletions.logfmt")
    if (fs.existsSync(deletionsPath)) {
      try {
        const stat = fs.statSync(deletionsPath)
        const diffMs = Math.abs(now.getTime() - stat.mtimeMs)
        if (diffMs < 30 * 1000) {
          return { compacted: false, purgedCount: 0, skippedReason: "deletions-fresh" }
        }
      } catch {
        // Proceed safely
      }
    }

    // Concurrency check (c): exclusive lock .opencode/memory/.hygiene.lock with flag 'wx'
    const lockPath = path.join(dir, ".hygiene.lock")
    let lockFd: number | null = null
    try {
      lockFd = fs.openSync(lockPath, "wx")
    } catch {
      return { compacted: false, purgedCount: 0, skippedReason: "locked" }
    }

    try {
      const mem = readMemoryRecords(dir)
      const { toPurge, toKeep } = selectPurgeCandidates(mem.records, { purgeDays, now, protectedTypes })

      // Audit trail must be written BEFORE records are removed
      if (toPurge.length > 0) {
        const nowIso = now.toISOString()
        const auditLines = toPurge.map((rec) => {
          const recTime = new Date(rec.ts).getTime()
          const ageDays = isNaN(recTime) ? 0 : Math.max(0, Math.floor((now.getTime() - recTime) / (1000 * 60 * 60 * 24)))
          const auditRec: MemoryRecord = {
            ts: nowIso,
            type: rec.type,
            scope: rec.scope || "project",
            content: rec.content,
            reason: "auto-hygiene:purge",
            ageDays
          }
          return serializeLogfmtRecord(auditRec)
        })
        fs.appendFileSync(deletionsPath, auditLines.join("\n") + "\n", "utf8")
      }

      const shouldCompact = mem.totalBytes > compactBytes
      if (!shouldCompact && toPurge.length === 0) {
        return { compacted: false, purgedCount: 0 }
      }

      const recordsToWrite = shouldCompact ? dedupeAndCompact(toKeep) : toKeep

      // Group records by YYYY-MM-DD extracted from each record's ts
      const recordsByDate = new Map<string, MemoryRecord[]>()
      for (const rec of recordsToWrite) {
        let dateKey = ""
        if (rec.ts && rec.ts.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(rec.ts)) {
          dateKey = rec.ts.slice(0, 10)
        } else {
          dateKey = now.toISOString().slice(0, 10)
        }
        const list = recordsByDate.get(dateKey) || []
        list.push(rec)
        recordsByDate.set(dateKey, list)
      }

      // Concurrency check (a): atomic writes via temp file + rename
      for (const [dateKey, dayRecords] of recordsByDate.entries()) {
        dayRecords.sort((a, b) => {
          const tA = new Date(a.ts).getTime()
          const tB = new Date(b.ts).getTime()
          return (isNaN(tA) ? 0 : tA) - (isNaN(tB) ? 0 : tB)
        })
        const fileContent = dayRecords.map(serializeLogfmtRecord).join("\n") + "\n"
        const targetFile = path.join(dir, `${dateKey}.logfmt`)
        const tempFile = path.join(dir, `.${dateKey}.logfmt.tmp.${Date.now()}_${Math.random().toString(36).slice(2)}`)
        fs.writeFileSync(tempFile, fileContent, "utf8")
        fs.renameSync(tempFile, targetFile)
      }

      // Delete daily files that become empty
      for (const filename of mem.files) {
        const dateKey = filename.replace(/\.logfmt$/, "")
        if (!recordsByDate.has(dateKey)) {
          const filePath = path.join(dir, filename)
          try {
            fs.unlinkSync(filePath)
          } catch {
            // Fail-open
          }
        }
      }

      return {
        compacted: shouldCompact,
        purgedCount: toPurge.length
      }
    } finally {
      if (lockFd !== null) {
        try {
          fs.closeSync(lockFd)
        } catch {
          // Ignore
        }
        try {
          fs.unlinkSync(lockPath)
        } catch {
          // Ignore
        }
      }
    }
  } catch (err: any) {
    // Fail-open: hygiene must never throw
    return {
      compacted: false,
      purgedCount: 0,
      skippedReason: "error",
      error: err?.message || String(err)
    }
  }
}
