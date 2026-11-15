"use strict";
const SYSTEM = "You are a connection test. Reply with exactly: OK";
function endpoint(baseUrl) {
  if (/\/chat\/completions$/i.test(baseUrl)) return baseUrl;
  return baseUrl.replace(/\/$/, "") + (/\/v1$/i.test(baseUrl) ? "/chat/completions" : "/v1/chat/completions");
}
async function callProvider(slot, prompt, timeoutMs = 25000, systemPrompt = SYSTEM) {
  let response, data;
  if (slot.provider === "gemini") {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(slot.model) + ":generateContent?key=" + encodeURIComponent(slot.apiKey);
    response = await fetch(url, { method:"POST", headers:{"content-type":"application/json"},
      body:JSON.stringify({systemInstruction:{parts:[{text:systemPrompt}]},contents:[{role:"user",parts:[{text:prompt}]}],
        generationConfig:{responseMimeType:"application/json",temperature:0,maxOutputTokens:128}}),
      signal:AbortSignal.timeout(timeoutMs) });
    data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error("Gemini request failed ("+response.status+"): "+String(data.error?.message||"").slice(0,250));
    return data.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("") || "";
  }
  const url = endpoint(slot.baseUrl);
  response = await fetch(url,{method:"POST",headers:{...(slot.apiKey?{authorization:"Bearer "+slot.apiKey}:{}),"content-type":"application/json"},
    body:JSON.stringify({model:slot.model,temperature:0,max_tokens:128,response_format:{type:"json_object"},
      messages:[{role:"system",content:systemPrompt},{role:"user",content:prompt}]}),signal:AbortSignal.timeout(timeoutMs)});
  data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error("Provider request failed ("+response.status+"): "+String(data.error?.message||"").slice(0,250));
  return data.choices?.[0]?.message?.content || "";
}
async function testProvider(slot) {
  const value = await callProvider(slot, "Return a JSON object with one key status and value OK.", 25000);
  if (!value.trim()) throw new Error("Provider returned an empty response.");
  return "Connected";
}
async function getConfiguredSlots() {
  const AISettings = require("./models/AISettings");
  const secret = require("./aiSettingsCrypto");
  const doc = await AISettings.findOne({key:"default"});
  if (!doc) return [];
  const slots=[];
  for (const name of ["main","fallback","backup"]) {
    const item=doc[name];
    if (item?.enabled && item.apiKeyEncrypted) {
      slots.push({name,provider:item.provider,model:item.model,baseUrl:item.baseUrl,
        apiKey:secret.decrypt(item.apiKeyEncrypted)});
    }
  }
  return slots;
}
module.exports={callProvider,testProvider,getConfiguredSlots};
