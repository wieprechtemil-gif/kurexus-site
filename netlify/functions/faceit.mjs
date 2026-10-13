// GET /api/faceit — live FACEIT CS2 stats for Kurexus
// Uses the official Data API when FACEIT_API_KEY is set (K/D, winrate, last 5…),
// otherwise falls back to the public profile endpoint (elo + level only).
const NICK = "Kurexus";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json",
    "cache-control": "public, max-age=0, must-revalidate",
    "netlify-cdn-cache-control": "public, s-maxage=300, stale-while-revalidate=900"
  }
});

async function official(key) {
  const h = { Authorization: `Bearer ${key}` };
  const p = await fetch(`https://open.faceit.com/data/v4/players?nickname=${NICK}&game=cs2`, { headers: h });
  if (!p.ok) throw new Error("player " + p.status);
  const player = await p.json();
  const cs2 = player.games?.cs2 || {};
  const out = {
    elo: cs2.faceit_elo,
    level: cs2.skill_level,
    krunkerLevel: player.games?.krunker?.skill_level || null,
    source: "official"
  };
  const s = await fetch(`https://open.faceit.com/data/v4/players/${player.player_id}/stats/cs2`, { headers: h });
  if (s.ok) {
    const lt = (await s.json()).lifetime || {};
    out.kd = lt["Average K/D Ratio"] || null;
    out.winrate = lt["Win Rate %"] || null;
    out.hs = lt["Average Headshots %"] || null;
    out.matches = lt["Matches"] ? Number(lt["Matches"]) : null;
    out.recent = Array.isArray(lt["Recent Results"]) ? lt["Recent Results"].slice(-5).reverse() : null;
  }
  return out;
}

async function publicProfile() {
  const r = await fetch(`https://www.faceit.com/api/users/v1/nicknames/${NICK}`, {
    headers: { "user-agent": "Mozilla/5.0 (kurexus.netlify.app)", accept: "application/json" }
  });
  if (!r.ok) throw new Error("public " + r.status);
  const d = await r.json();
  const games = d.payload?.games || d.games || {};
  return {
    elo: games.cs2?.faceit_elo,
    level: games.cs2?.skill_level,
    krunkerLevel: games.krunker?.skill_level || null,
    source: "public"
  };
}

export default async () => {
  try {
    const key = process.env.FACEIT_API_KEY;
    let data = null;
    if (key) { try { data = await official(key); } catch (e) { data = null; } }
    if (!data || !data.level) data = await publicProfile();
    if (!data.level) throw new Error("no data");
    return json(data);
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};

export const config = { path: "/api/faceit" };
