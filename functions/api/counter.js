import { json } from "../_shared.js";
// needs a KV namespace bound as "KV"
export async function onRequest({ request, env }) {
  if (!env.KV) return json({ error: "missing KV binding (Settings → Bindings → KV namespace, name: KV)" }, 503);
  let n = Number(await env.KV.get("visits")) || 0;
  if (request.method === "POST") { n += 1; await env.KV.put("visits", String(n)); }
  return json({ count: n });
}
