import { test, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "fs"
import * as path from "path"
import {
  parseLogfmtRecord,
  serializeLogfmtRecord,
  readMemoryRecords,
  dedupeAndCompact,
  selectPurgeCandidates,
  runMemoryHygiene,
  type MemoryRecord
} from "../src/memory-hygiene"

const TMP_ROOT = "/tmp/opencode"
let dir = ""

function makeDir(): string {
  fs.mkdirSync(TMP_ROOT, { recursive: true })
  return fs.mkdtempSync(path.join(TMP_ROOT, "memtest-"))
}

function write(date: string, lines: string[]): void {
  fs.writeFileSync(path.join(dir, `${date}.logfmt`), lines.join("\n") + "\n", "utf8")
}

beforeEach(() => {
  dir = makeDir()
})

afterEach(() => {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // best-effort cleanup
  }
})

test("logfmt round-trip preserves quoted and multiline content", () => {
  const rec: MemoryRecord = {
    ts: "2026-05-28T10:00:00.000Z",
    type: "context",
    scope: "api",
    content: 'Remember this\nwith "quotes" and \\slashes',
    issue: "#51",
    tags: "backend,current"
  }

  const line = serializeLogfmtRecord(rec)

  expect(line).toContain('content="Remember this\\nwith \\"quotes\\" and \\\\slashes"')
  expect(line).toContain("ts=2026-05-28T10:00:00.000Z")
  expect(line).toContain("type=context")
  expect(line).toContain("scope=api")

  const parsed = parseLogfmtRecord(line)!
  expect(parsed.ts).toBe(rec.ts)
  expect(parsed.type).toBe("context")
  expect(parsed.scope).toBe("api")
  expect(parsed.content).toBe(rec.content)
  expect(parsed.issue).toBe("#51")
  expect(parsed.tags).toBe("backend,current")
})

test("parses a canonical simple-memory record line", () => {
  const parsed = parseLogfmtRecord(
    'ts=2026-05-28T10:00:00.000Z type=context scope=api content="Remember this" issue=#51 tags=backend,current'
  )!
  expect(parsed.content).toBe("Remember this")
  expect(parsed.issue).toBe("#51")
  expect(parsed.tags).toBe("backend,current")
})

test("dedupeAndCompact removes exact duplicates and sorts chronologically", () => {
  const older: MemoryRecord = { ts: "2026-01-01T00:00:00.000Z", type: "context", content: "older" }
  const newer: MemoryRecord = { ts: "2026-02-01T00:00:00.000Z", type: "context", content: "newer" }
  const result = dedupeAndCompact([newer, older, { ...older }, { ...newer }])
  expect(result.length).toBe(2)
  expect(result[0].content).toBe("older")
  expect(result[1].content).toBe("newer")
})

test("compaction dedupes across multiple daily files and regroups by ts date", async () => {
  write("2026-01-01", [
    'ts=2026-01-01T08:00:00.000Z type=context scope=project content="alpha"',
    'ts=2026-01-02T09:00:00.000Z type=context scope=project content="beta"'
  ])
  write("2026-02-01", [
    'ts=2026-01-01T08:00:00.000Z type=context scope=project content="alpha"',
    'ts=2026-02-03T10:00:00.000Z type=context scope=project content="gamma"'
  ])

  const before = readMemoryRecords(dir)
  expect(before.records.length).toBe(4)

  const result = await runMemoryHygiene({
    dir,
    compactBytes: 1,
    purgeDays: 100000,
    now: new Date("2030-01-01T00:00:00.000Z")
  })

  expect(result.compacted).toBe(true)
  expect(result.purgedCount).toBe(0)

  const after = readMemoryRecords(dir)
  expect(after.records.length).toBe(3) // exact duplicate "alpha" removed
  const contents = after.records.map((r) => r.content).sort()
  expect(contents).toEqual(["alpha", "beta", "gamma"])

  // Records were regrouped into per-day files by their own ts date.
  expect(fs.existsSync(path.join(dir, "2026-01-02.logfmt"))).toBe(true)
  expect(fs.existsSync(path.join(dir, "2026-02-03.logfmt"))).toBe(true)
  const jan1 = fs.readFileSync(path.join(dir, "2026-01-01.logfmt"), "utf8")
  expect(jan1).toContain('content="alpha"')
  expect(jan1).not.toContain('content="beta"')
})

test("purge removes old context but keeps old decision and audits deletions.logfmt", async () => {
  const now = new Date("2026-06-01T00:00:00.000Z")
  const oldTs = "2026-02-15T00:00:00.000Z" // ~106 days before now
  write("2026-02-15", [
    `ts=${oldTs} type=context scope=project content="stale context"`,
    `ts=${oldTs} type=decision scope=project content="keep this decision"`
  ])

  expect(fs.existsSync(path.join(dir, "deletions.logfmt"))).toBe(false)

  const result = await runMemoryHygiene({ dir, purgeDays: 90, now })
  expect(result.purgedCount).toBe(1)

  const remaining = readMemoryRecords(dir)
  expect(remaining.records.length).toBe(1)
  expect(remaining.records[0].type).toBe("decision")
  expect(remaining.records[0].content).toBe("keep this decision")

  const deletions = fs.readFileSync(path.join(dir, "deletions.logfmt"), "utf8")
  expect(deletions).toContain("reason=auto-hygiene:purge")
  expect(deletions).toContain("type=context")
  expect(deletions).toContain('content="stale context"')
  expect(deletions).toContain("ageDays=")
})

test("selectPurgeCandidates never purges protected types", () => {
  const now = new Date("2026-06-01T00:00:00.000Z")
  const oldTs = "2026-01-01T00:00:00.000Z"
  const records: MemoryRecord[] = [
    { ts: oldTs, type: "decision", content: "d" },
    { ts: oldTs, type: "preference", content: "p" },
    { ts: oldTs, type: "pattern", content: "q" },
    { ts: oldTs, type: "learning", content: "l" }
  ]
  const { toPurge, toKeep } = selectPurgeCandidates(records, { purgeDays: 90, now })
  expect(toPurge.map((r) => r.type)).toEqual(["learning"])
  expect(toKeep.length).toBe(3)
})

test("no-op and no throw when the memory directory is absent", async () => {
  const missing = path.join(TMP_ROOT, "definitely-missing-" + Date.now())
  const result = await runMemoryHygiene({ dir: missing, now: new Date() })
  expect(result.purgedCount).toBe(0)
  expect(result.compacted).toBe(false)
  expect(result.skippedReason).toBe("no-dir")
})

test("pass is skipped when deletions.logfmt mtime is fresh (< 30 s)", async () => {
  const oldTs = "2026-01-01T00:00:00.000Z"
  write("2026-02-15", [`ts=${oldTs} type=context scope=project content="stale"`])
  fs.writeFileSync(path.join(dir, "deletions.logfmt"), "", "utf8")

  const result = await runMemoryHygiene({ dir, purgeDays: 90, now: new Date(Date.now() + 5000) })
  expect(result.skippedReason).toBe("deletions-fresh")
  expect(result.purgedCount).toBe(0)

  // The stale record survives because the pass was skipped.
  expect(readMemoryRecords(dir).records.length).toBe(1)
})
