import { json, cached, spotifyToken } from "../_shared.js";
// GET /api/music?period=7day|1month|overall — top tracks, top artists, recent tracks, total scrobbles
// Last.fm for the data, Spotify for covers/artist images/links, Deezer for 30s previews
const PERIODS = ["7day", "1month", "overall"];
const norm = x => String(x || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const LF_BLANK = /2a96cbd8b46e442fc41c2b86b821562f/;

export const onRequestGet = ctx => {
  const url = new URL(ctx.request.url);
  const period = PERIODS.includes(url.searchParams.get("period")) ? url.searchParams.get("period") : "1month";
  return cached(ctx, 900, async () => {
    const key = (ctx.env.LASTFM_API_KEY || "").trim(), user = (ctx.env.LASTFM_USER || "").trim();
    if (!key || !user) return json({ error: "missing lastfm config" }, 503);
    const lf = async (method, extra = "") => (await fetch(`https://ws.audioscrobbler.com/2.0/?method=${method}&user=${encodeURIComponent(user)}&api_key=${key}&format=json${extra}`)).json();
    try {
      const [tt, ta, info, rec] = await Promise.all([
        lf("user.gettoptracks", `&period=${period}&limit=10`),
        lf("user.gettopartists", `&period=${period}&limit=8`),
        lf("user.getinfo"),
        lf("user.getrecenttracks", "&limit=10")
      ]);
      const sp = await spotifyToken(ctx.env).catch(() => null);
      const spGet = async path => { if (!sp) return null; const r = await fetch("https://api.spotify.com/v1/" + path, { headers: { authorization: "Bearer " + sp } }); return r.ok ? r.json() : null; };

      const tracks = await Promise.all((tt.toptracks?.track || []).map(async (t, i) => {
        const o = { rank: i + 1, title: t.name, artist: t.artist?.name, plays: Number(t.playcount) || 0, lastfm: t.url, art: null, spotify: null, preview: null };
        const [s, d] = await Promise.all([
          spGet(`search?type=track&limit=3&q=${encodeURIComponent(`track:${o.title} artist:${o.artist}`)}`).catch(() => null),
          fetch(`https://api.deezer.com/search?limit=5&q=${encodeURIComponent(o.artist + " " + o.title)}`).then(r => r.json()).catch(() => null)
        ]);
        const sh = (s?.tracks?.items || []).find(x => norm(x.name).includes(norm(o.title))) || s?.tracks?.items?.[0];
        if (sh) { o.spotify = sh.external_urls?.spotify; o.art = sh.album?.images?.[1]?.url || sh.album?.images?.[0]?.url; }
        const dh = (d?.data || []).find(x => x.preview && norm(x.title).includes(norm(o.title)));
        if (dh) { o.preview = dh.preview; if (!o.art) o.art = dh.album?.cover_medium; }
        if (!o.spotify) o.spotify = `https://open.spotify.com/search/${encodeURIComponent(o.artist + " " + o.title)}`;
        return o;
      }));

      const artists = await Promise.all((ta.topartists?.artist || []).map(async (a, i) => {
        const o = { rank: i + 1, name: a.name, plays: Number(a.playcount) || 0, lastfm: a.url, image: null, spotify: null };
        const s = await spGet(`search?type=artist&limit=3&q=${encodeURIComponent(a.name)}`).catch(() => null);
        const h = (s?.artists?.items || []).find(x => norm(x.name) === norm(a.name)) || s?.artists?.items?.[0];
        if (h) { o.image = h.images?.[1]?.url || h.images?.[0]?.url; o.spotify = h.external_urls?.spotify; }
        if (!o.spotify) o.spotify = `https://open.spotify.com/search/${encodeURIComponent(a.name)}`;
        return o;
      }));

      const recent = (rec.recenttracks?.track || []).slice(0, 10).map(t => ({
        title: t.name, artist: t.artist?.["#text"], nowPlaying: t["@attr"]?.nowplaying === "true",
        date: t.date?.uts ? Number(t.date.uts) * 1000 : null,
        art: [...(t.image || [])].reverse().map(x => x["#text"]).find(x => x && !LF_BLANK.test(x)) || null
      }));

      return json({
        period, user,
        totalScrobbles: Number(info.user?.playcount) || 0,
        since: info.user?.registered?.unixtime ? Number(info.user.registered.unixtime) * 1000 : null,
        periodPlays: tracks.reduce((s, t) => s + t.plays, 0),
        tracks, artists, recent
      });
    } catch (e) { return json({ error: String(e.message || e) }, 502); }
  });
};
