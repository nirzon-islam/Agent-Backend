"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const themeStorageKey = "agent_dashboard_theme";
  function applyTheme(theme) {
    const selected = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = selected;
    const light = selected === "light";
    const toggle = $("themeToggle");
    if (toggle) {
      toggle.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
      toggle.title = light ? "Switch to dark theme" : "Switch to light theme";
    }
    if ($("themeIcon")) $("themeIcon").textContent = light ? "🌙" : "☀️";
    if ($("themeLabel")) $("themeLabel").textContent = light ? "Dark mode" : "Light mode";
    const meta = $("themeColorMeta");
    if (meta) meta.setAttribute("content", light ? "#f3f6fc" : "#080d18");
  }
  const savedTheme = localStorage.getItem(themeStorageKey);
  applyTheme(savedTheme || (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
  document.addEventListener("DOMContentLoaded", () => {
    const toggle = $("themeToggle");
    if (toggle) toggle.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      localStorage.setItem(themeStorageKey, next);
      applyTheme(next);
    });
  });
  let token = sessionStorage.getItem("agent_owner_token") || "";
  const headers = () => ({ "content-type": "application/json", authorization: "Bearer " + token });
  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed (" + response.status + ")");
    return data;
  }
  function safe(value) { return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[ch])); }
  function showApp(yes) { $("loginPanel").hidden = yes; $("appPanel").hidden = !yes; $("connection").textContent = yes ? "Connected" : "Offline"; $("connection").className = "pill " + (yes ? "pill-good" : ""); }
  function feedback(id, message, kind = "info") {
    const el = $(id); el.textContent = message; el.className = "feedback " + kind;
    el.setAttribute("aria-live", kind === "error" ? "assertive" : "polite");
  }
  function setView(view) {
    const views = {home:"Home",ai:"AI Settings",approvals:"Approvals",tasks:"Agent Tasks"};
    const selected = views[view] ? view : "home";
    for (const [key,id] of Object.entries({home:"homeView",ai:"aiView",approvals:"approvalsView",tasks:"tasksView"})) $(id).hidden = key !== selected;
    $("viewTitle").textContent = views[selected];
    document.querySelectorAll(".navItem").forEach(button => {
      const active = button.dataset.view === selected;
      button.classList.toggle("active",active);
      button.setAttribute("aria-current",active ? "page" : "false");
    });
    $("sectionMenu").hidden = true;
    $("menuToggle").setAttribute("aria-expanded","false");
  }
  function updateHomeNotice(approvalCount) {
    const notice=$("homeNotice");
    const hasPendingApprovals=Number(approvalCount)>0;
    notice.hidden=!hasPendingApprovals;
    notice.textContent=hasPendingApprovals
      ? "🔔 "+approvalCount+" approval"+(approvalCount===1?"":"s")+" waiting for your review — open Approvals."
      : "";
    $("approvalNavDot").hidden=!hasPendingApprovals;
    $("taskNavDot").hidden=true;
  }
  function busy(button, yes, busyText, idleText) {
    button.disabled = yes; button.classList.toggle("is-loading", yes);
    button.textContent = yes ? busyText : idleText;
    button.setAttribute("aria-busy", String(yes));
  }

  const aiSlotNames = ["main","fallback","backup"];
  let aiSettingsLoaded = false;
  async function loadAISettings() {
    if (aiSettingsLoaded) return;
    const data = await api("/api/ai-settings/");
    for (const name of aiSlotNames) {
      const slot = data.slots?.[name] || {};
      $("ai-"+name+"-enabled").checked = !!slot.enabled;
      $("ai-"+name+"-provider").value = slot.provider || "openai-compatible";
      $("ai-"+name+"-model").value = slot.model || "";
      $("ai-"+name+"-url").value = slot.baseUrl || "";
      $("ai-"+name+"-key").value = "";
      $("ai-"+name+"-clear").checked = false;
      $("ai-"+name+"-hint").textContent = slot.configured ? "Saved key ••••"+(slot.keyHint || "") : "No key saved";
    }
    aiSettingsLoaded = true;
  }
  $("saveAISettings").addEventListener("click", async () => {
    const button=$("saveAISettings"); busy(button,true,"Saving…","Save AI Settings");
    try {
      const slots={};
      for (const name of aiSlotNames) slots[name]={
        enabled:$("ai-"+name+"-enabled").checked,
        provider:$("ai-"+name+"-provider").value,
        model:$("ai-"+name+"-model").value.trim(),
        baseUrl:$("ai-"+name+"-url").value.trim(),
        apiKey:$("ai-"+name+"-key").value,
        clearApiKey:$("ai-"+name+"-clear").checked
      };
      const result=await api("/api/ai-settings/",{method:"PUT",body:JSON.stringify({slots})});
      for (const name of aiSlotNames) $("ai-"+name+"-key").value="";
      feedback("aiSettingsMessage",result.message || "Saved.","success");
      await loadAISettings();
    } catch(error) { feedback("aiSettingsMessage",error.message,"error"); }
    finally { busy(button,false,"Saving…","Save AI Settings"); }
  });
  $("aiSettingsPanel").addEventListener("click", async event => {
    const button=event.target.closest("button[data-ai-test]");
    if (!button) return;
    const slot=button.dataset.aiTest;
    button.disabled=true;
    try {
      const result=await api("/api/ai-settings/test",{method:"POST",body:JSON.stringify({slot})});
      feedback("aiSettingsMessage",result.message,"success");
    } catch(error) { feedback("aiSettingsMessage",slot+" test failed: "+error.message,"error"); }
    finally { button.disabled=false; }
  });

  let previousAccountState = "";
  let activeRecoveryRequestId = "";
  async function refreshAccountStatus() {
    const data = await api("/api/account/status");
    const account = data.account || {};
    const sessionState = account.sessionState || account.state || "unknown";
    const workerState = account.workerState || "unknown";
    const sessionLabels = { online: "Logged in", logged_out: "Logged out", checkpoint: "Checkpoint required", error: "Login error", unknown: "Unknown" };
    const workerLabels = { online: "Online", offline: "Offline", unknown: "Unknown" };
    $("workerState").textContent = workerLabels[workerState] || workerState;
    $("workerState").className = "status " + (workerState === "online" ? "state-good" : (workerState === "offline" ? "state-bad" : ""));
    $("accountState").textContent = sessionLabels[sessionState] || sessionState;
    $("accountState").className = "status " + (sessionState === "online" ? "state-good" : (["logged_out", "checkpoint", "error"].includes(sessionState) ? "state-bad" : ""));
    $("accountMessage").textContent = account.message || (sessionState === "online" ? "Facebook authentication is active." : "Facebook authentication is not confirmed.");
    $("accountId").textContent = account.accountId || "Not reported";
    $("recoveryFormPanel").hidden = false;
    $("accountHeartbeat").textContent = account.lastHeartbeatAt ? new Date(account.lastHeartbeatAt).toLocaleString() : "—";
    $("recoveryNote").textContent = data.recovery?.note || "Complete any Facebook security checks manually.";
    if (previousAccountState && previousAccountState !== sessionState && sessionState !== "online" && "Notification" in window && Notification.permission === "granted") new Notification("Agent account alert", { body: "Facebook bot session: " + (sessionLabels[sessionState] || sessionState) });
    previousAccountState = sessionState;
  }
  $("enableNotifications").addEventListener("click", async () => {
    if (!("Notification" in window)) { $("notificationMessage").textContent = "Browser notifications are not supported."; return; }
    const permission = await Notification.requestPermission();
    $("notificationMessage").textContent = permission === "granted" ? "Browser alerts enabled." : "Notification permission was not granted.";
  });
  $("loginForm").addEventListener("submit", async event => {
    event.preventDefault(); feedback("loginMessage", "Signing in…", "info");
    try {
      const response = await fetch("/api/auth/login", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({username:$("username").value,password:$("password").value}) });
      const data = await response.json();
      if (!response.ok || !data.token) throw new Error(data.message || "Login failed");
      token = data.token; sessionStorage.setItem("agent_owner_token", token); $("password").value = "";
      showApp(true); await refresh();
    } catch(error) { feedback("loginMessage", error.message, "error"); }
  });
  function renderApprovals(items) {
    $("pendingCount").textContent = items.length;
    updateHomeNotice(items.length);
    $("approvals").innerHTML = items.length ? items.map(item => `<article class="item"><div class="itemTop"><strong>Approval • ${safe(item.approvalId)}</strong><span class="status">${safe(item.status)}</span></div><p>Task: ${safe(item.taskId)}<br>Requested by: ${safe(item.requestedBy)}<br>Expires: ${safe(item.expiresAt)}</p><pre>${safe(JSON.stringify(item.action,null,2))}</pre><div class="actions"><button class="approve" data-action="approve" data-id="${safe(item.approvalId)}">Approve</button><button class="reject" data-action="reject" data-id="${safe(item.approvalId)}">Reject</button></div></article>`).join("") : '<p class="muted">No pending approvals.</p>';
  }
  function renderTasks(items) {
    $("taskCount").textContent = items.length;
    $("tasks").innerHTML = items.length ? items.map(task => {
      let parsed = null;
      try { parsed = typeof task.result === "string" ? JSON.parse(task.result) : task.result; } catch {}
      const files = Array.isArray(parsed?.downloadableFiles) ? parsed.downloadableFiles : [];
      const displayResult = parsed?.output !== undefined ? parsed.output : task.result;
      return `<article class="item"><div class="itemTop"><strong>${safe(task.type)} • ${safe(task.status)}</strong><span class="status">${safe(task.source)}</span></div><p>${safe(task.description)}</p><div class="meta">Task ID: ${safe(task.taskId)} • ${safe(new Date(task.createdAt).toLocaleString())}</div>${task.error ? `<p class="message">${safe(task.error)}</p>` : ""}${displayResult ? `<pre>${safe(typeof displayResult === "string" ? displayResult : JSON.stringify(displayResult,null,2))}</pre>` : ""}${files.map((file,index) => `<button class="downloadFile" data-task="${safe(task.taskId)}" data-index="${index}">Download ${safe(file.path)}</button>`).join(" ")}</article>`;
    }).join("") : '<p class="muted">No tasks yet. Send a request with !agent in Messenger.</p>';
  }
  $("tasks").addEventListener("click", async event => {
    const button = event.target.closest("button.downloadFile");
    if (!button) return;
    button.disabled = true;
    try {
      const response = await fetch("/api/tasks/" + encodeURIComponent(button.dataset.task) + "/files/" + button.dataset.index, { headers: headers() });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || "Download failed"); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = button.textContent.replace(/^Download /, "").split("/").pop() || "agent-file.txt";
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { alert(error.message); }
    finally { button.disabled = false; }
  });

  async function refresh() {
    const button=$("refreshBtn");
    if (button && !button.disabled) busy(button,true,"Refreshing…","↻ Refresh");
    feedback("refreshMessage","Updating dashboard…","loading");
    try {
      const [approvals,tasks] = await Promise.all([api("/api/approvals/"),api("/api/tasks/?limit=50")]);
      renderApprovals(approvals.approvals || []); renderTasks(tasks.tasks || []);
      await refreshAccountStatus();
      await loadAISettings();
      $("connection").textContent = "Connected"; $("connection").className = "pill pill-good";
      feedback("refreshMessage","✓ Updated just now","success");
    } catch(error) {
      if (/session|authentication|invalid/i.test(error.message)) { token="";sessionStorage.removeItem("agent_owner_token");showApp(false); }
      $("connection").textContent = "Connection issue"; $("connection").className = "pill pill-bad";
      feedback("refreshMessage","Refresh failed: "+error.message,"error");
      feedback("loginMessage",error.message,"error");
    } finally { if (button) busy(button,false,"Refreshing…","↻ Refresh"); }
  }

  async function refreshRecoveryProgress() {
    if (!activeRecoveryRequestId || !token) return;
    try {
      const data = await api("/api/account/status/recovery/" + encodeURIComponent(activeRecoveryRequestId));
      const recovery = data.recovery;
      const timeline = $("recoveryTimeline");
      timeline.innerHTML = (recovery.events || []).map(event =>
        "<li><strong>" + safe(event.state.replace(/_/g, " ")) + "</strong> · " +
        safe(new Date(event.at).toLocaleString()) + " — " + safe(event.message) + "</li>"
      ).join("");
      const terminal = ["online", "checkpoint", "error", "expired"].includes(recovery.state);
      if (terminal) activeRecoveryRequestId = "";
    } catch (error) {
      if (!/not found/i.test(error.message)) console.warn("Recovery progress unavailable");
    }
  }

  $("recoveryForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = $("submitRecovery");
    const cookie = $("recoveryCookie").value;
    if (!cookie.trim()) return;
    busy(button, true, "Sending securely…", "Login with Facebook Cookie");
    feedback("recoveryMessage", "Sending one-time Facebook login handoff…", "loading");
    try {
      const result = await api("/api/account/status/recovery", {
        method: "POST",
        body: JSON.stringify({ cookie })
      });
      $("recoveryCookie").value = "";
      activeRecoveryRequestId = result.requestId || "";
      if (result.botId) $("accountMessage").textContent = "Detected Facebook Bot ID: " + result.botId + ". Login handoff queued.";
      await refreshRecoveryProgress();
      feedback("recoveryMessage", (result.message || "Facebook login handoff queued.") + " Keep this page open and check the bot status.", "success");
      await refreshAccountStatus();
    } catch (error) {
      feedback("recoveryMessage", error.message, "error");
    } finally { busy(button, false, "Sending securely…", "Login with Facebook Cookie"); }
  });

  $("requestForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = $("submitRequest");
    const description = $("requestDescription").value.trim();
    if (description.length < 3) return;
    busy(button, true, "Sending to AI…", "Ask AI to plan");
    feedback("requestMessage", "Sending request to AI planner…", "loading");
    try {
      const response = await api("/api/tasks/", {
        method: "POST",
        body: JSON.stringify({ description })
      });
      $("requestDescription").value = "";
      feedback("requestMessage", response.task?.status === "awaiting_approval"
        ? "AI plan ready — sent to your Approval Queue."
        : (response.message || "Request received."), response.task?.status === "failed" ? "error" : "success");
      await refresh();
    } catch (error) {
      feedback("requestMessage", error.message, "error");
    } finally {
      busy(button, false, "Sending to AI…", "Ask AI to plan");
    }
  });
  $("approvals").addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]"); if (!button) return;
    button.disabled = true;
    try { await api("/api/approvals/" + encodeURIComponent(button.dataset.id) + "/" + button.dataset.action, {method:"POST",body:"{}"}); await refresh(); }
    catch(error) { alert(error.message); button.disabled=false; }
  });
  $("refreshBtn").addEventListener("click", () => { if (!$("refreshBtn").disabled) void refresh(); });
  $("menuToggle").addEventListener("click", () => { const menu=$("sectionMenu"), opening=menu.hidden; menu.hidden=!opening; $("menuToggle").setAttribute("aria-expanded",String(opening)); });
  $("sectionMenu").addEventListener("click", event => { const button=event.target.closest(".navItem"); if (button) setView(button.dataset.view); });
  setView("home");
  setInterval(() => { if (token && activeRecoveryRequestId && !document.hidden) void refreshRecoveryProgress(); }, 3000);
  $("logoutBtn").addEventListener("click", () => { token="";sessionStorage.removeItem("agent_owner_token");showApp(false); });
  if (token) { showApp(true); refresh(); setInterval(() => { if (token && !document.hidden) refresh(); }, 15000); } else showApp(false);
})();
