# Commit guidelines for full traceability credit

To demonstrate **explicit iteration** and reach the highest level in assessments:

- Prefer **smaller, focused commits** that tell a story of how the system evolved.
- Include commits that show **debugging**, **refactoring**, and **design adjustments** in response to issues discovered during use or testing, not only feature additions.
- Examples of commit messages that show iteration:
  - `fix: classify mutation when file is new (no HEAD content)`
  - `refactor: extract classifyMutation into dedicated module`
  - `fix: use forward slashes for git show HEAD:path on Windows`
  - `docs: document lifecycle transitions in active_intents`
- After implementing a feature, add a follow-up commit for any fix or refactor you discover while testing (e.g. edge case, readability, or alignment with intent_map/trace).

This produces a history that clearly shows response to discovered issues and design refinement.
