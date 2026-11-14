# Agent Backend — deployment preparation

## Current deployability status

This repository is **not yet a complete production Agent/Messenger integration**. The API server and approval/bridge foundations exist, but there is no complete Messenger task-intake + AI-planner path that safely turns a request into a validated approval record. Do not enable the bridge or connect a live bot until that path and its integration tests are complete.

## Runtime

- Node.js 20.x
- Install: `npm ci` (if a lockfile is present), otherwise `npm install`
- Start: `npm start`
- Health check: `GET /api/health`
- Set the host-provided `PORT`; do not hardcode it.

## MongoDB

Use MongoDB Atlas or another MongoDB deployment that supports replica-set transactions. The approval/task workflow uses transactions; a standalone MongoDB server is not sufficient. Create a dedicated database user with access only to this database, allow only the hosting provider's required network access, and keep the URI private.

## Required environment

See `.env.example`. Set `MONGODB_URI`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD`. Admin username must be 3–40 lowercase letters, digits, underscore or hyphen; password must be 12–128 characters. Use a unique password manager-generated password.

Optional AI keys are provider-specific. Do not assume a provider is active merely because a model name is present. Keep `BRIDGE_ENABLED=false` until the missing integration work is completed. If later enabled, `BRIDGE_SECRET` must be at least 32 characters and identical on the backend and bot.

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
- [ ] Keep `BRIDGE_ENABLED=false` until Messenger intake, planner, task/action binding and integration tests are implemented.

## Security

Never commit production secrets. If a secret has appeared in Git history, deleting it from the current file does not make it safe: revoke/rotate it at the provider, review repository history and restrict access. Do not paste secrets into issues, PRs or chat.
