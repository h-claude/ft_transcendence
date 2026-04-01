// backend/services/blockchainService.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

/* ---------- chargeur .env ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

function loadEnvFile() {
  const candidates = path.join(ROOT, ".env");
  const lines = fs.readFileSync(candidates, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const k = m[1];
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] == null) process.env[k] = v;
  }
}
loadEnvFile();
/* ------------------------------------------------------------------------- */

const FUJI_RPC_URL = process.env.FUJI_RPC_URL;
const BACKEND_WALLET_PRIVATE_KEY = process.env.BACKEND_WALLET_PRIVATE_KEY;

if (!FUJI_RPC_URL || !BACKEND_WALLET_PRIVATE_KEY) {
  throw new Error("Manque FUJI_RPC_URL ou BACKEND_WALLET_PRIVATE_KEY dans .env");
}

const CONTRACT_ADDRESS = "0x4C24a4A6B970fA4686AA662D2e15B13D532d1110";

const CONTRACT_ABI = [
  {
    "inputs":[
      {"internalType":"uint256[]","name":"userIds","type":"uint256[]"},
      {"internalType":"uint32[]","name":"scores","type":"uint32[]"},
      {"internalType":"uint256","name":"time","type":"uint256"}
    ],
    "name":"setScore","outputs":[],"stateMutability":"nonpayable","type":"function"
  },
  {
    "inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],
    "name":"gameScore","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],
    "stateMutability":"view","type":"function"
  },
  {
    "anonymous":false,"inputs":[
      {"indexed":true,"internalType":"bytes32","name":"gameId","type":"bytes32"},
      {"indexed":false,"internalType":"uint256[]","name":"userIds","type":"uint256[]"},
      {"indexed":false,"internalType":"uint32[]","name":"scores","type":"uint32[]"},
      {"indexed":false,"internalType":"uint256","name":"packed","type":"uint256"},
      {"indexed":false,"internalType":"uint256","name":"time","type":"uint256"}
    ],
    "name":"ScoreSaved","type":"event"
  }
];

const provider = new ethers.JsonRpcProvider(FUJI_RPC_URL);
const signer   = new ethers.Wallet(BACKEND_WALLET_PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

/* ------------------------------------------------------------------------- */
/* 🔄 Conversion UUID <-> BigInt cohérente et symétrique                      */
/* ------------------------------------------------------------------------- */
function uuidToUint256(uuid) {
  return BigInt("0x" + uuid.replace(/-/g, "").padStart(64, "0"));
}

function uint256ToUuid(bi) {
  let hex = bi.toString(16).padStart(32, "0"); // 128 bits = 32 hex chars
  return (
    hex.slice(0, 8) + "-" +
    hex.slice(8, 12) + "-" +
    hex.slice(12, 16) + "-" +
    hex.slice(16, 20) + "-" +
    hex.slice(20)
  );
}

/* ------------------------------------------------------------------------- */
function sortPairsByUserId(userIds, scores) {
  const pairs = userIds.map((id, i) => ({
    id: BigInt(id),
    score: Number(scores[i]),
  }));
  pairs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { ids: pairs.map(p => p.id), scs: pairs.map(p => p.score) };
}

function decodePacked(packedBigInt) {
  const packed = BigInt(packedBigInt);
  const count = Number(packed & 0xFFn);
  const scores = [];
  for (let i = 0; i < count; i++) {
    const shift = 8n + 32n * BigInt(i);
    scores.push(Number((packed >> shift) & 0xFFFFFFFFn));
  }
  return { count, scores };
}

/* ------------------------------------------------------------------------- */
export const BlockchainService = {
  uuidToUint256,
  uint256ToUuid,

  async saveScore(userIds, scores, time) {
    const { ids, scs } = sortPairsByUserId(userIds, scores);
    const tx = await contract.setScore(ids, scs, BigInt(time));
    const receipt = await tx.wait();

    let gameId = null;
    for (const log of receipt.logs ?? []) {
      try {
        const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
        if (parsed?.name === "ScoreSaved") {
          gameId = parsed.args.gameId;
          break;
        }
      } catch {}
    }
    return { txHash: tx.hash, gameId };
  },

  async getScorePacked(gameId) {
    const packed = await contract.gameScore(gameId);
    const { count, scores } = decodePacked(packed);
    return { packed, count, scores };
  },

  async findByUserIds(userUuids, { fromBlock = 0, toBlock = "latest", limit = 20, mode = "contains" } = {}) {
    // 🧩 ethers v6 : il faut créer une instance d’Interface manuellement
    const iface = new ethers.Interface(CONTRACT_ABI);
    const topic0 = iface.getEvent("ScoreSaved").topicHash;

    const logs = await provider.getLogs({
      address: CONTRACT_ADDRESS,
      topics: [topic0],
      fromBlock,
      toBlock
    });

    const want = userUuids.map(uuidToUint256);
    const wantSet = new Set(want);

    const out = [];
    for (const log of logs) {
      // idem : on parse avec iface.parseLog(), pas contract.interface
      const p = iface.parseLog({ topics: log.topics, data: log.data });
      const ids = p.args.userIds.map(v => BigInt(v));
      const scores = p.args.scores.map(n => Number(n));
      const time = Number(p.args.time);
      const gameId = p.args.gameId;

      let match = false;
      if (mode === "exact") {
        if (ids.length === want.length) {
          const a = [...ids].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
          const b = [...want].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
          match = a.every((v, i) => v === b[i]);
        }
      } else {
        match = [...wantSet].every(v => ids.includes(v));
      }

      if (match) {
        out.push({
          gameId,
          userIds: ids.map(uint256ToUuid), // conversion inverse UUID correcte
          scores,
          time,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber
        });
        if (out.length >= limit) break;
      }
    }

    out.sort((a, b) => (b.blockNumber - a.blockNumber) || (b.time - a.time));
    return out;
  },
};
