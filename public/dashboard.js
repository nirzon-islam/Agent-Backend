"use strict";
(() => {
  const $ = id => document.getElementById(id);
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
  function busy(button, yes, busyText, idleText) {
    button.disabled = yes; button.classList.toggle("is-loading", yes);
    button.textContent = yes ? busyText : idleText;
    button.setAttribute("aria-busy", String(yes));
  }
  let previousAccountState = "";
  let activeRecoveryRequestId = "";
  async function refreshAccountStatus() {
    const data = await api("/api/account/status");
    const account = data.account || {};
    const state = account.state || "unknown";
    const labels = { online: "Online", logged_out: "Logged out", checkpoint: "Checkpoint required", error: "Login error", unknown: "Not connected" };
    $("accountState").textContent = labels[state] || state;
    $("accountState").className = "status " + (state === "online" ? "state-good" : (["logged_out", "checkpoint", "error"].includes(state) ? "state-bad" : ""));
    $("accountMessage").textContent = account.message || (state === "online" ? "Bot session is reporting as active." : "No current bot session heartbeat.");
    $("accountId").textContent = account.accountId || "Not reported";
    if (account.accountId && !$("recoveryBotId").value) $("recoveryBotId").value = account.accountId;
    $("recoveryFormPanel").hidden = !["logged_out", "error", "unknown"].includes(state);
    $("accountHeartbeat").textContent = account.lastHeartbeatAt ? new Date(account.lastHeartbeatAt).toLocaleString() : "—";
    $("recoveryNote").textContent = data.recovery?.note || "Complete any Facebook security checks manually.";
    if (previousAccountState && previousAccountState !== state && state !== "online" && "Notification" in window && Notification.permission === "granted") new Notification("Agent account alert", { body: "Facebook bot account status: " + (labels[state] || state) });
    previousAccountState = state;
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
    try {
      const [approvals,tasks] = await Promise.all([api("/api/approvals/"),api("/api/tasks/?limit=50")]);
      renderApprovals(approvals.approvals || []); renderTasks(tasks.tasks || []);
      await refreshAccountStatus();
      $("connection").textContent = "Connected"; $("connection").className = "pill pill-good";
    } catch(error) {
      if (/session|authentication|invalid/i.test(error.message)) { token="";sessionStorage.removeItem("agent_owner_token");showApp(false); }
      $("connection").textContent = "Connection issue"; $("connection").className = "pill pill-bad"; feedback("loginMessage", error.message, "error");
    }
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
    const botId = $("recoveryBotId").value.trim();
    const cookie = $("recoveryCookie").value;
    if (!botId || !cookie.trim()) return;
    busy(button, true, "Sending securely…", "Send secure recovery");
    feedback("recoveryMessage", "Sending one-time recovery handoff…", "loading");
    try {
      const result = await api("/api/account/status/recovery", {
        method: "POST",
        body: JSON.stringify({ botId, cookie })
      });
      $("recoveryCookie").value = "";
      activeRecoveryRequestId = result.requestId || "";
      await refreshRecoveryProgress();
      feedback("recoveryMessage", (result.message || "Recovery handoff queued.") + " Keep this page open and check the bot status.", "success");
      await refreshAccountStatus();
    } catch (error) {
      feedback("recoveryMessage", error.message, "error");
    } finally { busy(button, false, "Sending securely…", "Send secure recovery"); }
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
  $("refreshBtn").addEventListener("click", refresh);
  setInterval(() => { if (token && activeRecoveryRequestId && !document.hidden) void refreshRecoveryProgress(); }, 3000);
  $("logoutBtn").addEventListener("click", () => { token="";sessionStorage.removeItem("agent_owner_token");showApp(false); });
  if (token) { showApp(true); refresh(); setInterval(() => { if (token && !document.hidden) refresh(); }, 15000); } else showApp(false);
})();
