import { json, cached, twitchToken } from "../_shared.js";
// GET /api/streams — minutes streamed per day (Berlin time). Twitch only keeps VODs for a few weeks,
// so every call merges them into KV — the heatmap keeps growing over time.
const LOGIN = "kurexus";
const dur = s => { const m = String(s || "").match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/) || []; return (+m[1] || 0) * 60 + (+m[2] || 0) + Math.round((+m[3] || 0) / 60); };
const day = ms => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
export const onRequestGet = ctx => cached(ctx, 1800, async () => {
  try {
    const { id, tk } = await twitchToken(ctx.env);
    const helix = async p => { const r = await fetch("https://api.twitch.tv/helix/" + p, { headers: { "Client-Id": id, Authorization: `Bearer ${tk}` } }); if (!r.ok) throw new Error(p + " " + r.status); return (await r.json()).data || []; };
    const [user] = await helix(`users?login=${LOGIN}`);
    const vids = await helix(`videos?user_id=${user.id}&type=archive&first=100`);
    const fresh = {};
    for (const v of vids) { const k = day(Date.parse(v.created_at)); fresh[k] = (fresh[k] || 0) + dur(v.duration); }
    let days = { ...fresh };
    const KV = ctx.env.KV;
    if (KV) {
      const old = (await KV.get("streamdays", { type: "json" }).catch(() => null)) || {};
      days = { ...old, ...fresh };
      if (JSON.stringify(days) !== JSON.stringify(old)) ctx.waitUntil(KV.put("streamdays", JSON.stringify(days)).catch(() => {}));
    }
    return json({ days });
  } catch (e) { return json({ error: String(e.message || e) }, 500); }
});
