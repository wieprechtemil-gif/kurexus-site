import { json } from "../_shared.js";
const RESERVED = ["kurexus", "kur", "kurexuss", "admin"];
export async function onRequest({ request, env }) {
  if (!env.KV) return json({ error: "missing KV binding (Settings → Bindings → KV namespace, name: KV)" }, 503);
  let board = JSON.parse(await env.KV.get("aim-board") || "[]");
  if (request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) {}
    const name = String(b.name || "").replace(/[^\p{L}\p{N} _.\-]/gu, "").trim().slice(0, 16);
    const score = Math.floor(Number(b.score)), acc = Math.max(0, Math.min(100, Math.round(Number(b.acc) || 0)));
    if (name.length < 2) return json({ error: "name" }, 400);
    if (RESERVED.includes(name.toLowerCase())) return json({ error: "reserved" }, 400);
    if (!Number.isFinite(score) || score < 1 || score > 100) return json({ error: "score" }, 400);
    const key = name.toLowerCase(), i = board.findIndex(r => r.name.toLowerCase() === key);
    if (i === -1) board.push({ name, score, acc, date: Date.now() });
    else if (score > board[i].score || (score === board[i].score && acc > board[i].acc)) board[i] = { name, score, acc, date: Date.now() };
    board.sort((a, b) => b.score - a.score || b.acc - a.acc || a.date - b.date); board = board.slice(0, 100);
    await env.KV.put("aim-board", JSON.stringify(board));
    return json({ top: board.slice(0, 10), rank: board.findIndex(r => r.name.toLowerCase() === key) + 1 });
  }
  return json({ top: board.slice(0, 10) });
}
