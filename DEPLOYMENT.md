# Agent Backend — deployment preparation

## Current deployability status

The Messenger intake, AI planner, structured action validation, Owner approval workflow, signed bridge client, and opt-in worker path are now implemented on the feature branches. However, database-backed end-to-end tests and credential rotation/history review remain outstanding. Keep the bridge and worker disabled until those checks are complete.

## Runtime

- Node.js 20.x
- Install: `npm ci` (if a lockfile is present), otherwise `npm install`
- Start: `npm start`
- Health check: `GET /api/health`
- Set the host-provided `PORT`; do not hardcode it.

## MongoDB

Use MongoDB Atlas or another MongoDB deployment that supports replica-set transactions. The approval/task workflow uses transactions; a standalone MongoDB server is not sufficient. Create a dedicated database user with access only to this database, allow only the hosting provider's required network access, and keep the URI private.

## Required environment

See `.env.example`. Set `MONGODB_URI`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD`. Admin username must be 3–40 lowercase letters, digits, underscore or hyphen; password must be 8–128 characters. Prefer a unique password-manager-generated password of at least 12 characters; the 8-character minimum is a compatibility floor, not a security recommendation.

Optional AI keys are provider-specific. Do not assume a provider is active merely because a model name is present. Keep `BRIDGE_ENABLED=false` until database-backed integration tests and credential rotation are complete. Configure at least one AI provider key. If enabled later, `BRIDGE_SECRET` must be at least 32 characters and identical on the backend and bot.

## Render setup (manual)

1. Create a new **Web Service** from this repository and select the reviewed feature branch/PR only after reviewing it.
2. Runtime: Node; build command: `npm install` (or `npm ci` when a committed lockfile is available); start command: `npm start`.
3. Add environment variables from `.env.example` in Render's Environment page; never upload a real `.env`.
4. Set health check path to `/api/health`.
5. Deploy, then verify the health endpoint and inspect logs for successful database connection and owner bootstrap.
6. Keep bridge disabled and do not connect GoatBot until the integration is complete.

Render free instances may sleep and are not suitable for reliable always-on workers. Database availability and hosting limits depend on the selected plans.

## Pre-deploy checklist

- [ ] Review PR diff and CI on the latest commit.
- [ ] Create MongoDB replica-set/Atlas database and least-privilege user.
- [ ] Configure all required environment variables in the host dashboard.
- [ ] Rotate any credentials that were ever committed to source control.
- [ ] Confirm `.env`, database dumps, bot session files and credentials are not committed.
- [ ] Verify `/api/health` and database startup logs.
- [ ] Keep `BRIDGE_ENABLED=false` until Messenger intake, planner, task/action binding and database-backed integration tests are verified.

## Security

Never commit production secrets. If a secret has appeared in Git history, deleting it from the current file does not make it safe: revoke/rotate it at the provider, review repository history and restrict access. Do not paste secrets into issues, PRs or chat.
