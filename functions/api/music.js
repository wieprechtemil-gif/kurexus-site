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

      const UA = { "user-agent": "Mozilla/5.0 (compatible; kurexus-site/1.0)", accept: "application/json" };
      const getJ = u => fetch(u, { headers: UA }).then(r => r.ok ? r.json() : null).catch(() => null);
      const big = u => u ? u.replace(/\/\d+x\d+(-[^/]*)?\.jpg$/, "/500x500$1.jpg").replace(/100x100bb/, "500x500bb") : u;
      const tracks = await Promise.all((tt.toptracks?.track || []).map(async (t, i) => {
        const o = { rank: i + 1, title: t.name, artist: t.artist?.name, plays: Number(t.playcount) || 0, lastfm: t.url, art: null, spotify: null, preview: null };
        const nt = norm(o.title), na = norm(o.artist).slice(0, 6);
        const [s, d] = await Promise.all([
          spGet(`search?type=track&limit=3&q=${encodeURIComponent(`track:${o.title} artist:${o.artist}`)}`).catch(() => null),
          getJ(`https://api.deezer.com/search?limit=10&q=${encodeURIComponent(o.artist + " " + o.title)}`)
        ]);
        const dl = d?.data || [];
        const dh = dl.find(x => norm(x.title).includes(nt) && norm(x.artist?.name).includes(na)) || dl.find(x => norm(x.title).includes(nt));
        if (dh) { o.preview = dh.preview || null; o.art = dh.album?.cover_big || dh.album?.cover_medium || null; }
        const sh = (s?.tracks?.items || []).find(x => norm(x.name).includes(nt)) || s?.tracks?.items?.[0];
        if (sh) { o.spotify = sh.external_urls?.spotify; if (!o.art) o.art = sh.album?.images?.[0]?.url || null; }
        if (!o.art || !o.preview) {
          const it = await getJ(`https://itunes.apple.com/search?media=music&entity=song&limit=8&term=${encodeURIComponent(o.artist + " " + o.title)}`);
          const ih = (it?.results || []).find(x => norm(x.trackName).includes(nt) && norm(x.artistName).includes(na)) || (it?.results || []).find(x => norm(x.trackName).includes(nt));
          if (ih) { if (!o.preview) o.preview = ih.previewUrl || null; if (!o.art) o.art = big(ih.artworkUrl100); }
        }
        if (!o.art) { const img = [...(t.image || [])].reverse().map(x => x["#text"]).find(x => x && !LF_BLANK.test(x)); if (img) o.art = img; }
        if (!o.spotify) o.spotify = `https://open.spotify.com/search/${encodeURIComponent(o.artist + " " + o.title)}`;
        return o;
      }));

      const artists = await Promise.all((ta.topartists?.artist || []).map(async (a, i) => {
        const o = { rank: i + 1, name: a.name, plays: Number(a.playcount) || 0, lastfm: a.url, image: null, spotify: null };
        const [s, d] = await Promise.all([
          spGet(`search?type=artist&limit=3&q=${encodeURIComponent(a.name)}`).catch(() => null),
          getJ(`https://api.deezer.com/search/artist?limit=5&q=${encodeURIComponent(a.name)}`)
        ]);
        const h = (s?.artists?.items || []).find(x => norm(x.name) === norm(a.name)) || s?.artists?.items?.[0];
        if (h) { o.image = h.images?.[1]?.url || h.images?.[0]?.url || null; o.spotify = h.external_urls?.spotify; }
        const dh = (d?.data || []).find(x => norm(x.name) === norm(a.name)) || d?.data?.[0];
        if (!o.image && dh && !/\/artist\/\/|images\/artist\/\//.test(dh.picture_medium || "")) o.image = dh.picture_big || dh.picture_medium || null;
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
    } catch (e) { return json({ error: String(e.message || e) }, 500); }
  });
};
