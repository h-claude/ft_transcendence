import { BlockchainService } from "./blockchainService.js";
import db from "../database.js";

const queue = [];
let isProcessing = false;

async function processNext() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  const job = queue.shift();
  const { matchId, userUids, userScores, timestamp } = job;

  //console.log("[QUEUE_PROCESSING_START]", { matchId, len: queue.length });

  try {
    const userIdsUint = userUids.map(BlockchainService.uuidToUint256);
    const result = await BlockchainService.saveScore(userIdsUint, userScores, timestamp);

    //console.log("[QUEUE_TX_HASH]", result.txHash);
    //console.log("[QUEUE_GAME_ID]", result.gameId?.toString?.() ?? "(none)");

    try {
      const insert = db.prepare(`
        INSERT INTO blockchain_matches (game_id, tx_hash, user_uids, scores, timestamp, confirmed, match_id_fk)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `);
      insert.run(
        result.gameId?.toString?.() ?? "(none)",
        result.txHash ?? "(none)",
        JSON.stringify(userUids),
        JSON.stringify(userScores),
        timestamp,
        matchId
      );
      //console.log("[QUEUE_DB_INSERT_SUCCESS] blockchain_matches entry added for match_id:", matchId);
    } catch (dbErr) {
      console.error("[QUEUE_DB_INSERT_ERROR]", dbErr);
    }

  } catch (err) {
    console.error("[QUEUE_BLOCKCHAIN_ERROR]", { matchId, error: err.message });
  } finally {
    isProcessing = false;
    if (queue.length > 0) {
      setTimeout(processNext, 1500);
    }
  }
}

export const BlockchainQueue = {
  enqueue(matchId, userUids, userScores, timestamp) {
    queue.push({ matchId, userUids, userScores, timestamp });
    console.log("[QUEUE_ENQUEUED]", { matchId, len: queue.length });
    processNext();
  },
  size() {
    return queue.length;
  }
};