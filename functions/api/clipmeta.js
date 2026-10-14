import { json, cached, twitchToken } from "../_shared.js";
const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i")) || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"));
  return m ? m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'") : null;
};
const twitchSlug = u => { const m = u.match(/(?:clips\.twitch\.tv\/|twitch\.tv\/[^/]+\/clip\/)([\w-]+)/); return m ? m[1] : null; };
export const onRequestGet = ctx => cached(ctx, 3600, async () => {
  const urls = new URL(ctx.request.url).searchParams.getAll("u").slice(0, 20), out = {};
  const slugs = urls.map(twitchSlug).filter(Boolean);
  let tw = {};
  await Promise.all([
    (async () => {
      if (!slugs.length) return;
      try {
        const { id, tk } = await twitchToken(ctx.env);
        const r = await fetch("https://api.twitch.tv/helix/clips?" + slugs.map(s => "id=" + encodeURIComponent(s)).join("&"), { headers: { "Client-Id": id, Authorization: `Bearer ${tk}` } });
        if (r.ok) for (const c of (await r.json()).data || []) tw[c.id] = { thumb: c.thumbnail_url, title: c.title, views: c.view_count };
      } catch (e) {}
    })(),
    ...urls.filter(u => /^https:\/\/(www\.)?medal\.tv\//.test(u)).map(async u => {
      try {
        const r = await fetch(u.split("?")[0], { headers: { "user-agent": "Mozilla/5.0 (kurexus)" } });
        const html = await r.text();
        out[u] = { thumb: meta(html, "og:image"), title: (meta(html, "og:title") || "").replace(/\s*-\s*Clipped .* with Medal\.tv\s*$/i, "").trim() };
      } catch (e) {}
    })
  ]);
  for (const u of urls) { const s = twitchSlug(u); if (s && tw[s]) out[u] = tw[s]; }
  return json(out);
});
