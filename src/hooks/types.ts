/**
 * Hook system types for Intent-Code Traceability (TRP1).
 * The hook engine sits as middleware between the assistant message loop and tool execution.
 */

import type { ToolUse } from "../shared/tools"
import type { Task } from "../core/task/Task"

/** Result of a Pre-Hook check. If allow is false, the tool must not run and errorContent is pushed to the conversation. */
export interface PreHookResult {
	allow: boolean
	/** When allow is false, this message is returned to the LLM as the tool result. */
	errorContent?: string
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
