/**
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function testRoutes(fastify, options) {
	fastify.get("/api/testbonjour", async (request, reply) => {
		return (reply.code(200).send({ success: true, message: "bonjour" }));
	});
}
