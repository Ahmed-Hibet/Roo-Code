/**
 * Hook system constants (TRP1 Intent-Code Traceability).
 * Phase 2: Command classification (Safe vs Destructive) and .intentignore.
 */

import type { ToolName } from "@roo-code/types"

/** Directory in the workspace root for orchestration artifacts (machine-managed). */
export const ORCHESTRATION_DIR = ".orchestration"

/** Filename for the intent specification (active intents and their scope). */
export const ACTIVE_INTENTS_FILE = "active_intents.yaml"

/** Filename for the append-only agent trace ledger. */
export const AGENT_TRACE_FILE = "agent_trace.jsonl"

/** Filename for the spatial map (intent → files/AST). */
export const INTENT_MAP_FILE = "intent_map.md"

/**
 * Filename for intent governance: list of intent IDs that require UI approval
 * before destructive actions (one intent ID per line; # comments allowed).
 * Located in .orchestration/.intentignore or workspace root.
 */
export const INTENT_IGNORE_FILE = ".intentignore"

/**
 * Tool names that mutate the workspace or system (write, delete, execute).
 * Pre-Hook must enforce intent and scope for these; Post-Hook may append trace.
 */
export const MUTATING_TOOL_NAMES: Set<ToolName> = new Set([
	"write_to_file",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
	"apply_patch",
	"execute_command",
	"update_todo_list",
	"new_task",
	"generate_image",
] as ToolName[])

/**
 * Phase 2: Destructive tools (write, delete, execute). These are the subset of
 * mutating tools that modify workspace or run shell; used for UI-blocking
 * authorization when .intentignore lists an intent (Approve/Reject).
 */
export const DESTRUCTIVE_TOOL_NAMES: Set<ToolName> = new Set([
	"write_to_file",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
	"apply_patch",
	"execute_command",
	"generate_image",
] as ToolName[])

/** Tool name used by the agent to "check out" an intent and load context (Phase 1). */
export const SELECT_ACTIVE_INTENT_TOOL_NAME = "select_active_intent"
