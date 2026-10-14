import { json, cached } from "../_shared.js";
// GET /api/leetify — aim card: Leetify ratings + aim stats (public API, no key)
const STEAM64 = "76561198437480026";
export const onRequestGet = ctx => cached(ctx, 1800, async () => {
  try {
    const r = await fetch(`https://api-public.cs-prod.leetify.com/v3/profile?steam64_id=${STEAM64}`, { headers: { accept: "application/json", "user-agent": "kurexus-site" } });
    if (!r.ok) throw new Error("leetify " + r.status);
    const d = await r.json(), rt = d.rating || {}, s = d.stats || {}, rk = d.ranks || {};
    const n = v => typeof v === "number" && isFinite(v) ? Math.round(v * 10) / 10 : null;
    const out = {
      leetify: n(rk.leetify), premier: rk.premier ?? null, winrate: n(d.winrate != null ? (d.winrate <= 1 ? d.winrate * 100 : d.winrate) : null), matches: d.total_matches ?? null,
      rating: { aim: n(rt.aim), positioning: n(rt.positioning), utility: n(rt.utility), opening: n(rt.opening != null ? rt.opening * (Math.abs(rt.opening) < 1 ? 100 : 1) : null), clutch: n(rt.clutch != null ? rt.clutch * (Math.abs(rt.clutch) < 1 ? 100 : 1) : null) },
      stats: { reaction: n(s.reaction_time_ms), preaim: n(s.preaim), hs: n(s.accuracy_head), spray: n(s.spray_accuracy), spotted: n(s.accuracy_enemy_spotted), strafe: n(s.counter_strafing_good_shots_ratio) }
    };
    if (new URL(ctx.request.url).searchParams.has("debug")) out._raw = { rating: d.rating, stats: d.stats, ranks: d.ranks };
    return json(out);
  } catch (e) { return json({ error: String(e.message || e) }, 500); }
});
