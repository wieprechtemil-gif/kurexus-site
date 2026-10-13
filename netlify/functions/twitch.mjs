// GET /api/twitch — top clips + last stream for kurexus
// Needs TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET (Netlify environment variables).
const LOGIN = "kurexus";
let token = null, tokenExp = 0;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json",
    "cache-control": "public, max-age=0, must-revalidate",
    "netlify-cdn-cache-control": "public, s-maxage=600, stale-while-revalidate=1800"
  }
});

async function getToken(id, secret) {
  if (token && Date.now() < tokenExp) return token;
  const r = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`, { method: "POST" });
  if (!r.ok) throw new Error("token " + r.status);
  const d = await r.json();
  token = d.access_token; tokenExp = Date.now() + (d.expires_in - 120) * 1000;
  return token;
}

export default async () => {
  const id = process.env.TWITCH_CLIENT_ID, secret = process.env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) return json({ error: "missing twitch keys" }, 503);
  try {
    const tk = await getToken(id, secret);
    const h = { "Client-Id": id, Authorization: `Bearer ${tk}` };
    const helix = async path => { const r = await fetch("https://api.twitch.tv/helix/" + path, { headers: h }); if (!r.ok) throw new Error(path + " " + r.status); return (await r.json()).data || []; };

    const [user] = await helix(`users?login=${LOGIN}`);
    if (!user) throw new Error("user not found");

    const [clips, videos, channel] = await Promise.all([
      helix(`clips?broadcaster_id=${user.id}&first=20`),
      helix(`videos?user_id=${user.id}&type=archive&first=1`).catch(() => []),
      helix(`channels?broadcaster_id=${user.id}`).catch(() => [])
    ]);

    const last = videos[0];
    return json({
      avatar: user.profile_image_url,
      clips: clips
        .sort((a, b) => b.view_count - a.view_count)
        .slice(0, 10)
        .map(c => ({ id: c.id, title: c.title, views: c.view_count, thumb: c.thumbnail_url, duration: c.duration, date: c.created_at })),
      lastStream: last ? { date: last.created_at, title: last.title, duration: last.duration, game: channel[0]?.game_name || null } : null
    });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};

export const config = { path: "/api/twitch" };
