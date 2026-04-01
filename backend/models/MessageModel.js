export const MessageModel = {
	/**
	 * @param {number} convId
	 * @param {number} userid1
	 * @param {number} userid2
	 * @returns {any | undefined} - either something or undefined
	 * if the conv does not exists
	 */
	privateConvExists(fastify, convId, userid1, userid2) {
		const r = fastify.db.prepare(
			`select *
			 from conversations c
			 where c.id = ? and c.type = 'private'
			 and ((c.id_1 = ? and c.id_2 = ?) or (c.id_1 = ? and c.id_2 = ?))`
		).get(convId, userid1, userid2, userid2, userid1);
		return (r);
	},

	/**
	* @param {number} convId
	* @param {string} msg
	* @param {number} receiverId
	* @returns nothing
	*/
	insertMessage(fastify, convId, userid, receiverId, msg) {
		fastify.db.prepare(
			`insert into messages (sender_id, receiver_id, content, conversation_id)
			 values (?, ?, ?, ?)`
		).run(userid, receiverId, msg, convId);
	},

	setConvToActive(fastify, convId) {
		fastify.db.prepare(
			`update conversations
			 set is_active = 1
			 where id = ?`
		).run(convId)
	}
}
