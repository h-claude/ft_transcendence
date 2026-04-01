import { UserManager } from '../User.js';
import { FriendsModel } from '../models/FriendsModel.js';
import { ConversationModel } from '../models/ConversationModel.js';

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function friendsRoutes(fastify, options) {
	fastify.post("/api/friends/request", async (request, reply) => {
		// envoyer une demande d'ami
		var id = request.token.id;
		if (typeof id === "object") {
			id = id.id;
		}
		const friendUsername = request.body;

		try {
			const friendId = FriendsModel.getIdByUsername(fastify, friendUsername);
			if (!friendId) {
				return (reply.code(404).send({ success: false, error: "User not found" }));
			}
			if (id === friendId) {
				return (reply.code(409).send({ success: false, error: `You cannot start a friendship with yourself :(` }));
			}

			if (FriendsModel.isBlocked(fastify, id, friendId)) {
				return (reply.code(403).send({ // 403 Forbidden
					success: false,
					error: "You cannot interact with this user."
				}));
			}

			if (FriendsModel.friendshipExists(fastify, id, friendId)) {
				return (reply.code(409).send({ success: false, error: `You are already in a relationship with ${friendUsername}` }));
			}

			FriendsModel.createFriendship(fastify, id, friendId);

			UserManager.sendThroughSocket(friendId, {
				type: "friend_request_update",
				action: "received",
				from: id
			})

			return { success: true, message: "Invitation sent" };
		} catch (err) {
			console.log(err);
		}
	});

	fastify.post("/api/friends/accept", async (request, reply) => {
		var id = request.token.id;
		const friendId = request.body;

		if (!FriendsModel.friendshipExists(fastify, id, friendId)) {
			return (reply.code(409).send({ success: false, error: `You are not in a relationship with ${friendUsername}` }));
		}

		FriendsModel.acceptFriendship(fastify, friendId, id);

		UserManager.sendThroughSocket(Number.parseInt(friendId), {
			type: "friend_request_accepted",
			action: "received",
			from: id
		})
		return { success: true, message: "friendship accepted" };
	});

	fastify.post('/api/friends/decline', async (request, reply) => {
		var id = request.token.id;
		const friendId = request.body;

		if (!FriendsModel.friendshipExists(fastify, id, friendId)) {
			return (reply.code(409).send({ success: false, error: `You are not in a relationship with ${friendUsername}` }));
		}

		FriendsModel.removeFriendRequest(fastify, friendId, id);

		UserManager.sendThroughSocket(Number.parseInt(friendId), {
			type: "friend_request_declined",
			action: "received",
			from: id
		});
		return { success: true, message: "friendship terminated" };
	});

	fastify.get('/api/friends/list', async (request, reply) => {
		// recuperer les amis acceptes
		var id = request.token.id;

		try {
			const friends = FriendsModel.getAcceptedFriends(fastify, id);
			return { success: true, message: friends };
		} catch (err) {
			console.log(err);
		}
	});

	fastify.delete('/api/friends/requests/cancel', async (request, reply) => {
		// quand un user veut cancel sa request
		const id = request.token.id;
		const friendId = request.body;

		try {
			if (!FriendsModel.friendshipExists(fastify, id, friendId)) {
				return (reply.code(409).send({ success: false, error: `you are in no relationship with that user` }));
			}

			FriendsModel.cancelFriendRequest(fastify, id, friendId);

			UserManager.sendThroughSocket(Number.parseInt(friendId), {
				type: "friend_request_canceled",
				action: "received",
				from: id
			});
			return { success: true, message: "friend invitation canceled" };
		} catch (e) {
			console.log(e);
		}
	})

	fastify.get('/api/friends/requests/received', async (request, reply) => {
		// recuperer les demandes d'ami vers l'utilisateur
		const id = request.token.id;

		try {
			const friends = FriendsModel.getReceivedFriendRequests(fastify, id);
			return { success: true, message: friends };
		} catch (err) {
			console.log(err);
		}

	});

	fastify.get('/api/friends/requests/sent', async (request, reply) => {
		const id = request.token.id;

		try {
			const friends = FriendsModel.getSentFriendsRequests(fastify, id);
			return { success: true, message: friends };
		} catch (err) {
			console.log(err);
		}
	});


	fastify.delete('/api/friends', async (request, reply) => {
		// supprimer un ami de la liste
		var id = request.token.id;
		const friendId = request.body;

		if (!FriendsModel.friendshipExists(fastify, id, friendId)) {
			return (reply.code(409).send({ success: false, error: `you are in no relationship with that user` }));
		}

		FriendsModel.removeFriendship(fastify, friendId, id);

		const friendWs = UserManager.getSocket(friendId);
		if (friendWs) {
			friendWs.send(JSON.stringify({
				type: "removed_by_friend",
				action: "received",
				from: id
			}));
		}
		return { success: true, message: "friendship terminated" };
	});

	fastify.get('/api/friends/id/:id', async (request, reply) => {
		var id = request.token.id;
		const friendId = request.params.id;

		if (!FriendsModel.friendshipExists(fastify, id, friendId)) {
			return (reply.code(409).send({ success: false, error: `you are in no relationship with that user` }));
		}

		const user = FriendsModel.getFriendInfos(fastify, friendId);
		return { success: true, message: user };
	});

	/**
	 * Bloque un utilisateur
	 */
	fastify.post("/api/friends/block", async (request, reply) => {
		const id = request.token.id;
		const blockedId = request.body; // Attendez-vous à recevoir juste l'ID

		if (!blockedId) {
			return reply.code(400).send({ success: false, error: "User ID is required" });
		}
		if (id === blockedId) {
			return reply.code(400).send({ success: false, error: "You cannot block yourself" });
		}

		try {
			// 1. Appelle la logique du modèle pour bloquer
			FriendsModel.blockUser(fastify, id, blockedId);

			// 2. Supprime la conversation existante comme demandé
			ConversationModel.deletePrivateConv(fastify, id, blockedId);

			// 3. Notifie les deux utilisateurs via WebSocket
			UserManager.sendThroughSocket(id, { // Notifie le bloqueur
				type: "user_blocked",
				action: "executed",
				targetId: blockedId
			});
			UserManager.sendThroughSocket(blockedId, { // Notifie le bloqué
				type: "user_blocked",
				action: "received",
				from: id
			});

			return { success: true, message: "User blocked" };
		} catch (err) {
			fastify.log.error(err, "Error blocking user");
			return reply.code(409).send({ success: false, error: "Could not block user" });
		}
	});

	/**
	 * Débloque un utilisateur
	 */
	fastify.post('/api/friends/unblock', async (request, reply) => {
		const id = request.token.id;
		const unblockedId = request.body; // Attendez-vous à recevoir juste l'ID

		if (!unblockedId) {
			return reply.code(400).send({ success: false, error: "User ID is required" });
		}

		try {
			FriendsModel.unblockUser(fastify, id, unblockedId);

			// Notifie les deux utilisateurs
			UserManager.sendThroughSocket(id, {
				type: "user_unblocked",
				action: "executed",
				targetId: unblockedId
			});
			UserManager.sendThroughSocket(unblockedId, {
				type: "user_unblocked",
				action: "received",
				from: id
			});

			return { success: true, message: "User unblocked" };
		} catch (err) {
			fastify.log.error(err, "Error unblocking user");
			return reply.code(409).send({ success: false, error: "Could not unblock user" });
		}
	});

	fastify.get('/api/friends/blocked/list', async (request, reply) => {
		const id = request.token.id;
		try {
			const blockedUsers = FriendsModel.getBlockedUsers(fastify, id);
			return { success: true, message: blockedUsers };
		} catch (err) {
			fastify.log.error(err, "Error getting blocked list");
			return reply.code(409).send({ success: false, error: "Could not get blocked list" });
		}
	});
}