import { json } from "../_shared.js";
// /api/live — who's on the site right now + global grenade/shot counters (KV, batched by the page)
// GET → { online, totals }   POST { id, ev:{shot,spray,smoke,molly,he,flash,hs} } → same, after counting
const KEYS = ["shot", "spray", "smoke", "molly", "he", "flash", "hs"];
const WINDOW = 80 * 1000;
export async function onRequest(ctx) {
  const KV = ctx.env.KV;
  if (!KV) return json({ error: "no KV binding" }, 503);
  const now = Date.now();
  let st = (await KV.get("live", { type: "json" }).catch(() => null)) || { p: {}, t: {} };
  st.p = st.p || {}; st.t = st.t || {};
  if (ctx.request.method === "POST") {
    let b = {}; try { b = await ctx.request.json(); } catch (e) {}
    const id = String(b.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 16);
    if (id) st.p[id] = now;
    for (const k of KEYS) { const n = Math.floor(Number(b.ev?.[k]) || 0); if (n > 0) st.t[k] = (st.t[k] || 0) + Math.min(n, 300); }
    for (const k in st.p) if (now - st.p[k] > WINDOW) delete st.p[k];
    try { await KV.put("live", JSON.stringify(st)); } catch (e) {}   // same-key write limit → just skip this one
  }
  const online = Object.values(st.p).filter(t => now - t <= WINDOW).length;
  return json({ online: Math.max(online, ctx.request.method === "POST" ? 1 : 0), totals: st.t });
}
