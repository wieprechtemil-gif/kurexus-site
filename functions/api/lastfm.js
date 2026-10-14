import { json, cached } from "../_shared.js";
// GET /api/lastfm — last played / now playing track from Last.fm + a 30s preview from the iTunes Search API
// env: LASTFM_API_KEY, LASTFM_USER
export const onRequestGet = ctx => cached(ctx, 30, async () => {
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
      url: t.url, user
    };
    try {
      const s = await fetch(`https://itunes.apple.com/search?media=music&entity=song&limit=5&term=${encodeURIComponent(out.artist + " " + out.title)}`);
      const res = (await s.json()).results || [];
      const norm = x => String(x || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
      const hit = res.find(x => norm(x.trackName).includes(norm(out.title)) && norm(x.artistName).includes(norm(out.artist))) || null;
      if (hit) { out.preview = hit.previewUrl; if (!out.art || /2a96cbd8b46e442fc41c2b86b821562f/.test(out.art)) out.art = hit.artworkUrl100?.replace("100x100", "300x300"); }
    } catch (e) {}
    return json(out);
  } catch (e) { return json({ error: String(e.message || e) }, 502); }
});
