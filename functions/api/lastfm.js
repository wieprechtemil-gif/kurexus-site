import { json, cached } from "../_shared.js";
// GET /api/lastfm — last played / now playing track (Last.fm)
// + 30s preview (Deezer / iTunes) + direct Spotify link (via song.link, fallback: Spotify search)
// env: LASTFM_API_KEY, LASTFM_USER
const norm = x => String(x || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const UA = { "user-agent": "Mozilla/5.0 (compatible; kurexus-site/1.0)", accept: "application/json" };

export const onRequestGet = ctx => cached(ctx, 30, async () => {
  const debug = new URL(ctx.request.url).searchParams.has("debug"), dbg = {};
  const key = (ctx.env.LASTFM_API_KEY || "").trim(), user = (ctx.env.LASTFM_USER || "").trim();
  if (!key || !user) return json({ error: "missing lastfm config" }, 503);
  try {
    const r = await fetch(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(user)}&api_key=${key}&format=json&limit=1`);
    const t = (await r.json()).recenttracks?.track?.[0];
    if (!t) throw new Error("no tracks");
    const out = {
      title: t.name, artist: t.artist?.["#text"] || t.artist?.name, album: t.album?.["#text"] || "",
      art: (t.image || []).map(i => i["#text"]).filter(Boolean).pop() || null,
      nowPlaying: t["@attr"]?.nowplaying === "true", date: t.date?.uts ? Number(t.date.uts) * 1000 : null,
      lastfm: t.url, user
    };
    out.spotify = `https://open.spotify.com/search/${encodeURIComponent(out.artist + " " + out.title)}`;
    let sourceUrl = null;

    // 1) Deezer
    try {
      const dz = await fetch(`https://api.deezer.com/search?limit=8&q=${encodeURIComponent(out.artist + " " + out.title)}`, { headers: UA });
      dbg.deezer = dz.status;
      const list = (await dz.json()).data || [];
      const hit = list.find(x => norm(x.title).includes(norm(out.title)) && norm(x.artist?.name).includes(norm(out.artist).slice(0, 6))) || null;
      dbg.deezerHit = hit ? hit.title + " / " + hit.artist?.name : null;
      if (hit) { if (hit.preview) out.preview = hit.preview; sourceUrl = hit.link; if (!out.art) out.art = hit.album?.cover_medium; }
    } catch (e) { dbg.deezerErr = String(e); }

    // 2) iTunes
    if (!out.preview || !sourceUrl) try {
      const s = await fetch(`https://itunes.apple.com/search?media=music&entity=song&limit=8&term=${encodeURIComponent(out.artist + " " + out.title)}`, { headers: UA });
      dbg.itunes = s.status;
      const res = (await s.json()).results || [];
      const hit = res.find(x => norm(x.trackName).includes(norm(out.title)) && norm(x.artistName).includes(norm(out.artist).slice(0, 6))) || null;
      dbg.itunesHit = hit ? hit.trackName + " / " + hit.artistName : null;
      if (hit) { if (!out.preview) out.preview = hit.previewUrl; if (!sourceUrl) sourceUrl = hit.trackViewUrl; }
    } catch (e) { dbg.itunesErr = String(e); }

    // 3) song.link → direct Spotify track URL
    if (sourceUrl) try {
      const sl = await fetch(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(sourceUrl)}`, { headers: UA });
      dbg.songlink = sl.status;
      const sp = (await sl.json()).linksByPlatform?.spotify?.url;
      if (sp) out.spotify = sp;
    } catch (e) { dbg.songlinkErr = String(e); }

    if (debug) out._debug = dbg;
    return json(out);
  } catch (e) { return json({ error: String(e.message || e) }, 502); }
});
