import sanitizeHtml from "sanitize-html"
import { UserManager } from "../User.js";
import { MessageModel } from "../models/MessageModel.js";
import { FriendsModel } from "../models/FriendsModel.js";

function sanitizeInput(input) {
	if (typeof input !== "string") return "";
	return sanitizeHtml(input.trim(), {
		allowedTags: [],
		allowedAttributes: [],
	});
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
export default async function messagesRoutes(fastify, options) {
	/**body: message: string, receiverId: number*/
	fastify.post("/api/messages/private/:convId", async (request, /**@type{import("fastify").FastifyReply}*/ reply) => {
		const id = request.token.id;
		const convId = request.params.convId;
		const receiverId = request.body.receiverId;
		const msg = sanitizeInput(request.body.message);

		if (FriendsModel.isBlocked(fastify, id, receiverId)) {
			return (reply.code(403).send({ // 403 Forbidden
				success: false,
				error: "You cannot interact with this user."
			}));
		}

		if (!MessageModel.privateConvExists(fastify, convId, id, receiverId)) {
			return (reply.code(409).send({
				success: false,
				error: "Conversation between these users does not exists"
			}));
		}

		try {
			MessageModel.insertMessage(fastify, convId, id, receiverId, msg);
			MessageModel.setConvToActive(fastify, convId);

			UserManager.sendThroughSocket(receiverId, {
				type: "chat_message_update",
				body: msg,
				action: "received",
				from: id,
				conversationId: convId,
				fromUsername: request.token.username
			})
			return { success: true, message: "Message sent" };
		} catch (e) {
			return (reply.code(400).send({
				success: false,
				error: e.message
			}));
		}
	});

	fastify.patch("/messages/:id", async (request, /**@type{import("fastify").FastifyReply}*/reply) => {
		// si on a envie de pouvoir faire modifier les messages
	});
}