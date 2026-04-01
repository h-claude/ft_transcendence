import { BlockchainService } from "../services/blockchainService.js";

export default async function scoreRoutes(fastify) {
  // save
  fastify.post("/api/score/save", async (request, reply) => {
    const { userIds, scores, time } = request.body ?? {};
    if (!Array.isArray(userIds) || !Array.isArray(scores) || userIds.length !== scores.length || userIds.length === 0) {
      return reply.code(400).send({ message: "userIds & scores: arrays de même longueur (>0) requis" });
    }
    if (userIds.length > 7) return reply.code(400).send({ message: "max 7 joueurs" });
    const t = Number.isFinite(Number(time)) ? Number(time) : Date.now();
    const { txHash, gameId } = await BlockchainService.saveScore(userIds, scores, t);
    return reply.send({ txHash, gameId, time: t });
  });

  // read packed
  fastify.get("/api/score/packed", async (request, reply) => {
    const { gameId } = request.query ?? {};
    if (typeof gameId !== "string" || !gameId.startsWith("0x") || gameId.length !== 66) {
      return reply.code(400).send({ message: "gameId (0x + 64 hex) requis" });
    }
    const { packed, count, scores } = await BlockchainService.getScorePacked(gameId);
    return reply.send({ packed: packed.toString(), count, scores });
  });

  // ➜ NOUVEAU: find by userIds (tournoi)
  // GET /api/score/find?userIds=1,2,3&limit=10&mode=contains|exact
  fastify.get("/api/score/find", async (request, reply) => {
    const { userIds, limit, mode, fromBlock, toBlock } = request.query ?? {};
    if (!userIds) return reply.code(400).send({ message: "query userIds=1,2,3 requis" });
    const ids = String(userIds).split(",").map(s => Number(s.trim())).filter(Number.isFinite);
    if (ids.length === 0) return reply.code(400).send({ message: "userIds vides" });

    const opts = {
      limit: Number(limit) > 0 ? Number(limit) : 20,
      mode: mode === "exact" ? "exact" : "contains",
      fromBlock: fromBlock ? Number(fromBlock) : 0,
      toBlock: toBlock ? Number(toBlock) : "latest",
    };
    const rows = await BlockchainService.findByUserIds(ids, opts);
    return reply.send({ count: rows.length, matches: rows });
  });

  // mini page test (garde les champs libres pour tes userIds réels)
  fastify.get("/api/score/demo", async (_req, reply) => {
    const html = `<!doctype html><meta charset="utf-8"><title>Score demo</title>
<body style="font-family:system-ui;margin:20px">
<h3>Save</h3>
<input id="ids" value="1,2" style="width:240px"> userIds<br>
<input id="scs" value="7,3" style="width:240px"> scores<br>
<input id="tm"  placeholder="auto" style="width:240px"> time (ms, optionnel)<br>
<button id="save">Save</button>
<pre id="o1"></pre>
<hr>
<h3>Read packed</h3>
<input id="gid" style="width:520px" placeholder="0x... bytes32"><br>
<button id="read">Read</button>
<pre id="o2"></pre>
<hr>
<h3>Find by userIds (tournoi)</h3>
<input id="fids" value="1,2" style="width:240px"> userIds filtrés<br>
<input id="flimit" value="10" style="width:80px"> limit
<select id="fmode"><option value="contains" selected>contains</option><option value="exact">exact</option></select>
<button id="find">Find</button>
<pre id="o3"></pre>
<script>
const j = v=>JSON.stringify(v,null,2);
ids.oninput = scs.oninput = ()=> gid.value="";
save.onclick = async ()=>{
  const idsA = ids.value.split(',').map(s=>Number(s.trim())).filter(Number.isFinite);
  const scsA = scs.value.split(',').map(s=>Number(s.trim())).filter(Number.isFinite);
  const t = tm.value.trim(); const body={userIds:idsA,scores:scsA}; if(t) body.time=Number(t);
  const r = await fetch('/api/score/save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const x = await r.json(); o1.textContent = j(x); if(x.gameId) gid.value=x.gameId;
};
read.onclick = async ()=>{
  const r = await fetch('/api/score/packed?gameId='+encodeURIComponent(gid.value.trim()));
  o2.textContent = j(await r.json());
};
find.onclick = async ()=>{
  const qs = new URLSearchParams({userIds:fids.value, limit:flimit.value, mode:fmode.value});
  const r = await fetch('/api/score/find?'+qs.toString());
  o3.textContent = j(await r.json());
};
</script>
</body>`;
    reply.type("text/html").send(html);
  });
}
