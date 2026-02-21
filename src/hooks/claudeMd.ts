/**
 * Phase 4 (TRP1): Shared Brain — append "Lessons Learned" to CLAUDE.md.
 * Used by the record_lesson tool so parallel sessions (Architect/Builder/Tester) share knowledge.
 */

import * as path from "path"
import * as fs from "fs/promises"

export const CLAUDE_MD_FILENAME = "CLAUDE.md"
const LESSONS_HEADING = "## Lessons Learned"

export interface AppendLessonResult {
	success: boolean
	error?: string
}

/**
 * Append a lesson to CLAUDE.md in the workspace root.
 * Creates the file with a "Lessons Learned" section if it does not exist.
 */
export async function appendLessonToClaudeMd(cwd: string, lesson: string): Promise<AppendLessonResult> {
	const filePath = path.join(cwd, CLAUDE_MD_FILENAME)
	const timestamp = new Date().toISOString()
	const line = `- [${timestamp}] ${lesson.trim()}\n`

	try {
		let content: string
		try {
			content = await fs.readFile(filePath, "utf-8")
		} catch {
			content = ""
		}

		let newContent: string
		if (content.trim() === "") {
			newContent = `# Shared project context (CLAUDE.md)\n\n${LESSONS_HEADING}\n\n${line}`
		} else if (!content.includes(LESSONS_HEADING)) {
			newContent = content.trimEnd() + `\n\n${LESSONS_HEADING}\n\n${line}`
		} else {
			newContent = content.trimEnd() + "\n" + line
		}

		await fs.writeFile(filePath, newContent, "utf-8")
		return { success: true }
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		return { success: false, error: message }
	}
}
