import { User } from '../User.js';
import { randomUUID } from 'crypto';
import {
	decryptTwoFactorSecret,
	encryptTwoFactorSecret,
	looksLikePlainTwoFactorSecret,
	looksLikeEncryptedTwoFactorSecret
} from '../utils/twoFactorCrypto.js';

/**
 * @typedef {import('../routes/login.js').ClientData} ClientData
 */

const AI_USER_ID = 9999;
const AI_USERNAME = "PongBot";
const AI_EMAIL = "bot@internal";
const AI_IMAGE_INFOS_OBJECT = {
	hasProfilePicture: false,
	hasProfileBackgroundPicture: false,
	hasProfileCardPicture: false,
	isAi: true,
	fallbackEndpoint: "/api/images/pongbot"
};
const AI_IMAGE_INFOS_JSON = JSON.stringify(AI_IMAGE_INFOS_OBJECT);

function sanitizeAiPrivateUser(user) {
	const base = user ? { ...user } : {};
	return {
		id: AI_USER_ID,
		username: AI_USERNAME,
		email: AI_EMAIL,
		twoFactorEnabled: false,
		wins: base.wins ?? 0,
		losses: base.losses ?? 0,
		highestKdr: base.highestKdr ?? 0,
		UserImageInfos: AI_IMAGE_INFOS_JSON
	};
}

function sanitizeAiPublicUser(user) {
	const base = user ? { ...user } : {};
	return {
		id: AI_USER_ID,
		username: AI_USERNAME,
		status: "offline",
		lastSeen: null,
		wins: base.wins ?? 0,
		losses: base.losses ?? 0,
		highestKdr: base.highestKdr ?? 0,
		UserImageInfos: AI_IMAGE_INFOS_JSON
	};
}

