import { fileURLToPath } from 'url';
import path from "path";
import fs from "fs";
import { ImageModel } from '../models/ImageModel.js';
import { fileTypeFromBuffer } from 'file-type';
import { ImageController } from '../controllers/ImageController.js';

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
export default async function imageRoutes(fastify, options) {
	fastify.get("/api/images/defaultPp", async (request, reply) => {
		const id = request.token.id;

		const __filename = fileURLToPath(import.meta.url);
		const __dirname = path.dirname(__filename);
		const imgPath = path.join(__dirname, '..', 'assets', 'tcd_default_profile_picture.png');
		return (reply.type('img/png').send(fs.createReadStream(imgPath)));
	});

	fastify.get("/api/images/pongbot", async (request, reply) => {
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = path.dirname(__filename);
		const imgPath = path.join(__dirname, '..', 'assets', 'pongbot_profile.png');
		return (reply.type('img/png').send(fs.createReadStream(imgPath)));
	});

	fastify.patch("/api/images/user/pp", {
		preHandler: fastify.multipartHandler,
		attachFieldsToBody: false
	},
		async (request, reply) => {
			const id = request.token.id;

			try {
				const parts = request.parts();
				for await (const part of parts) {
					if (part.file) {
						const chunks = [];
						for await (const chunk of part.file) {
							chunks.push(chunk);
						}
						let buffer = Buffer.concat(chunks);
						buffer = await ImageController.resizeImageIfTooBig(buffer);

						fastify.db.prepare(`
						UPDATE user_images
						SET has_profile_picture = 1,
						profile_picture = ?
						WHERE user_id = ?
					`).run(buffer, id);
						reply.send({ status: "ok" });
					}
				}
			} catch (e) {
				fastify.log.error(e.stack);
				return (reply.code(400).send({ success: false, error: "" }));
			}
		});

	fastify.get("/api/images/user/:userid/pp", async (request, reply) => {
		const id = request.token.id;
		const userid = request.params.userid;

		const stmt = fastify.db.prepare(`
			SELECT profile_picture
			FROM user_images
			WHERE user_id = ?
		`).get(userid);
		if (!stmt) {
			return (reply.code(404).send({ success: false, message: "profile picture not found not found" }));
		}
		if (!stmt.profile_picture) {
			return (reply.code(404).send({ success: false, message: "user has not set a profile picture yet" }));
		}

		const imgBuffer = Buffer.from(stmt.profile_picture);
		const filetype = await fileTypeFromBuffer(imgBuffer);
		if (!filetype) {
			return (reply.code(400).send({ success: false, message: "unsuported file type" }));
		}
		return (reply.code(200).header("content-type", filetype.mime).send(imgBuffer));
	});

	fastify.patch("/api/images/user/bg", {
		preHandler: fastify.multipartHandler,
		attachFieldsToBody: false
	},
		async (request, reply) => {
			const id = request.token.id;

			const parts = request.parts();
			for await (const part of parts) {
				if (part.file) {
					const chunks = [];
					for await (const chunk of part.file) {
						chunks.push(chunk);
					}
					let buffer = Buffer.concat(chunks);
					buffer = await ImageController.resizeImageIfTooBig(buffer);

					fastify.db.prepare(`
						UPDATE user_images
						SET has_profile_background_picture = 1,
							profile_background_picture = ?
						WHERE user_id = ?
				`).run(buffer, id);

					reply.send({ status: "ok" });
				}
			}
		});

	fastify.get("/api/images/user/:userid/bg", async (request, reply) => {
		const id = request.token.id;
		const userid = request.params.userid;

		const stmt = fastify.db.prepare(`
			SELECT profile_background_picture
			FROM user_images
			WHERE user_id = ?
		`).get(userid);
		if (!stmt) {
			return (reply.code(404).send({ success: false, message: "background profile picture not found not found" }));
		}

		const imgBuffer = Buffer.from(stmt.profile_background_picture);
		const filetype = await fileTypeFromBuffer(imgBuffer);
		if (!filetype) {
			return (reply.code(400).send({ success: false, message: "unsuported file type" }));
		}
		return (reply.code(200).header("content-type", filetype.mime).send(imgBuffer));
	});

	fastify.patch("/api/images/user/card", {
		preHandler: fastify.multipartHandler,
		attachFieldsToBody: false
	},
		async (request, reply) => {
			const id = request.token.id;

			const parts = request.parts();
			for await (const part of parts) {
				if (part.file) {
					const chunks = [];
					for await (const chunk of part.file) {
						chunks.push(chunk);
					}
					let buffer = Buffer.concat(chunks);
					buffer = await ImageController.resizeImageIfTooBig(buffer);

					fastify.db.prepare(`
						UPDATE user_images
						SET has_profile_card_picture = 1,
							profile_card_picture = ?
						WHERE user_id = ?
				`).run(buffer, id);

					reply.send({ status: "ok" });
				}
			}
		});

	fastify.get("/api/images/user/:userid/card", async (request, reply) => {
		const id = request.token.id;
		const userid = request.params.userid;

		const stmt = fastify.db.prepare(`
			SELECT profile_card_picture
			FROM user_images
			WHERE user_id = ?
		`).get(userid);
		if (!stmt) {
			return (reply.code(404).send({ success: false, message: "profile card picture not found not found" }));
		}

		const imgBuffer = Buffer.from(stmt.profile_card_picture);
		const filetype = await fileTypeFromBuffer(imgBuffer);
		if (!filetype) {
			return (reply.code(400).send({ success: false, message: "unsuported file type" }));
		}
		return (reply.code(200).header("content-type", filetype.mime).send(imgBuffer));
	});

	fastify.patch("/api/images/user/pp/default", async (request, reply) => {
		const id = request.token.id;

		ImageModel.changeToDefaultPp(fastify, id);
		return ({ success: true, message: "changed image" });
	});
	fastify.patch("/api/images/user/bg/default", async (request, reply) => {
		const id = request.token.id;

		ImageModel.changeToDefaultBg(fastify, id);
		return ({ success: true, message: "changed image" });
	});
	fastify.patch("/api/images/user/card/default", async (request, reply) => {
		const id = request.token.id;

		ImageModel.changeToDefaultCard(fastify, id);
		return ({ success: true, message: "changed image" });
	});
};
