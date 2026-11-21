import { boot } from "./runtime/index.js";
import { draftRequest } from "./site-actions.js";

const status = document.querySelector("#runtime-status");
try {
  const {engine} = await boot("#agent-app", {originUrl:new URL(".",location.href).href.replace(/\/$/,""),sandboxWorkerUrl:new URL("./runtime/sandbox-worker.js",location.href).href});
  status.textContent = `Network ready · ${engine.top.network.specMap.size} agents · runs in your browser`;
  const label = document.createElement("label");
  label.htmlFor = "ns-input";
  label.className = "chat-label";
  label.textContent = "Your plumbing question";
  document.querySelector(".ns-inputbar").before(label);
} catch (error) {
  status.textContent = `Could not load assistant: ${error.message}. You can still draft a request below.`;
}

document.querySelector("#request-form").addEventListener("submit", event => {
  event.preventDefault();
  const result = draftRequest(Object.fromEntries(new FormData(event.currentTarget)));
  if (!result.ok) document.querySelector("#draft-status").textContent = result.reason;
});
document.querySelector("#download-draft").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([document.querySelector("#request-draft").textContent],{type:"text/plain;charset=utf-8"}));
  const link = document.createElement("a");
  link.href = url; link.download = "northgate-request.txt"; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
