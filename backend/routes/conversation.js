import { UserManager } from "../User.js";
import { ConversationModel } from "../models/ConversationModel.js";
import { ConversationController } from "../controllers/ConversationController.js";
import { FriendsModel } from "../models/FriendsModel.js";


/**
 * @param {import("fastify").FastifyInstance} fastify
 */
export default async function conversationRoutes(fastify, options) {
	/**
	 * fetches all the private convs of a user, satisfying the frontend
	 * ConvOneOnOne type as an array
	 */
	fastify.get("/api/conv/private", async (request, /**@type{import("fastify").FastifyReply}*/ reply) => {
		const id = request.token.id;

		const data = ConversationModel.getPrivateConvs(fastify, id);
		const conversationsObject = ConversationController.conversationDataToConvType(data);
		return { success: true, message: conversationsObject };
	});

	/**
	 * fetches the conversations_id between current user and userid.
	 * error if no conv or if userid does not exist.
	 */
	fastify.get("/api/conv/private/getid/userid/:userid", async (request, reply) => {
		const id = request.token.id;
		const cid = request.params.userid;

		const userExists = ConversationModel.userExists(fastify, cid);
		if (!userExists) {
			return (reply.code(409).send({ success: false, error: "User does not exist" }));
		}

		if (FriendsModel.isBlocked(fastify, id, cid)) {
			return (reply.code(403).send({
				success: false,
				error: "You cannot interact with this user."
			}));
		}

		const rr = ConversationModel.getConvId(fastify, id, cid);
		if (!rr) {
			return (reply.code(409).send({ success: false, error: "No conversation" }));
		} else {
			return { success: true, message: rr.id };
		}
	});

	/**
	 * creates a new private conversation with the user id
	*/
	fastify.post("/api/conv/private/id/:id", async (request, /**@type{import("fastify").FastifyReply}*/ reply) => {
		const id = request.token.id;
		const cid = request.params.id;

		if (FriendsModel.isBlocked(fastify, id, cid)) {
			return (reply.code(403).send({
				success: false,
				error: "You cannot interact with this user."
			}));
		}

		const result = ConversationModel.getConvId(fastify, id, cid);

		// si une conv active est trouvee, alors renvoie 409
		//
		// si une conv non-active est trouvee, alors renvoie
		// l'id de la conv. ua cree une conv avec ub, et ub peut
		// aussi creer une conv avec ua avant que ua n'envoie un premier
		// message et rende la conv active. sinon il serait bloque.
		//
		// si aucune conv trouvee, cree une conv non-active et renvoie son
		// id.
		if (result && result.is_active) {
			return (reply.code(409).send({ success: false, error: "Already in a conversation with that user" }));
		} else if (result && !result.is_active) {
			return { success: true, message: result.id };
		} else {
			try {
				const r = ConversationModel.createPrivateConv(fastify, id, cid);
				return { success: true, message: r.lastInsertRowid };
			} catch (e) {
				return { success: false, error: e };
			}
		}
	});
};