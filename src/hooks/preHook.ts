/**
 * Pre-Hook: runs before a tool is executed.
 * Enforces intent gatekeeper (valid active intent for mutating tools) and scope (path in owned_scope).
 * When select_active_intent is implemented, this will also handle loading intent context.
 */

import * as path from "path"
import * as fs from "fs/promises"

import type { ToolUse } from "../shared/tools"
import type { Task } from "../core/task/Task"
import type { PreHookResult } from "./types"
import type { ActiveIntentEntry } from "./types"
import { MUTATING_TOOL_NAMES, ORCHESTRATION_DIR, ACTIVE_INTENTS_FILE } from "./constants"

/** In-memory store of active intent per task (set when select_active_intent is called). */
const activeIntentByTaskId = new Map<string, string>()

/**
 * Set the active intent for a task (called when select_active_intent is handled).
 * Public for use by the tool loop or by a future select_active_intent handler.
 */
export function setActiveIntentForTask(taskId: string, intentId: string): void {
	activeIntentByTaskId.set(taskId, intentId)
}

/**
 * Get the active intent ID for a task, or undefined if none set.
 */
export function getActiveIntentForTask(taskId: string): string | undefined {
	return activeIntentByTaskId.get(taskId)
}

/**
 * Run the Pre-Hook for a tool call.
 * Returns { allow: true } to proceed, or { allow: false, errorContent } to block and return error to the LLM.
 */
export async function runPreHook(
	task: Task,
	block: ToolUse,
): Promise<PreHookResult> {
	const toolName = block.name as string

	// Non-mutating tools always allowed (read-only, mode switch, etc.)
	if (!MUTATING_TOOL_NAMES.has(toolName as import("@roo-code/types").ToolName)) {
		return { allow: true }
	}

	const cwd = task.cwd
	const orchestrationPath = path.join(cwd, ORCHESTRATION_DIR)

	let existsOrchestration: boolean
	try {
		await fs.access(orchestrationPath)
		existsOrchestration = true
	} catch {
		existsOrchestration = false
	}

	// No .orchestration directory → no intent enforcement (backward compatible)
	if (!existsOrchestration) {
		return { allow: true }
	}

	const activeIntentId = getActiveIntentForTask(task.taskId)
	if (!activeIntentId) {
		return {
			allow: false,
			errorContent: [
				'You must cite a valid active Intent ID before performing this action.',
				'Call select_active_intent(intent_id) first to load context and then retry.',
			].join(' '),
		}
	}

	// Scope enforcement for write_to_file (and other file-writing tools)
	// Path resolution order must match post-hook and tool execution: nativeArgs first, then params.
	if (toolName === "write_to_file") {
		const filePath = (block as { nativeArgs?: { path?: string } }).nativeArgs?.path ?? block.params?.path
		if (filePath) {
			const intent = await loadIntentFromYaml(path.join(orchestrationPath, ACTIVE_INTENTS_FILE), activeIntentId)
			if (intent && intent.owned_scope && intent.owned_scope.length > 0) {
				const normalizedPath = path.normalize(filePath).replace(/\\/g, "/")
				const inScope = intent.owned_scope.some((scope) => matchScope(scope, normalizedPath))
				if (!inScope) {
					return {
						allow: false,
						errorContent: `Scope Violation: ${activeIntentId} is not authorized to edit ${filePath}. Request scope expansion.`,
					}
				}
			}
		}
	}

	return { allow: true }
}

/**
 * Load a single intent by id from active_intents.yaml.
 * Uses a simple line-based parse to avoid adding a YAML dependency; for production consider js-yaml.
 */
async function loadIntentFromYaml(
	filePath: string,
	intentId: string,
): Promise<ActiveIntentEntry | null> {
	try {
		const content = await fs.readFile(filePath, "utf-8")
		const intents = parseActiveIntentsYaml(content)
		return intents.find((e) => e.id === intentId) ?? null
	} catch {
		return null
	}
}

/**
 * Minimal YAML-like parse for active_intents: id, owned_scope list.
 * Handles only the structure we need; full YAML would use a proper parser.
 */
function parseActiveIntentsYaml(content: string): ActiveIntentEntry[] {
	const entries: ActiveIntentEntry[] = []
	const lines = content.split("\n")
	let current: Partial<ActiveIntentEntry> = {}
	let inOwnedScope = false

	for (const line of lines) {
		const trimmed = line.trim()
		if (trimmed.startsWith("- id:")) {
			if (current.id) entries.push(current as ActiveIntentEntry)
			current = { id: trimmed.replace(/^- id:\s*/, "").replace(/^["']|["']$/g, "").trim() }
			inOwnedScope = false
		} else if (current.id && trimmed.startsWith("owned_scope:")) {
			inOwnedScope = true
			current.owned_scope = []
		} else if (inOwnedScope && trimmed.startsWith("- ")) {
			const value = trimmed.slice(2).replace(/^["']|["']$/g, "")
			if (current.owned_scope) current.owned_scope.push(value)
		} else if (trimmed && !trimmed.startsWith("- ") && trimmed.indexOf(":") >= 0) {
			inOwnedScope = false
		}
	}
	if (current.id) entries.push(current as ActiveIntentEntry)
	return entries
}

/** Simple glob-style match: ** matches any path segment, * matches within segment. */
function matchScope(scope: string, normalizedPath: string): boolean {
	const pattern = scope.replace(/\\/g, "/")
	const parts = normalizedPath.split("/")
	const patternParts = pattern.split("/")
	let p = 0
	let q = 0
	while (p < patternParts.length && q < parts.length) {
		if (patternParts[p] === "**") {
			p++
			if (p === patternParts.length) return true
			while (q < parts.length) {
				if (matchRest(patternParts, p, parts, q)) return true
				q++
			}
			return false
		}
		if (!matchSegment(patternParts[p], parts[q])) return false
		p++
		q++
	}
	return p === patternParts.length && q === parts.length
}

function matchRest(patternParts: string[], p: number, parts: string[], q: number): boolean {
	while (p < patternParts.length && q < parts.length) {
		if (patternParts[p] === "**") {
			p++
			if (p === patternParts.length) return true
			while (q < parts.length) {
				if (matchRest(patternParts, p, parts, q)) return true
				q++
			}
			return false
		}
		if (!matchSegment(patternParts[p], parts[q])) return false
		p++
		q++
	}
	return p === patternParts.length && q === parts.length
}

function matchSegment(pat: string, seg: string): boolean {
	if (pat === "*") return true
	if (pat === seg) return true
	// simple * within segment
	const re = new RegExp("^" + pat.replace(/\*/g, "[^/]*") + "$")
	return re.test(seg)
}
