# 🤖 Agent Setup Help

এই গাইডটি Agent প্রথমবার ব্যবহার বা সেটআপ করার জন্য।

## কী কী লাগবে?
- GitHub account
- Render account
- MongoDB database
- যেকোনো একটি AI provider-এর API key

## Setup

1. **Agent Backend** repository Render-এ Web Service হিসেবে deploy করো।
2. Render-এর Environment-এ `.env.example`-এ থাকা প্রয়োজনীয় variable যোগ করো।
3. MongoDB connection URI এবং dashboard login details সেট করো।
4. Gemini, Groq অথবা Cloudflare-এর যেকোনো একটি AI provider configure করো।
5. Deploy শেষ হলে Agent-এর dashboard খোলো এবং login করো।

## দরকারি লিংক 🔗

- [Agent Backend Repository](https://github.com/nirzon-islam/Agent-Backend)
- [GoatBot Repository](https://github.com/nirzon-islam/OmegA-Goatbot)
- [Render](https://render.com/)
- [MongoDB Atlas](https://www.mongodb.com/atlas)
- [Google AI Studio](https://aistudio.google.com/)
- [Groq Console](https://console.groq.com/)

## মনে রাখবে 🔐

- নিজের API key, database URI ও password গোপন রাখবে।
- কোনো secret GitHub-এ upload করবে না।
- Render Free service কিছু সময় inactive থাকলে sleep করতে পারে।
- GoatBot-এর সঙ্গে সংযোগ ব্যবহার করতে চাইলে GoatBot setup guide অনুসরণ করো।

---

**Agent Backend — Setup Guide**
