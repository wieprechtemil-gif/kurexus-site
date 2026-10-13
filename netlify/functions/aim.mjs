// /api/aim — aim trainer leaderboard (Netlify Blobs)
// GET = top 10, POST {name, score, acc} = submit (keeps each player's best)
import { getStore } from "@netlify/blobs";

const RESERVED = ["kurexus", "kur", "kurexuss", "admin"];
const MAX_SCORE = 100; // 30s round can't realistically go higher

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" }
});

export default async req => {
  const store = getStore("kurexus");
  let board = (await store.get("aim-board", { type: "json" })) || [];

  if (req.method === "POST") {
    let b = {};
    try { b = await req.json(); } catch (e) {}
    const name = String(b.name || "").replace(/[^\p{L}\p{N} _.\-]/gu, "").trim().slice(0, 16);
    const score = Math.floor(Number(b.score));
    const acc = Math.max(0, Math.min(100, Math.round(Number(b.acc) || 0)));
    if (name.length < 2) return json({ error: "name" }, 400);
    if (RESERVED.includes(name.toLowerCase())) return json({ error: "reserved" }, 400);
    if (!Number.isFinite(score) || score < 1 || score > MAX_SCORE) return json({ error: "score" }, 400);

    const key = name.toLowerCase();
    const i = board.findIndex(r => r.name.toLowerCase() === key);
    if (i === -1) board.push({ name, score, acc, date: Date.now() });
    else if (score > board[i].score || (score === board[i].score && acc > board[i].acc)) board[i] = { name, score, acc, date: Date.now() };

    board.sort((a, b) => b.score - a.score || b.acc - a.acc || a.date - b.date);
    board = board.slice(0, 100);
    await store.setJSON("aim-board", board);
    const rank = board.findIndex(r => r.name.toLowerCase() === key) + 1;
    return json({ top: board.slice(0, 10), rank });
  }

  return json({ top: board.slice(0, 10) });
};

export const config = { path: "/api/aim" };
