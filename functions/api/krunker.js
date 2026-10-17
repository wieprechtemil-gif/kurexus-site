import { json, cached } from "../_shared.js";
// GET /api/krunker — live Krunker profile via the social page's websocket (msgpack)
const USER = "kodakosan";

// --- tiny msgpack (enough for Krunker's social socket)
function enc(v){
  const out = [];
  const w = x=>{
    if(x === null || x === undefined) out.push(0xc0);
    else if(typeof x === "string"){ const b = new TextEncoder().encode(x); if(b.length < 32) out.push(0xa0 | b.length); else if(b.length < 256) out.push(0xd9, b.length); else out.push(0xda, b.length >> 8, b.length & 255); out.push(...b); }
    else if(typeof x === "number" && Number.isInteger(x) && x >= 0 && x < 128) out.push(x);
    else if(typeof x === "number"){ const dv = new DataView(new ArrayBuffer(9)); dv.setUint8(0, 0xcb); dv.setFloat64(1, x); out.push(...new Uint8Array(dv.buffer)); }
    else if(typeof x === "boolean") out.push(x ? 0xc3 : 0xc2);
    else if(Array.isArray(x)){ if(x.length < 16) out.push(0x90 | x.length); else out.push(0xdc, x.length >> 8, x.length & 255); x.forEach(w); }
  };
  w(v); return new Uint8Array(out);
}
function dec(buf){
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength); let p = 0;
  const str = n=>{ const s = new TextDecoder().decode(buf.subarray(p, p + n)); p += n; return s; };
  const arr = n=>{ const a = []; for(let i=0;i<n;i++) a.push(r()); return a; };
  const map = n=>{ const o = {}; for(let i=0;i<n;i++){ const k = r(); o[k] = r(); } return o; };
  function r(){
    const b = dv.getUint8(p++);
    if(b < 0x80) return b; if(b >= 0xe0) return b - 256;
    if((b & 0xf0) === 0x80) return map(b & 15); if((b & 0xf0) === 0x90) return arr(b & 15); if((b & 0xe0) === 0xa0) return str(b & 31);
    switch(b){
      case 0xc0: return null; case 0xc2: return false; case 0xc3: return true;
      case 0xc4: { const n = dv.getUint8(p); p += 1; p += n; return null; } case 0xc5: { const n = dv.getUint16(p); p += 2 + n; return null; } case 0xc6: { const n = dv.getUint32(p); p += 4 + n; return null; }
      case 0xca: { const v = dv.getFloat32(p); p += 4; return v; } case 0xcb: { const v = dv.getFloat64(p); p += 8; return v; }
      case 0xcc: return dv.getUint8(p++); case 0xcd: { const v = dv.getUint16(p); p += 2; return v; } case 0xce: { const v = dv.getUint32(p); p += 4; return v; } case 0xcf: { const v = Number(dv.getBigUint64(p)); p += 8; return v; }
      case 0xd0: return dv.getInt8(p++); case 0xd1: { const v = dv.getInt16(p); p += 2; return v; } case 0xd2: { const v = dv.getInt32(p); p += 4; return v; } case 0xd3: { const v = Number(dv.getBigInt64(p)); p += 8; return v; }
      case 0xd9: { const n = dv.getUint8(p); p += 1; return str(n); } case 0xda: { const n = dv.getUint16(p); p += 2; return str(n); } case 0xdb: { const n = dv.getUint32(p); p += 4; return str(n); }
      case 0xdc: { const n = dv.getUint16(p); p += 2; return arr(n); } case 0xdd: { const n = dv.getUint32(p); p += 4; return arr(n); }
      case 0xde: { const n = dv.getUint16(p); p += 2; return map(n); } case 0xdf: { const n = dv.getUint32(p); p += 4; return map(n); }
    }
    throw new Error("msgpack 0x" + b.toString(16));
  }
  return r();
}

