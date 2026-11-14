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
  function showApp(yes) { $("loginPanel").hidden = yes; $("appPanel").hidden = !yes; $("connection").textContent = yes ? "Authenticated" : "Offline"; }
  $("loginForm").addEventListener("submit", async event => {
    event.preventDefault(); $("loginMessage").textContent = "Signing in…";
    try {
      const response = await fetch("/api/auth/login", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({username:$("username").value,password:$("password").value}) });
      const data = await response.json();
      if (!response.ok || !data.token) throw new Error(data.message || "Login failed");
      token = data.token; sessionStorage.setItem("agent_owner_token", token); $("password").value = "";
      showApp(true); await refresh();
    } catch(error) { $("loginMessage").textContent = error.message; }
  });
  function renderApprovals(items) {
    $("pendingCount").textContent = items.length;
    $("approvals").innerHTML = items.length ? items.map(item => `<article class="item"><div class="itemTop"><strong>Approval • ${safe(item.approvalId)}</strong><span class="status">${safe(item.status)}</span></div><p>Task: ${safe(item.taskId)}<br>Requested by: ${safe(item.requestedBy)}<br>Expires: ${safe(item.expiresAt)}</p><pre>${safe(JSON.stringify(item.action,null,2))}</pre><div class="actions"><button class="approve" data-action="approve" data-id="${safe(item.approvalId)}">Approve</button><button class="reject" data-action="reject" data-id="${safe(item.approvalId)}">Reject</button></div></article>`).join("") : '<p class="muted">No pending approvals.</p>';
  }
  function renderTasks(items) {
    $("taskCount").textContent = items.length;
    $("tasks").innerHTML = items.length ? items.map(task => `<article class="item"><div class="itemTop"><strong>${safe(task.type)} • ${safe(task.status)}</strong><span class="status">${safe(task.source)}</span></div><p>${safe(task.description)}</p><div class="meta">Task ID: ${safe(task.taskId)} • ${safe(new Date(task.createdAt).toLocaleString())}</div>${task.error ? `<p class="message">${safe(task.error)}</p>` : ""}${task.result ? `<pre>${safe(typeof task.result === "string" ? task.result : JSON.stringify(task.result,null,2))}</pre>` : ""}</article>`).join("") : '<p class="muted">No tasks yet. Send a request with !agent in Messenger.</p>';
  }
  async function refresh() {
    try {
      const [approvals,tasks] = await Promise.all([api("/api/approvals/"),api("/api/tasks/?limit=50")]);
      renderApprovals(approvals.approvals || []); renderTasks(tasks.tasks || []);
      $("connection").textContent = "Connected";
    } catch(error) {
      if (/session|authentication|invalid/i.test(error.message)) { token="";sessionStorage.removeItem("agent_owner_token");showApp(false); }
      $("connection").textContent = "Error"; $("loginMessage").textContent = error.message;
    }
  }
  $("approvals").addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]"); if (!button) return;
    button.disabled = true;
    try { await api("/api/approvals/" + encodeURIComponent(button.dataset.id) + "/" + button.dataset.action, {method:"POST",body:"{}"}); await refresh(); }
    catch(error) { alert(error.message); button.disabled=false; }
  });
  $("refreshBtn").addEventListener("click", refresh);
  $("logoutBtn").addEventListener("click", () => { token="";sessionStorage.removeItem("agent_owner_token");showApp(false); });
  if (token) { showApp(true); refresh(); } else showApp(false);
})();
