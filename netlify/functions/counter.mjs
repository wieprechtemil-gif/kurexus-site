// /api/counter — retro visitor counter stored in Netlify Blobs
// POST = count this visit (+1), GET = just read
import { getStore } from "@netlify/blobs";

const json = data => new Response(JSON.stringify(data), {
  headers: { "content-type": "application/json", "cache-control": "no-store" }
});

export default async req => {
  const store = getStore("kurexus");
  let count = Number(await store.get("visits")) || 0;
  if (req.method === "POST") {
    count += 1;
    await store.set("visits", String(count));
  }
  return json({ count });
};

export const config = { path: "/api/counter" };
