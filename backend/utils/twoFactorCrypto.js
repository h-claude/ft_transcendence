import crypto from 'crypto';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

let cachedKey = null;
let cachedRaw = null;
let triedLoadingEnv = false;

function ensureEnvLoaded() {
	if (process.env.TWOFA_SECRET_KEY || triedLoadingEnv) {
		return;
	}
	triedLoadingEnv = true;
	try {
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = path.dirname(__filename);
		dotenv.config({ path: path.resolve(__dirname, '../.env') });
	} catch (_) {}
}

function deriveKey(raw) {
	if (!raw) {
		throw new Error('TWOFA_SECRET_KEY env var is not defined');
	}

	if (cachedKey && cachedRaw === raw) {
		return cachedKey;
	}

	let keyBuffer = null;

	// Accept 64 hex chars (32 bytes)
	if (/^[0-9a-fA-F]{64}$/.test(raw)) {
		keyBuffer = Buffer.from(raw, 'hex');
	} else {
		const base64Buffer = Buffer.from(raw, 'base64');
		if (base64Buffer.length === 32) {
			keyBuffer = base64Buffer;
		} else {
			// Fallback: derive from string using SHA-256
			keyBuffer = crypto.createHash('sha256').update(raw, 'utf8').digest();
		}
	}

	if (keyBuffer.length !== 32) {
		throw new Error('Derived TWOFA_SECRET_KEY is not 32 bytes long');
	}

	cachedRaw = raw;
	cachedKey = keyBuffer;
	return keyBuffer;
}

function getKey() {
	ensureEnvLoaded();
	return deriveKey(process.env.TWOFA_SECRET_KEY);
}

export function encryptTwoFactorSecret(secret) {
	if (typeof secret !== 'string' || secret.length === 0) {
		throw new Error('Cannot encrypt empty two-factor secret');
	}

	const key = getKey();
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
	const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
	const authTag = cipher.getAuthTag();

	return [
		iv.toString('base64'),
		authTag.toString('base64'),
		ciphertext.toString('base64')
	].join('.');
}

export function decryptTwoFactorSecret(payload) {
	if (!payload || typeof payload !== 'string') {
		return null;
	}

	const parts = payload.split('.');
	if (parts.length !== 3) {
		return null;
	}

	try {
		const [ivB64, tagB64, cipherB64] = parts;
		const iv = Buffer.from(ivB64, 'base64');
		const authTag = Buffer.from(tagB64, 'base64');
		const ciphertext = Buffer.from(cipherB64, 'base64');

		const key = getKey();
		const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
		decipher.setAuthTag(authTag);
		const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
		return decrypted.toString('utf8');
	} catch {
		return null;
	}
}

const BASE32_TOTP_REGEX = /^[A-Z2-7]+=*$/i;

export function looksLikePlainTwoFactorSecret(value) {
	if (typeof value !== 'string') return false;
	const cleaned = value.replace(/\s+/g, '');
	return cleaned.length >= 16 && BASE32_TOTP_REGEX.test(cleaned);
}

export function looksLikeEncryptedTwoFactorSecret(value) {
	if (typeof value !== 'string') return false;
	const parts = value.split('.');
	if (parts.length !== 3) return false;
	return parts.every((part) => /^[0-9a-zA-Z+/=]+$/.test(part));
}
