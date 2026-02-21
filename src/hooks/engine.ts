/**
 * Hook Engine: middleware boundary that runs Pre-Hook and Post-Hook around tool execution.
 * Single entry point for the assistant message loop to invoke.
 * Phase 2: runPreHookOnly accepts optional PreHookOptions for UI-blocking authorization.
 */

import type { ToolUse } from "../shared/tools"
import type { Task } from "../core/task/Task"
import type { PreHookResult, PostHookContext, PreHookOptions } from "./types"
import { runPreHook } from "./preHook"
import { runPostHook } from "./postHook"
import { MUTATING_TOOL_NAMES } from "./constants"

export { runPreHook, runPostHook } from "./preHook"
export {
	setActiveIntentForTask,
	getActiveIntentForTask,
	clearActiveIntentForTask,
	loadIntentContext,
	loadRecentTraceEntriesForIntent,
	buildIntentContextXml,
	buildStandardizedToolError,
} from "./preHook"

/**
 * Check whether a tool name is mutating (requires Pre-Hook and may trigger Post-Hook).
 */
export function isMutatingTool(toolName: string): boolean {
	return MUTATING_TOOL_NAMES.has(toolName as import("@roo-code/types").ToolName)
}

/**
 * Run Pre-Hook only. Call this before calling tool.handle().
 * If result.allow is false, push result.errorContent as tool result and do not run the tool.
 * Phase 2: Pass options.requestDestructiveApproval for UI-blocking approval when intent is in .intentignore.
 */
export async function runPreHookOnly(
	task: Task,
	block: ToolUse,
	options?: PreHookOptions,
): Promise<PreHookResult> {
	return runPreHook(task, block, options)
}

/**
 * Run Post-Hook only. Call this after a mutating tool has completed successfully.
 */
export async function runPostHookOnly(context: PostHookContext): Promise<void> {
	return runPostHook(context)
}
