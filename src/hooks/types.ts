/**
 * Hook system types for Intent-Code Traceability (TRP1).
 * The hook engine sits as middleware between the assistant message loop and tool execution.
 * Phase 2: PreHookOptions and standardized error codes for autonomous recovery.
 */

import type { ToolUse } from "../shared/tools"
import type { Task } from "../core/task/Task"

/** Result of a Pre-Hook check. If allow is false, the tool must not run and errorContent is pushed to the conversation. */
export interface PreHookResult {
	allow: boolean
	/** When allow is false, this message is returned to the LLM as the tool result (JSON for autonomous recovery). */
	errorContent?: string
}

/**
 * Phase 2: Standardized error codes so the LLM can self-correct without crashing.
 * Used in Pre-Hook errorContent JSON.
 */
export type PreHookErrorCode =
	| "intent_required"
	| "scope_violation"
	| "user_rejected"
	| "intent_ignored"
	| "intent_not_found"

/**
 * Phase 2: Optional callbacks for the Pre-Hook. When .orchestration exists and
 * the active intent is listed in .intentignore, the host can provide
 * requestDestructiveApproval to show Approve/Reject UI before proceeding.
 */
export interface PreHookOptions {
	/**
	 * When provided and the tool is destructive and the active intent is in .intentignore,
	 * the Pre-Hook calls this to pause the Promise chain and show Approve/Reject.
	 * Return true to allow, false to block (standardized tool-error is returned to the LLM).
	 */
	requestDestructiveApproval?: (opts: {
		task: Task
		block: ToolUse
		intentId: string
		toolName: string
	}) => Promise<boolean>
}

/** Context passed to Post-Hook after a mutating tool runs (e.g. for trace append). */
export interface PostHookContext {
	task: Task
	/** Tool name that was executed. */
	toolName: string
	/** Params used (e.g. path for write_to_file). */
	params: Record<string, unknown>
	/** For write_to_file: absolute path of the file written (if available). */
	writtenPath?: string
}

/** One Agent Trace record (one line in agent_trace.jsonl). */
export interface AgentTraceRecord {
	id: string
	timestamp: string
	vcs?: { revision_id: string }
	files: Array<{
		relative_path: string
		conversations: Array<{
			url?: string
			contributor?: { entity_type: string; model_identifier?: string }
			ranges: Array<{ start_line: number; end_line: number; content_hash: string }>
			related?: Array<{ type: string; value: string }>
		}>
	}>
}

/** Minimal intent entry from active_intents.yaml (for scope/constraint checks). */
export interface ActiveIntentEntry {
	id: string
	name?: string
	status?: string
	owned_scope?: string[]
	constraints?: string[]
	acceptance_criteria?: string[]
}

/**
 * Type-safe intent context returned from the handshake (select_active_intent).
 * Propagated into the prompt as <intent_context> and used by pre/post hooks.
 */
export interface IntentContext {
	id: string
	name?: string
	status?: string
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria?: string[]
}

/** Summary of a recent agent trace entry for intent context (Phase 1 Context Loader). */
export interface RecentTraceSummary {
	relative_path: string
	content_hash: string
	timestamp: string
}
