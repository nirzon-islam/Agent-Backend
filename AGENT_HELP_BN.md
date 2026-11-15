# 🤖 Agent Setup & Configuration Help

**Project Owner:** Md SalmaN (NirZon)  
**Agent Backend:** https://github.com/nirzon-islam/Agent-Backend  
**GoatBot Runtime:** https://github.com/nirzon-islam/OmegA-Goatbot  
**Agent Dashboard / API:** https://agent-backend-jron.onrender.com

এই ম্যানুয়ালটি Agent-এর নিজের setup reference। কোন repository কী কাজ করে, কোথায় configuration থাকে এবং Render ↔ Railway connection কীভাবে configure করতে হয়—এখানে তা লেখা আছে। এটি কোনো remaining-work checklist নয়।

## ১. Repository map 🗂️

| Repository | দায়িত্ব |
|---|---|
| `nirzon-islam/Agent-Backend` | AI planner, task manager, Owner approval, dashboard, API ও secure bridge server |
| `nirzon-islam/OmegA-Goatbot` | Facebook Messenger bot/runtime; Railway-তে চালানো হয় এবং Agent-এর worker/bridge client থাকার জায়গা |

**Source of truth:** Agent-এর backend setting জানতে Agent-Backend-এর `.env.example`, `agent/config.js`, `server.js`, `agent/routes/` এবং `AGENT_DEPLOYMENT.md` দেখবে। GoatBot-side setting জানতে OmegA-Goatbot-এর active branch-এর runtime entry file, package files এবং Agent bridge/worker integration source দেখবে। শুধু README বা পুরোনো নোট দেখে কোনো feature live আছে ধরে নেবে না।

Private repository হলে Agent কেবল অনুমোদিত GitHub connection/access থাকলেই source পড়তে পারবে। Access না থাকলে Owner-কে repository permission বা প্রয়োজনীয় file দিতে হবে।

## ২. System connection overview 🔗

```text
Messenger User
     |
     v
OmegA-Goatbot (Railway)
     |  signed HTTPS bridge request
     v
Agent Backend (Render)
     |
     +--> MongoDB (tasks, approvals, owner data)
     |
     +--> Configured AI provider(s)
     |
     v
Owner approval / task result
     |
     v
GoatBot worker (Railway workspace)
```

- **Render**-এ Agent Backend Web Service চলে।
- **Railway**-তে GoatBot runtime চলে।
- **MongoDB** task, approval এবং Owner data সংরক্ষণ করে।
- GoatBot ও Agent-এর bridge secret দুই host-এ একই হতে হয়।
- Render free instance inactive থাকলে sleep করতে পারে; সবসময় instant response নিশ্চিত নয়।

## ৩. Render: Agent Backend configure করা ☁️

Render Dashboard → **Agent-Backend Web Service** → **Environment**-এ variable configure করতে হবে। বর্তমান service URL: `https://agent-backend-jron.onrender.com`।

| Variable | কীভাবে সেট করবে |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Render-এর runtime-provided port; source-এ default 3000, Render-এর port override করতে দাও |
| `MONGODB_URI` | MongoDB Atlas/replica-set connection URI |
| `ADMIN_USERNAME` | প্রথম Owner bootstrap username; ৩–৪০ lowercase letter, digit, underscore বা hyphen |
| `ADMIN_PASSWORD` | প্রথম Owner bootstrap password; ১২–১২৮ character |
| `GEMINI_API_KEY` | Gemini ব্যবহার করলে provider key |
| `GEMINI_MODEL` | optional; default `gemini-2.5-flash` |
| `GROQ_API_KEY` | Groq ব্যবহার করলে provider key |
| `GROQ_MODEL` | optional; default `openai/gpt-oss-120b` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Workers AI ব্যবহার করলে |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Workers AI ব্যবহার করলে |
| `CLOUDFLARE_MODEL` | Cloudflare model identifier |
| `BRIDGE_ENABLED` | bridge integration ও database-backed test যাচাই না হওয়া পর্যন্ত `false` |
| `BRIDGE_SECRET` | bridge enable করার সময় random কমপক্ষে ৩২-character secret |
| `AGENT_ALLOWED_SENDER_IDS` | Agent-এ request পাঠাতে পারবে এমন Facebook sender ID-র comma-separated তালিকা |
| `AGENT_OWNER_SENDER_IDS` | Messenger থেকে Owner approval action করতে পারবে এমন Owner sender ID-র comma-separated তালিকা |
| `WEBSITE_ORIGINS` | dashboard আলাদা domain/origin-এ থাকলে exact origin; same-origin dashboard হলে সাধারণত ফাঁকা |

