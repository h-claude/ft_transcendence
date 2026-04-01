// backend/server.js
import db from "./database.js";
import testRoutes from "./routes/testroute.js";
import userRoutes from "./routes/users.js";
import meRoutes from "./routes/me.js";
import loginRoutes from "./routes/login.js";
import logoutRoutes from "./routes/logout.js";
import wsRoutes from "./routes/ws.js";
import friendsRoutes from "./routes/friends.js";
import gameRoutes from "./routes/game.js";
import conversationRoutes from "./routes/conversation.js";
import messagesRoutes from "./routes/messages.js";
import imageRoutes from "./routes/images.js";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";
import fastifyCookie from '@fastify/cookie';
import fastifyWebsocket from '@fastify/websocket'
import fastifyJwt from '@fastify/jwt'
import fastifyMultipart from '@fastify/multipart';
import { User, UserManager } from "./User.js";
import { UsersModel } from "./models/UsersModel.js";
import { WsModel } from "./models/WsModel.js";
import { wsGameLogic } from "./routes/wsGameLogic.js";
import TournamentRoutes from "./routes/tournament.js";
import { TournamentModel } from "./models/TournamentModel.js";
import { GameModel } from "./models/GameModel.js";
import dotenv from 'dotenv';
import scoreRoutes from "./routes/score.js";
import blockchainRoutes from "./routes/blockchain.js";

// Routes 2FA
import twofaRoutes from "./routes/twofa.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log("--- Environment Variables ---");
console.log(`OAUTH42_UID: ${process.env.OAUTH42_UID ? 'set' : 'not set'}`);
console.log(`OAUTH42_USECRET: ${process.env.OAUTH42_USECRET ? 'set' : 'not set'}`);
console.log(`OAUTH_REDIRECT_URI: ${process.env.OAUTH_REDIRECT_URI ? 'set' : 'not set'}`);
console.log(`TWOFA_SECRET_KEY: ${process.env.TWOFA_SECRET_KEY ? 'set' : 'not set'}`);
console.log(`JWT_SECRET: ${process.env.JWT_SECRET ? 'set' : 'not set'}`);
console.log(`CHALLENGE_SECRET: ${process.env.CHALLENGE_SECRET ? 'set' : 'not set'}`);

const fastify = Fastify({
	disableRequestLogging: true,
	logger: {
		transport: {
			target: 'pino-pretty',
			options: {
				colorize: true,
				translateTime: 'SYS:standard',
				ignore: 'pid,hostname'
			}
		}
	}
});
fastify.decorate("db", db);

const config = {
	oauth42: {
		client_id: process.env.OAUTH42_UID,
		client_secret: process.env.OAUTH42_USECRET,
		redirect_uri: process.env.OAUTH_REDIRECT_URI
	},
	jwt: {
		secret: process.env.JWT_SECRET
	},
	twofa: {
		secret_key: process.env.TWOFA_SECRET_KEY,
		challenge_secret: process.env.CHALLENGE_SECRET
	}
};

fastify.decorate("config", config);

fastify.register(fastifyStatic, {
	root: path.join(__dirname, "../frontend/build"),
});

fastify.register(fastifyWebsocket);

// Cookie AVANT JWT pour lire le cookie `token`
fastify.register(fastifyCookie);

fastify.register(fastifyJwt, {
	secret: fastify.config.jwt.secret,
	cookie: { cookieName: 'token' }
});

fastify.register(fastifyMultipart, {
	limits: {
		fieldNameSize: 1000,
		fieldSize: 100000000,
		fields: 1000,
		fileSize: 500000000,
		files: 1,
		headerPairs: 200000
	},
	attachFieldsToBody: false
});

