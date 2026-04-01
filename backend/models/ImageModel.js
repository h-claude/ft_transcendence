export const ImageModel = {
	changeToDefaultPp(fastify, userId) {
		fastify.db.prepare(`
			UPDATE user_images
			set has_profile_picture = 0,
				profile_picture = NULL
			WHERE user_id = ?
		`).run(userId);
	},

	changeToDefaultBg(fastify, userId) {
		fastify.db.prepare(`
			UPDATE user_images
			set has_profile_background_picture = 0,
				profile_background_picture = NULL
			WHERE user_id = ?
		`).run(userId);
	},

	changeToDefaultCard(fastify, userId) {
		fastify.db.prepare(`
			UPDATE user_images
			set has_profile_card_picture = 0,
				profile_card_picture = NULL
			WHERE user_id = ?
		`).run(userId);
	},
}