কমপক্ষে একটি AI provider-এর valid key configure করতে হবে। শুধু model name থাকলে provider active হয় না।

### Owner dashboard bootstrap

- Dashboard Agent Backend-এর `public/` directory থেকে serve হয়; service root URL খুলে dashboard access করা যায়।
- প্রথমবার database-এ Owner না থাকলে `ADMIN_USERNAME` ও `ADMIN_PASSWORD` দিয়ে Owner তৈরি হয়।
- Database-এ Owner আগে থেকেই থাকলে startup log-এ **Owner already exists. Skipping.** দেখা যায়; environment variable বদলালেই existing Owner password overwrite হয় না।
- Login/API issue হলে Render logs, database connection এবং auth route/source পরীক্ষা করো।

### Database requirement

`MONGODB_URI` এমন MongoDB deployment-এর হতে হবে যা replica-set transaction support করে (যেমন MongoDB Atlas)। Approval/task workflow transaction ব্যবহার করে; standalone MongoDB যথেষ্ট নয়। URI কখনো GitHub বা chat-এ লিখবে না।

## ৪. Railway: GoatBot-side bridge configure করা 🚂

Railway → GoatBot project → সংশ্লিষ্ট service → **Variables**-এ Agent integration-এর variable configure করা হয়:

| Variable | Value / কাজ |
|---|---|
| `AGENT_BRIDGE_ENABLED` | GoatBot bridge client enable/disable flag |
| `AGENT_WORKER_ENABLED` | worker enable/disable flag |
| `AGENT_BACKEND_URL` | `https://agent-backend-jron.onrender.com` |
| `AGENT_BRIDGE_SECRET` | Render-এর `BRIDGE_SECRET`-এর সঙ্গে হুবহু একই secret |
| `AGENT_WORKSPACE_ROOT` | optional; worker-এর workspace path; না দিলে documented default process working directory |

**গুরুত্বপূর্ণ:** Agent-Backend-এর deployment guide-এ দুই GoatBot flag enable করার কথা আছে। কিন্তু OmegA-Goatbot-এর যে branch/source inspect করা হয়েছে, সেখানে `AGENT_BRIDGE_ENABLED`, `AGENT_WORKER_ENABLED` বা `AGENT_BACKEND_URL` code reference পাওয়া যায়নি। তাই variable যোগ করলেই integration কাজ করবে—এমন ধরে নেবে না। আগে active Railway branch-এর `EryXenX.js`/runtime entry ও worker source-এ integration উপস্থিত আছে কি না যাচাই করবে। Source integration না থাকলে Owner-এর অনুমোদিত code change ছাড়া bridge enable করবে না।

### Shared secret setup

1. Password manager বা trusted random generator দিয়ে ৩২+ character random secret তৈরি করো।
2. Render-এর `BRIDGE_SECRET`-এ সেট করো।
3. Railway-এর `AGENT_BRIDGE_SECRET`-এ একই value বসাও।
4. দুই value হুবহু এক কি না যাচাই করো।
5. Secret কাউকে Messenger-এ পাঠাবে না; source file, commit, screenshot বা এই help file-এ রাখবে না।

## ৫. Sender ID ও permission 👤

- `AGENT_ALLOWED_SENDER_IDS`: কারা Messenger থেকে Agent request পাঠাতে পারবে।
- `AGENT_OWNER_SENDER_IDS`: কারা Messenger-এর Owner-only pending approval, approve এবং reject endpoint ব্যবহার করতে পারবে।
- এক তালিকায় ID থাকা মানে অন্য permission স্বয়ংক্রিয়ভাবে পাওয়া নয়।
- ID comma দিয়ে আলাদা করতে হবে; অপ্রয়োজনীয় space বাদ দিয়ে source config অনুযায়ী trim করা হয়।
- কোনো ব্যক্তির ID অনুমান করে বা পুরোনো নোট থেকে কপি করে বসাবে না; Facebook-এর সঠিক sender ID Owner নিজে যাচাই করবেন।

## ৬. Dashboard, API ও health check 🩺

Agent Backend-এর source-এ পাওয়া route:

| Path | ব্যবহার |
|---|---|
| `/` | Static Owner dashboard |
| `/api/health` | service ও MongoDB connection health |
| `/api/auth` | dashboard authentication |
| `/api/tasks` | authenticated Owner task routes |
| `/api/approvals` | authenticated Owner approval routes |
| `/api/account/status` | authenticated Owner account-status routes |
| `/api/bridge` | signed service-authenticated GoatBot bridge routes |

