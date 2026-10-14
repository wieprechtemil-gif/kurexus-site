import { json, cached, twitchToken } from "../_shared.js";
const LOGIN = "kurexus";
export const onRequestGet = ctx => cached(ctx, 600, async () => {
  try {
    const { id, tk } = await twitchToken(ctx.env);
    const helix = async p => { const r = await fetch("https://api.twitch.tv/helix/" + p, { headers: { "Client-Id": id, Authorization: `Bearer ${tk}` } }); if (!r.ok) throw new Error(p + " " + r.status); return (await r.json()).data || []; };
    const [user] = await helix(`users?login=${LOGIN}`);
    const [clips, videos, channel] = await Promise.all([
      helix(`clips?broadcaster_id=${user.id}&first=20`),
      helix(`videos?user_id=${user.id}&type=archive&first=1`).catch(() => []),
      helix(`channels?broadcaster_id=${user.id}`).catch(() => [])
    ]);
    const last = videos[0];
    return json({
      avatar: user.profile_image_url,
      clips: clips.sort((a, b) => b.view_count - a.view_count).slice(0, 10).map(c => ({ id: c.id, title: c.title, views: c.view_count, thumb: c.thumbnail_url, duration: c.duration, date: c.created_at })),
      lastStream: last ? { date: last.created_at, title: last.title, duration: last.duration, game: channel[0]?.game_name || null } : null
    });
  } catch (e) { return json({ error: String(e.message || e) }, 500); }
});
