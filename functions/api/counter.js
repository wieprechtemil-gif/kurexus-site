import { json } from "../_shared.js";
// /api/counter — visits (per browser session), unique visitors (first visit ever), visitors per day (Berlin)
// GET → { count }   GET ?stats=1 → full numbers   POST { first } → counts one visit
export async function onRequest({ request, env }) {
  if (!env.KV) return json({ error: "missing KV binding (Settings → Bindings → KV namespace, name: KV)" }, 503);
  let st = await env.KV.get("vstats", { type: "json" }).catch(() => null);
  if (!st) st = { visits: Number(await env.KV.get("visits")) || 0, uniq: 0, daily: {}, since: Date.now() };
  if (request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) {}
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    st.visits += 1; if (b.first) st.uniq += 1;
    st.daily[day] = (st.daily[day] || 0) + 1;
    const keys = Object.keys(st.daily).sort(); while (keys.length > 120) delete st.daily[keys.shift()];
    try { await env.KV.put("vstats", JSON.stringify(st)); } catch (e) {}
  }
  if (new URL(request.url).searchParams.has("stats")) return json(st);
  return json({ count: st.visits });
}
