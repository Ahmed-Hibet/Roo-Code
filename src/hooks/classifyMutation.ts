/**
 * Semantic mutation classification for Intent–AST correlation (TRP1).
 *
 * Distinguishes refactors from feature changes using diff-type heuristics so the
 * trace ledger does not default to INTENT_EVOLUTION when the agent omits mutation_class.
 *
 * Rules (explicit refactor vs feature logic):
 * - AST_REFACTOR: Syntax/structure change within the same intent — e.g. formatting,
 *   renames, reordering, extracting functions without adding new behavior.
 * - INTENT_EVOLUTION: New feature or behavior — e.g. new file, new exports,
 *   new function/class declarations, or substantial line additions.
 *
 * Heuristics used (when agent does not supply mutation_class):
 * 1. New file (no previous content at HEAD) → INTENT_EVOLUTION.
 * 2. Purely whitespace/formatting change (normalized content identical) → AST_REFACTOR.
 * 3. Same line count and high line-set overlap (reorder/rename) → AST_REFACTOR.
 * 4. New declarations detected (export function/class, function X(, class X ) → INTENT_EVOLUTION.
 * 5. Substantial net additions (>threshold lines or >ratio of old size) → INTENT_EVOLUTION.
 * 6. Otherwise → INTENT_EVOLUTION (conservative default).
 */

import type { MutationClass } from "./types"

const NET_ADDITION_THRESHOLD_LINES = 5
const NET_ADDITION_RATIO = 0.2 // 20% more lines than before
const LINE_OVERLAP_RATIO_FOR_REFACTOR = 0.85 // same lines, reordered/renamed

/** Declarations that indicate new behavior (feature evolution). */
const NEW_BEHAVIOR_PATTERNS = [
	/\bexport\s+(?:async\s+)?function\s+/g,
	/\bexport\s+class\s+/g,
	/\bexport\s+enum\s+/g,
	/\b(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(/g,
	/\b(?:export\s+)?class\s+\w+[\s\{(]/g,
	/\b(?:export\s+)?enum\s+\w+\s*\{/g,
	/\b(?:export\s+)?interface\s+\w+\s*\{/g,
	/\b(?:export\s+)?type\s+\w+\s*=/g,
]

function normalizeForComparison(content: string): string {
	return content
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n")
		.split("\n")
		.map((line) => line.replace(/\s+$/g, ""))
		.join("\n")
}

function countNewDeclarations(content: string): number {
	let count = 0
	for (const re of NEW_BEHAVIOR_PATTERNS) {
		const matches = content.match(re)
		if (matches) count += matches.length
	}
	return count
}

/**
 * Classify a write as AST_REFACTOR (refactor) or INTENT_EVOLUTION (feature change)
 * using diff-type heuristics. Use when the agent does not supply mutation_class.
 *
 * @param previousContent - Content of the file at HEAD (null if new file).
 * @param newContent - Current content after the write.
 * @param _relativePath - File path (for future AST or path-based rules).
 */
export function classifyMutation(
	previousContent: string | null,
	newContent: string,
	_relativePath: string,
): MutationClass {
	if (previousContent == null || previousContent === "") {
		return "INTENT_EVOLUTION"
	}

	const prevNorm = normalizeForComparison(previousContent)
	const newNorm = normalizeForComparison(newContent)

	if (prevNorm === newNorm) {
		return "AST_REFACTOR"
	}

	const prevLines = prevNorm.split("\n").filter((l) => l.length > 0)
	const newLines = newNorm.split("\n").filter((l) => l.length > 0)
	const prevSet = new Set(prevLines)
	const newSet = new Set(newLines)

	const addedLines = newLines.filter((l) => !prevSet.has(l))
	const removedLines = prevLines.filter((l) => !newSet.has(l))
	const netAdditions = addedLines.length - removedLines.length
	const overlap = newLines.filter((l) => prevSet.has(l)).length
	const overlapRatio = newLines.length > 0 ? overlap / newLines.length : 1

	// Same line count and most lines unchanged → reorder/rename
	if (
		Math.abs(newLines.length - prevLines.length) <= 2 &&
		overlapRatio >= LINE_OVERLAP_RATIO_FOR_REFACTOR
	) {
		return "AST_REFACTOR"
	}

	// New declarations in the added content
	const addedBlock = addedLines.join("\n")
	if (countNewDeclarations(addedBlock) > 0) {
		return "INTENT_EVOLUTION"
	}

	// Substantial net additions
	if (
		netAdditions >= NET_ADDITION_THRESHOLD_LINES ||
		(prevLines.length > 0 && netAdditions >= prevLines.length * NET_ADDITION_RATIO)
	) {
		return "INTENT_EVOLUTION"
	}

	// Small edits with no new declarations → treat as refactor (e.g. fix, rename, reorder)
	if (netAdditions <= 2 && removedLines.length <= 2) {
		return "AST_REFACTOR"
	}

	return "INTENT_EVOLUTION"
}
