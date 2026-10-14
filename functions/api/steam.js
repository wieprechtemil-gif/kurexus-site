import { json, cached } from "../_shared.js";
// GET /api/steam — what kur is playing right now + CS2 hours (needs STEAM_API_KEY, profile/game details public)
const STEAM64 = "76561198437480026";
export const onRequestGet = ctx => cached(ctx, 60, async () => {
  const key = (ctx.env.STEAM_API_KEY || "").trim();
  if (!key) return json({ error: "no STEAM_API_KEY" }, 503);
  try {
    const base = "https://api.steampowered.com";
    const RDR2 = 1174180, RDO = 1404210;
    const [sum, own, rec, ach] = await Promise.all([
      fetch(`${base}/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${STEAM64}`).then(r => r.json()),
      fetch(`${base}/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${STEAM64}&include_appinfo=1&include_played_free_games=1`).then(r => r.json()).catch(() => null),
      fetch(`${base}/IPlayerService/GetRecentlyPlayedGames/v1/?key=${key}&steamid=${STEAM64}&count=10`).then(r => r.json()).catch(() => null),
      fetch(`${base}/ISteamUserStats/GetPlayerAchievements/v1/?key=${key}&steamid=${STEAM64}&appid=${RDR2}&l=english`).then(r => r.ok ? r.json() : null).catch(() => null)
    ]);
    const p = sum?.response?.players?.[0] || {};
    const games = own?.response?.games || [];
    const cs = games.find(g => g.appid === 730);
    const recent = rec?.response?.games || [];
    const g = id => { const o = games.find(x => x.appid === id), r = recent.find(x => x.appid === id); return o || r ? { h: Math.round(((o || r).playtime_forever || 0) / 60), h2w: r ? Math.round(r.playtime_2weeks / 6) / 10 : 0 } : null; };
    const A = ach?.playerstats?.achievements || [];
    const got = A.filter(a => a.achieved), last = got.sort((a, b) => b.unlocktime - a.unlocktime)[0];
    const rdr2 = g(RDR2);
    if (rdr2 && A.length) rdr2.ach = { got: got.length, total: A.length, last: last ? { name: last.name || last.apiname, desc: last.description || "", date: last.unlocktime * 1000 } : null };
    return json({
      state: p.personastate ?? null,                 // 0 offline, 1 online, 2 busy, 3 away …
      playing: p.gameextrainfo || null, appid: p.gameid ? Number(p.gameid) : null,
      cs2Hours: cs ? Math.round(cs.playtime_forever / 60) : null,
      rdr2, rdo: g(RDO),
      recent: recent.slice(0, 5).map(g => ({ name: g.name, appid: g.appid, h2w: Math.round(g.playtime_2weeks / 6) / 10 }))
    });
  } catch (e) { return json({ error: String(e.message || e) }, 500); }
});
