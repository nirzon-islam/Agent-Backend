# Agent Backend — deployment guide

## Deployment target

Deploy the Agent Backend as a Node.js **Web Service** on Render (or a compatible Node.js host). The GoatBot process is a separate service and is not deployed by this repository.

Deploy the reviewed `main` branch after its CI checks pass. Do not follow old instructions to deploy an unreviewed feature branch or PR head.

## Runtime

- Node.js: `20.x` (see `package.json`)
- Build command: `npm install`
- Start command: `npm start`
- Health check: `/api/health`
- Port: use the host-provided `PORT`; the application defaults to 3000 if it is absent.

Use `npm ci` only if a package lockfile is committed in the repository.

## MongoDB

Use MongoDB Atlas or another MongoDB deployment that supports replica-set transactions. The task/approval workflow relies on transaction support; a standalone MongoDB server is not sufficient.

Create a dedicated database user with access only to the Agent database. Restrict network access to the hosting provider as appropriate and keep the connection URI private.

## Environment variables

Use `.env.example` as the canonical variable-name reference. Add values in the host dashboard; never commit or upload a production `.env`.

### Required for initial deployment / Owner bootstrap

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string for a transaction-capable deployment |
| `ADMIN_USERNAME` | Initial Owner username: 3–40 lowercase letters, digits, underscore or hyphen |
| `ADMIN_PASSWORD` | Initial Owner password: 8–128 characters; use 12+ characters |

The Owner is created during first startup if one does not already exist. Once an Owner exists, changing the bootstrap variables does not automatically replace the stored Owner credentials. The optional `ADMIN_BOOTSTRAP_SYNC=true` path explicitly synchronizes them; use it only as a deliberate one-time operation and remove it immediately afterwards.

### Dashboard AI encryption

| Variable | Purpose |
|---|---|
| `AI_SETTINGS_ENCRYPTION_KEY` | 64 hexadecimal characters representing 32 random bytes; used to encrypt saved provider credentials at rest |

Back this key up securely. Losing it makes previously saved provider credentials unreadable. Configure AI provider keys and models in the Owner Dashboard (Main, Fallback and Backup slots), not by assuming provider-specific Render variables are active.

### Optional bridge settings

| Variable | Purpose |
|---|---|
| `BRIDGE_ENABLED` | Defaults to disabled; set to `true` only after end-to-end integration validation |
| `BRIDGE_SECRET` | Required when bridge is enabled; minimum 32 characters |
| `AGENT_ALLOWED_SENDER_IDS` | Comma-separated allowed Facebook sender IDs |
| `AGENT_OWNER_SENDER_IDS` | Comma-separated Owner sender IDs |
| `WEBSITE_ORIGINS` | Comma-separated exact origins allowed by CORS; leave empty for same-origin dashboard use |

The bridge secret must match the corresponding secret configured in the exact GoatBot revision. Do not guess the GoatBot variable name: confirm it in that revision's code/configuration before enabling the bridge.

## Render setup

1. Create a **New → Web Service** from `nirzon-islam/Agent-Backend`.
2. Select the `main` branch.
3. Set the runtime/build/start/health-check values listed above.
4. Add the environment variables required for Owner bootstrap and dashboard encryption.
5. Create the MongoDB database and set `MONGODB_URI`.
6. Deploy and inspect startup logs. Confirm the database connects and the Owner bootstrap completes or reports that an Owner already exists.
7. Verify `/api/health` returns HTTP 200 and reports `database: connected`.
8. Sign in to the dashboard and configure/test at least one AI provider.

Render Free services may sleep when inactive. Select a plan appropriate for the uptime and worker behavior you need.

## Bridge and Facebook session reconnection

Keep `BRIDGE_ENABLED=false` until all of the following have been tested against the exact deployed GoatBot revision:

- Signed bridge authentication and request validation
- Allowed sender/Owner authorization
- Messenger intake and task-to-action binding
- Owner approval before sensitive changes
- Account status and session-reconnection flow
- Facebook candidate-session verification and safe failure handling
- Database-backed integration tests and credential rotation

Facebook may require checkpoint or manual security verification. A successful backend health check does not prove Facebook login, MQTT readiness, account switching or bridge connectivity. Never paste or log cookies/AppState.

## Pre-deploy checklist

- [ ] Deploy the reviewed `main` branch with passing CI.
- [ ] Confirm Node.js 20.x and the correct start command.
- [ ] Configure MongoDB with replica-set transaction support.
- [ ] Set `MONGODB_URI`, `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
- [ ] Set and securely back up `AI_SETTINGS_ENCRYPTION_KEY`.
- [ ] Confirm `.env`, database dumps, cookies/AppState and credentials are not committed.
- [ ] Verify `/api/health` and database startup logs.
- [ ] Sign in and test an AI provider from the Owner Dashboard.
- [ ] Keep `BRIDGE_ENABLED=false` until the complete integration checklist above passes.
- [ ] Rotate any credentials that have ever appeared in Git history.

## Security

Never commit production secrets. Removing a secret from the latest file does not remove it from Git history. Revoke/rotate exposed credentials at their provider, review repository history and restrict access. Do not paste secrets into issues, pull requests or chat.


## OmegA-FCA owner licensing

The Agent Backend now contains owner-only FCA license management and a public key-authenticated refresh endpoint. It uses the existing MongoDB database; no second database or separate license backend is introduced.

### Signing key setup

Generate an Ed25519 key pair on a trusted local machine:

\`\`\`sh
openssl genpkey -algorithm ED25519 -out fca-license-private.pem
openssl pkey -in fca-license-private.pem -pubout -out fca-license-public.pem
\`\`\`

- Store the **private key** only in the Agent Backend host secret \`FCA_LICENSE_PRIVATE_KEY\`. Enter the PEM with newlines preserved or escaped as \`\\n\`.
- Store the matching **public key** in the approved OmegA-FCA runtime as \`OMEGA_FCA_LICENSE_PUBLIC_KEY\`.
- Never commit either key. Back up the private key securely; losing it prevents issuing/refreshing licenses.
- Do not deploy or enable the license workflow until the key pair is configured and verified.

### Owner API

All management routes require an authenticated Agent Backend Owner session:

- \`GET /api/fca-licenses\` — list license records (license secrets are never returned).
- \`POST /api/fca-licenses\` — issue an installation-bound license. JSON body: \`ownerId\`, \`installationId\`, optional \`durationDays\` (1–3650), optional \`features\` (\`messaging\`, \`threads\`, \`groups\`, \`reactions\`, \`events\`).
- \`POST /api/fca-licenses/:licenseId/revoke\` — revoke an active license.

The issue response displays \`licenseKey\` only once. Save it in the approved runtime's secret store. The signed token lasts 15 minutes; the runtime must refresh it using \`POST /api/fca-license/refresh\` with \`licenseId\`, \`installationId\`, and \`licenseKey\`. Revocation prevents future refreshes; an already-issued token may remain valid for at most its remaining 15-minute lifetime.

This API is not yet connected to a dashboard UI. Use the authenticated Owner API only; do not expose the license key in Messenger, task history, logs, or browser-readable public pages.