const PUBLIC_ROUTES = [
	{ method: 'POST', path: '/api/login' },
	{ method: 'POST', path: '/api/login/2fa' },
	{ method: 'GET', path: '/api/oauth/42/login' },
	{ method: 'GET', path: '/api/oauth/42/callback' },
	{ method: 'GET', path: '/api/me' },
	{ method: 'POST', path: '/api/users' },
	{ method: 'GET', path: '/api/testbonjour' }
];

function normalizePath(rawUrl = '') {
	const pathOnly = rawUrl.split('?')[0] || '/';
	if (pathOnly.length > 1) {
		return pathOnly.replace(/\/+$/, '');
	}
	return pathOnly;
}

function isPublicRequest(method, rawUrl) {
	const normalized = normalizePath(rawUrl);
	return PUBLIC_ROUTES.some(
		route => route.method === method && route.path === normalized
	);
}

fastify.decorate('authenticate', async function authenticate(request, reply) {
	const method = request.method;

	if (method === 'OPTIONS' || isPublicRequest(method, request.url)) {
		return;
	}

	try {
		const decoded = await request.jwtVerify();
		request.token = decoded;
		request.user = {
			id: decoded.id,
			username: decoded.username,
			role: decoded.role
		};
	} catch (err) {
		return reply.code(401).send({ message: 'unauthorized' });
	}
});

fastify.addHook('preHandler', fastify.authenticate);

fastify.register(testRoutes);
fastify.register(wsRoutes);
fastify.register(userRoutes);
fastify.register(meRoutes);
fastify.register(loginRoutes);

// Routes 2FA (/api/2fa/...)
fastify.register(twofaRoutes);

fastify.register(logoutRoutes);
fastify.register(friendsRoutes);
fastify.register(gameRoutes);
fastify.register(messagesRoutes);
fastify.register(conversationRoutes);
fastify.register(imageRoutes);
fastify.register(wsGameLogic);
fastify.register(TournamentRoutes);
fastify.register(scoreRoutes);
fastify.register(blockchainRoutes);

fastify.setNotFoundHandler((req, reply) => {
	if (!req.url.startsWith("/api")) {
		reply.sendFile("index.html");
	} else {
		reply.status(404).send({ message: "Not found" });
	}
});

// const printUser = () => {
// 	UserManager.print();
// }
// setInterval(printUser, 1000);

