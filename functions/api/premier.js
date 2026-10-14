import { json, cached } from "../_shared.js";
// GET /api/premier — live CS2 Premier rating via Leetify's public API (no key needed)
const STEAM64 = "76561198437480026";
export const onRequestGet = ctx => cached(ctx, 900, async () => {
  try {
    const r = await fetch(`https://api-public.cs-prod.leetify.com/v3/profile?steam64_id=${STEAM64}`, { headers: { accept: "application/json", "user-agent": "kurexus-site" } });
    if (!r.ok) throw new Error("leetify " + r.status);
    const d = await r.json(), rk = d.ranks || {};
    if (!rk.premier) throw new Error("no premier rating");
    return json({ premier: rk.premier, leetify: rk.leetify ?? null });
  } catch (e) { return json({ error: String(e.message || e) }, 502); }
});
