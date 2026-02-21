# .orchestration (Intent-Code Traceability)

This directory contains **machine-managed** artifacts for the TRP1 Intent-Code Traceability hook system. When present in the workspace root, the agent must call `select_active_intent(intent_id)` before any mutating action.

## Artifacts and coherence

| File | Purpose |
|------|--------|
| `active_intents.yaml` | Intent specification: id, name, status, owned_scope, constraints, acceptance_criteria. **Lifecycle:** status values `NOT_STARTED` → `IN_PROGRESS` → `DONE`; Pre-Hook (on task start) and Post-Hook (on milestone) update status so transitions are visible. |
| `agent_trace.jsonl` | Append-only ledger: each line links a mutating action to an intent (content_hash, vcs.revision_id, related intent_id, mutation_class). **Alignment:** every `related[].value` (intent_id) must exist in `active_intents.yaml` and appears in `intent_map.md` when mutation_class is INTENT_EVOLUTION. |
| `intent_map.md` | Spatial map: intent IDs to key paths. **Alignment:** updated automatically when a trace entry has mutation_class INTENT_EVOLUTION; intent IDs in the map match active_intents and trace `related` fields. |
| `.intentignore` | (Phase 2) Optional. One intent ID per line; `#` comments allowed. Intents listed here require **Approve/Reject** in the UI before destructive actions (write, execute_command, etc.). |

**Mutation classification:** `mutation_class` is either supplied by the agent or computed by diff heuristics (see `src/hooks/classifyMutation.ts`). **AST_REFACTOR** = refactor (formatting, renames, same intent); **INTENT_EVOLUTION** = feature change (new behavior, new file, new declarations). Trace entries thus explicitly distinguish refactors from feature changes.

The sample files in this repo serve as reference and demo. For your own project, ensure `owned_scope` paths match your codebase.

**Final Submission (point 5):** The repo must include these three artifacts: `agent_trace.jsonl`, `active_intents.yaml`, `intent_map.md`.
