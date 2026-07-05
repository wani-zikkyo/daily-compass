# Cloud handoff note

Status: cloud deployment is paused as of 2026-06-24.

The app should continue to be treated as a local-first personal quest app. Keep the current cloud-ready work in place so cloud deployment can resume later, but do not publish, tunnel, or migrate it unless the user explicitly asks again.

## Preserve these files

- `serve.py`: local server plus optional password login and cloud-safe static file handling.
- `.env.example`: example environment variables for future cloud setup.
- `DEPLOYMENT.md`: deployment notes, including persistent state warnings.
- `SMARTPHONE_USE.md`: smartphone/cloud usage guide.
- `MAINTENANCE.md`: rules for preserving app-side edits, Codex feedback, tuning, schedule, rewards, and progress.
- `Procfile`, `requirements.txt`, `.python-version`: deployment support files.
- `daily-compass-cloud-source.zip`: prepared source package for future cloud deployment.
- `backups/backup-20260623-205009`: pre-cloud backup.
- `app-state.json`: current local app state. This file is intentionally ignored by git and must not be overwritten casually.

## Do not preserve or publish secrets

- `.env` contains the local login password/secret. Keep it local.
- Do not include `.env`, `app-state.json`, logs, or backup folders in a public package or repository.

## Resume cloud work later

When the user resumes cloud work, confirm the desired level of effort first:

1. Keep local-only use and use the app normally on the PC.
2. Use a manual export/import flow for smartphone reference.
3. Deploy to a private cloud URL with password login.

For option 3, choose the provider only after the user agrees. Render with a persistent disk is the current documented path, but the provider is not locked in.

## Data preservation rules

- Never reset task rules, rewards, schedule, quest feedback, quest tuning, history, or app-side custom edits while changing deployment details.
- Before any migration, create a fresh backup of `app-state.json`.
- If deploying to a cloud server, use a persistent storage location for state. On Render, this means setting `DAILY_COMPASS_STATE_FILE` under the mounted disk path.
- After deployment, import or copy the existing state rather than starting from an empty app.

## Security boundary

- Do not start a public tunnel or create a public URL without explicit approval.
- Login-password protection is enough for the current personal-use plan, but it is still a public endpoint once deployed.
- Keep the app private by default.
