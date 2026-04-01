import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { UsersModel } from '../models/UsersModel.js';
import { encryptTwoFactorSecret } from '../utils/twoFactorCrypto.js';

const TWOFA_ISSUER = 'ft_transcendence';
authenticator.options = { window: 1 };

function generateRecoveryCodes(count = 8) {
	return Array.from({ length: count }, () => {
		const left = crypto.randomBytes(4).toString('hex');
		const right = crypto.randomBytes(4).toString('hex');
		return `${left}-${right}`.toUpperCase();
	});
}

async function hashRecoveryCodes(codes = []) {
	return Promise.all(codes.map((code) => bcrypt.hash(code, 10)));
}

export default async function twoFactorRoutes(fastify) {
	fastify.post('/api/2fa/setup', async (request, reply) => {
		const { token } = request;
		if (!token?.id) {
			return reply.code(401).send({ success: false, error: 'unauthorized' });
		}

		const settings = UsersModel.getTwoFactorSettings(fastify, token.id);
		if (settings?.enabled) {
			return reply
				.code(409)
				.send({ success: false, error: 'Two-factor authentication already enabled' });
		}

		const secret = authenticator.generateSecret();
		let encryptedSecret;
		try {
			encryptedSecret = encryptTwoFactorSecret(secret);
		} catch (err) {
			fastify.log.error({ msg: 'Failed to encrypt 2FA secret', err: err?.message });
			return reply
				.code(409)
				.send({
					success: false,
					error: 'Failed to initialize two-factor authentication',
					details: err?.message || 'encryption_failed'
				});
		}

		UsersModel.updateTwoFactorSecret(fastify, token.id, encryptedSecret);
		UsersModel.setTwoFactorEnabled(fastify, token.id, false);
		UsersModel.updateTwoFactorRecoveryHashes(fastify, token.id, []);

		const otpauthUrl = authenticator.keyuri(token.username || String(token.id), TWOFA_ISSUER, secret);

		let qrDataUrl = null;
		try {
			qrDataUrl = await QRCode.toDataURL(otpauthUrl);
		} catch (err) {
			fastify.log.warn({ msg: 'Failed to generate 2FA QR', err: err?.message });
		}

		return reply.send({ success: true, secret, otpauthUrl, qrDataUrl });
	});

	fastify.post('/api/2fa/activate', async (request, reply) => {
		const { token } = request;
		const { code } = request.body || {};

		if (!token?.id) {
			fastify.log.warn({ msg: '2FA activation blocked: unauthorized (missing token)', ip: request.ip });
			return reply.code(401).send({ success: false, error: 'unauthorized' });
		}

		if (UsersModel.isOauthLinked(fastify, token.id)) {
			fastify.log.warn({ msg: '2FA activation blocked for OAuth-linked user', userId: token.id });
			return reply.code(401).send({ success: false, error: '2FA cant be used with OAuth' });
		}

		if (!code || typeof code !== 'string') {
			return reply.code(400).send({ success: false, error: 'Missing verification code' });
		}

		const settings = UsersModel.getTwoFactorSettings(fastify, token.id);
		if (!settings?.secret) {
			return reply.code(400).send({ success: false, error: 'Two-factor setup not initiated' });
		}

		const verified = authenticator.verify({ token: code.trim(), secret: settings.secret });
		if (!verified) {
			fastify.log.warn({ msg: '2FA activation failed: invalid code', userId: token.id });
			return reply.code(401).send({ success: false, error: 'Invalid authentication code' });
		}

		UsersModel.setTwoFactorEnabled(fastify, token.id, true);

		const recoveryCodes = generateRecoveryCodes();
		const hashedCodes = await hashRecoveryCodes(recoveryCodes);
		UsersModel.updateTwoFactorRecoveryHashes(fastify, token.id, hashedCodes);

		return reply.send({ success: true, enabled: true, recoveryCodes });
	});

	fastify.post('/api/2fa/disable', async (request, reply) => {
		const { token } = request;
		const { code, recoveryCode } = request.body || {};

		if (!token?.id) {
			return reply.code(401).send({ success: false, error: 'unauthorized' });
		}

		const settings = UsersModel.getTwoFactorSettings(fastify, token.id);
		if (!settings?.enabled) {
			return reply
				.code(400)
				.send({ success: false, error: 'Two-factor authentication is not enabled' });
		}

		let verified = false;
		if (code && typeof code === 'string' && settings.secret) {
			verified = authenticator.verify({ token: code.trim(), secret: settings.secret });
		}

		if (!verified && recoveryCode && typeof recoveryCode === 'string') {
			for (let i = 0; i < (settings.recoveryHashes || []).length; i++) {
				const match = await bcrypt.compare(recoveryCode.trim(), settings.recoveryHashes[i]);
				if (match) {
					const updated = [...settings.recoveryHashes];
					updated.splice(i, 1);
					UsersModel.updateTwoFactorRecoveryHashes(fastify, token.id, updated);
					verified = true;
					break;
				}
			}
		}

		if (!verified) {
			return reply.code(401).send({ success: false, error: 'Invalid authentication code' });
		}

		UsersModel.disableTwoFactor(fastify, token.id);
		return reply.send({ success: true, enabled: false, message: 'Two-factor authentication disabled' });
	});

	fastify.post('/api/2fa/regenerate-recovery', async (request, reply) => {
		const { token } = request;
		const { code, recoveryCode } = request.body || {};

		if (!token?.id) {
			return reply.code(401).send({ success: false, error: 'unauthorized' });
		}

		const settings = UsersModel.getTwoFactorSettings(fastify, token.id);
		if (!settings?.enabled || !settings.secret) {
			return reply.code(400).send({ success: false, error: 'Two-factor authentication is not enabled' });
		}

		if (!code && !recoveryCode) {
			return reply
				.code(400)
				.send({ success: false, error: 'Verification code or recovery code required' });
		}

		let verified = false;
		if (code && typeof code === 'string') {
			verified = authenticator.verify({ token: code.trim(), secret: settings.secret });
		}

		if (!verified && recoveryCode && typeof recoveryCode === 'string') {
			for (let i = 0; i < (settings.recoveryHashes || []).length; i++) {
				const match = await bcrypt.compare(recoveryCode.trim(), settings.recoveryHashes[i]);
				if (match) {
					verified = true;
					break;
				}
			}
		}

		if (!verified) {
			return reply.code(401).send({ success: false, error: 'Invalid authentication code' });
		}

		const recoveryCodes = generateRecoveryCodes();
		const hashedCodes = await hashRecoveryCodes(recoveryCodes);
		UsersModel.updateTwoFactorRecoveryHashes(fastify, token.id, hashedCodes);

		return reply.send({ success: true, recoveryCodes });
	});
}
