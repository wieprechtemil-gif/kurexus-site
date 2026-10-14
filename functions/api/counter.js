import { json } from "../_shared.js";
// needs a KV namespace bound as "KV"
export async function onRequest({ request, env }) {
  let n = Number(await env.KV.get("visits")) || 0;
  if (request.method === "POST") { n += 1; await env.KV.put("visits", String(n)); }
  return json({ count: n });
}
