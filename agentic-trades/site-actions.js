export const services = Object.freeze({
  business: "Northgate Plumbing — fictional demonstration",
  services: ["Drain cleaning", "Water heater repair and replacement", "Leak repair", "Kitchen and bathroom renovations", "Sump pumps"],
  areas: ["Edmonton", "St. Albert", "Sherwood Park", "Spruce Grove", "Stony Plain", "Leduc", "Beaumont", "Fort Saskatchewan"],
  pricing: "No fixed prices are published. Work requires an inspection and a written quote before approval. No payment is collected here.",
  booking: "Requests are local drafts only. No request is sent and no visit is booked. There is no live availability or emergency dispatch."
});

export function draftRequest(args) {
  for (const field of ["service", "city", "symptoms", "urgency", "window"]) {
    if (typeof args?.[field] !== "string" || !args[field].trim() || args[field].length > 1000) {
      return {ok:false, reason:`Enter ${field} (1–1000 characters).`};
    }
  }
  if (!services.areas.some(area => area.toLowerCase() === args.city.trim().toLowerCase())) {
    return {ok:false, reason:"That city is outside the published service area. No draft was changed."};
  }
  const text = `NORTHGATE PLUMBING · REQUEST DRAFT\nNot sent · Not a quote or confirmed booking\n\nService: ${args.service.trim()}\nCity: ${args.city.trim()}\nIssue: ${args.symptoms.trim()}\nUrgency: ${args.urgency.trim()}\nPreferred window: ${args.window.trim()}\n\nPlease confirm scope, availability and a written price before any work.\nAdd your contact details privately before sharing with a real provider.`;
  if (typeof document !== "undefined") {
    document.querySelector("#request-draft").textContent = text;
    document.querySelector("#download-draft").disabled = false;
    document.querySelector("#draft-status").textContent = "Your draft is ready to review. Nothing has been sent.";
  }
  return {ok:true, status:"draft_only", text};
}

export function registerActions(actions) {
  actions.register({name:"read_services",description:"Read the published service catalogue, service areas, pricing policy and booking limitations.",effect:"read",inputSchema:{type:"object",properties:{},additionalProperties:false},execute:()=>structuredClone(services)});
  actions.register({name:"draft_request",description:"Create a visible local request draft from details the visitor supplied. Does not send, book, quote or charge. Ask about missing fields first.",effect:"write",inputSchema:{type:"object",properties:Object.fromEntries(["service","city","symptoms","urgency","window"].map(k=>[k,{type:"string",minLength:1,maxLength:1000}])),required:["service","city","symptoms","urgency","window"],additionalProperties:false},execute:draftRequest});
}
