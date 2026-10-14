import { json, cached } from "../_shared.js";
const NICK = "Kurexus";
export const onRequestGet = ctx => cached(ctx, 300, async () => {
  try {
    const key = ctx.env.FACEIT_API_KEY;
    let out = null, why = key ? null : "no FACEIT_API_KEY set";
    if (key) {
      const h = { Authorization: `Bearer ${key}` };
      const p = await fetch(`https://open.faceit.com/data/v4/players?nickname=${NICK}&game=cs2`, { headers: h });
      if (!p.ok) why = "faceit api " + p.status + " " + (await p.text()).slice(0, 120);
      if (p.ok) {
        const pl = await p.json(), cs2 = pl.games?.cs2 || {};
        out = { elo: cs2.faceit_elo, level: cs2.skill_level, source: "official" };
        const s = await fetch(`https://open.faceit.com/data/v4/players/${pl.player_id}/stats/cs2`, { headers: h });
        if (s.ok) {
          const lt = (await s.json()).lifetime || {};
          Object.assign(out, { kd: lt["Average K/D Ratio"] || null, winrate: lt["Win Rate %"] || null, hs: lt["Average Headshots %"] || null,
            matches: lt["Matches"] ? Number(lt["Matches"]) : null, recent: Array.isArray(lt["Recent Results"]) ? lt["Recent Results"].slice(-5).reverse() : null });
        }
      }
    }
    if (!out || !out.level) {
      const r = await fetch(`https://www.faceit.com/api/users/v1/nicknames/${NICK}`, { headers: { "user-agent": "Mozilla/5.0 (kurexus)", accept: "application/json" } });
      const d = await r.json(), g = d.payload?.games || d.games || {};
      out = { elo: g.cs2?.faceit_elo, level: g.cs2?.skill_level, source: "public", why };
    }
    if (!out.level) throw new Error("no data");
    return json(out);
  } catch (e) { return json({ error: String(e.message || e) }, 500); }
});
