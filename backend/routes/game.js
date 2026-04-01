import { UserManager } from '../User.js';
import { ConversationModel } from '../models/ConversationModel.js';
import { GameModel, AI_USER_ID } from '../models/GameModel.js';
import { MessageModel } from '../models/MessageModel.js';
import { UsersModel } from '../models/UsersModel.js';
import { MatchMaker } from '../MatchMaker.js';
import { z } from 'zod';

const userIdSchema = z.union([
	z.number().int().positive(),
	z.string().regex(/^\d+$/)
]);

const directInviteBodySchema = z.object({
	opponentId: z.union([
		z.number().int().positive(),
		z.string().regex(/^\d+$/)
	])
});

export default async function gameRoutes(fastify, options) {
	fastify.get('/api/game/infos', async (request, reply) => {
		try {
			const idResult = userIdSchema.safeParse(request?.token?.id);
			if (!idResult.success) {
				return reply.code(401).send({ success: false, error: "Authentification required" });
			}
			const id = Number(idResult.data);
			const matchInfos = GameModel.getMatchInfosByUserId(fastify, id);
			return (matchInfos);
		}
		catch (e) {
			fastify.log.warn(e.stack);
			return (reply.code(400).send({ success: false, error: e.message }));
		}
	});

	fastify.post('/api/game/forfeit', async (request, reply) => {
		const idResult = userIdSchema.safeParse(request?.token?.id);
		if (!idResult.success) {
			return reply.code(401).send({ success: false, error: "Authentification required" });
		}
		const id = Number(idResult.data);
		try {
			const matchId = GameModel.getUserCurrentMatch(fastify, id);
			if (!matchId) {
				return (reply.code(409).send({ success: false, error: "user not in a match" }));
			}
			const oppoId = GameModel.getOpponentId(fastify, matchId, id);

			UserManager.setFreeToGame(id, true);
			if (UserManager.has(oppoId)) {
				UserManager.setFreeToGame(oppoId, true);
			}

			// Pour l'instant le score sera fixe UPDATE : et il le restera
			const scores = [
				{ userId: id, score: 0 },
				{ userId: oppoId, score: 3 }
			];

			GameModel.finishMatch(fastify, matchId, scores);

			for (const participant of [id, oppoId]) {
				UserManager.sendThroughSocket(participant, {
					type: "game_forfeited",
					from: id
				});
			}
			return { success: true, message: "Game ended" };
		} catch (e) {
			fastify.log.warn(e.stack);
			return (reply.code(400).send({ success: false, error: e.message }));
		}

	});

	// ------ MATCHMAKING ROUTES ------

	fastify.post('/api/game/mm/subscribe', async (request, reply) => {
		const idResult = userIdSchema.safeParse(request?.token?.id);
		if (!idResult.success) {
			return reply.code(401).send({ success: false, error: "Authentification required" });
		}
		const id = Number(idResult.data);
		if (UserManager.has(id) && !UserManager.isFreeToGame(id)) {
			return reply.code(409).send({ success: false, error: "You cant do this right now!" })
		}
		if (UsersModel.inTournament(fastify, id)) {
			return reply.code(409).send({ success: false, error: "You are in a tournament and cannot join matchmaking!" })
		}
		if (UsersModel.IsSearchingForMatch(fastify, id)) {
			return reply.code(409).send({ success: false, error: "You are already in the matchmaking queue!" })
		}

		try {
			UsersModel.setSearchingForMatch(fastify, id, 1);
			if (UserManager.has(id))
				UserManager.setFreeToGame(id, false);
			MatchMaker.addUserToQueue(id);

			return reply.send({ success: true, message: "Added to matchmaking queue" });
		} catch (error) {
			fastify.log.warn(error.stack);
			return (reply.code(400).send({ success: false, error: error.message }));
		}
	});

	fastify.delete('/api/game/mm/unsubscribe', async (request, reply) => {
		const idResult = userIdSchema.safeParse(request?.token?.id);
		if (!idResult.success) {
			return reply.code(401).send({ success: false, error: "Authentification required" });
		}
		const id = Number(idResult.data);
		try {
			UsersModel.setSearchingForMatch(fastify, id, 0);
			if (UserManager.has(id))
				UserManager.setFreeToGame(id, true);
			MatchMaker.removeUserFromQueue(id);

			return reply.send({ success: true, message: "Removed from matchmaking queue" });
		} catch (error) {
			fastify.log.warn(error.stack);
			return (reply.code(400).send({ success: false, error: error.message }));
		}
	});

	fastify.get('/api/game/mm/status', async (request, reply) => {
		const idResult = userIdSchema.safeParse(request?.token?.id);
		if (!idResult.success) {
			return reply.code(401).send({ success: false, error: "Authentification required" });
		}
		const id = Number(idResult.data);
		if (UsersModel.getPublicUserById(fastify, id) == undefined)
			return reply.code(400).send({ success: false, error: "User doesnt exist or not allowed" }); // franchement je sais pas si ca marche mais svp ne m'insultez pas je suis perdu :,(
		const isSearching = UsersModel.IsSearchingForMatch(fastify, id);
		return { success: true, searching: isSearching };
	});

	fastify.get('/api/game/mm/count', async () => {
		return { success: true, count: MatchMaker.getQueue() };
	})


	// ---- DIRECT INVITE GAME ROUTES -----

	// il faut d'abord envoyer une demande, et que l'autre l'accepte.
	// demande impossible si l'utilisateur est deja dans une partie,
	// ou en recherche de partie, ou qu'il a deja une demande active.
	// Faire une tableau des utilisateurs en recherche de mm,
	// inscrits a un tournoi, et en attente de reponse, et en partie.
	// ou bien, enregistrer le status d'un utilisateur dans une map

	/**
	* Body: { "recId:" "id"};
	*/
	fastify.post('/api/game/direct/request', async (request, reply) => {
		// envoyer une demande de partie directe
		const idResult = userIdSchema.safeParse(request?.token?.id);
		if (!idResult.success) {
			return reply.code(401).send({ success: false, error: "Authentification required" });
		}
		const id = Number(idResult.data);

		let parsedBody;
		if (typeof request.body === 'string') {
			try {
				parsedBody = JSON.parse(request.body);
			} catch {
				parsedBody = null;
			}
		} else {
			parsedBody = request.body;
		}

		const bodyResult = directInviteBodySchema.safeParse(parsedBody || {});
		if (!bodyResult.success) {
			return reply.code(400).send({ success: false, error: "Invalid opponentId" });
		}
		const opponentId = Number(bodyResult.data.opponentId);

		let newGameId = null;
		try {
			if (!UserManager.has(opponentId)) {
				return (reply.code(409).send({ success: false, error: "user is offline" }));
			}
			if (UsersModel.inTournament(fastify, id)) {
				return reply.code(409).send({ success: false, error: "You are in a tournament and cannot send game invites!" })
			}
			if (UsersModel.inTournament(fastify, opponentId)) {
				return reply.code(409).send({ success: false, error: "This user is in a tournament and cannot receive game invites!" })
			}
			if (!UserManager.isFreeToGame(id)) {
				return (reply.code(409).send({ success: false, error: "You cannot send a game invite right now" }));
			} else if (!UserManager.isFreeToGame(opponentId)) {
				return (reply.code(409).send({ success: false, error: "User is busy and cant receive game invites right now" }));
			} else if (id === opponentId) {
				return (reply.code(409).send({ success: false, error: "You cannot send a game invite to yourself" }));
			}

			const conv = ConversationModel.getConvId(fastify, id, opponentId);
			const convId = conv?.id;
			if (!convId) {
				return (reply.code(400).send({ success: false, error: "Something fishy is going on" }));
			}
			UserManager.sendThroughSocket(opponentId, {
				type: "game_direct_invite_request",
				from: id
			});
			UserManager.setFreeToGame(id, false);
			UserManager.setFreeToGame(opponentId, false);

			MessageModel.insertMessage(fastify, convId, 1, opponentId, "game_direct_invite_request");
			MessageModel.insertMessage(fastify, convId, 1, id, "game_direct_invite_sent");
			newGameId = GameModel.createMatch(fastify, "direct", id.toString(), null);
			GameModel.addParticipant(fastify, newGameId, id, "player");
			GameModel.addParticipant(fastify, newGameId, opponentId, "player");

			UsersModel.setMatchStatus(fastify, id, 1);
			UsersModel.setMatchStatus(fastify, opponentId, 1);
			return { success: true, message: "invite sent" };
		} catch (e) {
			if (typeof newGameId === 'number' && Number.isFinite(newGameId)) {
				GameModel.deleteMatch(fastify, newGameId);
			}
			UsersModel.setMatchStatus(fastify, id, 0);
			UsersModel.setMatchStatus(fastify, opponentId, 0);
			UserManager.setFreeToGame(id, true);
			UserManager.setFreeToGame(opponentId, true);
			fastify.log.warn(e.stack);
			return (reply.code(400).send({ success: false, error: e.message }));
		}
	});

	fastify.post('/api/game/direct/accept', async (request, reply) => {
		const idResult = userIdSchema.safeParse(request?.token?.id);
		if (!idResult.success) {
			return reply.code(401).send({ success: false, error: "Authentification required" });
		}
		const id = Number(idResult.data);

		try {
			const matchId = GameModel.getUserCurrentMatch(fastify, id);
			if (!matchId) {
				return (reply.code(409).send({ success: false, error: "user not in a match" }));
			}
			const matchInitiator = Number(GameModel.getMatchInitiator(fastify, matchId));
			if (matchInitiator === id) {
				return (reply.code(409).send({ success: false, error: "you cannot decline this match invite" }));
			}
			const oppoId = Number(GameModel.getOpponentId(fastify, matchId, id));

			if (UserManager.has(oppoId) && (UserManager.isFreeToGame(oppoId) || UserManager.isInGame(oppoId) ||
				UserManager.isInGame(id))) {
				return (reply.code(409).send({
					success: false,
					error: "Something strange's happening with your game request ;p"
				}));
			}

			GameModel.changeMatchStatus(fastify, matchId, "ongoing");

			UserManager.sendThroughSocket(id, {
				type: 'game_direct_invite_accepted',
				from: id
			})
			UserManager.sendThroughSocket(oppoId, {
				type: 'game_direct_invite_accepted',
				from: id
			})
			return { success: true, message: "invite accepted" };
		} catch (e) {
			fastify.log.warn(e.stack);
			return (reply.code(400).send({ success: false, error: e.message }));
		}
	});

	fastify.post('/api/game/direct/decline', async (request, reply) => {
		const idResult = userIdSchema.safeParse(request?.token?.id);
		if (!idResult.success) {
			return reply.code(401).send({ success: false, error: "Authentification required" });
		}
		const id = Number(idResult.data);
		try {
			const matchId = GameModel.getUserCurrentMatch(fastify, id);
			if (!matchId) {
				return (reply.code(409).send({ success: false, error: "user not in a match" }));
			}
			const matchInitiator = Number(GameModel.getMatchInitiator(fastify, matchId));
			if (matchInitiator === id) {
				return (reply.code(409).send({ success: false, error: "you cannot decline this match invite" }));
			}
			const oppoId = Number(GameModel.getOpponentId(fastify, matchId, id));

			if (UserManager.has(oppoId) && (UserManager.isFreeToGame(oppoId) || UserManager.isInGame(oppoId) ||
				UserManager.isInGame(id))) {
				return (reply.code(409).send({
					success: false,
					error: "Something strange's happening with your game request ;p"
				}));
			}

			UserManager.setFreeToGame(id, true);
			if (UserManager.has(oppoId)) {
				UserManager.setFreeToGame(oppoId, true);
			}
			GameModel.removeParticipant(fastify, matchId, id);
			GameModel.removeParticipant(fastify, matchId, oppoId);
			GameModel.deleteMatch(fastify, matchId);
			UsersModel.setMatchStatus(fastify, id, 0);
			UsersModel.setMatchStatus(fastify, oppoId, 0);
			UserManager.sendThroughSocket(id, {
				type: 'game_direct_invite_declined',
				from: id
			})
			if (UserManager.has(oppoId)) {
				UserManager.sendThroughSocket(oppoId, {
					type: 'game_direct_invite_declined',
					from: id
				})
			}
			return { success: true, message: "invite declined" };
		} catch (e) {
			fastify.log.warn(e.stack);
			return (reply.code(400).send({ success: false, error: e.message }));
		}
	})

	fastify.post('/api/game/direct/cancel', async (request, reply) => {
		const idResult = userIdSchema.safeParse(request?.token?.id);
		if (!idResult.success) {
			return reply.code(401).send({ success: false, error: "Authentification required" });
		}
		const id = Number(idResult.data);
		try {
			const matchId = GameModel.getUserCurrentMatch(fastify, id);
			if (!matchId) {
				return (reply.code(409).send({ success: false, error: "user not in a match" }));
			}
			const matchInitiator = Number(GameModel.getMatchInitiator(fastify, matchId));
			if (matchInitiator !== id) {
				return (reply.code(409).send({ success: false, error: "you cannot cancel this match invite" }));
			}
			const oppoId = Number(GameModel.getOpponentId(fastify, matchId, id));

			if ((UserManager.has(oppoId) && UserManager.isFreeToGame(oppoId)) || (UserManager.has(oppoId) && UserManager.isInGame(oppoId)) ||
				UserManager.isInGame(id)) {
				return (reply.code(409).send({
					success: false,
					error: "Something strange's happening with your game request ;p"
				}));
			}

			UserManager.setFreeToGame(id, true);
			UserManager.setFreeToGame(oppoId, true);
			GameModel.removeParticipant(fastify, matchId, id);
			GameModel.removeParticipant(fastify, matchId, oppoId);
			GameModel.deleteMatch(fastify, matchId);
			UsersModel.setMatchStatus(fastify, id, 0);
			UsersModel.setMatchStatus(fastify, oppoId, 0);
			UserManager.sendThroughSocket(id, {
				type: 'game_direct_invite_canceled',
				from: id
			})
			UserManager.sendThroughSocket(oppoId, {
				type: 'game_direct_invite_canceled',
				from: id
			})
			return { success: true, message: "invite canceled" };
		} catch (e) {
			fastify.log.warn(e.stack);
			return (reply.code(400).send({ success: false, error: e.message }));
		}
	})

	fastify.get('/api/game/direct/status', async (request, reply) => {
		const idResult = userIdSchema.safeParse(request?.token?.id);
		if (!idResult.success) {
			return reply.code(401).send({ success: false, error: "Authentification required" });
		}
		return reply.code(204).send();
	})

	// ------- Ai GAME ROUTES --------

	// --- IA ---
	fastify.post('/api/game/ai/start', async (request, reply) => {
		const idResult = userIdSchema.safeParse(request?.token?.id);
		if (!idResult.success) {
			return reply.code(401).send({ success: false, error: "Authentification required" });
		}
		const id = Number(idResult.data);
		if (UserManager.has(id) && !UserManager.isFreeToGame(id)) {
			return reply.code(409).send({ success: false, error: "You cant do this right now!" })
		}
		if (UsersModel.inTournament(fastify, id)) {
			return reply.code(409).send({ success: false, error: "You are in a tournament and cannot start an AI game!" })
		}
		if (UsersModel.IsSearchingForMatch(fastify, id)) {
			return reply.code(409).send({ success: false, error: "You are already in the matchmaking queue!" })
		}
		if (UsersModel.isInAMatch(fastify, id)) {
			return reply.code(409).send({ success: false, error: "You cant do this right now!" });
		}

		try {
			UserManager.setFreeToGame(id, false);
			const newGameId = GameModel.createMatch(fastify, "ai", id.toString(), null);

			GameModel.addParticipant(fastify, newGameId, id, "player");        // Joueur Humain
			GameModel.addParticipant(fastify, newGameId, AI_USER_ID, "ai");    // Joueur AI

			GameModel.changeMatchStatus(fastify, newGameId, "ongoing");

			UsersModel.setMatchStatus(fastify, id, 1);
			UserManager.sendThroughSocket(id, {
				type: 'game_ai_started',
				from: 'server',
				matchId: newGameId,
				opponentId: AI_USER_ID,
				isAi: true
			});
			return reply.send({ success: true, message: "AI game started", matchId: newGameId });
		}
		catch (e) {
			fastify.log.warn(e.stack);
			UsersModel.setMatchStatus(fastify, id, 0);
			UserManager.setFreeToGame(id, true);
			return (reply.code(400).send({ success: false, error: e.message }));
		}
	})


	fastify.post('/api/game/ai/forfeit', async (request, reply) => { });

	fastify.get('/api/game/stats/leaderboard', async (request, reply) => {
		const topPlayers = GameModel.getLeaderboardWinRatios(fastify, 10);
		return ({ success: true, message: topPlayers });
	});

	// ------- TOURNAMENT GAME ROUTES --------

	//fastify.post('/api/game/tournament/subscribe', async (request, reply) => {
	//	const id = request.token.id;
	//});

	//fastify.delete('/api/game/tournament/unsubscribe', async (request, reply) => {
	//	const id = request.token.id;
	//});

	//fastify.get('/api/game/tournament/status', async (request, reply) => {
	//	const id = request.token.id;
	//});

	//fastify.post('/api/game/tournament/create', async (request, reply) => {
	//	const id = request.token.id;
	//	if (!request.body) {
	//		return reply.code(400).send({success: false, error: "no body"});
	//	}
	//})

	MatchMaker.start(fastify);
}
