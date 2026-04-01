import bcrypt from 'bcryptjs';
import sanitizeHtml from 'sanitize-html';
import jwt from 'jsonwebtoken';
import { LoginModel } from '../models/LoginModel.js';
import { UsersModel } from '../models/UsersModel.js';
import { authenticator } from 'otplib';
import crypto from 'crypto';
import { User } from '../User.js';
import { z } from 'zod';

/**
 * Structure renvoyée par `POST https://api.intra.42.fr/oauth/token`.
 * @typedef {Object} TokenData
 * @property {string} access_token Jeton d'accès permettant d'appeler l'API 42 au nom de l'utilisateur.
 * @property {string} token_type Généralement "bearer" ; utile si l'API change de schéma d'authentification.
 * @property {number} expires_in Durée de vie du jeton en secondes à partir de `created_at`.
 * @property {string} scope Liste des scopes accordés, séparés par des espaces (ex : "public").
 * @property {number} created_at Timestamp Unix (secondes) indiquant quand le jeton a été émis.
 * @property {string|undefined} refresh_token Jeton longue durée pour renouveler l'accès (présent si la configuration OAuth le permet).
 */

/**
 * Sous-ensemble des champs utiles renvoyés par `GET https://api.intra.42.fr/v2/me`.
 * La réponse complète contient davantage de données, mais ces clés couvrent les usages courants.
 * @typedef {Object} FortyTwoProfile
 * @property {number} id Identifiant numérique unique du compte 42 (clé stable pour ta base).
 * @property {string} login Identifiant public 42 (souvent utilisé comme username).
 * @property {string|null} email Adresse e-mail principale (peut être `null` si l'utilisateur l'a masquée).
 * @property {string} first_name Prénom renseigné sur 42.
 * @property {string} last_name Nom renseigné sur 42.
 * @property {string|null} displayname Nom complet formaté (prénom + nom), parfois `null`.
 * @property {{link: string}|null} image Objet contenant les URL d'avatar (`profile.image?.link`).
 * @property {string} url Lien public vers le profil 42.
 * @property {Array<Object>} cursus_users Liste des cursus avec leurs informations (id, grade, etc.).
 */

/**
 * Agrégat pratique contenant tout ce qui revient du provider après OAuth.
 * @typedef {Object} ClientData
 * @property {TokenData} tokenData Informations d'authentification (access token, refresh token, expiration…).
 * @property {FortyTwoProfile} profileData Profil utilisateur renvoyé par `GET /v2/me`.
 */

function sanitizeInput(input) {
	if (typeof input !== 'string') return '';
	return sanitizeHtml(input.trim(), {
		allowedTags: [],
		allowedAttributes: [],
	});
}

function parseRecoveryHashes(raw) {
	if (!raw) return [];
	try {
		const data = JSON.parse(raw);
		return Array.isArray(data) ? data : [];
	} catch (_) {
		return [];
	}
}

const loginBodySchema = z.object({
	username: z.string(),
	password: z.string()
});

const twoFaBodySchema = z.object({
	challenge: z.string(),
	code: z.union([z.string(), z.undefined()]),
	recoveryCode: z.union([z.string(), z.undefined()])
}).refine((data) => Boolean(data.code) || Boolean(data.recoveryCode), {
	message: "challenge and code/recoveryCode are required"
});

const oauthCallbackQuerySchema = z.object({
	code: z.union([z.string(), z.undefined()]),
	state: z.union([z.string(), z.undefined()])
});

