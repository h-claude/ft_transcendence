export const WsModel = {
	disconnectUser(fastify, userId) {
		fastify.db.prepare(
			`UPDATE user_status
			 SET status = 'offline'
			 WHERE user_id = ?`
		).run(userId);
	}
}
// , in_a_match = 0