export const UsersModel = {
	/**
	 * @typedef {Object} UserForValidation
	 * @property {string} username
	 * @property {string} email
	 */

	/**
	 * @typedef {Object} PublicUser
	 */

	/**
	 * @param {string} email
	 * @param {string} username
	 * @returns {UserForValidation}
	*/
	getUsernameAndOrEmail(fastify, username, email) {
		const existingUser = fastify.db.prepare(
			`SELECT id, username, email, oauth_provider, provider_user_id
			 FROM users
			 WHERE username = ? OR email = ?`
		).get(username, email);
		return (existingUser);
	},

	createNewUser(fastify, username, email, hashedPassword) {
		const uid = randomUUID(); // UID universel
		// Vérifie que l’UID n’existe pas déjà (cas très rare)
		const existing = fastify.db.prepare("SELECT id FROM users WHERE uid = ?").get(uid);
		if (existing) throw new Error("UID collision (improbable)");

		const stmt = fastify.db.prepare(
			"INSERT INTO users (username, email, password, role, uid) VALUES (?, ?, ?, 'user', ?)"
		).run(username, email, hashedPassword, uid);
		return (stmt.lastInsertRowid);
	},

	createDefaults(fastify, userId) {
		(fastify.db.transaction(() => {
			fastify.db.prepare(`INSERT INTO user_status (user_id, status)
								VALUES (?, 'offline')`).run(userId);
			fastify.db.prepare(`INSERT INTO player_stats (user_id, wins, losses, highest_kdr)
								VALUES (?, 0, 0, 0)`).run(userId);
			fastify.db.prepare(`INSERT INTO user_images (user_id)
								VALUES (?)`).run(userId);
		}))();
	},

	getPrivateUser(fastify, userId) {
		const user = fastify.db.prepare(`
			SELECT	u.id,
					u.uid,
					u.username,
					u.email,
					u.two_factor_enabled as twoFactorEnabled,
					u.two_factor_recovery_hashes as twoFactorRecoveryHashes,
					ps.wins,
					ps.losses,
					ps.highest_kdr as highestKdr,
					json_object (
						 'hasProfilePicture', ui.has_profile_picture,
						 'hasProfileBackgroundPicture', ui.has_profile_background_picture,
						 'hasProfileCardPicture', ui.has_profile_card_picture
					) as UserImageInfos
			FROM users u
			JOIN player_stats ps on (ps.user_id = u.id)
			JOIN user_images ui on (ui.user_id = u.id)
			WHERE u.id = ?
		`).get(userId);

		if (userId === AI_USER_ID) {
			return sanitizeAiPrivateUser(user);
		}

		if (!user) return (undefined);

		// Expose un compteur optionnel pour l'IHM (sans révéler les hashes)
		let remaining = null;
		try {
			if (user.twoFactorRecoveryHashes) {
				const arr = JSON.parse(user.twoFactorRecoveryHashes);
				if (Array.isArray(arr)) remaining = arr.length;
			}
		} catch (_) { }

		delete user.twoFactorRecoveryHashes;
		if (remaining !== null) user.twoFactorRecoveryCodesRemaining = remaining;
		user.twoFactorEnabled = !!user.twoFactorEnabled;

		return (user);
	},

	/**
	 * @param {string} username
	 */
	getUserByUsername(fastify, username) {
		const user = fastify.db.prepare("SELECT id, username, role FROM users WHERE username = ?").get(username);
		if (user && user.id === AI_USER_ID) {
			return { ...user, username: AI_USERNAME };
		}
		if (!user && username === AI_USERNAME) {
			return { id: AI_USER_ID, username: AI_USERNAME, role: 'server' };
		}
		return (user);
	},

	/**
	* @param {number} userId
	* @returns {PublicUser | undefined}
	*/
	getPublicUserById(fastify, userId) {
		const user = fastify.db.prepare(`
			SELECT	u.id,
					u.username,
					us.status,
					us.last_seen as lastSeen,
					ps.wins,
					ps.losses,
					ps.highest_kdr as highestKdr,
					json_object (
						 'hasProfilePicture', ui.has_profile_picture,
						 'hasProfileBackgroundPicture', ui.has_profile_background_picture,
						 'hasProfileCardPicture', ui.has_profile_card_picture
					) as UserImageInfos
			FROM users u
			JOIN user_status us on (us.user_id = u.id)
			JOIN player_stats ps on (ps.user_id = u.id)
			JOIN user_images ui on (ui.user_id = u.id)
			WHERE u.id = ?
		`).get(userId);
		if (userId === AI_USER_ID) {
			return sanitizeAiPublicUser(user);
		}
		return (user);
	},

	/**
	* @param {number} userId
	* @param {'online' | 'offline'} status
	*/
	updateStatus(fastify, userId, status) {
		if (userId === AI_USER_ID) {
			return;
		}
		if (status !== 'online' && status !== 'offline') {
			throw new Error("wrong status for updateStatus");
		}
		fastify.db.prepare(
			`
				UPDATE user_status
				SET status = ?
				WHERE user_id = ?
			`
		).run(status, userId);
	},

	/**
	* sets the in a match flag of the user to 1 or 0
	* @param {boolean} status
	*/
	setMatchStatus(fastify, userId, status) {
		if (userId === AI_USER_ID) {
			return;
		}
		if (status !== 1 && status !== 0) {
			throw new Error("wrong range for setMatchStatus");
		}
		fastify.db.prepare(
			`
				UPDATE user_status
				SET in_a_match = ?
				WHERE user_id = ?
			`
		).run(status, userId);
	},

	isInAMatch(fastify, userId) {
		const stmt = fastify.db.prepare(
			`SELECT in_a_match
			 FROM user_status
			 WHERE user_id = ?`
		).get(userId);
		if (!stmt) {
			return (false);
		}
		return (stmt.in_a_match === 1 ? true : false);
	},

	/**
	 * sets the searching for match flag of the user to 1 or 0 (1 is searching, 0 is not searching)
	 * @param {number} userId
	 * @param {number} status
	 * @throws {Error} if status is not 1 or 0
	 * @example
	 * setSearchingForMatch(fastify, userId, 1); // sets the user as searching for a match
	 * setSearchingForMatch(fastify, userId, 0); // sets the user as not searching for a match
	 */
	setSearchingForMatch(fastify, userId, status) {
		if (userId === AI_USER_ID) {
			return;
		}
		if (status !== 1 && status !== 0) {
			throw new Error("wrong range for setSearchingForMatch");
		}
		fastify.db.prepare(
			`
				UPDATE user_status
				SET searching_for_match = ?
				WHERE user_id = ?
			`
		).run(status, userId);
	},

	/**
	 * @param {number} userId
	 * @returns {boolean} true if the user is searching for a match, false otherwise
	 */
	IsSearchingForMatch(fastify, userId) {
		const stmt = fastify.db.prepare(
			`SELECT searching_for_match
			 FROM user_status
			 WHERE user_id = ?`
		).get(userId);
		if (!stmt) {
			return (false);
		}
		return (stmt.searching_for_match === 1 ? true : false);
	},

	inTournament(fastify, userId) {
		const stmt = fastify.db.prepare(
			`SELECT in_a_tournament
			FROM user_status
			WHERE user_id = ?`).get(userId);
		if (!stmt)
			return (false);
		return (stmt.in_a_tournament === 1 ? true : false);
	},

	getIdTournamentFromUserId(fastify, userId) {
		const stmt = fastify.db.prepare(
			`SELECT tournament_id
			FROM user_status
			WHERE user_id = ?`).get(userId);
		return (stmt.tournament_id);
	},

	setInTournament(fastify, userId, status) {
		if (status !== 1 && status !== 0)
			throw new Error("wrong range for setInTournament")
		const stmt = fastify.db.prepare(
			`UPDATE user_status
			SET in_a_tournament = ?
			WHERE user_id = ?
			`
		).run(status, userId);
	},

	/**
	 * Sets the tournament ID for a user
	 * @param {Object} fastify - Fastify instance with database connection
	 * @param {number} userId - The ID of the user
	 * @param {number} TournamentId - The ID of the tournament to set
	 */
	setIdOfTournament(fastify, userId, TournamentId) {
		const stmt = fastify.db.prepare(
			`UPDATE user_status
			SET tournament_id = ?
			WHERE user_id = ?`
		).run(TournamentId, userId);
	},

	getImagesInfos(fastify, userId) {
		if (userId === AI_USER_ID) {
			return { ...AI_IMAGE_INFOS_OBJECT };
		}
		const stmt = fastify.db.prepare(
			`SELECT has_profile_picture as hasProfilePicture,
					has_profile_background_picture as hasProfileBackgroundPicture,
					has_profile_card_picture as hasProfileCardPicture,
					profile_picture as profilePicture,
					profile_background_picture as profileBackgroundPicture,
					profile_card_picture as profileCardPicture
			 FROM user_images
			 WHERE user_id = ?`
		).get(userId);
		return (stmt);
	},

	usernameExists(fastify, username) {
		const stmt = fastify.db.prepare(
			`SELECT *
			 FROM users
			 WHERE username = ?`
		).get(username);
		return (stmt);
	},

	emailExists(fastify, email) {
		const stmt = fastify.db.prepare(
			`SELECT *
			 from users
			 where email = ?`
		).get(email);
		return (stmt);
	},

	changeUsername(fastify, userId, newUsername) {
		if (userId === AI_USER_ID) {
			return;
		}
		const stmt = fastify.db.prepare(
			`UPDATE users
			 set username = ?
			 where id = ?`
		).run(newUsername, userId);
		return (stmt);
	},

	changeEmail(fastify, userId, newEmail) {
		if (userId === AI_USER_ID) {
			return;
		}
		const stmt = fastify.db.prepare(
			`UPDATE users
			 set email = ?
			 where id = ?`
		).run(newEmail, userId);
		return (stmt);
	},

	changePassword(fastify, userId, newPassword) {
		if (userId === AI_USER_ID) {
			return;
		}
		const stmt = fastify.db.prepare(
			`UPDATE users
			 set password = ?
			 where id = ?`
		).run(newPassword, userId);
		return (stmt);
	},

	getPassword(fastify, userId) {
		if (userId === AI_USER_ID) {
			return null;
		}
		const stmt = fastify.db.prepare(
			`SELECT password
			 FROM users
			 WHERE id = ?`
		).get(userId);
		return (stmt.password);
	},

	// ---------- 2FA (TOTP) : méthodes ajoutées pour routes/twofa.js ----------

	/**
	 * Récupère l'état 2FA + secret + hashes de codes de secours
	 * @returns {{enabled:boolean, secret:string|null, recoveryHashes:string[]}}
	 */
	getTwoFactorSettings(fastify, userId) {
		if (userId === AI_USER_ID) {
			return {
				enabled: false,
				secret: null,
				recoveryHashes: []
			};
		}
		const row = fastify.db.prepare(
			`SELECT two_factor_enabled, two_factor_secret, two_factor_recovery_hashes
			 FROM users
			 WHERE id = ?`
		).get(userId);

		if (!row) return null;

		let hashes = [];
		if (row.two_factor_recovery_hashes) {
			try {
				const parsed = JSON.parse(row.two_factor_recovery_hashes);
				if (Array.isArray(parsed)) hashes = parsed;
			} catch (_) { }
		}

		let secret = null;
		if (row.two_factor_secret) {
			const storedSecret = row.two_factor_secret;
			let decrypted = null;
			let decryptError = null;

			try {
				decrypted = decryptTwoFactorSecret(storedSecret);
			} catch (err) {
				decryptError = err;
				decrypted = null;
			}

			if (decrypted) {
				secret = decrypted;
			} else {
				const looksPlain = looksLikePlainTwoFactorSecret(storedSecret);
				const looksEncrypted = looksLikeEncryptedTwoFactorSecret(storedSecret);

				if (decryptError || looksEncrypted) {
					fastify.log.error({
						msg: 'Failed to decrypt stored 2FA secret',
						userId,
						error: decryptError?.message || String(decryptError) || 'unknown_error',
						looksEncrypted
					});
				}

				if (looksPlain) {
					secret = storedSecret;
					try {
						const reEncrypted = encryptTwoFactorSecret(secret);
						this.updateTwoFactorSecret(fastify, userId, reEncrypted);
					} catch (err) {
						fastify.log.error({
							msg: 'Failed to re-encrypt legacy 2FA secret',
							userId,
							error: err?.message || String(err)
						});
					}
				} else {
					secret = null;
				}
			}
		}

		return {
			enabled: !!row.two_factor_enabled,
			secret,
			recoveryHashes: hashes
		};
	},

	/**
	 * Met à jour le secret TOTP (déjà chiffré en amont)
	 */
	updateTwoFactorSecret(fastify, userId, encryptedSecret) {
		if (userId === AI_USER_ID) {
			return;
		}
		fastify.db.prepare(
			`UPDATE users
			 SET two_factor_secret = ?
			 WHERE id = ?`
		).run(encryptedSecret, userId);
	},

	/**
	 * Active/Désactive le flag 2FA
	 */
	setTwoFactorEnabled(fastify, userId, enabled) {
		if (userId === AI_USER_ID) {
			return;
		}
		fastify.db.prepare(
			`UPDATE users
			 SET two_factor_enabled = ?
			 WHERE id = ?`
		).run(enabled ? 1 : 0, userId);
	},

	/**
	 * Remplace la liste de hashes des codes de secours
	 * @param {string[]} hashesArray
	 */
	updateTwoFactorRecoveryHashes(fastify, userId, hashesArray) {
		if (userId === AI_USER_ID) {
			return;
		}
		fastify.db.prepare(
			`UPDATE users
			 SET two_factor_recovery_hashes = ?
			 WHERE id = ?`
		).run(JSON.stringify(hashesArray || []), userId);
	},

	/**
	 * Désactive complètement la 2FA (supprime secret + hashes)
	 */
	disableTwoFactor(fastify, userId) {
		if (userId === AI_USER_ID) {
			return;
		}
		fastify.db.prepare(
			`UPDATE users
			 SET two_factor_enabled = 0,
				 two_factor_secret = NULL,
				 two_factor_recovery_hashes = NULL
			 WHERE id = ?`
		).run(userId);
	},

	/**
	 * Increments the win counter of a player.
	 * @param {Object} fastify
	 * @param {number} userId
	 * @param {number} amount
	 */
	incrementWins(fastify, userId, amount = 1) {
		const diff = Number.isFinite(amount) ? Math.max(1, Math.floor(amount)) : 1;
		fastify.db.prepare(
			`UPDATE player_stats
			 SET wins = wins + ?
			 WHERE user_id = ?`
		).run(diff, userId);
	},

	/**
	 * Decrements the win counter of a player, without going below zero.
	 * @param {Object} fastify
	 * @param {number} userId
	 * @param {number} amount
	 */
	decrementWins(fastify, userId, amount = 1) {
		const diff = Number.isFinite(amount) ? Math.max(1, Math.floor(amount)) : 1;
		fastify.db.prepare(
			`UPDATE player_stats
			 SET wins = MAX(wins - ?, 0)
			 WHERE user_id = ?`
		).run(diff, userId);
	},

	/**
	 * Increments the loss counter of a player.
	 * @param {Object} fastify
	 * @param {number} userId
	 * @param {number} amount
	 */
	incrementLosses(fastify, userId, amount = 1) {
		const diff = Number.isFinite(amount) ? Math.max(1, Math.floor(amount)) : 1;
		fastify.db.prepare(
			`UPDATE player_stats
			 SET losses = losses + ?
			 WHERE user_id = ?`
		).run(diff, userId);
	},

	/**
	 * Decrements the loss counter of a player, without going below zero.
	 * @param {Object} fastify
	 * @param {number} userId
	 * @param {number} amount
	 */
	decrementLosses(fastify, userId, amount = 1) {
		const diff = Number.isFinite(amount) ? Math.max(1, Math.floor(amount)) : 1;
		fastify.db.prepare(
			`UPDATE player_stats
			 SET losses = MAX(losses - ?, 0)
			 WHERE user_id = ?`
		).run(diff, userId);
	},

	// ---------- Méthodes OAuth2 ----------

	linkOAuthProvider(fastify, userId, provider, providerUserId, accessToken) {
		fastify.db.prepare(
			`UPDATE users
			 SET oauth_provider = ?,
				 provider_user_id = ?,
				 oauth_access_token = ?
			 WHERE id = ?`
		).run(provider, providerUserId, accessToken, userId);
	},

	getUserByOAuthProvider(fastify, provider, providerUserId) {
		const user = fastify.db.prepare(
			`SELECT id, username, role
			 FROM users
			 WHERE oauth_provider = ? AND provider_user_id = ?`
		).get(provider, providerUserId);
		return (user);
	},

	unlinkOAuthProvider(fastify, userId) {
		fastify.db.prepare(
			`UPDATE users
			 SET oauth_provider = NULL,
				 provider_user_id = NULL,
				 oauth_access_token = NULL
			 WHERE id = ?`
		).run(userId);
	},

	isOauthLinked(fastify, userId) {
		if (!userId || userId === AI_USER_ID) {
			return false;
		}
		const row = fastify.db.prepare(
			`SELECT oauth_provider
			 FROM users
			 WHERE id = ?`
		).get(userId);
		return Boolean(row?.oauth_provider);
	},

	/**
	 *
	 * @param {FastifyInstance} fastify
	 * @param {string} providerName
	 * @param {ClientData} clientData
	 * @throws {Error} if no clientData or creation of the user doesnt work or user already exists
	 */
	ensureOAuthUser(fastify, providerName, clientData) {
		if (!clientData) {
			throw new Error("No clientData.");
		}

		const providerUserId = clientData.profileData.id;
		const login = clientData.profileData.login;
		const email = clientData.profileData.email ?? null;

		let linkedUser = this.getUserByOAuthProvider(fastify, providerName, providerUserId);
		if (linkedUser) {
			this.linkOAuthProvider(fastify, linkedUser.id, providerName, providerUserId, clientData.tokenData.access_token);
			return (linkedUser);
		}

		const existingLocal = this.getUsernameAndOrEmail(fastify, login, email ?? "");
		if (existingLocal && existingLocal.id) {
			if (!existingLocal.oauth_provider) {
				throw new Error("An account already exists with this identifier.");
			}
			this.linkOAuthProvider(fastify, existingLocal.id, providerName, providerUserId, clientData.tokenData.access_token);
			return (this.getUserByOAuthProvider(fastify, providerName, providerUserId));
		}

		const newUserId = this.createNewUser(fastify, login, email, null);
		if (!newUserId)
			throw new Error("Cant create an User");
		this.createDefaults(fastify, newUserId);
		this.linkOAuthProvider(fastify, newUserId, providerName, providerUserId, clientData.tokenData.access_token);
		return (this.getUserByOAuthProvider(fastify, providerName, providerUserId));
	},

	/**
	 * ✅ Récupère l’UID à partir de l’ID interne
	 * Utilisé par blockchain.js pour relier un utilisateur à son identifiant unique.
	 */
	getUidById(fastify, id) {
		const stmt = fastify.db.prepare("SELECT uid FROM users WHERE id = ?");
		const row = stmt.get(id);
		return row ? row.uid : null;
	},

	/**
	 * ✅ Récupère un utilisateur à partir de son UID unique (UUID)
	 * Permet d’associer les enregistrements blockchain à l’utilisateur connu.
	 */
	getByUid(fastify, uid) {
		const stmt = fastify.db.prepare("SELECT id, username FROM users WHERE uid = ?");
		const row = stmt.get(uid);
		return row || null;
	},
};
