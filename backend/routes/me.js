import jwt from 'jsonwebtoken'

export default async function meRoutes(fastify, options) {
	const JWT_SECRET = fastify.config.jwt.secret;

	fastify.get('/api/me', async (request, reply) => {
		const token = request.cookies.token;
		if (!token) {
			return (reply.code(401).send({ success: false, error: "Not logged in" }));
		}

		try {
			const user = jwt.verify(token, JWT_SECRET);
			return ({ success: true });
		} catch (err) {
			return (reply.code(401).send({ success: false, error: "Invalid Token" }));
		}
	});
}
