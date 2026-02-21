# .orchestration (Intent-Code Traceability)

This directory contains **machine-managed** artifacts for the TRP1 Intent-Code Traceability hook system. When present in the workspace root, the agent must call `select_active_intent(intent_id)` before any mutating action.

| File | Purpose |
|------|--------|
| `active_intents.yaml` | Intent specification: id, name, status, owned_scope, constraints, acceptance_criteria. |
| `agent_trace.jsonl` | Append-only ledger: each line links a mutating action to an intent (content_hash, vcs.revision_id, related intent_id, mutation_class: AST_REFACTOR \| INTENT_EVOLUTION). |
| `intent_map.md` | Spatial map: intent IDs to key paths (updated on INTENT_EVOLUTION). |
| `.intentignore` | (Phase 2) Optional. One intent ID per line; `#` comments allowed. Intents listed here require **Approve/Reject** in the UI before destructive actions (write, execute_command, etc.). |

The sample files in this repo serve as reference and demo. For your own project, ensure `owned_scope` paths match your codebase.
