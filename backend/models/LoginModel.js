import {
	decryptTwoFactorSecret,
	encryptTwoFactorSecret,
	looksLikePlainTwoFactorSecret,
	looksLikeEncryptedTwoFactorSecret
} from '../utils/twoFactorCrypto.js';

function ensureDecryptedSecret(fastify, user) {
	if (!user?.twoFactorSecret || !user?.id) {
		return;
	}

	const stored = user.twoFactorSecret;
	let decrypted = null;
	let decryptError = null;

	try {
		decrypted = decryptTwoFactorSecret(stored);
	} catch (err) {
		decryptError = err;
		decrypted = null;
	}

	if (decrypted) {
		user.twoFactorSecret = decrypted;
		return;
	}

	if (decryptError || looksLikeEncryptedTwoFactorSecret(stored)) {
		fastify.log.error({
			msg: 'Failed to decrypt stored 2FA secret during login lookup',
			userId: user.id,
			error: decryptError?.message || String(decryptError)
		});
	}

	if (looksLikePlainTwoFactorSecret(stored)) {
		user.twoFactorSecret = stored;
		try {
			const reEncrypted = encryptTwoFactorSecret(stored);
			fastify.db.prepare(
				`UPDATE users
				 SET two_factor_secret = ?
				 WHERE id = ?`
			).run(reEncrypted, user.id);
		} catch (err) {
			fastify.log.error({
				msg: 'Failed to re-encrypt legacy 2FA secret during login lookup',
				userId: user.id,
				error: err?.message || String(err)
			});
		}
	} else {
		user.twoFactorSecret = null;
	}
}

export const LoginModel = {
	getUserByUsername(fastify, username) {
		if (!username) return undefined;
		const user = fastify.db.prepare(
			`SELECT
				id,
				username,
				email,
				password,
				two_factor_enabled AS twoFactorEnabled,
				two_factor_secret AS twoFactorSecret,
				two_factor_recovery_hashes AS twoFactorRecoveryHashes
			 FROM users
			 WHERE username = ?`
		).get(username);

		ensureDecryptedSecret(fastify, user);
		return user;
	},

	getUserById(fastify, userId) {
		if (!userId) return undefined;
		const user = fastify.db.prepare(
			`SELECT
				id,
				username,
				email,
				two_factor_enabled AS twoFactorEnabled,
				two_factor_secret AS twoFactorSecret,
				two_factor_recovery_hashes AS twoFactorRecoveryHashes
			 FROM users
			 WHERE id = ?`
		).get(userId);

		ensureDecryptedSecret(fastify, user);
		return user;
	},

	isUserAlreadyConnected(fastify, username) {
		if (!username) return false;
		const stmt = fastify.db.prepare(
			`SELECT us.status
			 FROM user_status us
			 JOIN users u ON us.user_id = u.id
			 WHERE u.username = ?`
		).get(username);
		return stmt?.status === "online";
	}
};
