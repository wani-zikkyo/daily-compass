# Daily Compass Maintenance Rules

このアプリの修正で最も重要なのは、ユーザーがアプリ内で積み上げた調整と、Codexから反映する修正をどちらも維持すること。

## Data Boundaries

- Code and UI: `index.html`, `styles.css`, `app.js`, `serve.py`
- Standard quest rules: `quest-rules.js`
- User progress: `daily-compass-progress-v2`, `app-state.json`
- Schedule changes: `daily-compass-schedule-v2`
- App-added quests: `daily-compass-custom-quests-v1`
- Quest removal feedback: `daily-compass-quest-feedback-v1`
- Quest tuning: `daily-compass-quest-tuning-v1`
- Codex notes: `daily-compass-quest-inbox-v1`

## Non-Negotiables

- Do not reset or overwrite user data when changing app code.
- Do not hard-code the user's current app-side edits into `quest-rules.js` as a replacement for saved data.
- Do not delete completion history, reroll history, schedule overrides, custom quests, removal feedback, or tuning data unless the user explicitly asks for it.
- Treat Codex imports as additive or differential updates.
- Preserve app-side edits when changing standard rules.
- Preserve Codex-side imports when changing app-side edit screens.
- Before a large migration or cloud conversion, add an export/backup path and explain what is preserved.

## Cloud Conversion Principles

- Keep app code, standard rules, user progress, app-side edits, and Codex imports in separate storage areas.
- Prefer append-only history for completions and rerolls.
- Use stable IDs for quests; if a quest is renamed, keep its ID when it represents the same behavior.
- If schemas change, write a migration that merges old data into the new shape instead of starting from empty state.
- Keep manual export available even after cloud sync is added.
- Keep `DAILY_COMPASS_PASSWORD` enabled for any internet-facing deployment.
- Store cloud state on a persistent disk via `DAILY_COMPASS_STATE_FILE`; do not rely on ephemeral deployment storage.
