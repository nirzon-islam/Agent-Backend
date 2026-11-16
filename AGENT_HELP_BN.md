# 🤖 Agent Setup Help (বাংলা)

এই guide অনুযায়ী Agent Backend-এর `main` branch Render-এ deploy করো। GoatBot আলাদা Railway/VPS service হিসেবে চলে।

## যা লাগবে

- GitHub ও Render account
- MongoDB Atlas (replica-set transaction support সহ)
- Owner username ও strong password
- AI provider-এর API key (dashboard-এ configure করবে)

## 1. Render-এ Deploy

1. Render → **New → Web Service** নির্বাচন করো।
2. GitHub থেকে `nirzon-islam/Agent-Backend` connect করে `main` branch নির্বাচন করো।
3. Build command: `npm install`
4. Start command: `npm start`
5. Health check path: `/api/health`

## 2. Environment Variables

Render-এর **Environment**-এ নিচের variable যোগ করো:

```env
NODE_ENV=production
MONGODB_URI=তোমার_MongoDB_Connection_URI
ADMIN_USERNAME=তোমার_Admin_Username
ADMIN_PASSWORD=তোমার_Strong_Password
AI_SETTINGS_ENCRYPTION_KEY=64_hex_character_random_key

BRIDGE_ENABLED=false
BRIDGE_SECRET=
AGENT_ALLOWED_SENDER_IDS=
AGENT_OWNER_SENDER_IDS=
WEBSITE_ORIGINS=
```

- Username 3–40 অক্ষরের lowercase letter, number, underscore বা hyphen হতে হবে।
- Password 8–128 অক্ষর; 12+ অক্ষর ব্যবহার করো।
- `AI_SETTINGS_ENCRYPTION_KEY` হবে 32 random byte-এর 64-character hex value। এটা হারালে dashboard-এ save করা provider key decrypt করা যাবে না—নিরাপদ backup রাখবে।
- AI provider key ও model Owner Dashboard-এর Main/Fallback/Backup slot-এ configure করবে; অপ্রয়োজনীয় provider environment variable যোগ কোরো না।
- MongoDB অবশ্যই transaction support করবে।

## 3. Deploy যাচাই

1. Deploy শেষ হলে startup logs-এ database connected এবং Owner bootstrap status দেখো।
2. `/api/health` খুলে HTTP 200 এবং database connected নিশ্চিত করো।
3. Dashboard-এ Owner credentials দিয়ে login করো।
4. অন্তত একটি AI provider configure করে Test করো।

## 4. GoatBot Bridge (ঐচ্ছিক)

`BRIDGE_ENABLED=false` রেখো যতক্ষণ না exact GoatBot revision-এর সঙ্গে signed bridge, authorization, Messenger intake, approval এবং database-backed integration test সম্পন্ন হয়। Bridge চালু করলে backend-এ 32+ character random `BRIDGE_SECRET` দিতে হবে এবং GoatBot-এর compatible configuration-এ একই secret দিতে হবে। GoatBot-এর variable name code দেখে নিশ্চিত না হয়ে অনুমান কোরো না।

শুধু দুইটি repository deploy করলেই connection তৈরি হয় না। Facebook account reconnect বা account switch-ও live test ছাড়া successful ধরে নেবে না।

## নিরাপত্তা

- Facebook cookies/AppState, API key, password বা MongoDB URI কাউকে দেবে না।
- কোনো secret GitHub-এ commit কোরো না।
- Git history-তে secret চলে গেলে শুধু file থেকে মুছলেই হবে না—provider থেকে rotate/revoke করবে।
- Facebook checkpoint বা manual verification লাগতে পারে।