Health endpoint healthy হলে HTTP 200 এবং database connected দেখায়; database disconnected হলে degraded/503 দেখায়। Render service logs-এ database connection, Owner bootstrap এবং server startup message দেখা যায়।

## ৭. Bridge-এর কাজের ধরন

Backend bridge route-এ request intake, task status, Owner approval এবং worker queue/result flow রয়েছে। Worker-side documented operation-এর মধ্যে workspace file inventory/read, create/edit, backup-সহ delete, restore verification, move/rename, directory operation, JavaScript syntax check, fixed npm operation এবং Owner-approved supervisor restart রয়েছে।

Worker protected path-এ Git metadata, dependency folder, hidden files, credentials, account/appstate/cookie data ও internal backup storage অন্তর্ভুক্ত। Arbitrary shell command বা npm lifecycle script চালানোর ব্যবস্থা documented নয়।

Messenger command name বা prefix branch-specific। Active GoatBot command handler inspect না করে `!agent` বা অন্য কোনো command syntax-কে নিশ্চিত command হিসেবে ব্যবহার করবে না।

## ৮. Security defaults 🔐

বর্তমান Agent config-এ:
- sensitive action-এর আগে Owner approval বাধ্যতামূলক;
- change-এর আগে backup;
- apply-এর আগে test/validation;
- automatic install বন্ধ;
- automatic delete বন্ধ;
- arbitrary shell execution বন্ধ;
- সর্বোচ্চ pending approval: ৫।

এই guardrail bypass করার জন্য environment variable বানাবে না। Cookie/AppState, Facebook password, API key, MongoDB URI, dashboard password ও bridge secret গোপন credential—GitHub-এ commit করবে না। কোনো secret Git history-তে চলে গেলে শুধু file থেকে মুছলেই নিরাপদ হয় না; provider থেকে rotate/revoke করতে হবে।

## ৯. Troubleshooting reference 🧰

| লক্ষণ | কোথায় পরীক্ষা করবে |
|---|---|
| Dashboard খুলছে না | Render service status, deploy logs, `public/index.html`, `server.js` |
| Health degraded | `MONGODB_URI`, MongoDB network access, Render logs |
| Owner login হচ্ছে না | existing Owner record, auth route, username/password; bootstrap env existing Owner overwrite করে না |
| AI task plan হচ্ছে না | provider API key, model name, provider quota/availability, task logs |
| Bridge unauthorized | দুই host-এর secret হুবহু মেলে কি না, signed request/time/nonce handling, service logs |
| Messenger sender denied | `AGENT_ALLOWED_SENDER_IDS` এবং সঠিক sender ID |
| Owner approval denied | `AGENT_OWNER_SENDER_IDS` এবং Owner sender ID |
| Worker queue/result আসছে না | Railway active branch-এ worker code আছে কি না, দুই worker flag, backend URL, shared secret, Railway logs |
| পরিবর্তন live হচ্ছে না | GitHub branch, Render/Railway configured branch ও deployed commit আলাদা করে যাচাই |

## ১০. Configuration source index 📚

**Agent-Backend**
- `.env.example` — Render environment variable reference
- `agent/config.js` — app, database, AI provider, bridge ও security config
- `server.js` — startup, dashboard static hosting, routes, health check ও Owner bootstrap
- `agent/routes/bridge.js` — bridge API
- `AGENT_DEPLOYMENT.md` — backend/worker deployment variable reference
- `DEPLOYMENT.md` — runtime, MongoDB ও safe deployment guidance
- `public/` — dashboard UI assets

**OmegA-Goatbot**
- `README.md` — bot setup, account.txt cookie placement, config.json ও Railway/VPS runtime guidance
- `config.json` — bot prefix, adminBot ও runtime options (বর্তমান repository README অনুযায়ী)
- `account.txt` — Facebook session cookie JSON রাখার runtime file; কখনো commit/share করবে না
- `EryXenX.js` / active runtime entry এবং Agent worker source — bridge integration branch-এ থাকলে সেখান থেকে exact implementation যাচাই করবে

---

**Maintained for:** Md SalmaN (NirZon)  
**Projects:** Agent Backend × OmegA-Goatbot  
**Last note:** এই নথি configuration guide; এটি নিজে কোনো deploy, restart বা live setting পরিবর্তন করে না।
