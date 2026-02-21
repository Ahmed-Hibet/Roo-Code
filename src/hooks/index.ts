/**
 * Hook system for Intent-Code Traceability (TRP1).
 *
 * Public API:
 * - runPreHookOnly(task, block): run before tool execution; if !allow, block and return error.
 * - runPostHookOnly(context): run after a mutating tool (e.g. write_to_file) succeeds.
 * - setActiveIntentForTask(taskId, intentId): set the active intent (e.g. when select_active_intent is called).
 * - getActiveIntentForTask(taskId): get current active intent.
 * - isMutatingTool(toolName): whether the tool requires intent/scope checks.
 *
 * The extension host should call runPreHookOnly before dispatching to any mutating tool,
 * and runPostHookOnly after write_to_file (and optionally other mutating tools) complete.
 */

export {
	runPreHookOnly,
	runPostHookOnly,
	setActiveIntentForTask,
	getActiveIntentForTask,
	clearActiveIntentForTask,
	loadIntentContext,
	loadRecentTraceEntriesForIntent,
	buildIntentContextXml,
	recordFileHashForTask,
	clearFileHashesForTask,
	computeContentHash,
	appendLessonToClaudeMd,
	CLAUDE_MD_FILENAME,
	isMutatingTool,
} from "./engine"

export {
	ORCHESTRATION_DIR,
	ACTIVE_INTENTS_FILE,
	AGENT_TRACE_FILE,
	INTENT_MAP_FILE,
	INTENT_IGNORE_FILE,
	MUTATING_TOOL_NAMES,
	DESTRUCTIVE_TOOL_NAMES,
} from "./constants"

export type {
	PreHookResult,
	PreHookOptions,
	PreHookErrorCode,
	PostHookContext,
	AgentTraceRecord,
	MutationClass,
	ActiveIntentEntry,
	IntentContext,
	RecentTraceSummary,
} from "./types"
