export const ConversationModel = {
	/**
	 * returns the raw convs for userid, to be shaped into
	 * a ConvOneOnOne
	 * @param {import("fastify").FastifyInstance} fastify
	 * @param {number} userId
	 */
	getPrivateConvs(fastify, userId) {
		const data = fastify.db.prepare(
			`
			SELECT
				c.id AS conversation_id,
				c.type,
				c.name,
				c.created_at,
				m.id AS message_id,
				m.sender_id,
				m.receiver_id,
				m.content,
				m.timestamp
			FROM conversations c
			LEFT JOIN messages m ON m.conversation_id = c.id
			WHERE m.conversation_id IN (
				SELECT conversation_id
				FROM messages
				WHERE sender_id = ? OR receiver_id = ?
				AND c.type = 'private'
			)
			ORDER BY c.id, m.timestamp ASC
			`
		).all(userId, userId);
		return (data);
	},

	/**
	 * @param {import("fastify").FastifyInstance} fastify
	 * @param {number} userId
	*/
	userExists(fastify, userId) {
		const r = fastify.db.prepare(`
			select *
			from users u
			where u.id = ?
		`).get(userId);
		return (r);
	},

	/**
	* @param {import("fastify").FastifyInstance} fastify
	* @param {number} userid1
	* @param {number} userid2
	* @returns convid et is_active
	*/
	getConvId(fastify, userid1, userid2) {
		const r = fastify.db.prepare(`
			select c.id, c.is_active
			from conversations c
			where (c.id_1 = ? and c.id_2 = ?) or (c.id_1 = ? and c.id_2 = ?)
		`).get(userid1, userid2, userid2, userid1);
		return (r);
	},

	createPrivateConv(fastify, userid1, userid2) {
		const label = `${userid1}$${userid2}`;

		const r = fastify.db.prepare(`
			INSERT INTO conversations (type, name, id_1, id_2)
			VALUES ('private', ?, ?, ?)
		`).run(label, userid1, userid2);
		return (r);
	},

	/**
	* Supprime une conversation privée et tous ses messages.
	* @param {import("fastify").FastifyInstance} fastify
	* @param {number} userId1
	* @param {number} userId2
	*/
	deletePrivateConv(fastify, userId1, userId2) {
		// 1. Trouver l'ID de la conversation
		const conv = this.getConvId(fastify, userId1, userId2); // [cite: 8]

		if (conv && conv.id) {
			const convId = conv.id;
			// 2. Utiliser une transaction pour supprimer les messages PUIS la conversation
			fastify.db.transaction(() => {
				// Supprimer tous les messages associés
				fastify.db.prepare(
					`DELETE FROM messages WHERE conversation_id = ?`
				).run(convId);
				
				// Supprimer la conversation elle-même
				fastify.db.prepare(
					`DELETE FROM conversations WHERE id = ?`
				).run(convId);
			})();
		}
	},
}
