# Shared project context (CLAUDE.md)

This file is the **shared brain** for parallel agent sessions (Architect/Builder/Tester). When a verification step fails (linter, test, build), the agent should call `record_lesson(lesson)` to append a lesson here so future turns and other sessions avoid the same mistake.

## Lessons Learned

- [2026-02-21T14:30:00.000Z] When editing files under `.orchestration` owned_scope, always call `select_active_intent(intent_id)` first; otherwise the Pre-Hook returns intent_required and the mutating tool is blocked. Use the intent's constraints and acceptance_criteria when implementing.
- [2026-02-21T15:00:00.000Z] For `write_to_file`, pass `mutation_class: "AST_REFACTOR"` when only changing structure/formatting within the same intent; pass `mutation_class: "INTENT_EVOLUTION"` when adding new behavior or features. If omitted, the system classifies via diff heuristics (see `src/hooks/classifyMutation.ts`).
