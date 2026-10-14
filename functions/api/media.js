// GET /api/media?u=<url> — same-origin proxy for album art + 30s previews,
// so the page can read cover colours and analyse audio (needs CORS-free access).
const ALLOWED = [/(^|\.)lastfm\.freetls\.fastly\.net$/, /^lastfm-img\d*\.akamaized\.net$/, /(^|\.)scdn\.co$/, /(^|\.)dzcdn\.net$/, /(^|\.)mzstatic\.com$/, /(^|\.)itunes\.apple\.com$/];
export async function onRequestGet({ request }) {
  const u = new URL(request.url).searchParams.get("u");
  let target;
  try { target = new URL(u); } catch (e) { return new Response("bad url", { status: 400 }); }
  if (target.protocol !== "https:" || !ALLOWED.some(rx => rx.test(target.hostname))) return new Response("host not allowed", { status: 403 });
  const headers = {};
  const range = request.headers.get("range"); if (range) headers.range = range;
  const r = await fetch(target.toString(), { headers, cf: { cacheTtl: 3600, cacheEverything: true } });
  const out = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) { const v = r.headers.get(h); if (v) out.set(h, v); }
  out.set("cache-control", "public, max-age=3600");
  out.set("access-control-allow-origin", "*");
  return new Response(r.body, { status: r.status, headers: out });
}