const start = async () => {
	try {
		await fastify.listen({ port: 3000, host: "0.0.0.0" });
		console.log("server listening on http://localhost:3000");
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};

/** Sanitize all tournaments in the database on server startup. */
function sanitizeAllTournaments(fastify) {
	const ongoingTournaments = fastify.db.prepare(
		"SELECT tournament_id FROM tournaments WHERE status = 'ongoing' OR status = 'pending' OR status = 'ongoing'"
	).all();

	for (let tournament of ongoingTournaments) {
		const tournamentId = tournament.tournament_id;
		console.log(`Sanitizing tournament ${tournamentId}...`);
		TournamentModel.sanitizeTournamentState(fastify, tournamentId);
	}
}

/** Sanitize all ongoing matches in the database on server startup. */
function sanitizeAllMatches(fastify, force_flag = false) {
	const ongoingMatches = fastify.db.prepare("SELECT id, start_time, status FROM matches").all();
	const now = new Date();

	for (let match of ongoingMatches) {
		const matchId = match.id;
		const startTime = new Date(match.start_time);
		const elapsedTime = (now - startTime) / 1000;

		if (((elapsedTime > 3600 || force_flag) && (match.status === "pending" || match.status === "ongoing"))) { // 1 hour
			console.log(`Sanitizing match ${matchId}...`);
			GameModel.sanitizeGameState(fastify, matchId);
		}
		if (force_flag) {
			GameModel.deleteMatch(fastify, matchId);
			const participants = GameModel.getAllParticipants(fastify, matchId);
			for (let p of participants) {
				UsersModel.setMatchStatus(fastify, p.id, 0);
				UsersModel.setSearchingForMatch(fastify, p.id, 0);
				UsersModel.setIdOfTournament(fastify, p.id, null);
				UsersModel.setInTournament(fastify, p.id, 0);
				UserManager.setFreeToChat(p.id, true);
				UserManager.setFreeToGame(p.id, true);
				WsModel.disconnectUser(fastify, p.id);
			}
		}
	}
}

/** Sanitize all users in the database on server startup.
 * This function sets all users to 'offline' status and match status to 0.
 * It also disconnects them from WebSocket if they are not in UserManager.
 * @param {FastifyInstance} fastify - The Fastify instance.
 */
function sanitizeAllUsers(fastify) {
	const allUsers = fastify.db.prepare("SELECT id FROM users").all();

	for (let user of allUsers) {
		const id = user.id;
		if (!UserManager.has(id)) {
			//  console.log(`Sanitizing user ${id}...`);
			UsersModel.updateStatus(fastify, id, 'offline');
			UsersModel.setMatchStatus(fastify, id, 0);
			UsersModel.setSearchingForMatch(fastify, id, 0);
			UsersModel.setIdOfTournament(fastify, id, 0);
			UsersModel.setInTournament(fastify, id, 0);
			UserManager.setFreeToChat(id, true);
			UserManager.setFreeToGame(id, true);
			WsModel.disconnectUser(fastify, id);
		}
	}
}

/** Starts a monitor that checks for user sessions every 60 seconds. */
function startUserSessionMonitor(fastify) {
	const allKnownUsers = fastify.db.prepare(`
		SELECT u.id
		FROM users u
		JOIN user_status us ON u.id = us.user_id
		WHERE us.status = 'online'
	`).all();

	for (let user of allKnownUsers) {
		const id = user.id;

		if (!UserManager.has(id)) {
			console.log(`User ${id} not found in UserManager, disconnecting...`);
			UsersModel.updateStatus(fastify, id, 'offline');
			UsersModel.setMatchStatus(fastify, id, 0);
			//WsModel.disconnectUser(fastify, id);
		}
	}
}

function sanitizeRoutine(fastify) {
	sanitizeAllUsers(fastify);
	sanitizeAllMatches(fastify, true);
	console.log("Starting user session monitor...");
	setInterval(() => startUserSessionMonitor(fastify), 60000);
	sanitizeAllTournaments(fastify);
	setInterval(() => sanitizeAllMatches(fastify, false), 3600000);
}

/** DEBUG USERS */

import bcrypt from 'bcryptjs'


async function hashPassword(password) {
	const saltRounds = 10;
	return bcrypt.hash(password, saltRounds);
}

// Username : a, email : a@a.a, password : a
// Username : b, email : b@b.b, password : b
// Username : c, email : c@c.c, password : c
// Username : d, email : d@d.d, password : d
const a_password_hash = await hashPassword('a');
const b_password_hash = await hashPassword('b');
const c_password_hash = await hashPassword('c');
const d_password_hash = await hashPassword('d');

if (UsersModel.getUserByUsername(fastify, 'a') === undefined) {
	const uid = UsersModel.createNewUser(fastify, 'a', 'a@a.a', a_password_hash);
	UsersModel.createDefaults(fastify, uid);
}
if (UsersModel.getUserByUsername(fastify, 'b') === undefined) {
	const uid = UsersModel.createNewUser(fastify, 'b', 'b@b.b', b_password_hash);
	UsersModel.createDefaults(fastify, uid);
}
if (UsersModel.getUserByUsername(fastify, 'c') === undefined) {
	const uid = UsersModel.createNewUser(fastify, 'c', 'c@c.c', c_password_hash);
	UsersModel.createDefaults(fastify, uid);
}
if (UsersModel.getUserByUsername(fastify, 'd') === undefined) {
	const uid = UsersModel.createNewUser(fastify, 'd', 'd@d.d', d_password_hash);
	UsersModel.createDefaults(fastify, uid);
}

/** END */

start();
sanitizeRoutine(fastify);
