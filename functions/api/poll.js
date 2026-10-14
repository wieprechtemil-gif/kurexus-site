import { json } from "../_shared.js";
export async function onRequest({ request, env }) {
  if (!env.KV) return json({ error: "missing KV binding (Settings → Bindings → KV namespace, name: KV)" }, 503);
  const v = JSON.parse(await env.KV.get("poll-faceit10") || '{"yes":0,"no":0}');
  if (request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) {}
    if (b.vote !== "yes" && b.vote !== "no") return json({ error: "bad vote" }, 400);
    v[b.vote] = (v[b.vote] || 0) + 1; await env.KV.put("poll-faceit10", JSON.stringify(v));
  }
  return json(v);
}
