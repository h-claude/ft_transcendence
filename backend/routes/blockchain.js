import { BlockchainService } from "../services/blockchainService.js";
import { UsersModel } from "../models/UsersModel.js";
import { TournamentModel } from "../models/TournamentModel.js";
import db from "../database.js";

export default async function blockchainRoutes(fastify) {
  fastify.get("/api/blockchain/matches/me", async (req, reply) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return reply.code(401).send({ success: false, error: "Non authentifié" });
      }

      const matchIdsStmt = db.prepare('SELECT match_id FROM old_match_participants WHERE user_id = ?');
      const matchIds = matchIdsStmt.all(userId).map(row => row.match_id);

      const finalHistory = [];
      if (matchIds.length > 0) {
        const placeholders = matchIds.map(() => '?').join(',');
        const oldMatchesStmt = db.prepare(`SELECT match_id, type, tournament_id, end_time FROM old_matches WHERE match_id IN (${placeholders})`);
        const oldMatches = oldMatchesStmt.all(...matchIds);

        const bcMatchesStmt = db.prepare(`SELECT match_id_fk, game_id, tx_hash, user_uids, timestamp FROM blockchain_matches WHERE match_id_fk IN (${placeholders})`);
        const bcMatches = bcMatchesStmt.all(...matchIds);
        const bcMatchesMap = new Map(bcMatches.map(m => [m.match_id_fk, m]));

        const processedTournaments = new Set();
        for (const oldMatch of oldMatches) {
          const bcData = bcMatchesMap.get(oldMatch.match_id);
          if (!bcData) continue;

          if (oldMatch.type === 'tournament' && oldMatch.tournament_id) {
            if (processedTournaments.has(oldMatch.tournament_id)) continue;

            const tournamentDetails = TournamentModel.getTournamentDetails(fastify, oldMatch.tournament_id);
            const allTournamentMatchIds = tournamentDetails.matches.map(m => m.id);
            if (allTournamentMatchIds.length > 0) {
              const tourneyPlaceholders = allTournamentMatchIds.map(() => '?').join(',');
              const allBcMatchesStmt = db.prepare(`SELECT match_id_fk, game_id, tx_hash FROM blockchain_matches WHERE match_id_fk IN (${tourneyPlaceholders})`);
              const allBcMatches = allBcMatchesStmt.all(...allTournamentMatchIds);
              const allBcMatchesMap = new Map(allBcMatches.map(m => [m.match_id_fk, m]));
              for (const tMatch of tournamentDetails.matches) {
                const tMatchBcData = allBcMatchesMap.get(tMatch.id);
                if (tMatchBcData) {
                  tMatch.txHash = tMatchBcData.tx_hash;
                  tMatch.gameId = tMatchBcData.game_id;
                }
              }
            }
            finalHistory.push({
              type: 'tournament', id: oldMatch.tournament_id, details: tournamentDetails, time: oldMatch.end_time
            });
            processedTournaments.add(oldMatch.tournament_id);
          } else {
            const { scores } = await BlockchainService.getScorePacked(bcData.game_id);
            const userUids = JSON.parse(bcData.user_uids);
            const usernames = userUids.map(uid => UsersModel.getByUid(fastify, uid)?.username || uid.slice(0, 8));
            finalHistory.push({
              type: 'simple', gameId: bcData.game_id, txHash: bcData.tx_hash,
              userIds: userUids, usernames, scores, time: bcData.timestamp,
            });
          }
        }
      }
      const userUid = UsersModel.getUidById(fastify, userId);
      const aiUid = UsersModel.getUidById(fastify, 9999);

      const aiMatchesStmt = db.prepare(`
        SELECT game_id, tx_hash, user_uids, timestamp
        FROM blockchain_matches
        WHERE user_uids LIKE ? AND user_uids LIKE ? AND match_id_fk IS NULL
      `);
      const aiMatches = aiMatchesStmt.all(`%${userUid}%`, `%${aiUid}%`);

      for (const aiMatch of aiMatches) {
        const { scores } = await BlockchainService.getScorePacked(aiMatch.game_id);
        const userUids = JSON.parse(aiMatch.user_uids);
        const usernames = userUids.map(uid => UsersModel.getByUid(fastify, uid)?.username || '...');
        finalHistory.push({
          type: 'simple', gameId: aiMatch.game_id, txHash: aiMatch.tx_hash,
          userIds: userUids, usernames, scores, time: aiMatch.timestamp,
        });
      }

      finalHistory.sort((a, b) => {
        const timeA = a.time ? (typeof a.time === 'string' ? Date.parse(a.time) : a.time) : 0;
        const timeB = b.time ? (typeof b.time === 'string' ? Date.parse(b.time) : b.time) : 0;
        return timeB - timeA;
      });

      return reply.send({ success: true, history: finalHistory });

    } catch (err) {
      console.error("[API_BLOCKCHAIN_MATCHES_ERR]", err);
      return reply.code(409).send({ success: false, error: err?.stack || JSON.stringify(err) });
    }
  });
}