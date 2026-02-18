/**
 * Hook Engine: middleware boundary that runs Pre-Hook and Post-Hook around tool execution.
 * Single entry point for the assistant message loop to invoke.
 */

import type { ToolUse } from "../shared/tools"
import type { Task } from "../core/task/Task"
import type { PreHookResult, PostHookContext } from "./types"
import { runPreHook } from "./preHook"
import { runPostHook } from "./postHook"
import { MUTATING_TOOL_NAMES } from "./constants"

export { runPreHook, runPostHook } from "./preHook"
export { setActiveIntentForTask, getActiveIntentForTask } from "./preHook"

/**
 * Check whether a tool name is mutating (requires Pre-Hook and may trigger Post-Hook).
 */
export function isMutatingTool(toolName: string): boolean {
	return MUTATING_TOOL_NAMES.has(toolName as import("@roo-code/types").ToolName)
}

/**
 * Run Pre-Hook only. Call this before calling tool.handle().
 * If result.allow is false, push result.errorContent as tool result and do not run the tool.
 */
export async function runPreHookOnly(task: Task, block: ToolUse): Promise<PreHookResult> {
	return runPreHook(task, block)
}

/**
 * Run Post-Hook only. Call this after a mutating tool has completed successfully.
 */
export async function runPostHookOnly(context: PostHookContext): Promise<void> {
	return runPostHook(context)
}
