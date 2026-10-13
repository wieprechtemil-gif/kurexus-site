// GET /api/youtube — latest upload from youtube.com/@kurexus (via public RSS, no key needed)
const CHANNEL_ID = "UC8g56Ya8gibDCxCJYtxpNKA";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json",
    "cache-control": "public, max-age=0, must-revalidate",
    "netlify-cdn-cache-control": "public, s-maxage=900, stale-while-revalidate=3600"
  }
});

const decode = s => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export default async () => {
  try {
    const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`);
    if (!r.ok) throw new Error("rss " + r.status);
    const xml = await r.text();
    const entry = xml.split("<entry>")[1];
    if (!entry) throw new Error("no videos");
    const id = (entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const title = decode((entry.match(/<title>([^<]*)<\/title>/) || [])[1] || "");
    const published = (entry.match(/<published>([^<]+)<\/published>/) || [])[1] || null;
    if (!id) throw new Error("no id");
    return json({ id, title, published });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};

export const config = { path: "/api/youtube" };
