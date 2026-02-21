/**
 * Pre-Hook: runs before a tool is executed.
 * Enforces intent gatekeeper (valid active intent for mutating tools) and scope (path in owned_scope).
 * When select_active_intent is implemented, this will also handle loading intent context.
 */

import * as path from "path"
import * as fs from "fs/promises"

import type { ToolUse } from "../shared/tools"
import type { Task } from "../core/task/Task"
import type { PreHookResult, ActiveIntentEntry, IntentContext, RecentTraceSummary } from "./types"
import { MUTATING_TOOL_NAMES, ORCHESTRATION_DIR, ACTIVE_INTENTS_FILE, AGENT_TRACE_FILE } from "./constants"

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
 * Clear the active intent for a task. Must be called when the task is disposed
 * to prevent unbounded growth of the map over long IDE sessions.
 */
export function clearActiveIntentForTask(taskId: string): void {
	activeIntentByTaskId.delete(taskId)
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
			if (!intent) {
				return {
					allow: false,
					errorContent: `Active intent "${activeIntentId}" no longer exists in .orchestration/active_intents.yaml (file may have been modified or corrupted). Call select_active_intent with a valid intent_id from the current specification.`,
				}
			}
			if (intent.owned_scope && intent.owned_scope.length > 0) {
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
 * Load intent context for the handshake (select_active_intent). Returns type-safe IntentContext
 * or null if .orchestration is missing or the intent_id is not found.
 */
export async function loadIntentContext(
	task: Task,
	intentId: string,
): Promise<IntentContext | null> {
	const orchestrationPath = path.join(task.cwd, ORCHESTRATION_DIR)
	try {
		await fs.access(orchestrationPath)
	} catch {
		return null
	}
	const entry = await loadIntentFromYaml(
		path.join(orchestrationPath, ACTIVE_INTENTS_FILE),
		intentId,
	)
	if (!entry) return null
	return {
		id: entry.id,
		name: entry.name,
		status: entry.status,
		owned_scope: entry.owned_scope ?? [],
		constraints: entry.constraints ?? [],
		acceptance_criteria: entry.acceptance_criteria,
	}
}

/**
 * Load recent agent trace entries that reference the given intent_id (Phase 1 Context Loader).
 * Reads agent_trace.jsonl and returns up to `limit` most recent entries with matching related intent.
 */
export async function loadRecentTraceEntriesForIntent(
	cwd: string,
	intentId: string,
	limit: number = 5,
): Promise<RecentTraceSummary[]> {
	const tracePath = path.join(cwd, ORCHESTRATION_DIR, AGENT_TRACE_FILE)
	let content: string
	try {
		content = await fs.readFile(tracePath, "utf-8")
	} catch {
		return []
	}
	const lines = content.split("\n").filter((l) => l.trim())
	const summaries: RecentTraceSummary[] = []
	for (let i = lines.length - 1; i >= 0 && summaries.length < limit; i--) {
		try {
			const record = JSON.parse(lines[i]) as {
				timestamp?: string
				files?: Array<{
					relative_path?: string
					conversations?: Array<{ related?: Array<{ value?: string }>; ranges?: Array<{ content_hash?: string }> }>
				}>
			}
			const relatedMatch = record.files?.some((f) =>
				f.conversations?.some((c) =>
					c.related?.some((r) => r.value === intentId),
				),
			)
			if (!relatedMatch) continue
			const file = record.files?.[0]
			const relPath = file?.relative_path
			const hash = file?.conversations?.[0]?.ranges?.[0]?.content_hash
			const timestamp = record.timestamp
			if (relPath && hash && timestamp) {
				summaries.push({ relative_path: relPath, content_hash: hash, timestamp })
			}
		} catch {
			// Skip malformed lines
		}
	}
	return summaries
}

/**
 * Build the <intent_context> XML block returned as the tool result for select_active_intent.
 * Optionally includes <recent_trace> when recentTrace is provided (Phase 1 consolidated context).
 */
export function buildIntentContextXml(
	context: IntentContext,
	recentTrace?: RecentTraceSummary[],
): string {
	const lines: string[] = [
		"<intent_context>",
		`<intent_id>${escapeXml(context.id)}</intent_id>`,
	]
	if (context.name) lines.push(`<name>${escapeXml(context.name)}</name>`)
	if (context.owned_scope.length > 0) {
		lines.push("<owned_scope>")
		for (const s of context.owned_scope) lines.push(`  <path>${escapeXml(s)}</path>`)
		lines.push("</owned_scope>")
	}
	if (context.constraints.length > 0) {
		lines.push("<constraints>")
		for (const c of context.constraints) lines.push(`  <constraint>${escapeXml(c)}</constraint>`)
		lines.push("</constraints>")
	}
	if (context.acceptance_criteria?.length) {
		lines.push("<acceptance_criteria>")
		for (const a of context.acceptance_criteria) lines.push(`  <criterion>${escapeXml(a)}</criterion>`)
		lines.push("</acceptance_criteria>")
	}
	if (recentTrace && recentTrace.length > 0) {
		lines.push("<recent_trace>")
		for (const t of recentTrace) {
			lines.push(
				`  <entry path="${escapeXml(t.relative_path)}" content_hash="${escapeXml(t.content_hash)}" timestamp="${escapeXml(t.timestamp)}" />`,
			)
		}
		lines.push("</recent_trace>")
	}
	lines.push("</intent_context>")
	return lines.join("\n")
}

function escapeXml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;")
}

/**
 * Minimal YAML-like parse for active_intents: id, name, owned_scope, constraints, acceptance_criteria.
 * Handles only the structure we need; full YAML would use a proper parser.
 */
function parseActiveIntentsYaml(content: string): ActiveIntentEntry[] {
	const entries: ActiveIntentEntry[] = []
	const lines = content.split("\n")
	let current: Partial<ActiveIntentEntry> = {}
	let listKey: "owned_scope" | "constraints" | "acceptance_criteria" | null = null

	for (const line of lines) {
		const trimmed = line.trim()
		if (trimmed.startsWith("- id:")) {
			if (current.id) entries.push(current as ActiveIntentEntry)
			current = { id: trimmed.replace(/^- id:\s*/, "").replace(/^["']|["']$/g, "").trim() }
			listKey = null
		} else if (current.id && trimmed.startsWith("name:")) {
			current.name = trimmed.replace(/^name:\s*/, "").replace(/^["']|["']$/g, "").trim()
			listKey = null
		} else if (current.id && trimmed.startsWith("owned_scope:")) {
			listKey = "owned_scope"
			current.owned_scope = []
		} else if (current.id && trimmed.startsWith("constraints:")) {
			listKey = "constraints"
			current.constraints = []
		} else if (current.id && trimmed.startsWith("acceptance_criteria:")) {
			listKey = "acceptance_criteria"
			current.acceptance_criteria = []
		} else if (listKey && current[listKey] && trimmed.startsWith("- ")) {
			const value = trimmed.slice(2).replace(/^["']|["']$/g, "").trim()
			;(current[listKey] as string[]).push(value)
		} else if (trimmed && trimmed.indexOf(":") >= 0 && !trimmed.startsWith("- ")) {
			listKey = null
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
