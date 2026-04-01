import { UsersModel } from '../models/UsersModel.js';
import { GameModel } from '../models/GameModel.js';
import { User, UserManager } from '../User.js';

export const TournamentModel = {
	/*
	CREATE TABLE IF NOT EXISTS tournaments (
			tournament_id INTEGER PRIMARY KEY AUTOINCREMENT,
			start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			end_time TIMESTAMP,
			winner_id INTEGER,
			initiator TEXT NOT NULL DEFAULT 'server',
			status TEXT CHECK(status IN ('pending', 'ongoing', 'finished', 'canceled')),
			number_of_participants INTEGER NOT NULL CHECK(number_of_participants >= 0 AND number_of_participants <= 4),
			FOREIGN KEY (winner_id) REFERENCES users(id)

	User possede une cle si il est dans un tournois si oui lequel grace a id
	un match possede id de tournois

	ce fichier de creer un tournois avec les users dedans les matchs lies etc...
	*/

	/**
	 * Checks if a tournament exists and has a 'pending' status
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} tournament_id - The ID of the tournament to check
	 * @returns {boolean} True if tournament exists and is pending, false otherwise
	 */
	isTournamentExisting(fastify, tournament_id) {
		//if (typeof tournament_id !== "number")
		//	throw new Error("tournament id must be a number");
		const stmt = fastify.db.prepare(
			`SELECT * FROM tournaments
			 WHERE tournament_id = ?`// AND status = 'pending'`
		).get(tournament_id);
		return stmt ? true : false;
	},

	/**
	 * Creates a new tournament with the specified initiator
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {string} initiator - The user ID who initiated the tournament
	 * @returns {number} The ID of the newly created tournament
	 * @throws {Error} If initiator is not a string
	 */
	createTournament(fastify, initiator) {
		if (typeof initiator !== "string")
			throw new Error("Initiator must be a string");
		const stmt = fastify.db.prepare(
			`INSERT INTO tournaments (initiator, number_of_participants, status)
			 VALUES (?, 0, 'pending')`
		).run(initiator);

		this.addUserToTournament(fastify, stmt.lastInsertRowid, parseInt(initiator));

		return (stmt.lastInsertRowid);
	},

	/**
	 * Gets the number of participants in a tournament
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} tournament_id - The ID of the tournament
	 * @returns {number} The number of participants in the tournament
	 * @throws {Error} If tournament doesn't exist
	 */
	numberParticipant(fastify, tournament_id) {
		if (!this.isTournamentExisting(fastify, tournament_id))
			throw new Error(`Tournament ${tournament_id} was not found.`);
		//if (this.isTournamentCanceled(fastify, tournament_id))
		//	throw new Error("tournament_id is canceled");

		const stmt = fastify.db.prepare(
			`SELECT number_of_participants
			FROM tournaments
			WHERE tournament_id = ?`
		).get(tournament_id);

		return (stmt.number_of_participants);
	},

	/**
	 * Deletes a tournament and removes all participants from it
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} tournament_id - The ID of the tournament to delete
	 * @throws {Error} If tournament doesn't exist
	 */
	deleteTournament(fastify, tournament_id) {
		if (!this.isTournamentExisting(fastify, tournament_id))
			throw new Error(`Tournament ${tournament_id} was not found.`);
		if (this.isTournamentCanceled(fastify, tournament_id))
			throw new Error(`Tournament ${tournament_id} is already canceled.`);

		const userList = this.getListUser(fastify, tournament_id);
		//throw new Error("User list:", userList); // Ajoutez ce log pour voir le contenu de la liste
		for (const u of userList) {
			this.removeUserFromTournament(fastify, u, tournament_id);
			UserManager.setFreeToGame(u, true);
		}
		fastify.db.prepare(`
			UPDATE tournaments
			SET status = 'canceled'
			WHERE tournament_id = ?`).run(tournament_id);
	},

	/**
	 * Gets the initiator (creator) of a tournament
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} tournament_id - The ID of the tournament
	 * @returns {string} The user ID of the tournament initiator
	 * @throws {Error} If tournament doesn't exist
	 */
	getTournamentInitiator(fastify, tournament_id) {
		//if (typeof tournament_id !== "number")
		//	throw new Error("tournament id must be a number");\
		if (!this.isTournamentExisting(fastify, tournament_id))
			throw new Error(`Tournament ${tournament_id} was not found.`);
		const stmt = fastify.db.prepare(
			'SELECT initiator FROM tournaments WHERE tournament_id = ?').get(tournament_id);
		return (stmt.initiator);
	},

	/**
	 * Gets a list of all user IDs participating in a tournament
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} tournament_id - The ID of the tournament
	 * @returns {number[]} Array of user IDs in the tournament
	 * @throws {Error} If tournament doesn't exist
	 */
	getListUser(fastify, tournament_id) {
		//if (typeof tournament_id !== "number")
		//	throw new Error("tournament_id must be a number");

		if (!this.isTournamentExisting(fastify, tournament_id))
			throw new Error(`Tournament ${tournament_id} was not found.`);

		const stmt = fastify.db.prepare(
			`
			SELECT user_id FROM user_status
			WHERE tournament_id = ?`
		).all(tournament_id);

		return (stmt.map(row => row.user_id));
	},

	/**
	 * Gets all participants of a finished tournament
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} tournament_id - The ID of the tournament
	 * @returns {Object[]} Array of participant objects with user_id and status
	 * @throws {Error} If tournament doesn't exist
	 * @throws {Error} If tournament is not finished
	 */
	getAllParticipantsFromTournamentAfterFinish(fastify, tournament_id) {
		if (!this.isTournamentExisting(fastify, tournament_id))
			throw new Error(`Tournament ${tournament_id} was not found.`);

		if (!this.getStatusTournament(fastify, tournament_id) === "finished")
			throw new Error(`Tournament ${tournament_id} is not finished yet.`);

		const stmt = fastify.db.prepare(
			`
			SELECT DISTINCT user_id FROM old_matches
			WHERE tournament_id = ?`).all(tournament_id);
		return (stmt.map(row => ({ user_id: row.user_id })));
	},

	/**
	 * Checks if a specific user is participating in a tournament
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} tournament_id - The ID of the tournament
	 * @param {number} user_id - The ID of the user to check
	 * @returns {boolean} True if user is in tournament, false otherwise
	 * @throws {Error} If tournament doesn't exist
	 */
	isUserInTournament(fastify, tournament_id, user_id) {
		//if (typeof user_id !== "number")
		//	throw new Error("user_id must be a number");

		if (!this.isTournamentExisting(fastify, tournament_id))
			throw new Error(`Tournament ${tournament_id} was not found.`);

		const stmt = fastify.db.prepare(
			`SELECT user_id
			FROM user_status
			WHERE tournament_id = ? AND user_id = ?`
		).get(tournament_id, user_id);

		return (stmt ? true : false);
	},

	/**
	 * Checks if a tournament has been canceled
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} tournament_id - The ID of the tournament
	 * @returns {boolean} True if tournament is canceled, false otherwise
	 * @throws {Error} If tournament doesn't exist
	 */
	isTournamentCanceled(fastify, tournament_id) {
		if (!this.isTournamentExisting(fastify, tournament_id))
			throw new Error(`Tournament ${tournament_id} was not found.`);

		const stmt = fastify.db.prepare(
			`SELECT status
			FROM tournaments
			WHERE tournament_id = ? AND status = 'canceled'`
		).get(tournament_id);

		return (stmt ? true : false);
	},

	/**
	 * Checks if a tournament has been finished
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} tournament_id - The ID of the tournament
	 * @returns {boolean} True if tournament is finished, false otherwise
	 * @throws {Error} If tournament doesn't exist
	 */
	isTournamentFinished(fastify, tournament_id) {
		if (!this.isTournamentExisting(fastify, tournament_id))
			throw new Error(`Tournament ${tournament_id} was not found.`);
		const stmt = fastify.db.prepare(
			`SELECT status
			FROM tournaments
			WHERE tournament_id = ? AND status = 'finished'`
		).get(tournament_id);
		return (stmt ? true : false);
	},

	/**
	 * Adds a user to a tournament
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} tournament_id - The ID of the tournament
	 * @param {number} user_id - The ID of the user to add
	 * @throws {Error} If tournament doesn't exist or tournament is full (max 4 participants)
	 */
	addUserToTournament(fastify, tournament_id, user_id) {
		//if (typeof user_id !== "number")
		//	throw new Error("user_id must be a number");

		if (!this.isTournamentExisting(fastify, tournament_id))
			throw new Error(`Tournament ${tournament_id} was not found.`);

		if (this.numberParticipant(fastify, tournament_id) >= 4)
			throw new Error(`Tournament ${tournament_id} already has the maximum number of participants.`);

		if (this.isTournamentCanceled(fastify, tournament_id))
			throw new Error(`Tournament ${tournament_id} has been canceled.`);

		fastify.db.prepare(
			`UPDATE tournaments
			 SET number_of_participants = number_of_participants + 1
			 WHERE tournament_id = ?`
		).run(tournament_id);

		UsersModel.setInTournament(fastify, user_id, 1);
		UsersModel.setIdOfTournament(fastify, user_id, tournament_id);
	},

	/**
	 * Removes a user from their current tournament
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} user_id - The ID of the user to remove
	 * @param {number} tournament_id - The ID of the tournament
	 * @throws {Error} If the user's tournament doesn't exist
	 */
	removeUserFromTournament(fastify, user_id, tournament_id) {
		//if (typeof user_id !== "number")
		//	throw new Error("user_id must be a number");

		if (!this.isTournamentExisting(fastify, tournament_id))
			throw new Error(`Tournament ${tournament_id} was not found.`);

		if (!this.isUserInTournament(fastify, tournament_id, user_id))
			throw new Error(`User ${user_id} is not in tournament ${tournament_id}.`);

		fastify.db.prepare(
			`UPDATE tournaments
			 SET number_of_participants = number_of_participants - 1
			 WHERE tournament_id = ?`
		).run(tournament_id);

		if (UsersModel.isInAMatch(fastify, user_id)) {
			GameModel.deleteMatch(fastify, GameModel.getMatchIdFromUserId(fastify, user_id));
			UsersModel.setMatchStatus(fastify, user_id, 0);
			UsersModel.setSearchingForMatch(fastify, user_id, 0);
		}

		UsersModel.setInTournament(fastify, user_id, 0);
		UsersModel.setIdOfTournament(fastify, user_id, null);
		UsersModel.setSearchingForMatch(fastify, user_id, 0);
		UserManager.setFreeToGame(user_id, true);
	},

	/**
	 * Gets a list of all pending tournaments with their basic information
	 * @param {Object} fastify - Fastify instance with database connection
	 * @returns {Object[]} Array of tournament objects with id, initiator, and participant count
	 */
	getListTournaments(fastify) {
		const stmt = fastify.db.prepare(
			`SELECT * FROM tournaments
				WHERE status != 'canceled' AND status != 'finished'`
		).all();
		return (stmt.map(row => ({
			tournament_id: row.tournament_id,
			initiator: row.initiator,
			number_of_participants: row.number_of_participants,
			status: row.status
		})));
	},

	/**
	 * Gets detailed information about a specific tournament
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} tournamentId - The ID of the tournament
	 * @returns {Object} Tournament details including participants and matches
	 * @throws {Error} throws error !
	 */
	getTournamentDetails(fastify, tournamentId) {
		if (!this.isTournamentExisting(fastify, tournamentId))
			throw new Error(`Tournament ${tournamentId} was not found.`);

		const tournamentRow = fastify.db.prepare(
			`SELECT tournament_id, initiator, status, number_of_participants, winner_id
			FROM tournaments
			WHERE tournament_id = ?`
		).get(tournamentId);

		const initiatorId = Number.parseInt(tournamentRow.initiator);
		let initiatorUsername = tournamentRow.initiator;
		if (!Number.isNaN(initiatorId)) {
			const initiator = UsersModel.getPublicUserById(fastify, initiatorId);
			if (initiator?.username)
				initiatorUsername = initiator.username;
		}

		const usernameCache = new Map();
		const getUsername = (userId) => {
			if (usernameCache.has(userId))
				return usernameCache.get(userId);
			const user = UsersModel.getPublicUserById(fastify, userId);
			const username = user?.username ?? `Player #${userId}`;
			usernameCache.set(userId, username);
			return username;
		};

		const participantMap = new Map();
		const addParticipant = (userId, isActive) => {
			if (userId == null)
				return;
			const username = getUsername(userId);
			if (!participantMap.has(userId)) {
				participantMap.set(userId, {
					id: userId,
					username,
					active: !!isActive
				});
			} else if (isActive) {
				participantMap.get(userId).active = true;
			}
		};

		const activeParticipantIds = this.getListUser(fastify, tournamentId);
		const activeIdSet = new Set(activeParticipantIds);
		for (const userId of activeParticipantIds)
			addParticipant(userId, true);

		const activeMatchRows = fastify.db.prepare(
			`SELECT id, status, status_tournament, winner_id
			FROM matches
			WHERE tournament_id = ?`
		).all(tournamentId);

		const archivedMatchRows = fastify.db.prepare(
			`SELECT match_id AS id, status_tournament, winner_id
			FROM old_matches
			WHERE tournament_id = ?`
		).all(tournamentId);

		const activeMatchParticipantsStmt = fastify.db.prepare(
			`SELECT user_id AS id, score
			FROM match_participants
			WHERE match_id = ? AND role = 'player'`
		);
		const archivedMatchParticipantsStmt = fastify.db.prepare(
			`SELECT user_id AS id, score
			FROM old_match_participants
			WHERE match_id = ? AND role = 'player'`
		);

		const mapParticipants = (rows, getParticipants) =>
			rows.map((row) => {
				const participants = getParticipants.all(row.id).map((participant) => {
					addParticipant(participant.id, activeIdSet.has(participant.id));
					return {
						id: participant.id,
						username: getUsername(participant.id),
						score: participant.score ?? null
					};
				});
				return {
					id: row.id,
					stage: row.status_tournament,
					status: row.status ?? 'finished',
					winnerId: row.winner_id ?? null,
					participants
				};
			});

		const matches = [
			...mapParticipants(activeMatchRows, activeMatchParticipantsStmt),
			...mapParticipants(archivedMatchRows, archivedMatchParticipantsStmt)
		];

		let winner = null;
		if (tournamentRow.winner_id) {
			const winnerId = Number(tournamentRow.winner_id);
			addParticipant(winnerId, true);
			winner = {
				id: winnerId,
				username: getUsername(winnerId)
			};
		}

		const participants = Array.from(participantMap.values()).sort((a, b) => a.username.localeCompare(b.username));

		return {
			id: tournamentRow.tournament_id,
			status: tournamentRow.status,
			number_of_participants: tournamentRow.number_of_participants,
			participants,
			initiator: {
				id: Number.isNaN(initiatorId) ? null : initiatorId,
				username: initiatorUsername
			},
			matches,
			winner
		};
	},

	/**
	 * Changes the status of a tournament
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} tournamentId - The ID of the tournament
	 * @param {string} status - New status ('pending', 'ongoing', 'finished', 'canceled')
	 * @throws {Error} If tournament doesn't exist or status is invalid
	 */
	changeStatusTournament(fastify, tournamentId, status) {
		if (!this.isTournamentExisting(fastify, tournamentId))
			throw new Error(`Tournament ${tournamentId} was not found.`);

		if (status !== 'pending' && status !== 'ongoing' && status !== 'finished' && status !== 'canceled')
			throw new Error("Status must be one of: 'pending', 'ongoing', 'finished', 'canceled'.");

		fastify.db.prepare(
			`UPDATE tournaments
			 SET status = ?
			 WHERE tournament_id = ?`
		).run(status, tournamentId);
	},

	/**
	 * Gets the winners of both semi-final matches in a tournament
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} tournamentId - The ID of the tournament
	 * @returns {number[]} Array of winner IDs from both semi-final matches
	 * @throws {Error} If tournament doesn't exist or both semi-finals aren't finished
	 */
	getWinnerDemiFinal(fastify, tournamentId) {
		if (!this.isTournamentExisting(fastify, tournamentId))
			throw new Error(`Tournament ${tournamentId} was not found.`);

		const stmt = fastify.db.prepare(
			`SELECT winner_id FROM old_matches
			 WHERE tournament_id = ? AND status_tournament = 'demi-final'`
		).all(tournamentId);

		if (stmt.length !== 2)
			throw new Error("Both semi-final matches are not finished yet");

		return (stmt.map(row => row.winner_id));
	},

	/**
	 * Gets the winner of a completed tournament
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} tournamentId - The ID of the tournament
	 * @returns {number} The user ID of the tournament winner
	 * @throws {Error} If tournament doesn't exist
	 */
	getWinnerTournament(fastify, tournamentId) {
		if (!this.isTournamentExisting(fastify, tournamentId))
			throw new Error(`Tournament ${tournamentId} was not found.`);

		const stmt = fastify.db.prepare(
			`SELECT winner_id FROM tournaments
			WHERE tournament_id = ?`
		).get(tournamentId);

		return (stmt.winner_id);
	},

	getFinalMatchId(fastify, tournamentId) {
		if (!this.isTournamentExisting(fastify, tournamentId))
			throw new Error(`Tournament ${tournamentId} was not found.`);

		const stmt = fastify.db.prepare(
			`SELECT match_id FROM old_matches
			 WHERE tournament_id = ? AND status_tournament = 'final'`
		).get(tournamentId);

		return (stmt ? stmt.match_id : null);
	},

	getStatusTournament(fastify, tournamentId) {
		const stmt = fastify.db.prepare(
			`SELECT status FROM tournaments
			WHERE tournament_id = ?`
		).get(tournamentId);

		return (stmt.status);
	},

	/**
	 * Sets the winner of a tournament
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} tournamentId - The ID of the tournament
	 * @param {number} winnerId - The user ID of the winner
	 * @throws {Error} If tournament doesn't exist
	 */
	setWinnerTournament(fastify, tournamentId, winnerId) {
		if (!this.isTournamentExisting(fastify, tournamentId))
			throw new Error(`Tournament ${tournamentId} was not found.`);

		fastify.db.prepare(
			`UPDATE tournaments
			 SET winner_id = ?
			 WHERE tournament_id = ?`
		).run(winnerId, tournamentId);
	},

	/**
	 * Updates the tournament winner based on the final match result
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} tournamentId - The ID of the tournament
	 * @throws {Error} If tournament doesn't exist or final match isn't finished
	 */
	updateWinnerTournament(fastify, tournamentId) {
		try {
			if (!this.isTournamentExisting(fastify, tournamentId))
				throw new Error(`Tournament ${tournamentId} was not found.`);

			const stmt = fastify.db.prepare(`
				SELECT match_id
				FROM old_matches
				WHERE tournament_id = ? AND status_tournament = 'final'`).get(tournamentId);

			if (!stmt || !stmt.match_id)
				throw new Error(`Final match for tournament ${tournamentId} is not completed yet.`);

			fastify.db.prepare(`
				UPDATE tournaments
				SET winner_id = (
					SELECT winner_id
					FROM old_matches
					WHERE tournament_id = ? AND status_tournament = 'final'
				)
				WHERE tournament_id = ?
			`).run(tournamentId, tournamentId);

		}
		catch (e) {
			throw e;
		}
	},

	/**
	 * Completes a tournament by updating the winner and changing status to finished
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} tournamentId - The ID of the tournament to finish
	 * @throws {Error} If tournament doesn't exist or can't be finished
	 */
	finishTournament(fastify, tournamentId) {
		try {
			const final_match_id = this.getFinalMatchId(fastify, tournamentId);
			const participants = GameModel.getAllOldParticipants(fastify, final_match_id);

			this.updateWinnerTournament(fastify, tournamentId);
			GameModel.updateUsersAfterMatch(fastify, 0, participants, true);
			participants.forEach((participant) => {
				UsersModel.setInTournament(fastify, participant.user_id, 0);
				UsersModel.setIdOfTournament(fastify, participant.user_id, null);
			});
			this.changeStatusTournament(fastify, tournamentId, "finished");
			console.log(`Tournament ${tournamentId} has been finished.`);
			console.log(`Winner is user ID: ${this.getWinnerTournament(fastify, tournamentId)}`);
		}
		catch (e) {
			throw e;
		}
	},

	/**
	 * Updates player statuses after semi-final matches are completed
	 * Winners remain in tournament for final, losers are freed and removed from tournament
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} tournamentId - The ID of the tournament
	 * @throws {Error} If tournament doesn't exist
	 */
	updateStatusPlayerAfterDemiFinal(fastify, tournamentId) {
		if (!this.isTournamentExisting(fastify, tournamentId))
			throw new Error(`Tournament ${tournamentId} was not found.`);

		const winnerIds = this.getWinnerDemiFinal(fastify, tournamentId);
		for (const id of winnerIds) {
			UserManager.setFreeToGame(id, false);
			UsersModel.setMatchStatus(fastify, id, 0);
			UsersModel.setSearchingForMatch(fastify, id, 0);
		}

		const allParticipants = this.getListUser(fastify, tournamentId);
		for (const id of allParticipants) {
			if (!winnerIds.includes(id)) {
				UserManager.setFreeToGame(id, true);
				UsersModel.setInTournament(fastify, id, 0);
				UsersModel.setIdOfTournament(fastify, id, null);
				UsersModel.setMatchStatus(fastify, id, 0);
				UsersModel.setSearchingForMatch(fastify, id, 0);
			}
		}
	},

	startFinalMatch(fastify, tournamentId) {
		try {
			if (!this.isTournamentExisting(fastify, tournamentId)) {
				throw new Error(`Tournament ${tournamentId} was not found.`);
			}

			const finalist_players = TournamentModel.getWinnerDemiFinal(fastify, tournamentId);
			if (finalist_players.length !== 2) {
				throw new Error(`Cannot start final match for tournament ${tournamentId}: expected 2 finalists, got ${finalist_players.length}.`);
			}
			if (UserManager.has(finalist_players[0]) === false && UserManager.has(finalist_players[1]) === false) {
				throw new Error(`Cannot start final match for tournament ${tournamentId}: one or both finalists are not connected.`);
			}

			const final_match = GameModel.createMatch(fastify, "tournament", "server", tournamentId);
			GameModel.setTournamentStatus(fastify, final_match, "final");

			for (const player of finalist_players) {
				GameModel.addParticipant(fastify, final_match, player, "player");
				UsersModel.setMatchStatus(fastify, player, 1);

				UserManager.sendThroughSocket(player, {
					type: 'game_mm_found',
					from: 'server'
				});
			}

			GameModel.changeMatchStatus(fastify, final_match, "ongoing");

			console.log(`Final match started for tournament ${tournamentId}`);
		}
		catch (e) {
			throw e;
		}
	},

	autoUpdateTournament(fastify, tournamenId) {
		if (!this.isTournamentExisting(fastify, tournamenId))
			throw new Error(`Tournament ${tournamenId} was not found.`);

		const stmt_final = fastify.db.prepare(`
			SELECT *
			FROM old_matches
			WHERE tournament_id = ? AND status_tournament = 'final'`).all(tournamenId);

		const stmt_demi = fastify.db.prepare(`
			SELECT *
			FROM old_matches
			WHERE tournament_id = ? AND status_tournament = 'demi-final'`).all(tournamenId);

		if (stmt_final.length === 1) {
			if (!this.isTournamentFinished(fastify, tournamenId))
				this.finishTournament(fastify, tournamenId);
		}
		else if (stmt_demi.length === 2) {
			this.updateStatusPlayerAfterDemiFinal(fastify, tournamenId);
			const delayMs = 8000;
			setTimeout(() => {
				try {
					this.startFinalMatch(fastify, tournamenId);
				} catch (e) {
					this.sanitizeTournamentState(fastify, tournamenId);
					console.error(`Error starting final match for tournament ${tournamenId}:`, e);
				}
			}, delayMs);
		}
	},

	/**
	 * Cleans up a tournament by removing disconnected users and canceling if necessary
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} tournamentId - The ID of the tournament to sanitize
	 */
	sanitizeTournamentState(fastify, tournamentId) {
		if (!this.isTournamentExisting(fastify, tournamentId))
			return;

		const participants = this.getListUser(fastify, tournamentId);

		for (const userId of participants) {
			try {
				if (UsersModel.isInAMatch(fastify, userId)) {
					const matchId = GameModel.getMatchIdFromUserId(fastify, userId);
					if (matchId && GameModel.matchIsInTournament(fastify, matchId))
						GameModel.sanitizeGameState(fastify, matchId);
				}
				this.removeUserFromTournament(fastify, userId, tournamentId);
			}
			catch (e) { console.error(`Error removing user ${userId} from tournament ${tournamentId}:`, e); }

			console.log(`User ${userId} removed from tournament ${tournamentId} due to disconnection.`);
		}

		if (!this.isTournamentCanceled(fastify, tournamentId)) {
			try {
				this.changeStatusTournament(fastify, tournamentId, "canceled");
			}
			catch (e) { console.error(`Error canceling tournament ${tournamentId}:`, e); }

			console.log(`Tournament ${tournamentId} canceled due to insufficient participants.`);
		}
	}
}
/*
a chaque fin de match une fonction se lancera et si le match est un tournois, les losers sont free,
les winners restent dans le tournois si demi final
sinon tout le monde est free. Donc si demi final on lance la fonction qui lance la suite du tournois.
Drop the mic.

Probablement des problemes avec certaines fonctions plus compatibles
avec la gestion des matchs car match ancien par dans old_matches et est supprime de matches
Donc faut maj


Ensuite faut bien tout proteger car possible acces a des choses qui n'existent pas ou pas autorise ou autres...
*/
