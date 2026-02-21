import type OpenAI from "openai"

const SELECT_ACTIVE_INTENT_DESCRIPTION = `Select the active intent (requirement/task) you are working on. You MUST call this tool before performing any mutating actions (writing files, applying diffs, executing commands, etc.) when the workspace uses intent governance.

Call select_active_intent with the intent_id that matches the user's request (e.g. from .orchestration/active_intents.yaml). The tool returns an <intent_context> block with constraints and scope—use that context for all subsequent tool calls in this turn. Do not write code or run mutating tools until you have called select_active_intent and received the context.`

const INTENT_ID_PARAMETER_DESCRIPTION = `The intent identifier (e.g. INT-001, REQ-001) from the active intents specification. Must match an id in .orchestration/active_intents.yaml when present.`

export default {
	type: "function",
	function: {
		name: "select_active_intent",
		description: SELECT_ACTIVE_INTENT_DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				intent_id: {
					type: "string",
					description: INTENT_ID_PARAMETER_DESCRIPTION,
				},
			},
			required: ["intent_id"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
