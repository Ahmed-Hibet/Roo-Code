import type OpenAI from "openai"

const RECORD_LESSON_DESCRIPTION = `Append a "Lesson Learned" to the shared knowledge base (CLAUDE.md) so parallel sessions and future turns can avoid the same mistake. Call this when a verification step fails (e.g. linter error, test failure, build failure) so the lesson is recorded for the Hive Mind. The content is appended under a "Lessons Learned" section.`

const LESSON_PARAMETER_DESCRIPTION = `The lesson to record (e.g. "Auth middleware must not use external providers per INT-001 constraints" or "Tests fail when X is used; use Y instead"). Be concise and actionable.`

export default {
	type: "function",
	function: {
		name: "record_lesson",
		description: RECORD_LESSON_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				lesson: {
					type: "string",
					description: LESSON_PARAMETER_DESCRIPTION,
				},
			},
			required: ["lesson"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
