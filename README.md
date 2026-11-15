# 🤖 Agent Backend by NirZon

### A Secure AI-Powered Autonomous Coding Assistant for GoatBot Messenger

Agent Backend is an AI-powered assistant designed to manage, analyze, debug, and maintain GoatBot projects through a web-based interface and Facebook Messenger.

It connects a dedicated AI backend with an existing GoatBot runtime, allowing users to communicate with one assistant from multiple platforms.

---

## ✨ Features

- 🌐 **Web-Based AI Chat Interface**
- 💬 **Facebook Messenger Integration**
- 🧠 **Gemini AI** — Primary AI
- ⚡ **Groq** — First Fallback
- ☁️ **Cloudflare Workers AI** — Additional Fallback
- 🔍 Automatic Code Analysis and Debugging
- 🛠️ Command Creation and Editing
- 📦 Command Installation and Deletion Management
- 🔐 Approval-Based Execution System
- 💾 Automatic Backups Before Modifications
- ↩️ Rollback Support
- 📋 Task History and Activity Logs
- 🔗 Secure Railway-to-Render Communication
- 🔄 **Facebook ID Reconnection** — Reconnect the GoatBot Facebook account through the Agent interface by securely providing updated login/session information, including a refreshed session cookie (AppState), with verification before the bot resumes.

---

## 🏗️ Architecture

```text
             USER
          /       \
     WEBSITE    MESSENGER
          \       /
       AGENT BACKEND
          (RENDER)
              |
       AI & TASK MANAGER
              |
      APPROVAL & SECURITY
              |
       SECURE API BRIDGE
              |
       GOATBOT (RAILWAY)
              |
        PROJECT FILES
```
---

## License

Copyright (c) 2026 Md SalmaN(NirZon).

All rights reserved.

Unauthorized copying, modification, distribution, or commercial use of this project is prohibited without prior written permission from the copyright owner.

---

## 🧠 AI Providers

The Owner dashboard includes three configurable AI slots: **Main**, **Fallback**, and **Backup**. Each slot supports Google Gemini or any public HTTPS OpenAI-compatible API (for example OpenRouter, Groq, DeepSeek, Together, or compatible hosted endpoints). The planner tries enabled slots in order and proceeds to the next slot when a provider fails or returns invalid JSON. A structurally unsafe planner response is rejected rather than silently retried.

To save dashboard API keys, set `AI_SETTINGS_ENCRYPTION_KEY` in Render Environment to a securely generated 64-character hexadecimal value (32 random bytes). Keys are encrypted at rest with AES-256-GCM; the dashboard only displays a masked hint. Keep this encryption key backed up securely. Losing it makes saved provider keys unreadable. Never commit the key to GitHub.

Only the Owner can view or change provider settings. Use **Save AI Settings** and then **Test** each enabled slot. Base URLs must use public HTTPS hosts; localhost and private IP destinations are blocked.



| Provider | Purpose |
|---|---|
| Gemini | Primary AI |
| Groq | First Fallback |
| Cloudflare Workers AI | Additional Fallback |

**Note:** The project aims to use free API tiers. Availability and usage are subject to each provider's limits.

---

## 🔐 Security

Security is a core part of this project.

- No sensitive modifications without explicit user approval.
- Backup before applying code changes.
- Review changes before execution.
- Validate code before applying changes.
- Restricted project-file access.
- Secure API communication.
- Task and approval tracking.
- Rollback support for recoverable changes.
- Facebook login credentials and session cookies must be handled securely, never exposed in logs or task history, and used only for the explicitly approved reconnection process.

> **The agent must never independently execute destructive or sensitive operations without authorization.**

---

## ☁️ Deployment

| Component | Platform |
|---|---|
| Source Code | GitHub |
| Agent Backend | Render |
| Existing GoatBot | Railway |
| Database | Free-Tier External Database |
| AI Providers | Free API Tiers |

---

## 🚧 Development Status

**Current Status: Under Development**

### Development Roadmap

- [x] Initial Configuration
- [x] Security Foundation
- [x] Approval System Foundation
- [ ] Persistent Task Management
- [ ] AI Provider Integration
- [ ] Backend API
- [ ] Website Interface
- [ ] Railway Runtime Bridge
- [ ] Messenger Integration
- [ ] Facebook ID Reconnection Flow
- [ ] Backup and Rollback Engine
- [ ] Full Security Testing

---

## ⚠️ Important Notes

- This project follows a security-first approach.
- Render Free services may sleep when inactive.
- Free AI providers have rate limits.
- Persistent database storage is required for reliable task history.
- Facebook authentication and session recovery may require manual verification.
- Facebook ID reconnection depends on valid, current login/session information and may require completing Facebook security checks or checkpoints.

---

## 📜 License

License and distribution terms will be defined before public release.

---

### 💜 Built for Secure, Controlled, AI-Powered GoatBot Management.
