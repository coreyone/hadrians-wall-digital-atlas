---
description: A practical model of “memory” for a junior developer, explained without biology. Use this to design systems, debug reliability issues, and build better personal/ team habits.
---

# 🧠 “Memory” as a System: Instructions for a Junior Developer (No bio terms)

## ✅ Prime directive
**Memory is not a single database.**
It’s a **pipeline**: Capture → Stabilize → Store (distributed) → Retrieve → Update.

---

## 1) 📥 Capture (Encoding)
**Goal:** Only important signals get recorded.

**Do**
- **Focus on one thing** before recording it.
- Reduce noise: fewer tabs, fewer notifications, one question at a time.
- Write down the **minimum useful facts**:
  - what happened
  - when
  - where (system/env)
  - inputs/outputs
  - observed vs assumed

**Don’t**
- Don’t expect “I saw it once” to persist.
- Don’t multitask and assume it’s captured.

**Rule of thumb**
- If you didn’t *name it* (note it, label it, link it), you didn’t capture it.

---

## 2) 🧱 Stabilize (Consolidation)
**Goal:** Turn fresh, fragile information into durable knowledge.

**Do**
- After exposure, do a quick “stabilize pass”:
  - summarize in 3 bullets
  - write a tiny example or test case
  - create a ticket/task with acceptance criteria
- Use **time separation**:
  - revisit later (same day + next day) to strengthen retention

**Don’t**
- Don’t rely on immediate confidence.
- Don’t skip the second pass.

**Rule of thumb**
- Durable knowledge comes from **revisiting**, not re-reading.

---

## 3) 🗄️ Store (Distributed Storage)
**Goal:** Don’t put everything in one place or one format.

**Do**
- Store knowledge in multiple retrievable forms:
  - PR description (why + what + risk)
  - code comments for invariants and sharp edges
  - runbooks for ops steps
  - tests as executable knowledge
  - docs with examples
- Prefer “source of truth” with links, not duplicates.

**Don’t**
- Don’t keep “critical memory” only in your head or in chat.
- Don’t create orphan notes with no tags or links.

**Rule of thumb**
- If it can’t be found in 30 seconds, it might as well not exist.

---

## 4) 🔎 Retrieve (Cue-Based Recall)
**Goal:** Retrieval depends on cues. Design cues intentionally.

**Do**
- Create strong retrieval cues:
  - consistent naming (feature flags, metrics, services)
  - searchable tags (incident-####, perf, auth, rollout)
  - structured templates (Debug Log / ADR / Runbook)
- When debugging, start with cues:
  - error codes, endpoints, correlation IDs, timestamps, recent deploys

**Don’t**
- Don’t expect perfect recall without context.
- Don’t search with vague terms (“it’s broken”)—use concrete cues.

**Rule of thumb**
- Retrieval is reconstruction: you rebuild the picture from partial clues.

---

## 5) ✏️ Update (Re-save After Retrieval)
**Goal:** Every retrieval is a chance to improve or corrupt the record.

**Do**
- When you “remember” something in a meeting or incident:
  - verify quickly (logs/tests/spec)
  - then **update the source of truth**
  - add “what changed” and “why it changed”
- After an incident:
  - write the postmortem while details are fresh
  - capture the new insight as a test, alert, or guardrail

**Don’t**
- Don’t spread “remembered facts” without re-checking.
- Don’t let outdated docs live forever.

**Rule of thumb**
- If knowledge changed, **change the artifact** (doc/test/runbook), not just the story.

---

# ⚠️ Why things disappear (Forgetting as a feature)
Information fades when it’s:
- low signal (not important)
- not revisited
- not attached to cues
- not used in real tasks

That’s normal. Your job is to make important things **stick** via repetition + cues + artifacts.

---

# ✅ What makes knowledge stick (Practical levers)
1. **Repetition** (spaced): revisit after 1 day, 1 week, 1 month.
2. **Meaning**: explain the “why,” not just the “what.”
3. **Usage**: apply it in code/tests/docs.
4. **Low interruption**: capture suffers under context switching.

---

# 🧪 Personal workflow (Use this daily)
- After learning something: write **3 bullets + 1 example**.
- After solving a bug: add **a test** + update a **runbook** entry.
- After a decision: write a short **ADR** (problem, options, decision, tradeoff).
- Weekly: review top notes/issues and “stabilize” the ones that matter.

---

# 🧭 Team workflow (Make org memory reliable)
- Decisions live in **ADRs**.
- How-to lives in **runbooks**.
- Guarantees live in **tests**.
- Reality lives in **metrics/logs**.
- Every incident ends with at least one **guardrail** (test, alert, or rollback plan).
