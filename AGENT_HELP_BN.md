# 🤖 Agent Setup Help — বাংলা গাইড

**প্রকল্প:** Agent Backend  
**Owner / Creator:** Md SalmaN (NirZon)  
**GitHub:** https://github.com/nirzon-islam/Agent-Backend  
**GoatBot repository:** https://github.com/nirzon-islam/OmegA-Goatbot

এই ফাইলটি Agent-এর সেটিংস, Messenger সংযোগ, নিরাপত্তা এবং বাকি কাজগুলো মনে রাখার জন্য। এখানে কোনো আসল password, API key, Facebook cookie বা bridge secret রাখা যাবে না।

---

## ১) কোন Repository কোথায়?

- **Agent Backend:** `nirzon-islam/Agent-Backend` — Agent-এর API, AI planner, approval system এবং dashboard।
- **GoatBot:** `nirzon-islam/OmegA-Goatbot` — Messenger bot/runtime; Agent-এর সঙ্গে secure bridge দিয়ে যোগাযোগ করবে।
- **GitHub account/owner:** `nirzon-islam`।
- **Project owner:** Md SalmaN (NirZon)।

Agent-এর মূল backend code Agent-Backend repository-তেই থাকবে। GoatBot repository-তে শুধু bot-side bridge/worker integration থাকবে।

## ২) Render — Agent Backend Environment

Render-এর **Agent-Backend Web Service → Environment**-এ নিচের variable-গুলো যাচাই/সেট করতে হবে:

| Variable | কী দিতে হবে |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Render-এর দেওয়া port; hardcode নয় |
| `MONGODB_URI` | MongoDB Atlas replica-set connection URI |
| `ADMIN_USERNAME` | Owner dashboard-এর username (৩–৪০ অক্ষর; lowercase, number, _ বা -) |
| `ADMIN_PASSWORD` | Unique password, ১২–১২৮ অক্ষর |
| `GEMINI_API_KEY` | Gemini API key |
| `GEMINI_MODEL` | `gemini-2.5-flash` (বর্তমান default) |
| `GROQ_API_KEY` | Groq fallback API key, ব্যবহার করতে চাইলে |
| `GROQ_MODEL` | `openai/gpt-oss-120b` (বর্তমান default) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare ব্যবহার করলে |
| `CLOUDFLARE_API_TOKEN` | Cloudflare ব্যবহার করলে |
| `CLOUDFLARE_MODEL` | Cloudflare ব্যবহার করলে |
| `BRIDGE_ENABLED` | এখন `false` রাখো; integration test শেষ না হওয়া পর্যন্ত enable নয় |
| `BRIDGE_SECRET` | পরে bridge চালুর সময় random ৩২+ character secret |
| `AGENT_ALLOWED_SENDER_IDS` | অনুমোদিত Messenger sender ID-গুলোর comma-separated তালিকা |
| `AGENT_OWNER_SENDER_IDS` | Owner-এর Messenger sender ID; comma-separated |
| `WEBSITE_ORIGINS` | Dashboard আলাদা origin-এ host করা হলে exact origin |

**গুরুত্বপূর্ণ:** `AGENT_ALLOWED_SENDER_IDS` আর `AGENT_OWNER_SENDER_IDS` আলাদা কাজ করে। প্রথমটি Agent-এ request পাঠাতে পারবে কারা, দ্বিতীয়টি Messenger থেকে pending approval দেখা/approve/reject করতে পারবে কারা—তা নিয়ন্ত্রণ করে।

Owner Messenger sender ID (বর্তমান নোট): `61561645647195`। Render-এ `AGENT_OWNER_SENDER_IDS`-এ এটি বসাতে হবে; request পাঠানোর অনুমতি দিতে চাইলে `AGENT_ALLOWED_SENDER_IDS`-এও রাখতে হবে।

## ৩) Railway — GoatBot Environment

OmegA-Goatbot যে Railway service-এ চলছে, তার **Variables**-এ bridge integration চালুর আগে এগুলো যাচাই করতে হবে:

| Variable | কী দিতে হবে |
|---|---|
| `AGENT_BRIDGE_ENABLED` | integration test শেষ না হওয়া পর্যন্ত `false` |
| `AGENT_WORKER_ENABLED` | integration test শেষ না হওয়া পর্যন্ত `false` |
| `AGENT_BACKEND_URL` | Agent Backend Render URL: `https://agent-backend-jron.onrender.com` |
| `AGENT_BRIDGE_SECRET` | Render-এর `BRIDGE_SECRET`-এর সঙ্গে হুবহু একই secret |
| `AGENT_ALLOWED_SENDER_IDS` | অনুমোদিত Messenger sender ID-গুলোর তালিকা |
| `AGENT_OWNER_SENDER_IDS` | Owner sender ID-র তালিকা, যদি bot-side code এই variable ব্যবহার করে |

Bridge চালু করার সময় দুই পাশে secret একদম একই হতে হবে। Secret কখনো Messenger chat, source code, GitHub file বা screenshot-এ দেবে না।

## ৪) Messenger থেকে Agent ব্যবহার

বর্তমান পরিকল্পিত command:

- `!agent <request>` — Agent-কে কাজের অনুরোধ পাঠানো।
- `!agent pending` — Owner-এর pending approval দেখা।
- `!agent approve <taskId বা approvalId>` — নির্দিষ্ট কাজ অনুমোদন।
- `!agent reject <taskId বা approvalId>` — নির্দিষ্ট কাজ বাতিল।
- `!agent status <taskId>` — নিজের পাঠানো task-এর status দেখা।

কমান্ডগুলো live bot-এ কাজ করছে—এমন ধরে নেওয়া যাবে না; Messenger-to-Agent end-to-end test দিয়ে নিশ্চিত করতে হবে। Prefix/command routing এবং bot-side bridge handler deploy করা আছে কি না আগে যাচাই করো।

## ৫) AI Provider ও আগের Error

Gemini planner-এ আগে `503: This model is currently experiencing high demand` এবং timeout দেখা গিয়েছিল। তাই:

1. Render Environment-এ `GEMINI_API_KEY` সত্যিই আছে কি না যাচাই করো।
2. Groq fallback ব্যবহার করতে চাইলে `GROQ_API_KEY` সেট করো।
3. Render logs-এ provider error এবং fallback attempt দেখো।
4. ছোট, নিরাপদ read-only request দিয়ে planner পরীক্ষা করো।
5. Provider সফল না হলে একই request বারবার পাঠিও না।

শুধু model name থাকলেই provider সক্রিয় হয় না; valid API key এবং provider availability দরকার।

## ৬) নিরাপত্তা ও Approval নিয়ম

- প্রতিটি sensitive action-এর আগে Owner approval বাধ্যতামূলক।
- পরিবর্তনের আগে backup এবং apply করার আগে validation/test থাকতে হবে।
- Arbitrary shell command execution বন্ধ থাকবে।
- Automatic delete/install চালু করা যাবে না; প্রয়োজন হলে explicit approval এবং code review লাগবে।
- Facebook cookie, AppState, password, API key, MongoDB URI বা bridge secret কখনো GitHub-এ commit করা যাবে না।
- Facebook cookie password-এর মতো গোপনীয়; শুধু অনুমোদিত secure recovery/login flow ব্যবহার করবে।
- Database অবশ্যই MongoDB replica-set/Atlas compatible হতে হবে, কারণ approval workflow transaction ব্যবহার করে।

## ৭) এখন কী কী বাকি — Checklist

- [ ] Render Environment-এর required variables যাচাই।
- [ ] MongoDB Atlas URI এবং replica-set transaction support নিশ্চিত।
- [ ] Gemini key পরীক্ষা এবং Groq fallback configure/verify।
- [ ] Owner dashboard login পরীক্ষা।
- [ ] `AGENT_ALLOWED_SENDER_IDS` ও `AGENT_OWNER_SENDER_IDS` দুই জায়গায় সঠিকভাবে configure।
- [ ] GoatBot branch-এর bridge/worker code এবং environment variable মিলিয়ে দেখা।
- [ ] Messenger-এর `!agent`, pending, approve, reject, status command end-to-end test।
- [ ] Account heartbeat/status এবং cookie recovery flow নিরাপদে test।
- [ ] Backup, validation, approval, rollback test।
- [ ] সব test pass না করা পর্যন্ত bridge/worker disabled রাখা।

**Deploy সতর্কতা:** আগে code, environment, database এবং integration test review করতে হবে। Owner-এর স্পষ্ট অনুমতি ছাড়া Railway বা Render deploy/restart করা যাবে না।

---

**Maintained by:** Md SalmaN (NirZon)  
**Project:** Agent Backend × OmegA-Goatbot  
