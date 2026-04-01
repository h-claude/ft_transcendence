import { UsersModel } from '../models/UsersModel.js';
import { GameModel } from '../models/GameModel.js';
import { User, UserManager } from '../User.js';
import { TournamentModel } from '../models/TournamentModel.js';
import messagesRoutes from './messages.js';
import { z } from 'zod';

const userIdSchema = z.union([
	z.number().int().positive(),
	z.string().regex(/^\d+$/)
]);

const tournamentIdSchema = z.union([
	z.number().int().positive(),
	z.string().regex(/^\d+$/)
]);

const tournamentIdBodySchema = z.object({
	tournamentId: tournamentIdSchema
});

const tournamentLeaveParamsSchema = z.object({
	tournament_id: tournamentIdSchema
});

const tournamentParamSchema = z.object({
	tournamentId: tournamentIdSchema
});

export default async function tournamentRoutes(fastify) {
	fastify.post('/api/tournament/create', async (request, reply) => {
		try {
			const idResult = userIdSchema.safeParse(request?.token?.id);
			if (!idResult.success)
				return reply.code(401).send({ success: false, error: "Authentification required" });
			const id = Number(idResult.data);

			if (!UserManager.isFreeToGame(id))
				return reply.code(409).send({ success: false, error: "You cant do this right now!" });

			if (UsersModel.inTournament(fastify, id))
				return reply.code(409).send({ success: false, error: "You are alrealdy in a tournament!" });

			const tournamentId = TournamentModel.createTournament(fastify, String(id));
			UserManager.setFreeToGame(id, false);

			return reply.send({ success: true, message: "Tournament created", tournamentId });
		}
		catch (e) {
			fastify.log.warn(e.stack);
			return (reply.code(400).send({ success: false, error: e.message }));
		}
	});

	fastify.delete('/api/tournament/cancel', async (request, reply) => {
		try {
			const idResult = userIdSchema.safeParse(request?.token?.id);
			if (!idResult.success) {
				return reply.code(401).send({ success: false, error: "Authentification required" });
			}
			const id = String(idResult.data);

			let parsedBody = request.body;
			if (typeof parsedBody === 'string') {
				try {
					parsedBody = JSON.parse(parsedBody);
				} catch {
					parsedBody = null;
				}
			}
			const bodyResult = tournamentIdBodySchema.safeParse(parsedBody || {});
			if (!bodyResult.success) {
				return reply.code(400).send({ success: false, error: "Tournament ID is required" });
			}
			const tournamentId = Number(bodyResult.data.tournamentId);
			const initiator = TournamentModel.getTournamentInitiator(fastify, tournamentId);

			if (id !== initiator)
				return reply.code(401).send({ success: false, error: "you cant delete this tournament" });

			TournamentModel.deleteTournament(fastify, tournamentId);
			return reply.send({ success: true, message: "tournament deleted" });
		}
		catch (e) {
			fastify.log.warn(e.stack);
			return (reply.code(400).send({ success: false, error: e.message }));
		}
	});

	fastify.post('/api/tournament/exists', async (request, reply) => {
		try {
			let body = request.body;
			if (typeof body === 'string') {
				try {
					body = JSON.parse(body);
				} catch {
					body = null;
				}
			}
			const bodyResult = tournamentIdBodySchema.safeParse(body || {});
			if (!bodyResult.success) {
				return reply.code(400).send({ success: false, error: "Tournament ID is required" });
			}
			const tournamentId = Number(bodyResult.data.tournamentId);

			const exists = TournamentModel.isTournamentExisting(fastify, tournamentId);

			if (exists)
				return reply.send({ success: true, message: "Tournament exists :)" });
			else
				return reply.code(404).send({ success: false, error: "Tournament doesnt exist" });
		}
		catch (e) {
			fastify.log.warn(e.stack);
			return (reply.code(400).send({ success: false, error: e.message }));
		}
	});

	fastify.post('/api/tournament/listUser', async (request, reply) => {
		try {
			let body = request.body;
			if (typeof body === 'string') {
				try {
					body = JSON.parse(body);
				} catch {
					body = null;
				}
			}
			const bodyResult = tournamentIdBodySchema.safeParse(body || {});
			if (!bodyResult.success) {
				return reply.code(400).send({ success: false, error: "Tournament ID is required" });
			}
			const tournamentId = Number(bodyResult.data.tournamentId);

			if (!TournamentModel.isTournamentExisting(fastify, tournamentId))
				return reply.code(404).send({ success: false, error: "Tournament doesnt exist !" });

			const users = TournamentModel.getListUser(fastify, tournamentId);

			return reply.send({ success: true, users });
		}
		catch (e) {
			fastify.log.warn(e.stack);
			return (reply.code(400).send({ success: false, error: e.message }));
		}
	});

	fastify.post('/api/tournament/join', async (request, reply) => {
		try {
			let body = request.body;
			if (typeof body === 'string') {
				try {
					body = JSON.parse(body);
				} catch {
					body = null;
				}
			}
			const bodyResult = tournamentIdBodySchema.safeParse(body || {});
			if (!bodyResult.success)
				return reply.code(400).send({ success: false, error: "tournamentId is required" });
			const tournamentId = Number(bodyResult.data.tournamentId);

			const idResult = userIdSchema.safeParse(request?.token?.id);
			if (!idResult.success)
				return reply.code(401).send({ success: false, error: "Authentification required" });
			const id = Number(idResult.data);
			if (!TournamentModel.isTournamentExisting(fastify, tournamentId))
				return reply.code(404).send({ success: false, error: "Tournament doesnt exist" });
			if (TournamentModel.isUserInTournament(fastify, tournamentId, id))
				return reply.code(409).send({ success: false, error: "You are already in this tournament" });
			if (!UserManager.isFreeToGame(id))
				return reply.code(409).send({ success: false, error: "You cant do this right now!" });

			TournamentModel.addUserToTournament(fastify, tournamentId, id);
			UserManager.setFreeToGame(id, false);

			return reply.send({ success: true, message: "tournament joined" });
		}
		catch (e) {
			fastify.log.warn(e.stack);
			return (reply.code(400).send({ success: false, error: e.message }));
		}
	});

	fastify.post('/api/tournament/leave/:tournament_id', async (request, reply) => {
		try {
			const idResult = userIdSchema.safeParse(request?.token?.id);
			if (!idResult.success)
				return reply.code(401).send({ success: false, error: "Authentification required" });
			const id = Number(idResult.data);

			const paramsResult = tournamentLeaveParamsSchema.safeParse(request.params || {});
			if (!paramsResult.success)
				return reply.code(400).send({ success: false, error: "tournament_id is required" });
			const tournament_id = Number(paramsResult.data.tournament_id);

			if (!TournamentModel.isTournamentExisting(fastify, tournament_id))
				return reply.code(404).send({ success: false, error: "Tournament doesnt exist" });
			if (!TournamentModel.isUserInTournament(fastify, tournament_id, id))
				return reply.code(401).send({ success: false, error: "You are not in tournament" });

			TournamentModel.removeUserFromTournament(fastify, id, tournament_id);
			UserManager.setFreeToGame(id, true);

			return reply.send({ success: true, message: "tournament leaved" });
		}
		catch (e) {
			fastify.log.warn(e.stack);
			return (reply.code(400).send({ success: false, error: e.message }));
		}
	});

	fastify.get('/api/tournament/list', async (request, reply) => {
		try {
			const tournaments = TournamentModel.getListTournaments(fastify);
			return reply.send({ success: true, tournaments });
		}
		catch (e) {
			fastify.log.warn(e.stack);
			return (reply.code(400).send({ success: false, error: e.message }));
		}
	});

	fastify.get('/api/tournament/:tournamentId/details', async (request, reply) => {
		try {
			const paramsResult = tournamentParamSchema.safeParse(request.params || {});
			if (!paramsResult.success) {
				return reply.code(400).send({ success: false, error: "Tournament ID is required" });
			}
			const tournamentId = Number(paramsResult.data.tournamentId);
			if (!TournamentModel.isTournamentExisting(fastify, tournamentId)) {
				return reply.code(404).send({ success: false, error: "Tournament doesnt exist" });
			}
			const details = TournamentModel.getTournamentDetails(fastify, tournamentId);
			return reply.send({ success: true, tournament: details });
		}
		catch (e) {
			fastify.log.warn(e.stack);
			return (reply.code(400).send({ success: false, error: e.message }));
		}
	});

	fastify.post('/api/tournament/start/:tournamentId', async (request, reply) => {
		try {
			const idResult = userIdSchema.safeParse(request?.token?.id);
			if (!idResult.success) {
				return reply.code(401).send({ success: false, error: "Authentification required" });
			}
			const id = Number(idResult.data);

			const paramsResult = tournamentParamSchema.safeParse(request.params || {});
			if (!paramsResult.success) {
				return reply.code(400).send({ success: false, error: "Tournament ID is required" });
			}
			const tournamentId = Number(paramsResult.data.tournamentId);

			if (!TournamentModel.isTournamentExisting(fastify, tournamentId))
				return reply.code(404).send({ success: false, error: "Tournament doesnt exist" });

			const initiator = TournamentModel.getTournamentInitiator(fastify, tournamentId);

			if (String(id) !== initiator)
				return reply.code(401).send({ success: false, error: "you cant start this tournament cause you are not the initiator" });

			if (!UserManager.has(id))
				return reply.code(401).send({ success: false, error: "you cant start this tournament cause you are not connected" });

			if (TournamentModel.isTournamentCanceled(fastify, tournamentId))
				return reply.code(401).send({ success: false, error: "The tournament is canceled" });

			if (TournamentModel.numberParticipant(fastify, tournamentId) !== 4)
				return reply.code(401).send({ success: false, error: "The tournament is not full" });

			const status = TournamentModel.getStatusTournament(fastify, tournamentId);
			if (status !== "pending")
				return reply.code(401).send({ success: false, error: "The tournament has already started" });

			const users = TournamentModel.getListUser(fastify, tournamentId);
			users.forEach((player) => {
				if (UserManager.has(player) === false) {
					throw new Error(`Cannot start tournament ${tournamentId}: player "${UsersModel.getPublicUserById(fastify, player).username}" is not connected.`);
				}
			});
			TournamentModel.changeStatusTournament(fastify, tournamentId, "ongoing");
			const firstMatch = GameModel.createMatch(fastify, "tournament", "server", tournamentId);
			const secondMatch = GameModel.createMatch(fastify, "tournament", "server", tournamentId);

			GameModel.setTournamentStatus(fastify, firstMatch, "demi-final");
			GameModel.setTournamentStatus(fastify, secondMatch, "demi-final");


			users.forEach((player, index, players) => {
				if (index < 2)
					GameModel.addParticipant(fastify, firstMatch, player, "player");
				else
					GameModel.addParticipant(fastify, secondMatch, player, "player");

				UsersModel.setMatchStatus(fastify, player, 1);

				UserManager.sendThroughSocket(player, {
					type: 'game_mm_found',
					from: 'server'
				});
			})

			GameModel.changeMatchStatus(fastify, firstMatch, "ongoing");
			GameModel.changeMatchStatus(fastify, secondMatch, "ongoing");

			return (reply.send({ success: true, message: "Tournament started!" }));
		}
		catch (e) {
			fastify.log.warn(e.stack);
			TournamentModel.sanitizeTournamentState(fastify, request.params.tournamentId);
			return (reply.code(400).send({ success: false, error: e.message }));
		}
	});

	//fastify.post('/api/tournament/start_final/:tournamentId', async (request, reply) => {
	//	try
	//	{
	//		const id = request.token.id.toString();
	//		const { tournamentId } = request.params;
	//		const initiator = TournamentModel.getTournamentInitiator(fastify, tournamentId);

	//		if (id !== initiator)
	//			return reply.code(401).send({ success: false, error: "you cant start the final of this tournament cause you are not the initiator"});

	//		if (UserManager.has(id))
	//			return reply.code(401).send({ success: false, error: "you cant start this tournament cause you are not connected"});

	//		if (TournamentModel.isTournamentCanceled(fastify, tournamentId))
	//			return reply.code(401).send({ success: false, error: "The tournament is canceled"});

	//		const	finalist_players = TournamentModel.getWinnerDemiFinal(fastify, tournamentId);

	//		const	final_match = GameModel.createMatch(fastify, "tournament", "server", tournamentId);
	//		GameModel.setTournamentStatus(fastify, final_match, "final");

	//		for (const player of finalist_players)
	//		{
	//			GameModel.addParticipant(fastify, final_match, player, "player");
	//			UsersModel.setMatchStatus(fastify, player, 1);

	//			UserManager.sendThroughSocket(player, {
	//				type: 'game_mm_found',
	//				from: 'server'
	//			});
	//		}

	//		GameModel.changeMatchStatus(fastify, final_match, "ongoing");
	//	}
	//	catch (e)
	//	{
	//		fastify.log.warn(e.stack);
	//		return (reply.code(400).send({success: false, error: e.message}));
	//	}
	//});
}