async function ask(url, msg, ms=7000){
  const res = await fetch(url, { headers:{ Upgrade:"websocket", Origin:"https://krunker.io", "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36" } });
  const ws = res.webSocket; if(!ws) throw new Error("no websocket (" + res.status + ")");
  ws.accept();
  return await new Promise((resolve, reject)=>{
    const msgs = [], t = setTimeout(()=>{ try{ ws.close(); }catch(e){} resolve(msgs); }, ms);
    ws.addEventListener("message", e=>{
      try{
        const d = typeof e.data === "string" ? e.data : dec(new Uint8Array(e.data));
        msgs.push(d);
        if(Array.isArray(d) && d[0] === "0" && d[1] === "profile"){ clearTimeout(t); try{ ws.close(); }catch(x){} resolve(msgs); }
        if(Array.isArray(d) && (d[0] === "pi" || d[0] === "po")) ws.send(enc([d[0] === "pi" ? "po" : "pi"]));
      }catch(err){ msgs.push("decode error: " + err.message); }
    });
    ws.addEventListener("error", ()=>{ clearTimeout(t); reject(new Error("ws error")); });
    ws.send(enc(msg));
  });
}

export const onRequestGet = ctx => {
  const debug = new URL(ctx.request.url).searchParams.has("debug");
  const run = async ()=>{
    const tries = [
      ["https://social.krunker.io/ws", ["r", "profile", USER, null]],
      ["https://social.krunker.io/ws", ["r", ["profile", USER, "000000", null]]],
      ["https://krunker_social.krunker.io/ws", ["r", ["profile", USER, "000000", null]]]
    ];
    const log = [];
    for(const [url, msg] of tries){
      try{
        const msgs = await ask(url, msg);
        log.push({ url, msg, got: JSON.stringify(msgs).slice(0, 1500) });
        let prof = null;
        for(const m of msgs){ if(Array.isArray(m)){ const cand = m.find(x=>x && typeof x === "object" && !Array.isArray(x) && (x.player_name || x.player_kills != null)) || (Array.isArray(m[1]) ? m[1].find(x=>x && typeof x === "object" && (x.player_name || x.player_kills != null)) : null) || (m[2] && typeof m[2] === "object" && m[2].player_kills != null ? m[2] : null); if(cand){ prof = cand; break; } } }
        if(prof){
          const st = typeof prof.player_stats === "string" ? (()=>{ try{ return JSON.parse(prof.player_stats); }catch(e){ return {}; } })() : (prof.player_stats || {});
          const n = k=>Number(prof[k] ?? st[k] ?? 0) || 0;
          const kills = n("player_kills"), deaths = n("player_deaths"), score = n("player_score"), games = n("player_games_played"), wins = n("player_wins");
          const shots = Number(st.s ?? 0), hits = Number(st.h ?? 0), hs = Number(st.hs ?? 0), wb = Number(st.wb ?? 0), ms = Number(st.ms ?? 0), as = Number(st.ast ?? st.as ?? 0);
          const out = {
            name: prof.player_name, clan: prof.player_clan || null, level: Math.max(1, Math.floor(.03*Math.sqrt(score))), score,
            kills, deaths, kd: deaths ? +(kills/deaths).toFixed(2) : kills, kpg: games ? +(kills/games).toFixed(2) : 0, games, wins,
            timeMs: n("player_timeplayed"), followers: prof.player_followed ?? null, kr: prof.player_funds ?? null,
            shots, hits, headshots: hs, wallbangs: wb, melee: Number(st.mk ?? 0), assists: as, misses: shots ? shots - hits : null,
            accuracy: shots ? +(hits/shots*100).toFixed(1) : null, hsKills: kills && hs ? +(hs/kills*100).toFixed(1) : null
          };
          if(debug) out._raw = prof;
          return json(out);
        }
      }catch(e){ log.push({ url, msg, err: String(e.message || e) }); }
    }
    return json({ error:"no profile", log: debug ? log : undefined }, 500);
  };
  return debug ? run() : cached(ctx, 1800, run);
};
