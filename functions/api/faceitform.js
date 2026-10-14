import { json, cached } from "../_shared.js";
// GET /api/faceitform — recent FACEIT matches (map, score, K/D) + elo history for the curve
const NICK = "Kurexus";
const UA = { "user-agent": "Mozilla/5.0 (kurexus)", accept: "application/json" };
export const onRequestGet = ctx => cached(ctx, 300, async () => {
  const key = (ctx.env.FACEIT_API_KEY || "").trim();
  if (!key) return json({ error: "no FACEIT_API_KEY" }, 503);
  const h = { Authorization: `Bearer ${key}` };
  try {
    const p = await fetch(`https://open.faceit.com/data/v4/players?nickname=${NICK}&game=cs2`, { headers: h });
    if (!p.ok) throw new Error("player " + p.status);
    const pl = await p.json(), id = pl.player_id, eloNow = pl.games?.cs2?.faceit_elo || null;
    const [st, hist] = await Promise.all([
      fetch(`https://open.faceit.com/data/v4/players/${id}/games/cs2/stats?limit=20`, { headers: h }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`https://api.faceit.com/stats/v1/stats/time/users/${id}/games/cs2?size=40`, { headers: UA }).then(r => r.ok ? r.json() : null).catch(() => null)
    ]);
    const num = v => v == null || v === "" ? null : Number(String(v).replace(",", "."));
    const matches = (st?.items || []).map(it => {
      const s = it.stats || {};
      return {
        win: String(s["Result"]) === "1",
        map: String(s["Map"] || "").replace(/^de_/, ""),
        score: s["Score"] || null,
        kd: num(s["K/D Ratio"]), k: num(s["Kills"]), d: num(s["Deaths"]), hs: num(s["Headshots %"]),
        date: num(s["Match Finished At"]) || num(s["Created At"]) || null,
        id: s["Match Id"] || null
      };
    }).filter(m => m.map);
    let elo = (Array.isArray(hist) ? hist : []).map(x => ({ elo: num(x.elo), date: num(x.date) || num(x.created_at) })).filter(x => x.elo);
    elo.sort((a, b) => (a.date || 0) - (b.date || 0));
    if (eloNow && (!elo.length || elo[elo.length - 1].elo !== eloNow)) elo.push({ elo: eloNow, date: Date.now() });
    let streak = null;
    if (matches.length) { const w = matches[0].win; let n = 0; for (const m of matches) { if (m.win === w) n++; else break; } streak = { win: w, n }; }
    return json({ matches: matches.slice(0, 10), elo: elo.slice(-30), eloNow, streak });
  } catch (e) { return json({ error: String(e.message || e) }, 500); }
});
