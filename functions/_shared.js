// Shared helpers for Cloudflare Pages Functions (same API as the old Netlify functions)
export const json = (data, status = 200, maxAge = 0) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json", "cache-control": maxAge ? `public, max-age=${maxAge}` : "no-store" }
});

// cache a GET response at the edge for `ttl` seconds
export async function cached(ctx, ttl, produce) {
  const cache = caches.default, key = new Request(new URL(ctx.request.url).toString(), { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await produce();
  if (res.status === 200) {
    const copy = new Response(res.body, res);
    copy.headers.set("cache-control", `public, max-age=${ttl}`);
    ctx.waitUntil(cache.put(key, copy.clone()));
    return copy;
  }
  return res;
}

let twTok = null, twExp = 0;
export async function twitchToken(env) {
  const id = (env.TWITCH_CLIENT_ID || "").trim(), secret = (env.TWITCH_CLIENT_SECRET || "").trim();
  if (!id || !secret) throw new Error("missing twitch keys");
  if (twTok && Date.now() < twExp) return { id, tk: twTok };
  const r = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials" })
  });
  if (!r.ok) throw new Error("token " + r.status);
  const d = await r.json(); twTok = d.access_token; twExp = Date.now() + (d.expires_in - 120) * 1000;
  return { id, tk: twTok };
}