export default async function loginRoutes(fastify) {
	const OAUTH42_UID = fastify.config.oauth42.client_id;
	const OAUTH42_USECRET = fastify.config.oauth42.client_secret;
	const OAUTH_REDIRECT_URI = fastify.config.oauth42.redirect_uri;
	const JWT_SECRET = fastify.config.jwt.secret;
	const CHALLENGE_SECRET = fastify.config.twofa.challenge_secret;

	const redirectOAuthError = (reply, code) => {
		const params = new URLSearchParams({ oauthError: code });
		return reply.redirect(`/login?${params.toString()}`);
	};

	// ------------- Étape 1 : login mot de passe -------------
	fastify.post('/api/login', async (request, reply) => {
		const parseResult = loginBodySchema.safeParse(request.body || {});
		if (!parseResult.success) {
			return reply.code(400).send({ success: false, error: 'Invalid credentials format' });
		}
		const { username, password } = parseResult.data;

		const sanitizedUsername = sanitizeInput(username);
		if (sanitizedUsername !== username) {
			return reply.code(409).send({ success: false, error: 'Invalid characters in username/email' });
		}

		try {
			const user = LoginModel.getUserByUsername(fastify, sanitizedUsername);
			if (!user) {
				return reply.code(409).send({ success: false, error: 'User not found' });
			}

			if (!user.password) {
				return reply.code(409).send({ success: false, error: 'User has no local password set' });
			}

			const match = await bcrypt.compare(password, user.password);
			if (!match) {
				return reply.code(409).send({ success: false, error: 'invalid password' });
			}

			if (LoginModel.isUserAlreadyConnected(fastify, sanitizedUsername)) {
				return reply.code(409).send({ success: false, error: 'User is already connected' });
			}

			if (user.twoFactorEnabled) {
				const challenge = jwt.sign({ sub: user.id, stage: '2fa' }, CHALLENGE_SECRET, { expiresIn: '5m' });
				return reply
					.code(401)
					.send({ success: false, twoFactorRequired: true, challenge });
			}

			const payload = { id: user.id, username: user.username, role: 'user' };
			const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
			reply.setCookie('token', token, { httpOnly: true, path: '/', maxAge: 3600, sameSite: 'lax' });

			return { success: true, message: "User Successfuly loged in" + " >|<" + token };
		} catch (err) {
			request.server.log.warn(`${err.stack}\n${err.message}`);
			return reply.code(400).send({ success: false, error: err.message });
		}
	});

	// ------------- Étape 2 : validation 2FA -------------
	fastify.post('/api/login/2fa', async (request, reply) => {
		const parseResult = twoFaBodySchema.safeParse(request.body || {});
		if (!parseResult.success) {
			return reply.code(400).send({ success: false, error: 'challenge and code/recoveryCode are required' });
		}
		const { challenge, code, recoveryCode } = parseResult.data;
		const normalizedCode = typeof code === 'string' ? code.trim() : '';
		const normalizedRecovery = typeof recoveryCode === 'string' ? recoveryCode.trim() : '';

		try {
			const payload = jwt.verify(challenge, CHALLENGE_SECRET);
			const userId = Number(payload?.sub);
			if (payload.stage !== '2fa' || !Number.isInteger(userId) || userId <= 0) {
				return reply.code(400).send({ success: false, error: 'invalid challenge' });
			}

			const user = LoginModel.getUserById(fastify, userId);
			if (!user) {
				return reply.code(401).send({ success: false, error: 'invalid challenge' });
			}

			let ok = false;
			if (normalizedCode && user.twoFactorSecret) {
				ok = authenticator.verify({ token: normalizedCode, secret: user.twoFactorSecret });
			}

			if (!ok && normalizedRecovery) {
				const hashes = parseRecoveryHashes(user.twoFactorRecoveryHashes);
				for (let i = 0; i < hashes.length; i++) {
					const match = await bcrypt.compare(normalizedRecovery, hashes[i]);
					if (match) {
						hashes.splice(i, 1);
						UsersModel.updateTwoFactorRecoveryHashes(fastify, user.id, hashes);
						ok = true;
						break;
					}
				}
			}

			if (!ok) {
				return reply.code(401).send({ success: false, error: 'invalid_2fa_code' });
			}

			const sessionPayload = { id: user.id, username: user.username, role: 'user' };
			const token = jwt.sign(sessionPayload, JWT_SECRET, { expiresIn: '1h' });
			reply.setCookie('token', token, { httpOnly: true, path: '/', maxAge: 3600, sameSite: 'lax' });

			return reply.send({ success: true, message: '2FA success, logged in' });
		} catch (err) {
			return reply.code(401).send({ success: false, error: 'invalid challenge' });
		}
	});

	// ------------- oauth2 -------------

	fastify.get('/api/oauth/42/login', async (request, reply) => {
		const redirect_url = OAUTH_REDIRECT_URI;
		const client_id = OAUTH42_UID;
		const response_type = 'code';
		const scope = 'public';
		const state = crypto.randomBytes(16).toString('hex');

		if (!client_id || !OAUTH42_USECRET) {
			return reply.code(409).send({ success: false, error: 'OAuth2 not configured' });
		}
		if (!redirect_url) {
			return reply.code(409).send({ success: false, error: 'Redirect URI not configured' });
		}

		const ParamsURL = new URLSearchParams({
			client_id: client_id,
			redirect_uri: redirect_url,
			response_type: response_type,
			scope: scope,
			state: state
		});
		reply.setCookie('oauth_state', state, { secure: true, httpOnly: true, path: '/', maxAge: 300, sameSite: 'Lax' });

		reply.redirect('https://api.intra.42.fr/oauth/authorize?' + ParamsURL.toString());
	});

	fastify.get('/api/oauth/42/callback', async (request, reply) => {
		const queryResult = oauthCallbackQuerySchema.safeParse(request.query || {});
		if (!queryResult.success) {
			reply.clearCookie('oauth_state');
			return redirectOAuthError(reply, 'invalid_state');
		}
		const { code, state } = queryResult.data;
		const Cookie_state = request.cookies.oauth_state;

		if (!state || !Cookie_state || state !== Cookie_state) {
			reply.clearCookie('oauth_state');
			return redirectOAuthError(reply, 'invalid_state');
		}
		if (!code) {
			reply.clearCookie('oauth_state');
			return redirectOAuthError(reply, 'missing_code');
		}

		reply.clearCookie('oauth_state');

		// Time to recover the token

		const tokenParams = new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			client_id: OAUTH42_UID,
			client_secret: OAUTH42_USECRET,
			redirect_uri: OAUTH_REDIRECT_URI
		});

		const tokenResponse = await fetch('https://api.intra.42.fr/oauth/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: tokenParams
		});

		if (!tokenResponse.ok) {
			return redirectOAuthError(reply, 'token_exchange_failed');
		}

		const tokenData = await tokenResponse.json();

		const profileRes = await fetch('https://api.intra.42.fr/v2/me', {
			headers: { Authorization: `Bearer ${tokenData.access_token}` }
		});

		if (!profileRes.ok) {
			return redirectOAuthError(reply, 'profile_fetch_failed');
		}

		const profile = await profileRes.json();

		/** @type {ClientData} */
		const ClientData = {
			tokenData,
			profileData: profile
		};

		try {
			const oauthUser = UsersModel.ensureOAuthUser(fastify, '42', ClientData);
			const user = LoginModel.getUserById(fastify, oauthUser.id);

			if (!user) {
				return redirectOAuthError(reply, 'user_not_found');
			}

			if (LoginModel.isUserAlreadyConnected(fastify, user.username)) {
				return redirectOAuthError(reply, 'already_connected');
			}

			if (user.twoFactorEnabled) {
				const challenge = jwt.sign({ sub: user.id, stage: '2fa' }, CHALLENGE_SECRET, { expiresIn: '5m' });
				return reply
					.code(401)
					.send({ success: false, twoFactorRequired: true, challenge });
			}

			const payload = { id: user.id, username: user.username, role: 'user' };
			const jwt_token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

			reply.setCookie('token', jwt_token, {
				httpOnly: true,
				sameSite: 'lax',
				secure: true,
				path: '/',
				maxAge: 3600,
			});

			UsersModel.updateStatus(fastify, user.id, 'online');

			return reply.redirect('/');
		} catch (err) {
			if (request?.server?.log?.warn) {
				request.server.log.warn(`${err?.stack || err?.message || err}`);
			}
			return redirectOAuthError(reply, 'internal_error');
		}

	});
}
