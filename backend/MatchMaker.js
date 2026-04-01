import { UsersModel } from "./models/UsersModel.js";
import { User, UserManager } from "./User.js";
import { GameModel } from "./models/GameModel.js";


let _queue = [];
let _started = false;

function runMatchMaker(fastify) {
	//console.log("Bob (the matchmaker) is running...\nQueue length: " + _queue.length);

	if (_queue.length < 2)
		return;
	while (_queue.length >= 2) {
		try {
			let p1 = _queue.shift();
			let p2 = _queue.shift();

			if (!UserManager.has(p1) || !UserManager.has(p2)) {
				if (UserManager.has(p1))
					_queue.unshift(p1);
				if (UserManager.has(p2))
					_queue.unshift(p2);
				continue;
			}

			UserManager.setFreeToGame(p1, false);
			UserManager.setFreeToGame(p2, false);

			UsersModel.setSearchingForMatch(fastify, p1, 0);
			UsersModel.setSearchingForMatch(fastify, p2, 0);

			let matchId = GameModel.createMatch(fastify, "mm", "server", null);

			GameModel.addParticipant(fastify, matchId, p1, "player");
			GameModel.addParticipant(fastify, matchId, p2, "player");

			UsersModel.setMatchStatus(fastify, p1, 1);
			UsersModel.setMatchStatus(fastify, p2, 1);

			GameModel.changeMatchStatus(fastify, matchId, "ongoing");

			UserManager.sendThroughSocket(p1, {
				type: 'game_mm_found',
				from: p1
			});
			UserManager.sendThroughSocket(p2, {
				type: 'game_mm_found',
				from: p2
			});
		}
		catch (e) {
			if (matchId)
				GameModel.deleteMatch(fastify, matchId);

			UserManager.setFreeToGame(p1, true);
			UserManager.setFreeToGame(p2, true);
			UsersModel.setSearchingForMatch(fastify, p1, 0);
			UsersModel.setSearchingForMatch(fastify, p2, 0);
			UsersModel.setMatchStatus(fastify, p1, 0);
			UsersModel.setMatchStatus(fastify, p2, 0);
			_queue.unshift(p1);
			_queue.unshift(p2);

			console.error("Error in matchmaker:", e);
		}

	}
}

function cleanDisconnectedUsersFromQueue() {
	_queue = _queue.filter(id => UserManager.has(id));
}

export const MatchMaker =
{

	/**
	 * @returns {boolean} true if the matchmaker is started, false otherwise
	 */
	isStarted: function () {
		return (_started);
	},

	/**
	 * Adds a user to the matchmaking queue
	 * @param {number} userId - The id of the user to add
	 */
	addUserToQueue: function (userId) {
		if (!_queue.includes(userId))
			_queue.push(userId);
	},

	/**
	 * Removes a user from the matchmaking queue
	 * @param {number} userId - The id of the user to remove
	 */
	removeUserFromQueue: function (userId) {
		const i = _queue.indexOf(userId);
		if (i !== -1)
			_queue.splice(i, 1);
	},

	/**
	 * Returns the number of users in the matchmaking queue
	 * @returns {number} - The number of users in the matchmaking queue
	 */
	getQueue: function () {
		return (_queue.length);
	},

	/**
	 * Starts the matchmaker
	 * @param {FastifyInstance} fastify - The fastify instance
	 */
	start: function (fastify) {
		if (_started)
			return;
		_started = true;

		console.log("Bob the matchmaker is starting...");

		setInterval(() => {
			runMatchMaker(fastify);
			cleanDisconnectedUsersFromQueue();
		}, 100);
	}
}
