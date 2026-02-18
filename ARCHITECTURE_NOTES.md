# ARCHITECTURE_NOTES.md (Phase 0 + Hook Integration)

Phase 0 deliverable: mapping where the tool loop and prompt builder live so that a hook system and intent protocol can be added. Updated to reflect the implemented hook integration.

---

## 1. Tool Loop – Where `execute_command` and `write_to_file` Are Handled

- **Dispatch point:** `presentAssistantMessage()` in `src/core/assistant-message/presentAssistantMessage.ts`. It iterates over `cline.assistantMessageContent` and, for each block, switches on `block.type` and `block.name`.

- **execute_command:** Handled in the same file via `await executeCommandTool.handle(cline, block, { askApproval, handleError, pushToolResult })`. The actual execution (terminal, approval, timeout) is in `src/core/tools/ExecuteCommandTool.ts`; `execute()` receives `{ command, cwd }` and uses the terminal integration and optional approval.

- **write_to_file:** Handled via `await writeToFileTool.handle(cline, block, { askApproval, handleError, pushToolResult })`. Implementation is in `src/core/tools/WriteToFileTool.ts`; `execute()` receives `{ path, content }`, validates path (rooignore, write protection), creates directories if needed, and writes content. Approval and diff preview are integrated. The tool sets `task.didWriteToFileSucceed = true` only on the success path so the post-hook runs only when the write actually persisted.

Other mutating tools (apply_diff, edit, search_replace, edit_file, apply_patch) follow the same pattern: same file, same callbacks. The single interception point for all tool execution is the `switch (block.name)` inside the native tool_use branch of `presentAssistantMessage()`.

---

## 2. Prompt Builder – Where the System Prompt Is Constructed

- **Call site for the agent:** `Task.getSystemPrompt()` (private method in `src/core/task/Task.ts`). It is invoked when building the payload for the LLM. It resolves MCP hub, provider state (mode, custom instructions, etc.), and then calls `SYSTEM_PROMPT(...)`.

- **Composition:** `SYSTEM_PROMPT` is exported from `src/core/prompts/system.ts`. It delegates to `generatePrompt()`, which assembles the final string from sections: role definition, markdown formatting, shared tool-use section, tool-use guidelines, capabilities (including MCP), modes, skills, rules (`getRulesSection(cwd, settings)`), system info, objective, and custom instructions. Rules and capabilities are where high-level constraints are stated; this is the right place to add “You are an Intent-Driven Architect…” and “your first action MUST be to call select_active_intent”.

- **Tool descriptions for the API:** Tool definitions (names, parameters, descriptions) are built elsewhere (e.g. `buildNativeToolsArrayWithRestrictions` in `src/core/task/build-tools`) and passed to the API as the tool catalog; they are not embedded in the system prompt text. To add `select_active_intent(intent_id)`, we must (1) add the tool definition to the catalog and (2) add the behavioral instruction and protocol to the system prompt sections.

---

## 3. Hook Injection (Implemented)

- **Pre-Hook:** In `presentAssistantMessage()`, before the `switch (block.name)`, we call `runPreHookOnly(cline, block)` for every mutating tool (see `src/hooks/constants.ts` for the list). If `!preResult.allow`, we push the error and break without running the tool. The Pre-Hook enforces: (1) when `.orchestration` exists, an active intent must be set; (2) for `write_to_file`, the path must match the active intent’s `owned_scope` in `active_intents.yaml`. Path is resolved as `nativeArgs?.path ?? params?.path` to match the tool and post-hook.

- **Post-Hook:** After `writeToFileTool.handle()` we run `runPostHookOnly(...)` only when `cline.didWriteToFileSucceed` is true (set by WriteToFileTool only on successful persist). The post-hook appends one JSON line to `.orchestration/agent_trace.jsonl` with id, timestamp, file path, content hash, and related intent ID. Failed or cancelled writes do not produce a trace entry.

- **Hook implementation:** `src/hooks/` contains the hook engine (types, constants, preHook, postHook, engine, index). See `src/hooks/README.md` for structure and usage.

---

## 4. Key File Reference

| Concern              | Location |
|----------------------|----------|
| Extension entry      | `src/extension.ts` |
| Task / conversation  | `src/core/task/Task.ts` |
| System prompt        | `src/core/prompts/system.ts` |
| Tool loop dispatch   | `src/core/assistant-message/presentAssistantMessage.ts` |
| Tool definitions     | `src/shared/tools.ts` |
| write_to_file        | `src/core/tools/WriteToFileTool.ts` |
| execute_command      | `src/core/tools/ExecuteCommandTool.ts` |
| Hook engine          | `src/hooks/` |
