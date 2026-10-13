// /api/poll — "Will kur hit FACEIT 10 by end of 2026?" stored in Netlify Blobs
// GET = results, POST {vote:"yes"|"no"} = add a vote
import { getStore } from "@netlify/blobs";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" }
});

export default async req => {
  const store = getStore("kurexus");
  const votes = (await store.get("poll-faceit10", { type: "json" })) || { yes: 0, no: 0 };
  if (req.method === "POST") {
    let body = {};
    try { body = await req.json(); } catch (e) {}
    if (body.vote !== "yes" && body.vote !== "no") return json({ error: "bad vote" }, 400);
    votes[body.vote] = (votes[body.vote] || 0) + 1;
    await store.setJSON("poll-faceit10", votes);
  }
  return json(votes);
};

export const config = { path: "/api/poll" };
