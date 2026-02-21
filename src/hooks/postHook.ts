/**
 * Post-Hook: runs after a mutating tool has executed successfully.
 * Appends to .orchestration/agent_trace.jsonl linking intent to code (content hash, REQ-ID).
 */

import * as path from "path"
import * as fs from "fs/promises"
import { createHash } from "crypto"
import { v7 as uuidv7 } from "uuid"

import type { PostHookContext } from "./types"
import type { AgentTraceRecord } from "./types"
import { ORCHESTRATION_DIR, AGENT_TRACE_FILE } from "./constants"
import { getActiveIntentForTask } from "./preHook"
import { getCurrentRevisionId } from "../utils/git"

/**
 * Run the Post-Hook after a mutating tool (e.g. write_to_file) has completed.
 * Appends one JSON line to agent_trace.jsonl when .orchestration exists and we have enough context.
 */
export async function runPostHook(context: PostHookContext): Promise<void> {
	const { task, toolName, params, writtenPath } = context
	const cwd = task.cwd
	const orchestrationDir = path.join(cwd, ORCHESTRATION_DIR)
	const tracePath = path.join(orchestrationDir, AGENT_TRACE_FILE)

	try {
		await fs.access(orchestrationDir)
	} catch {
		return
	}

	const activeIntentId = getActiveIntentForTask(task.taskId)
	if (!activeIntentId && toolName !== "write_to_file") {
		return
	}

	// For write_to_file we append a trace entry with path and content hash when possible
	if (toolName === "write_to_file") {
		const relPath = (params.path as string) ?? writtenPath
		if (!relPath) return

		const absolutePath = path.resolve(cwd, relPath)
		let contentHash: string
		let startLine = 1
		let endLine = 1
		try {
			const content = await fs.readFile(absolutePath, "utf-8")
			contentHash = "sha256:" + createHash("sha256").update(content).digest("hex")
			const lines = content.split("\n")
			// Trailing newline produces an extra empty segment; don't count it as a line
			endLine =
				content.endsWith("\n") && lines[lines.length - 1] === ""
					? lines.length - 1
					: lines.length
		} catch {
			contentHash = "sha256:(unable-to-read)"
		}

		const revisionId = await getCurrentRevisionId(cwd)
		const record: AgentTraceRecord = {
			id: uuidv7(),
			timestamp: new Date().toISOString(),
			...(revisionId && { vcs: { revision_id: revisionId } }),
			files: [
				{
					relative_path: relPath,
					conversations: [
						{
							contributor: { entity_type: "AI", model_identifier: task.api?.getModel?.()?.id },
							ranges: [{ start_line: startLine, end_line: endLine, content_hash: contentHash }],
							related: activeIntentId ? [{ type: "specification", value: activeIntentId }] : undefined,
						},
					],
				},
			],
		}

		// Append one JSON line (JSONL format)
		const line = JSON.stringify(record) + "\n"
		await fs.appendFile(tracePath, line)
	}
}
