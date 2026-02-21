/**
 * Intent Map (Spatial Map) — incrementally updated when INTENT_EVOLUTION occurs.
 * PDF spec: "Maps high-level business intents to physical files and AST nodes.
 * Update Pattern: Incrementally updated when INTENT_EVOLUTION occurs."
 */

import * as path from "path"
import * as fs from "fs/promises"

import { ORCHESTRATION_DIR, INTENT_MAP_FILE } from "./constants"

/**
 * Update intent_map.md to add a path to an intent's key paths when INTENT_EVOLUTION
 * is recorded. Idempotent: if the path is already listed for that intent, no change.
 */
export async function updateIntentMapForEvolution(
	cwd: string,
	intentId: string,
	relativePath: string,
): Promise<void> {
	const mapPath = path.join(cwd, ORCHESTRATION_DIR, INTENT_MAP_FILE)
	let content: string
	try {
		content = await fs.readFile(mapPath, "utf-8")
	} catch {
		return
	}

	const lines = content.split("\n")
	let separatorPassed = false
	const newLines: string[] = []

	for (const line of lines) {
		const trimmed = line.trim()
		if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
			if (trimmed.match(/^\|[\s\-:]+\|/)) {
				separatorPassed = true
				newLines.push(line)
				continue
			}
			if (separatorPassed) {
				const cells = trimmed.split("|").map((c) => c.trim()).filter(Boolean)
				if (cells.length >= 3 && cells[0] === intentId) {
					const keyPaths = cells[2]
					const normalizedPath = relativePath.trim()
					if (!keyPaths.includes(normalizedPath)) {
						const newKeyPaths = keyPaths ? `${keyPaths}, ${normalizedPath}` : normalizedPath
						const newCell2 = cells[1]
						newLines.push(`| ${cells[0]} | ${newCell2} | ${newKeyPaths} |`)
						continue
					}
				}
			}
		}
		newLines.push(line)
	}

	const newContent = newLines.join("\n")
	if (newContent !== content) {
		await fs.writeFile(mapPath, newContent, "utf-8")
	}
}
