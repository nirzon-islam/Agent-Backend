# 🤖 Agent Backend by NirZon

### Secure AI Agent Backend for GoatBot Messenger

Agent Backend provides an Owner-controlled dashboard and Messenger-connected workflow for managing and maintaining a GoatBot project. It is designed to work with a GoatBot runtime hosted separately from this backend.

## Features

- Owner-authenticated web dashboard
- Facebook Messenger intake and signed backend bridge
- Main, Fallback and Backup AI provider slots configured from the Owner Dashboard
- AI-assisted code analysis and task planning
- Approval-controlled actions, task history and activity logs
- Backup and rollback support for supported file changes
- Facebook account/session reconnection workflow with account-ID validation and session verification

**Important:** A feature being present in the repository does not mean the full production flow has been validated against a live Facebook account. Reconnection and bridge behavior must be tested in a controlled environment before relying on them.

## Architecture

```text
Owner / Messenger
       |
Agent Backend (Render)
       |
MongoDB + AI providers
       |
Signed bridge (opt-in)
       |
GoatBot runtime (Railway)
```

## Requirements

- Node.js 20.x
- MongoDB deployment that supports replica-set transactions (MongoDB Atlas is recommended)
- Render Web Service or another Node.js host
- At least one supported AI provider configured from the Owner Dashboard
- A GoatBot runtime only if using the Messenger/bridge integration

## Deploy to Render

1. Push or merge the reviewed code to the repository's `main` branch.
2. In Render, create a **Web Service** from `nirzon-islam/Agent-Backend` and select `main`.
3. Use:
   - Runtime: Node
   - Build command: `npm install` (or `npm ci` only if a lockfile is committed)
   - Start command: `npm start`
   - Health check path: `/api/health`
4. Add the required environment variables from [`.env.example`](.env.example) in Render's Environment settings. Do not upload a real `.env` file.
5. Deploy and verify that `/api/health` returns HTTP 200 with database status `connected`.
6. Open the dashboard and sign in with the configured Owner credentials.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full environment-variable reference, MongoDB requirements and pre-deploy checklist.

## Environment and AI providers

Required for the first Owner bootstrap:

- `MONGODB_URI`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

`AI_SETTINGS_ENCRYPTION_KEY` is required to save AI provider credentials in the dashboard. Generate 32 random bytes and encode them as 64 hexadecimal characters. Keep a secure backup: saved provider keys cannot be decrypted if this key is lost.

Configure Main, Fallback and Backup providers in the Owner Dashboard. Provider credentials and model settings are stored by the dashboard; do not assume that adding a model name or an unrelated Render variable activates a provider.

## GoatBot bridge (optional; disabled by default)

Keep `BRIDGE_ENABLED=false` until the backend and the exact deployed GoatBot revision have passed end-to-end integration tests. If you later enable it:

- Set a random `BRIDGE_SECRET` of at least 32 characters on the backend.
- Configure the matching secret on the GoatBot side using the variable name required by that exact GoatBot revision.
- Restrict allowed sender/owner IDs with the supported environment settings.
- Verify signed requests, account status, approval flow and reconnect behavior before production use.

Do not assume that deploying both repositories automatically connects them. Their bridge implementations and configuration must be compatible.

## Facebook account/session reconnection

The reconnection workflow is intended to accept refreshed session data through the protected Agent flow, validate the target Facebook account ID, and verify the candidate session before replacing the active session. Facebook may still require checkpoint or other manual security verification. Never share cookies/AppState in chat, issues, logs or source control. Use only accounts you own or are authorized to operate.

## Security

- Never commit `.env`, database dumps, Facebook cookies/AppState, API keys or passwords.
- Use a unique Owner password (12+ characters recommended).
- Keep `AI_SETTINGS_ENCRYPTION_KEY` backed up securely and never expose it.
- Rotate any credential that has ever been committed to Git history.
- Keep the bridge disabled until integration tests are complete.
- Sensitive or destructive actions must remain approval-controlled.

## Deployment notes

- Render Free instances may sleep when inactive; they are not suitable for reliable always-on workers.
- MongoDB must support replica-set transactions for the task/approval workflow.
- The health endpoint reports database connectivity; a healthy response alone does not prove Messenger or bridge integration works.

## License

Copyright (c) 2026 Md SalmaN (NirZon). All rights reserved. See the repository's license terms before redistributing.

---
💜 Built for secure, controlled AI-powered GoatBot management.
