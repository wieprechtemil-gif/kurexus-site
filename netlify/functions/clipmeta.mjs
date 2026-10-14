// GET /api/clipmeta?u=<url>&u=<url>… — fresh thumbnails + titles for Medal and Twitch clips
// (Medal thumbnail links expire, so we look them up live and let the CDN cache the result.)
let token = null, tokenExp = 0;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json",
    "cache-control": "public, max-age=0, must-revalidate",
    "netlify-cdn-cache-control": "public, s-maxage=3600, stale-while-revalidate=86400"
  }
});

const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"))
        || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"));
  return m ? m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'") : null;
};

async function medal(u) {
  const r = await fetch(u.split("?")[0], { headers: { "user-agent": "Mozilla/5.0 (kurexus.netlify.app)" } });
  if (!r.ok) throw new Error("medal " + r.status);
  const html = await r.text();
  const title = (meta(html, "og:title") || "").replace(/\s*-\s*Clipped .* with Medal\.tv\s*$/i, "").trim();
  return { thumb: meta(html, "og:image"), title };
}

async function twitchToken(id, secret) {
  if (token && Date.now() < tokenExp) return token;
  const r = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials" })
  });
  if (!r.ok) throw new Error("token " + r.status);
  const d = await r.json(); token = d.access_token; tokenExp = Date.now() + (d.expires_in - 120) * 1000;
  return token;
}

async function twitchClips(slugs) {
  const id = (process.env.TWITCH_CLIENT_ID || "").trim(), secret = (process.env.TWITCH_CLIENT_SECRET || "").trim();
  if (!id || !secret || !slugs.length) return {};
  const tk = await twitchToken(id, secret);
  const r = await fetch("https://api.twitch.tv/helix/clips?" + slugs.map(s => "id=" + encodeURIComponent(s)).join("&"), { headers: { "Client-Id": id, Authorization: `Bearer ${tk}` } });
  if (!r.ok) return {};
  const out = {};
  for (const c of (await r.json()).data || []) out[c.id] = { thumb: c.thumbnail_url, title: c.title, views: c.view_count };
  return out;
}

const twitchSlug = u => { const m = u.match(/(?:clips\.twitch\.tv\/|twitch\.tv\/[^/]+\/clip\/)([\w-]+)/); return m ? m[1] : null; };

export default async req => {
  const urls = new URL(req.url).searchParams.getAll("u").slice(0, 20);
  const out = {};
  const slugs = urls.map(twitchSlug).filter(Boolean);
  const [tw] = await Promise.all([
    twitchClips(slugs).catch(() => ({})),
    ...urls.filter(u => /^https:\/\/(www\.)?medal\.tv\//.test(u)).map(u => medal(u).then(m => { out[u] = m; }).catch(() => {}))
  ]);
  for (const u of urls) { const s = twitchSlug(u); if (s && tw[s]) out[u] = tw[s]; }
  return json(out);
};

export const config = { path: "/api/clipmeta" };
