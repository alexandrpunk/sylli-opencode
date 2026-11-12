# Goldfish Review Report

**Target:** `/home/alexandr/proylli-opencode/design_draft.md` (full file, 48 lines)

## Reviewer Status

| Reviewer | Status |
| --- | --- |
| `design_critic` | completed |
| `structural` | completed |

## Prioritized Findings (Blockers -> Major -> Nits)

### 1. Missing "Alternatives Considered" section - Severity: Blocker
* **Reviewer Lens:** `design_critic`, `structural`
* **Affected Scope:** Entire document
* **Discrepancy Description:** The feature-spec-standard mandates evaluation of alternatives. The draft proposes a single path with no evaluation of alternatives such as: (a) building the kickoff flow into omo-slim's existing council directly, (b) using a separate orchestrator, (c) hard-enforcement vs. advisory-only, or (d) whether the skill bundle is necessary at all.
* **Rationale & Recommendation:** Add an "Alternatives Considered" section evaluating at least 3-4 viable approaches with concrete rejection rationales.

### 2. Missing "Risks & Mitigations" section - Severity: Blocker
* **Reviewer Lens:** `design_critic`, `structural`
* **Affected Scope:** Entire document
* **Discrepancy Description:** The standard requires explicit identification of failure modes, security implications, scalability limits, and mitigations. The draft has an "Open Questions" section documenting unknowns, not known risks with mitigations.
* **Rationale & Recommendation:** Add a "Risks & Mitigations" section covering security, scalability, operational complexity, and integration failure modes.

### 3. "Proposed Architecture" not labeled as a required section - Severity: Major
* **Reviewer Lens:** `design_critic`, `structural`
* **Affected Scope:** Lines 10-17 (Overview section)
* **Discrepancy Description:** The standard lists "Proposed Architecture" as a required area. The draft covers this content under "Overview" rather than "Proposed Architecture."
* **Rationale & Recommendation:** Rename the heading or add a dedicated "Proposed Architecture" section.

### 4. Installer goals asserted with zero technical detail - Severity: Major
* **Reviewer Lens:** `design_critic`
* **Affected Scope:** Lines 17, 25, 31-32
* **Discrepancy Description:** The design asserts an "idempotent installer that merges config additively, never overwrites user edits, checks for skill-name collisions, and verifies that granted agents exist" but provides no technical detail on how. The open questions at line 45 are load-bearing, not nice-to-know.
* **Rationale & Recommendation:** Resolve the verify implementation question or scope the installer as a separate workstream.

### 5. "Survives plugin updates" claim is unbacked - Severity: Major
* **Reviewer Lens:** `design_critic`
* **Affected Scope:** Lines 14-15, 17
* **Discrepancy Description:** The claim that the bundle survives plugin updates because it uses "documented surfaces" is an assumption about omo-slim's API stability with no evidence. No fallback, version-pinning, or compatibility-testing plan is mentioned.
* **Rationale & Recommendation:** Add a compatibility strategy: pin to a specific omo-slim version, document the exact config schema version, or add a post-update verify step.

### 6. Human freeze step is a single point of failure - Severity: Major
* **Reviewer Lens:** `design_critic`
* **Affected Scope:** Lines 14-15
* **Discrepancy Description:** The kickoff flow depends on a human freezing the spec, but there is no contingency for when the human does not freeze. The advisory gate can be trivially bypassed.
* **Rationale & Recommendation:** Define explicit freeze timeout behavior, or acknowledge that the advisory model means the gate is opt-out.

### 7. Skill bundle porting methodology nonexistent - Severity: Major
* **Reviewer Lens:** `design_critic`
* **Affected Scope:** Lines 15-16, 23
* **Discrepancy Description:** The design proposes porting "~30 skills plus 6 per-stack rules" but provides no porting methodology, compatibility analysis, skill inventory, or mapping. The claim that "irrelevant ones never enter its context" assumes omo-slim supports per-agent skill scoping, which is unverified.
* **Rationale & Recommendation:** Add a skill inventory and mapping document; verify omo-slim supports per-agent skill grants.

### 8. Open Questions are load-bearing design decisions - Severity: Major
* **Reviewer Lens:** `design_critic`
* **Affected Scope:** Lines 43-47
* **Discrepancy Description:** Several open questions (verify implementation, lens subset, size cap) are critical to the design's viability, not nice-to-know.
* **Rationale & Recommendation:** Resolve inline or reclassify as a "Concepts Brief" with ownership and timeline.

### 9. Broken reference marker in config path - Severity: Nit
* **Reviewer Lens:** `design_critic`, `structural`
* **Affected Scope:** Line 17
* **Discrepancy Description:** The text reads `oh-my-opencode-slim.json[c]` — the `[c]` suffix is an undefined reference marker with no corresponding footnote or citation.
* **Rationale & Recommendation:** Remove the `[c]` suffix or replace with a proper link or footnote.

### 10. Header lacks version and change history - Severity: Nit
* **Reviewer Lens:** `design_critic`
* **Affected Scope:** Lines 1-7
* **Discrepancy Description:** The header lists Source but no version number, review history, or approval status.
* **Rationale & Recommendation:** Add a version field and change log.

### 11. Standalone readability compromised by external source dependency - Severity: Nit
* **Reviewer Lens:** `structural`
* **Affected Scope:** Line 6, lines 14-15
* **Discrepancy Description:** The document cites `concepts_brief.md` as source but does not inline key context. A reader unfamiliar with that file would not know what "Priority 1 intake" means.
* **Rationale & Recommendation:** Make the document self-contained or expand the source reference into a proper note.