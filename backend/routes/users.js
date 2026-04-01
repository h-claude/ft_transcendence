import bcrypt from 'bcryptjs'
import sanitizeHtml from "sanitize-html"
import { UserManager } from '../User.js';
import { UsersModel } from '../models/UsersModel.js';
import { GameModel, AI_USER_ID } from '../models/GameModel.js';
import PinoPretty from 'pino-pretty';


async function hashPassword(password) {
	const saltRounds = 10;
	return await bcrypt.hash(password, saltRounds);
}

function sanitizeInput(input) {
	if (typeof input !== "string") return "";
	return sanitizeHtml(input.trim(), {
		allowedTags: [],
		allowedAttributes: [],
	});
}

export default async function userRoutes(fastify, options) {
	fastify.post("/api/users", async (request, reply) => {
		// creer un nouveau compte depuis l'api
		var { name: username, email: email, password: password } = request.body;
		if (!username || !email || !password) {
			return (reply.code(409).send({
				success: false,
				error: "All fields are required"
			}));
		}

		var sanitizedUsername = sanitizeInput(username)
		var sanitizedEmail = sanitizeInput(email)
		if (sanitizedUsername != username) {
			return (reply.code(409).send({ success: false, error: "Your username is trying to fuck with my webiste, please don't" }));
		} else if (sanitizedEmail != email) {
			return (reply.code(409).send({ success: false, error: "Your email is trying to fuck with my webiste, please don't" }));
		}

		try {
			const existingUser = UsersModel.getUsernameAndOrEmail(fastify, username, email);
			if (existingUser) {
				if (existingUser.username === username) {
					return (reply.code(409).send({ success: false, error: "Username Already Taken" }));
				}
				if (existingUser.email === email) {
					return (reply.code(409).send({ success: false, error: "Email Already in Use" }));
				}
			}

			const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

			if (!emailRegex.test(email)) {
				return reply.code(400).send({
					success: false,
					error: "Invalid email format"
				});
			}

			if (password.length < 8) {
				return reply.code(400).send({
					success: false,
					error: "Password must be longer than 8 characters"
				});
			}

			if (!/[@#\$%\^&!\*]/.test(password)) {
				return reply.code(400).send({
					success: false,
					error: "Password must contain at least one special character (&@#$%^!*)"
				});
			}

			if (!/[0-9]/.test(password)) {
				return reply.code(400).send({
					success: false,
					error: "Password must contain at least one number"
				});
			}

			if (!/[A-Z]/.test(password)) {
				return reply.code(400).send({
					success: false,
					error: "Password must contain at least one uppercase letter"
				});
			}

			const hashedPassword = await hashPassword(password);
			const uid = UsersModel.createNewUser(fastify, username, email, hashedPassword);

			UsersModel.createDefaults(fastify, uid);

			return { success: true, message: "User Added!" };
		} catch (err) {
			return (reply.code(400).send({
				success: false,
				error: err.message
			}));
		}
	});

	fastify.get("/api/users", async (request, reply) => {
		const id = request.token.id;
		// const user = fastify.db.prepare("SELECT id, username, email FROM users u where u.id = ? AND u.role = 'user'").all(id);
		const user = UsersModel.getPrivateUser(fastify, id);
		if (!user) {
			return reply.code(401).send({ success: false, error: "User not found" });
		}
		//console.log("[DEBUG_USER_PRIVATE]", user);
		return {success: true, message: user};
	});

	fastify.get("/api/users/id/:username", async (request, reply) => {
		var id = request.token.id;
		if (typeof id === "object") {
			id = id.id;
		}
		const { username } = request.params;
		const user = UsersModel.getUserByUsername(fastify, username);
		if (!user) {
			return (reply.code(404).send({ success: false, error: "User not found" }));
		} else if (user.id === id) {
			return (reply.code(409).send({ success: false, error: "User is you" }));
		} else if (user.role !== 'user') {
			return (reply.code(409).send({ success: false, error: "pas de ca ici petit coquin" }));
		}
		fastify.log.warn(user);
		return { success: true, message: user };
	})

	// TODO: changer ca pour adherer a l'interface PublicUser
	// et paser sur /api/users/public/username/:username
	fastify.get("/api/users/public/username/:username", async (request, reply) => {
		var id = request.token.id;
		if (typeof id === "object") {
			id = id.id;
		}

		const { username } = request.params;

		const user = UsersModel.getUserByUsername(fastify, username);
		if (!user) {
			return (reply.code(404).send({ success: false, error: "User not found" }));
		} else if (user.id === id) {
			return (reply.code(409).send({ success: false, error: "User is you" }));
		} else if (user.role !== 'user') {
			return (reply.code(409).send({ success: false, error: "pas de ca ici petit coquin" }));
		}

		const userFull = UsersModel.getPublicUserById(fastify, user.id);
		return { success: true, message: userFull };
	})

	fastify.get("/api/users/public/id/:id", async (request, reply) => {
		// returns a PublicUser - comforming object
		var id = request.token.id;
		const userId = Number.parseInt(request.params.id);

		const user = UsersModel.getPublicUserById(fastify, userId);
		if (!user) {
			return (reply.code(404).send({ success: false, error: "User not found" }));
		}

		return { success: true, message: user };
	});

	fastify.patch("/api/users/status", async (request, reply) => {
		try {
			const id = request.token.id;
			const status = request.body;

			if (!id) {
				return reply.code(401).send({ success: false, error: "Authentification required" });
			}
			if (!['online', 'offline'].includes(status)) {
				return (reply.code(400).send({ success: false, error: "Invalid status" }));
			}
			UsersModel.updateStatus(fastify, id, status);

			UserManager.broadcastToFriendsWs(fastify, id, {
				type: "user_connected",
				body: "lol?",
				action: "received",
				from: id,
				fromUsername: request.token.username
			});
			return ({ success: true, message: "Status updated" });
		}
		catch (e) {
			return (reply.code(400).send({
				success: false,
				error: e.message
			}));
		}
	});

	fastify.patch("/api/users/username", async (request, reply) => {
		const id = request.token.id;
		const data = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;

		if (typeof data !== 'string' || !data.trim()) {
			return (reply.code(400).send({ success: false, error: "Invalid username format" }));
		}

		if (sanitizeInput(data) !== data) {
			return (reply.code(400).send({ success: false, error: "Not a typical username" }));
		}

		if (UsersModel.usernameExists(fastify, data)) {
			return (reply.code(409).send({
				success: false,
				error: "Username already taken"
			}));
		}

		try {
			UsersModel.changeUsername(fastify, id, data);
		} catch (err) {
			return (reply.code(400).send({
				success: false,
				error: "Error changing username"
			}));
		}
		return ({ success: true, message: "Username changed" });
	})

	fastify.patch("/api/users/email", async (request, reply) => {
		const id = request.token.id;
		const data = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;

		if (typeof data !== 'string' || !data.trim()) {
			return (reply.code(400).send({ success: false, error: "Invalid email format" }));
		}

		if (sanitizeInput(data) !== data) {
			return (reply.code(400).send({ success: false, error: "Not a typical email" }));
		}

		const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

		if (!emailRegex.test(data)) {
			return reply.code(400).send({
				success: false,
				error: "Invalid email format"
			});
		}

		if (UsersModel.emailExists(fastify, data)) {
			return (reply.code(409).send({
				success: false,
				error: "Email already taken"
			}));
		}

		try {
			UsersModel.changeEmail(fastify, id, data);
		} catch (err) {
			return (reply.code(400).send({
				success: false,
				error: "Error changing email"
			}));
		}
		return ({ success: true, message: "Username changed" });
	})

	fastify.patch("/api/users/password", async (request, reply) => {
		const id = request.token.id;
		const data = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;

		// Validation des données reçues
		if (!data || typeof data !== 'object') {
			return reply.code(400).send({ success: false, error: "Invalid request data" });
		}

		// currentPassword
		// newPassword
		// confirmPassword
		try {
			const pw = UsersModel.getPassword(fastify, id);
			if (data.newPassword !== data.confirmPassword) {
				return (reply.code(409).send({ success: false, error: "Passwords dont match" }));
			}
			if (data.newPassword.length < 8) {
				return reply.code(400).send({
					success: false,
					error: "Password must be longer than 8 characters"
				});
			}

			if (!/[@#\$%\^&!\*]/.test(data.newPassword)) {
				return reply.code(400).send({
					success: false,
					error: "Password must contain at least one special character (&@#$%^!*)"
				});
			}

			if (!/[0-9]/.test(data.newPassword)) {
				return reply.code(400).send({
					success: false,
					error: "Password must contain at least one number"
				});
			}

			if (!/[A-Z]/.test(data.newPassword)) {
				return reply.code(400).send({
					success: false,
					error: "Password must contain at least one uppercase letter"
				});
			}

			if (pw) {
				const pwCompare = await bcrypt.compare(data.currentPassword, pw);
				if (pwCompare) {
					const newPasswordCompare = await bcrypt.compare(data.newPassword, pw);
					if (newPasswordCompare) {
						return (reply.code(409).send({ success: false, error: "New password cannot be the same as the old one" }));
					}
					const newPasswordHashed = await hashPassword(data.newPassword);
					UsersModel.changePassword(fastify, id, newPasswordHashed);
					return { success: true, message: "password changed" };
				} else {
					return (reply.code(409).send({ success: false, error: "Wrong password" }));
				}
			}
			else {
				const newPasswordHashed = await hashPassword(data.newPassword);
				UsersModel.changePassword(fastify, id, newPasswordHashed);
				return { success: true, message: "password changed" };
			}

		} catch (e) {
			fastify.log.error(e.stack);
			fastify.log.error(e.message);
			return (reply.code(400).send({ success: false, error: "error while changing password" }));
		}
	})

	fastify.delete("/api/users", async (request, reply) => {
		// supprimer le compte de l'utilisateur
	})
	fastify.get("/api/users/game/infos", async (request, reply) => {
		// returns  the game infos of the current user
		const id = request.token.id;
		if (!UsersModel.isInAMatch(fastify, id)) {
			return { success: true, message: "not in a match" };
		}

		const matchId = GameModel.getUserCurrentMatch(fastify, id);
		if (!GameModel.matchExists(fastify, matchId)) {
			return reply.code(404).send({ success: false, error: "Match not found" });
		}

		const matchStatus = GameModel.getMatchStatus(fastify, matchId);
		const matchType = GameModel.getMatchType(fastify, matchId);
		const initiator = Number.parseInt(GameModel.getMatchInitiator(fastify, matchId)) === id ? true : false;
		const opponentId = matchType === "ai"
			? AI_USER_ID
			: GameModel.getOpponentId(fastify, matchId, id);
		return {
			success: true, message: JSON.stringify({
				matchId: matchId,
				matchStatus: matchStatus,
				matchType: matchType,
				initiator: initiator,
				opponentId: opponentId
			})
		};
	})

	fastify.get("/api/users/game/active", async (request, reply) => {
		const id = request.token.id;
		const iam = UsersModel.isInAMatch(fastify, id);
		return ({ success: true, message: JSON.stringify({ iam }) });
	})
	fastify.get("/api/users/profile/me", { preValidation: [fastify.authenticate] }, async (request, reply) => {
		try {
			const userId = request.user?.id;
			if (!userId) {
				// Normalement, fastify.authenticate devrait déjà gérer ça.
				return reply.code(401).send({ success: false, error: "Not authenticated" });
			}

			const userProfile = UsersModel.getPrivateUser(fastify, userId);

			if (!userProfile) {
				return reply.code(404).send({ success: false, error: "User profile not found" });
			}

			return { success: true, user: userProfile };
		} catch (err) {
			fastify.log.error(err, "Error fetching user profile");
			return reply.code(409).send({ success: false, error: "Error fetching user profile" });
		}
	});

	fastify.get("/api/users/freetogame", async (request, reply) => {
		const id = request.token.id;
		const freeToGame = UserManager.isFreeToGame(id);
		const inTournament = UsersModel.inTournament(fastify, id);
		return ({ success: true, message: JSON.stringify({ freeToGame, inTournament }) });
	})
}