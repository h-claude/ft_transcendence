import bcrypt from 'bcryptjs'
import sanitizeHtml from "sanitize-html"
import jwt from 'jsonwebtoken'

// Pour le moment l'utilisateur peut reutiliser son token, a voire si on s'en fout
// ou si on mets en place une blacklist de tokens pour l'obliger a regenerer un token
export default async function logoutRoutes(fastify, options) {
	fastify.post("/api/logout", async (request, reply) => {
		// securiser la route
		reply
			.clearCookie('token', { path: '/', httpOnly: true, secure: true, sameSite: 'Strict' })
			.send({ message: 'Logged out Successfully' });
	});
}
