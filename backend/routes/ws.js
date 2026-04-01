import { GameModel } from '../models/GameModel.js';
import { UsersModel } from '../models/UsersModel.js';
import { WsModel } from '../models/WsModel.js';
import { UserManager, User } from '../User.js';

/**
 * little job on disconnection that deletes all unused conv
 * created during the session
* @param {User} user
*/
async function clearEmptyConversations(fastify, user) {
	if (!user) {
		console.log(`\nclearEmptyConversations: could not read user\n`);
		return;
	}
	const stmt = fastify.db.prepare(
		`delete from conversations where id_1 = ? and is_active = 0`
	);
	stmt.run(user.id);
}

export default async function wsRoutes(fastify, options) {
	fastify.get("/api/ws", { websocket: true, preValidation: [fastify.authenticate] }, (socket, request) => {
		const id = request.token.id;
		UserManager.add(id, request.token.username, socket);
		if (UsersModel.isInAMatch(fastify, id)) {
			UserManager.setFreeToGame(id, false);
		}
		if (UserManager.getStatus !== "online") {
			UsersModel.updateStatus(fastify, id, "online");
			UserManager.broadcastToFriendsWs(fastify, id, {
				type: "user_connected",
				body: "lol?",
				action: "received",
				from: id,
				fromUsername: request.token.username
			});
		}

		socket.on("close", async () => {

			WsModel.disconnectUser(fastify, id);

			UserManager.broadcastToFriendsWs(fastify, id, {
				type: "user_disconnected",
				body: "lol?",
				action: "received",
				from: id,
				fromUsername: request.token.username
			})
			await clearEmptyConversations(fastify, UserManager.getUser(id));
			UserManager.remove(id);
		})

		socket.on("message", async (msg) => {
			const data = JSON.parse(msg);
			if (!UserManager.has(data.to) && data.toServer === undefined) {
				UserManager.sendThroughSocket(id, {
				})
				return;
			}
			switch (data.type) {
				case "wizz":
					UserManager.sendThroughSocket(data.to, {
						type: "chat_ui_wizz",
						action: "received",
						from: id,
						fromUsername: request.token.username
					})
					break;
				case "testCliWeboscket":
					UserManager.sendThroughSocket(id, {
						test: "ca marche"
					})
					break;
			}
		});
	});
}

