# Agent Backend deployment and GoatBot worker

## Agent Backend service

Set these environment variables in the Agent Backend host:

- `NODE_ENV=production`
- `MONGODB_URI`: MongoDB replica-set URI (transactions are used for approvals).
- `ADMIN_USERNAME` and `ADMIN_PASSWORD`: owner dashboard bootstrap login; password must be 12-128 characters.
- `BRIDGE_ENABLED=true`
- `BRIDGE_SECRET`: random secret with at least 32 characters.
- `AGENT_ALLOWED_SENDER_IDS`: comma-separated Messenger sender IDs allowed to submit requests.
- At least one AI provider: `GEMINI_API_KEY`, `GROQ_API_KEY`, or Cloudflare AI account/token/model variables.

Keep all secrets in the host's environment-secret manager. Never paste them into task prompts, source files, or chat.

## GoatBot worker service

Set these environment variables in the GoatBot host:

- `AGENT_BRIDGE_ENABLED=true`
- `AGENT_WORKER_ENABLED=true`
- `AGENT_BACKEND_URL=https://<your-agent-backend-host>`
- `AGENT_BRIDGE_SECRET`: exactly the same secret as Agent Backend's `BRIDGE_SECRET`.
- `AGENT_WORKSPACE_ROOT`: optional; defaults to the GoatBot process working directory.

The Bridge uses signed HTTPS requests. Do not expose the Bridge secret to Messenger users.

## Worker capabilities

The worker operates on normal files/directories inside its configured workspace. It supports inventory/read, create/edit, backed-up delete, hash-verified restore, file move/rename, directory create, empty-directory removal, JavaScript syntax checks, fixed npm dependency operations (`npm ci --ignore-scripts` and `npm update --ignore-scripts`), and owner-approved supervisor restart.

Protected paths include Git metadata, dependency folders, hidden files, credentials, account/appstate/cookie data, and internal backup storage. It does not run arbitrary shell commands or npm lifecycle scripts.

## Runtime and deployment

The Bridge worker is started from `EryXenX.js` when both GoatBot flags are enabled. The restart action exits with the supervisor's restart code only after the task result has been reported.

Deploy/restart each service separately after setting its environment variables. Code on a feature branch is not live until the relevant host is configured to deploy that branch or the changes are merged and deployed.
