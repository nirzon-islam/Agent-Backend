# 🤖 Agent Setup Help

Agent চালু করার সহজ নিয়ম নিচে দেওয়া হলো।

## যা লাগবে
- GitHub account
- Render account
- MongoDB Atlas
- Gemini / Groq / Cloudflare-এর যেকোনো একটি API key

## 1. Render-এ Deploy
1. [Render](https://render.com/) এ গিয়ে **New → Web Service** নির্বাচন করো।
2. GitHub থেকে `Agent-Backend` repository connect করো।
3. Build command: `npm install`
4. Start command: `npm start`

## 2. Environment Variables

Render-এর **Environment** অপশনে নিচের variable-গুলো যোগ করো। প্রতিটি লাইনের `=`-এর পর নিজের তথ্য বসাবে।

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=তোমার_MongoDB_Connection_URI
ADMIN_USERNAME=তোমার_Admin_Username
ADMIN_PASSWORD=তোমার_নিরাপদ_Password

GEMINI_API_KEY=তোমার_Gemini_API_Key
GEMINI_MODEL=gemini-2.5-flash

GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b

CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_MODEL=

BRIDGE_ENABLED=false
BRIDGE_SECRET=
AGENT_ALLOWED_SENDER_IDS=
WEBSITE_ORIGINS=
```

**মনে রাখবে:**
- Gemini, Groq অথবা Cloudflare—কমপক্ষে একটি AI provider-এর API key দিতে হবে।
- যে provider ব্যবহার করবে, শুধু তার key পূরণ করলেই হবে।
- GoatBot Bridge ব্যবহার না করলে `BRIDGE_ENABLED=false` রাখবে।
- Bridge চালু করলে `BRIDGE_SECRET`-এ 32+ character-এর random secret দেবে; GoatBot-এও একই secret লাগবে।
- MongoDB URI-তে নিজের database username ও password বসাবে।

## 3. Deploy শেষ হলে
Render-এর দেওয়া URL খুলে Admin username ও password দিয়ে login করো।

## দরকারি লিংক 🔗
- [Agent Backend Repository](https://github.com/nirzon-islam/Agent-Backend)
- [GoatBot Repository](https://github.com/nirzon-islam/OmegA-Goatbot)
- [MongoDB Atlas](https://www.mongodb.com/atlas)
- [Google AI Studio](https://aistudio.google.com/)
- [Groq Console](https://console.groq.com/)

🔐 API key, password ও database URI কখনো GitHub-এ প্রকাশ করবে না।
