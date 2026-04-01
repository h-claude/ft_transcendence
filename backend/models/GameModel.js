import { UserManager } from "../User.js";
import { UsersModel } from "./UsersModel.js";

export const AI_USER_ID = 9999;

export const GameModel = {
	/**
	 * creates a basic template match of type type.
	 * It is pending.
	 * @param {"direct" | "mm" | "tournament" | "ai"} type
	 * @returns {number} the new match id.
	 */
	createMatch(fastify, type, initiator, tournament_id) {
		const allowedTypes = ["direct", "mm", "tournament", "ai"];
		if (!allowedTypes.includes(type)) {
			throw new Error(`GameModel.createMatch: invalid type "${type}". Allowed values: ${allowedTypes.join(', ')}.`);
		}
		if (typeof initiator !== "string") {
			throw new Error(`GameModel.createMatch: initiator must be a string, received ${typeof initiator}.`);
		}
		if (type === "tournament" & tournament_id === null)
			throw new Error("GameModel.createMatch: tournament matches require a tournament_id.");

		if (type === "tournament") {
			const stmt = fastify.db.prepare(
				`INSERT INTO matches (type, status, initiator, tournament_id)
				 VALUES (?, 'pending', ?, ?)`
			).run(type, initiator, tournament_id);
			return (stmt.lastInsertRowid);
		}
		else {
			const stmt = fastify.db.prepare(
				`INSERT INTO matches (type, status, initiator)
				 VALUES (?, 'pending', ?)`
			).run(type, initiator);
			return (stmt.lastInsertRowid);
		}
	},

	/**
	 * Deletes a match from the database without moving it to the old_match table
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match to delete
	 */
	deleteMatch(fastify, matchId) {
		fastify.db.prepare(
			`DELETE FROM matches
			 WHERE id = ?`
		).run(matchId);
	},

	/**
	 * Gets the type of a match from the matches table
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match
	 * @returns {"direct" | "mm" | "tournament" | "ai"} The type of the match
	 */
	getMatchType(fastify, matchId) {
		const stmt = fastify.db.prepare(
			`SELECT type
			 FROM matches
			 WHERE id = ?`
		).get(matchId);
		return (stmt ? stmt.type : undefined);
	},

	/**
	 * Gets the type of a match from the old_matches table
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match
	 * @returns {"direct" | "mm" | "tournament" | "ai"} The type of the match
	 */
	getOldMatchType(fastify, matchId) {
		const stmt = fastify.db.prepare(
			`SELECT type
			 FROM old_matches
			 WHERE match_id = ?`
		).get(matchId);
		return (stmt ? stmt.type : undefined);
	},

	/**
	 * Gets the initiator of a match from the matches table
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match
	 * @returns {string} The initiator of the match (either "server" or a userId)
	 */
	getMatchInitiator(fastify, matchId) {
		const stmt = fastify.db.prepare(
			`SELECT initiator
			 FROM matches
			 WHERE id = ?`
		).get(matchId);
		return (stmt ? stmt.initiator : undefined);
	},

	/**
	 * Gets the match ID associated with a user ID from the match_participants table
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} userId - The ID of the user
	 * @returns {number} The match ID the user is participating in
	 */
	getMatchIdFromUserId(fastify, userId) {
		const stmt = fastify.db.prepare(
			`SELECT match_id
			 FROM match_participants
			 WHERE user_id = ?`
		).get(userId);
		return (stmt ? stmt.match_id : undefined);
	},

	/**
	 * Gets the initiator of a match from the old_matches table
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match
	 * @returns {string} The initiator of the match (either "server" or a userId)
	 */
	getOldMatchInitiator(fastify, matchId) {
		const stmt = fastify.db.prepare(
			`SELECT initiator
			 FROM old_matches
			 WHERE match_id = ?`
		).get(matchId);
		return (stmt.initiator);
	},

	/**
	* @param {number} matchId
	* @returns {boolean} whether the match exists or not
	*/
	matchExists(fastify, matchId) {
		const stmt = fastify.db.prepare(
			`SELECT * from matches
			 WHERE id = ?`
		).get(matchId);
		return stmt ? true : false;
	},

	/**
	 * Checks if a match exists in the old_matches table
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match to check
	 * @returns {boolean} Whether the match exists or not
	 */
	oldmatchExists(fastify, matchId) {
		const stmt = fastify.db.prepare(
			`SELECT * from old_matches
			 WHERE match_id = ?`
		).get(matchId);
		return stmt ? true : false;
	},

	/**
	 * Checks if a user is participating in a specific match
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match
	 * @param {number} userId - The ID of the user
	 * @returns {boolean} Whether the user is in the match or not
	 */
	isUserInMatch(fastify, matchId, userId) {
		const stmt = fastify.db.prepare(
			`SELECT * FROM match_participants
			 WHERE match_id = ? and user_id = ?`
		).get(matchId, userId);
		return stmt ? true : false;
	},

	/**
	 * Checks if a user participated in a specific old match
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match
	 * @param {number} userId - The ID of the user
	 * @returns {boolean} Whether the user was in the old match or not
	 */
	isUserInOldMatch(fastify, matchId, userId) {
		const stmt = fastify.db.prepare(
			`SELECT * FROM old_matches
			 WHERE match_id = ? and (userid_1 = ? OR userid_2 = ?)`
		).get(matchId, userId, userId);
		return stmt ? true : false;
	},

	/**
	 * Checks if a user is currently participating in any match
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} userId - The ID of the user
	 * @returns {boolean} Whether the user is in any match or not
	 */
	isUserInAMatch(fastify, userId) {
		const stmt = fastify.db.prepare(
			`SELECT * FROM match_participants
			 WHERE user_id = ?`
		).get(userId);
		return stmt ? true : false;
	},

	/**
	 * Gets the current match ID for a user
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} userId - The ID of the user
	 * @returns {number | undefined} The match ID if user is in a match, undefined otherwise
	 */
	getUserCurrentMatch(fastify, userId) {
		const stmt = fastify.db.prepare(
			`SELECT match_id
			 FROM match_participants
			 WHERE user_id = ?`
		).get(userId);
		if (!stmt) {
			return (undefined);
		}
		return (stmt.match_id);
	},

	/**
	 * Gets the opponent's user ID in a match
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match
	 * @param {number} userId - The ID of the current user
	 * @returns {number} The opponent's user ID
	 */
	getOpponentId(fastify, matchId, userId) {
		const stmt = fastify.db.prepare(
			`SELECT user_id
			 FROM match_participants
			 WHERE match_id = ?
			 AND user_id != ?`
		).get(matchId, userId);
		return (stmt ? stmt.user_id : undefined);
	},

	/**
	* @param {number} matchId
	* @param {"pending" | "ongoing" | "finished" | "canceled"} newStatus
	*/
	changeMatchStatus(fastify, matchId, newStatus) {
		fastify.db.prepare(
			`UPDATE matches
			 SET status = ?
			 WHERE id = ?`
		).run(newStatus, matchId);
	},

	/**
	 * @param {number} matchId
	* @returns {"pending" | "ongoing" | "finished" | "canceled"};
	*/
	getMatchStatus(fastify, matchId) {
		const stmt = fastify.db.prepare(
			`SELECT status
			 FROM matches
			 WHERE id = ?`
		).get(matchId);
		return (stmt ? stmt.status : undefined);
	},

	/**
	 * Gets comprehensive match information for a user including opponent details
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} userId - The ID of the user
	 * @returns {object} Match information including opponent ID
	 */
	getMatchInfosByUserId(fastify, userId) {
		const stmt = fastify.db.prepare(
			`
			SELECT
				matches.*,
				opponent.user_id AS opponent_id
			FROM
				match_participants AS self
			JOIN matches ON self.match_id = matches.id
			LEFT JOIN match_participants AS opponent
				ON opponent.match_id = self.match_id AND opponent.user_id != self.user_id
			WHERE
				self.user_id = ?
		`
		).get(userId);

		if (!stmt) {
			return stmt;
		}

		if ((stmt.opponent_id == null || stmt.opponent_id === undefined) && stmt.type === "ai") {
			stmt.opponent_id = AI_USER_ID;
		}

		return stmt;
	},

	/**
	 * Gets detailed information about a specific match (structure to be defined)
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match
	 * @returns {object} Match information
	 */
	getMatchInfos(fastify, matchId) {
		// structure a definire
		const stmt = fastify.db.prepare(
			``
		).get();
	},

	/**
	 * Adds a participant to a match with a specific role
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match
	 * @param {number} userId - The ID of the user to add
	 * @param {"player" | "spectator"} role - The role of the participant
	 */
	addParticipant(fastify, matchId, userId, role) {
		const stmt = fastify.db.prepare(
			`INSERT INTO match_participants (match_id, user_id, role)
			 VALUES (?, ?, ?)`
		).run(matchId, userId, role);
	},

	/**
	 * Removes a participant from a match
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match
	 * @param {number} userId - The ID of the user to remove
	 */
	removeParticipant(fastify, matchId, userId) {
		const stmt = fastify.db.prepare(
			`DELETE FROM match_participants
			 WHERE match_id = ? AND user_id = ?`
		).run(matchId, userId);
	},

	/**
	 * Gets all participants of a match with their roles
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match
	 * @returns {Array<{user_id: number, role: string}>} Array of participants with their roles
	 */
	getAllParticipants(fastify, matchId) {
		const stmt = fastify.db.prepare(
			`SELECT 
				mp.user_id,
				mp.role,
				u.username,
				u.uid
			 FROM match_participants AS mp
			 JOIN users AS u ON u.id = mp.user_id
			 WHERE mp.match_id = ?`
		).all(matchId);
		return stmt;
	},

	/**
	 * Gets all participants of an old match
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the old match
	 * @returns {Array<{user_id: number}>} Array of participants
	 */
	getAllOldParticipants(fastify, matchId) {
		const stmt = fastify.db.prepare(
			`SELECT user_id
			FROM old_match_participants
			WHERE match_id = ?`
		).all(matchId);
		return stmt;
	},
	
	/**
	 * Gets the role of a user in a specific match
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match
	 * @param {number} userId - The ID of the user
	 * @returns {object | undefined} Object containing the role, or undefined if user not in match
	 */
	getUserRoleForMatch(fastify, matchId, userId) {
		const stmt = fastify.db.prepare(
			`SELECT role
			 FROM match_participants
			 WHERE match_id = ? AND user_id = ?`
		).get(matchId, userId);
		return stmt;
	},

	/**
	 * Gets the tournament ID associated with a match
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match
	 * @returns {number} The tournament ID
	 */
	getTournamentIdFromMatchId(fastify, matchId) {
		const stmt = fastify.db.prepare(
			`SELECT tournament_id
			FROM matches
			WHERE id = ?`
		).get(matchId);
		if (!stmt) {
			return (null);
		}
		return (stmt.tournament_id);
	},

	getTournamentIdFromOldMatchId(fastify, matchId) {
		const stmt = fastify.db.prepare(
			`SELECT tournament_id
			FROM old_matches
			WHERE match_id = ?`
		).get(matchId);
		if (!stmt) {
			return (null);
		}
		return (stmt.tournament_id);
	},

	/**
	 * Gets the match ID(s) associated with a tournament
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} tournamentId - The ID of the tournament
	 * @returns {number} The match ID
	 */
	getMatchIdFromTournamentId(fastify, tournamentId) {
		const stmt = fastify.db.prepare(
			`SELECT id
			FROM matches
			WHERE tournament_id = ?`
		).get(tournamentId);
		return stmt.id;
	},

	/**
	 * Sets the tournament stage flag for a specific match
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match to update
	 * @param {"demi-final" | "final"} newStatus - The new tournament stage
	 */
	setTournamentStatus(fastify, matchId, newStatus) {
		fastify.db.prepare(
			`UPDATE matches
			 SET status_tournament = ?
			 WHERE id = ?`
		).run(newStatus, matchId);
	},

	/**
	 * Sets the winner of a match
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match
	 * @param {number} winnerId - The ID of the winning user
	 */
	setWinner(fastify, matchId, winnerId) {
		fastify.db.prepare(
			`UPDATE matches
			 SET winner_id = ?
			 WHERE id = ?`
		).run(winnerId, matchId);
	},

	/**
	 * Gets the current tournament status for matches in a tournament
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} tournamentId - The ID of the tournament
	 * @returns {"demi-final" | "final"} The current tournament status
	 */
	getTournamentStatus(fastify, tournamentId) {
		const stmt = fastify.db.prepare(
			`SELECT status_tournament
			 FROM matches
			 WHERE tournament_id = ?`
		).get(tournamentId);
		return (stmt.status_tournament);
	},

	/**
	 * Checks if a match is part of a tournament
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match
	 * @returns {boolean} true if the match is in a tournament, false otherwise
	 */
	matchIsInTournament(fastify, matchId) {
		const stmt = fastify.db.prepare(
			`SELECT *
			 FROM matches
			 WHERE id = ? AND type = 'tournament'`
		).get(matchId);
		if (!stmt) return false;
		return (stmt.tournament_id != null);
	},

	/**
	 * Checks if an old match was part of a tournament
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the old match
	 * @returns {boolean} true if the old match was in a tournament, false otherwise
	 */
	oldmatchIsInTournament(fastify, matchId) {
		const stmt = fastify.db.prepare(
			`SELECT *
			 FROM old_matches
			 WHERE match_id = ? AND type = 'tournament'`
		).get(matchId);
		if (!stmt) return false;
		return (stmt.tournament_id != null);
	},

	/**
	 * Moves a match from the matches table to the old_matches table
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match to move
	 */
	moveToOldMatches(fastify, matchId) {
		const stmt = fastify.db.prepare(
			`INSERT INTO old_matches (match_id, start_time, end_time, winner_id, tournament_id, type, status_tournament, initiator)
			SELECT
				id,
				start_time,
				end_time,
				winner_id,
				tournament_id,
				type,
				status_tournament,
				initiator
			FROM matches
			WHERE id = ?`
		).run(matchId);
	},

	/**
	 * Sets the final scores for a finished match
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match
	 * @param {Object} scores - An object mapping user IDs to their scores, e.g. { userId1: score1, userId2: score2 }
	 * @throws {Error} If there aren't exactly 2 participants in the match or if scores for both users are not provided
	 */
	setScore(fastify, matchId, scores) {
		const participants = this.getAllParticipants(fastify, matchId);
		if (participants.length !== 2)
			throw new Error(`GameModel.setScore: expected 2 participants for match ${matchId}, found ${participants.length}.`);

		for (const participant of participants) {
			const score = scores[participant.user_id];
			if (score === undefined) {
				throw new Error(`GameModel.setScore: missing score for user ${participant.user_id} in match ${matchId}.`);
			}
			fastify.db.prepare(
				`UPDATE match_participants
				 SET score = ?
				 WHERE match_id = ? AND user_id = ?`
			).run(score, matchId, participant.user_id);
		}
	},

	/**
	 * Completes a match by setting it as finished, moving to old_matches, setting scores, and cleaning up
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match to finish
	 * @param {Object} scores - An object mapping user IDs to their scores, e.g. { userId1: score1, userId2: score2 }
	 * @throws {Error} If the match doesn't exist
	 */
	finishMatch(fastify, matchId, scores) { // faut surement que je protege les fonctions et ajout de verif
		if (!this.matchExists(fastify, matchId))
			throw new Error(`GameModel.finishMatch: match ${matchId} does not exist.`);
		if (this.getMatchStatus(fastify, matchId) === "finished")
			throw new Error(`GameModel.finishMatch: match ${matchId} is already finished.`);
		const matchType = this.getMatchType(fastify, matchId);
		if (matchType === "ai") {
			const participants = this.getAllParticipants(fastify, matchId);
			this.deleteMatch(fastify, matchId);
			this.updateUsersAfterMatch(fastify, matchId, participants, true);
			return;
		}
		if (Object.keys(scores).length !== 2)
			throw new Error(`GameModel.finishMatch: expected 2 scores for match ${matchId}, received ${Object.keys(scores).length}.`);
		console.log(`Finishing match ${matchId} with scores:`, scores);

		const participants = this.getAllParticipants(fastify, matchId);
		if (participants.length !== 2)
			throw new Error(`GameModel.finishMatch: expected 2 participants for match ${matchId}, found ${participants.length}.`);

		const winnerId = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
		const winnerIdNumber = Number.parseInt(winnerId, 10);

		this.setWinner(fastify, matchId, winnerIdNumber);
		this.changeMatchStatus(fastify, matchId, "finished");
		this.moveToOldMatches(fastify, matchId);
		this.setScore(fastify, matchId, scores);
		this.archiveParticipants(fastify, matchId);
		this.deleteMatch(fastify, matchId);

		if (Number.isInteger(winnerIdNumber)) {
			UsersModel.incrementWins(fastify, winnerIdNumber);
			const loser = participants.find((participant) => participant.user_id !== winnerIdNumber);
			if (loser && Number.isInteger(loser.user_id)) {
				UsersModel.incrementLosses(fastify, loser.user_id);
			}
		}

		this.updateUsersAfterMatch(fastify, matchId, participants);
	},

	/**
	 * Gets the winner of a finished match
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match
	 * @returns {number} The user ID of the winner
	 * @throws {Error} If the match is not finished or doesn't exist
	 */
	getWinner(fastify, matchId) {
		const stmt = fastify.db.prepare(
			`SELECT winner_id
			FROM old_matches
			WHERE match_id = ?`
		).get(matchId);

		if (!stmt || stmt.winner_id == null)
			throw new Error(`GameModel.getWinner: match ${matchId} is not finished or is missing from archives.`);

		return stmt.winner_id;
	},

	/**
	 * Gets the loser of a finished match
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match
	 * @returns {number} The user ID of the loser
	 * @throws {Error} If the match is not finished or doesn't exist
	 */
	getLoser(fastify, matchId) {
		const winnerId = this.getWinner(fastify, matchId);
		const stmt = fastify.db.prepare(
			`SELECT user_id
			FROM old_match_participants
			WHERE match_id = ? AND user_id != ?
			LIMIT 1`
		).get(matchId, winnerId);

		if (!stmt)
			throw new Error(`GameModel.getLoser: match ${matchId} is not finished or is missing from archives.`);

		return stmt.user_id;
	},

	/**
	 * Updates user statuses and frees them to play after a match concludes
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match that has concluded
	 * @param {Array<{user_id: number, role: string}>} participants - Array of participants in the match
	 * @param {boolean} includeTournamentMatch - Whether to include tournament matches in the update (default: false)
	 * @throws {Error} If there aren't exactly 2 participants in the match
	 * @description This function updates the match status and searching status of users who participated in a match.
	 * It also marks them as free to play again. This is only done for matches that are not part of a tournament.
	 */
	updateUsersAfterMatch(fastify, matchId, participants, includeTournamentMatch = false) {
		if (participants.length < 1)
			throw new Error(`GameModel.updateUsersAfterMatch: expected 1 or more participant for match ${matchId}, found ${participants.length}.`);

		if (!this.oldmatchIsInTournament(fastify, matchId) || (includeTournamentMatch)) {
			participants.forEach((participant) => {
				UsersModel.setMatchStatus(fastify, participant.user_id, 0);
				UsersModel.setSearchingForMatch(fastify, participant.user_id, 0);
				UserManager.setFreeToGame(participant.user_id, true);
			});
		}
	},

	/**
	 * Archives participants of a match into the old_match_participants table
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match whose participants are to be archived
	 * @description This function copies participants from the match_participants table to the old_match_participants table
	 * for a given match ID. It uses an INSERT OR REPLACE statement to ensure that if a participant already exists
	 * in the old table, their record is updated instead of creating a duplicate.
	 */
	archiveParticipants(fastify, matchId) {
		fastify.db.prepare(
			`INSERT OR REPLACE INTO old_match_participants (match_id, user_id, role, score)
			SELECT match_id, user_id, role, score
			FROM match_participants
			WHERE match_id = ?`
		).run(matchId);


	},

	/**
	 * Cleans up a match by resetting user statuses, canceling the match, archiving participants, and deleting the match record
	 * @param {object} fastify - The Fastify instance containing the database connection
	 * @param {number} matchId - The ID of the match to sanitize
	 * @description This function is used to clean up a match that is being canceled.
	 * It resets the match status and searching status of all participants, marks them as free to play,
	 * changes the match status to "canceled", moves the match to the old_matches table,
	 * archives the participants, and finally deletes the match record from the matches table.
	 */
	sanitizeGameState(fastify, matchId) {
		const participants = this.getAllParticipants(fastify, matchId);

		participants.forEach((participant) => {
			UsersModel.setMatchStatus(fastify, participant.user_id, 0);
			UsersModel.setSearchingForMatch(fastify, participant.user_id, 0);
			UserManager.setFreeToGame(participant.user_id, true);
		});

		this.changeMatchStatus(fastify, matchId, "canceled");
		this.moveToOldMatches(fastify, matchId);
		this.archiveParticipants(fastify, matchId);
		this.deleteMatch(fastify, matchId);
		console.log(`Sanitized game state for match ${matchId}`);
	},

	getLeaderboardWinRatios(fastify, _limit = 10) {
		const rows = fastify.db.prepare(
			`
			SELECT
				u.id AS user_id,
				u.username,
				ps.wins AS wins,
				ps.losses AS losses,
				(ps.wins + ps.losses) AS total_games,
				CASE
					WHEN (ps.wins + ps.losses) = 0 THEN 0
					ELSE ROUND((CAST(ps.wins AS FLOAT) / (ps.wins + ps.losses)) * 100, 2)
				END AS win_ratio
			FROM users u
			JOIN player_stats ps ON ps.user_id = u.id
			WHERE u.role != 'server'
			ORDER BY ps.wins DESC, total_games DESC, win_ratio DESC, u.username ASC
			`
		).all();
		return rows;
	},
}
