import Database from "better-sqlite3"

const db = new Database("database.db");

db.exec("PRAGMA foreign_keys = ON;")

db.exec(`
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		email TEXT UNIQUE NOT NULL,
		password TEXT,
		role TEXT CHECK(role IN ('user', 'server', 'admin')) NOT NULL,
		two_factor_enabled INTEGER NOT NULL DEFAULT 0,
		two_factor_secret TEXT,
		two_factor_recovery_hashes TEXT,
		oauth_provider TEXT,
		provider_user_id TEXT,
		oauth_access_token TEXT,
		uid TEXT UNIQUE
	);

	CREATE TABLE IF NOT EXISTS user_status (
		user_id INTEGER PRIMARY KEY,
		status TEXT CHECK(status IN ('online', 'offline', 'away')),
		last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		in_a_match BOOLEAN NOT NULL DEFAULT 0,
		in_a_tournament BOOLEAN NOT NULL DEFAULT 0,
		tournament_id INTEGER DEFAULT NULL,
		searching_for_match BOOLEAN NOT NULL DEFAULT 0,
		FOREIGN KEY (user_id) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS user_images (
		user_id INTEGER PRIMARY KEY,
		has_profile_picture BOOLEAN NOT NULL DEFAULT 0,
		has_profile_background_picture BOOLEAN NOT NULL DEFAULT 0,
		has_profile_card_picture BOOLEAN NOT NULL DEFAULT 0,
		profile_picture BLOB DEFAULT NULL,
		profile_background_picture BLOB DEFAULT NULL,
		profile_card_picture BLOB DEFAULT NULL,
		FOREIGN KEY (user_id) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS friends (
		user_id INTEGER,
		friend_id INTEGER,
		status TEXT CHECK(status IN ('pending', 'accepted', 'blocked')),
		block_emitter_id INTEGER DEFAULT NULL,
		PRIMARY KEY (user_id, friend_id),
		FOREIGN KEY (user_id) REFERENCES users(id),
		FOREIGN KEY (friend_id) REFERENCES users(id),
		FOREIGN KEY (block_emitter_id) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS conversations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		type TEXT CHECK(type IN ('private', 'public')),
		name TEXT UNIQUE NOT NULL,
		id_1 INTEGER NOT NULL,
		id_2 INTEGER NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		is_active BOOLEAN NOT NULL DEFAULT 0,
		FOREIGN KEY (id_1) REFERENCES users(id),
		FOREIGN KEY (id_2) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		sender_id INTEGER NOT NULL,
		receiver_id INTEGER NOT NULL,
		content TEXT NOT NULL,
		timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
		conversation_id INTEGER NOT NULL,
		FOREIGN KEY (conversation_id) REFERENCES conversations(id),
		FOREIGN KEY (sender_id) REFERENCES users(id),
		FOREIGN KEY (receiver_id) REFERENCES users(id)
	);

	CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

	CREATE TABLE IF NOT EXISTS messaging (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user1 INTEGER NOT NULL,
		user2 INTEGER NOT NULL,
		FOREIGN KEY (user1) REFERENCES users(id),
		FOREIGN KEY (user2) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS matches (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		end_time TIMESTAMP,
		winner_id INTEGER,
		type TEXT CHECK(type IN ('direct', 'mm', 'tournament', 'ai')),
		tournament_id INTEGER,
		initiator TEXT NOT NULL DEFAULT 'server',
		status TEXT CHECK(status IN ('pending', 'ongoing', 'finished', 'canceled')),
		status_tournament TEXT CHECK(status_tournament IN ('demi-final', 'final')),
		FOREIGN KEY (winner_id) REFERENCES users(id),
		FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
		CHECK (type != 'tournament' OR tournament_id IS NOT NULL)
	);

	CREATE TABLE IF NOT EXISTS match_participants (
		match_id INTEGER,
		user_id INTEGER,
		role TEXT CHECK(role IN ('player', 'spectator', 'ai')),
		score INTEGER DEFAULT 0,
		PRIMARY KEY (match_id, user_id),
		FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS old_matches (
		match_id INTEGER PRIMARY KEY,
		start_time TIMESTAMP,
		end_time TIMESTAMP,
		winner_id INTEGER,
		tournament_id INTEGER,
		type  TEXT CHECK(type IN ('direct', 'mm', 'tournament')),
		status_tournament TEXT CHECK(status_tournament IN ('demi-final', 'final')),
		initiator TEXT NOT NULL,
		FOREIGN KEY (winner_id) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS old_match_participants (
		match_id INTEGER,
		user_id INTEGER,
		role TEXT CHECK(role IN ('player', 'spectator')),
		score INTEGER DEFAULT 0,
		PRIMARY KEY (match_id, user_id),
		FOREIGN KEY (match_id) REFERENCES old_matches(match_id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS game_state (
		match_id INTEGER PRIMARY KEY,
		state_data TEXT NOT NULL,
		last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (match_id) REFERENCES matches(id)
	);

	CREATE TABLE IF NOT EXISTS player_stats (
		user_id INTEGER PRIMARY KEY,
		wins INTEGER DEFAULT 0,
		losses INTEGER DEFAULT 0,
		highest_kdr INTEGER DEFAULT 0,
		FOREIGN KEY (user_id) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS settings (
		user_id INTEGER PRIMARY KEY,
		settings_data TEXT NOT NULL,
		FOREIGN KEY (user_id) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS reports (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		reported_by INTEGER NOT NULL,
		reported_user INTEGER NOT NULL,
		reason TEXT NOT NULL,
		timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (reported_by) REFERENCES users(id),
		FOREIGN KEY (reported_by) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS tournaments (
		tournament_id INTEGER PRIMARY KEY AUTOINCREMENT,
		start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		end_time TIMESTAMP,
		winner_id INTEGER,
		initiator TEXT NOT NULL DEFAULT 'server',
		status TEXT CHECK(status IN ('pending', 'ongoing', 'finished', 'canceled')),
		number_of_participants INTEGER NOT NULL CHECK(number_of_participants >= 0 AND number_of_participants <= 4),
		FOREIGN KEY (winner_id) REFERENCES users(id)
	);
`);
db.exec(`
	CREATE TABLE IF NOT EXISTS blockchain_matches (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		game_id TEXT NOT NULL,
		tx_hash TEXT NOT NULL,
		user_uids TEXT NOT NULL,     -- JSON.stringify([...])
		scores TEXT NOT NULL,        -- JSON.stringify([...])
		timestamp INTEGER NOT NULL,  -- timestamp blockchain
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		confirmed BOOLEAN DEFAULT 1, -- 1 = confirmé, 0 = en attente
		match_id_fk INTEGER,
		FOREIGN KEY (match_id_fk) REFERENCES old_matches(match_id)
		);

	CREATE INDEX IF NOT EXISTS idx_blockchain_gameid ON blockchain_matches(game_id);
	CREATE INDEX IF NOT EXISTS idx_blockchain_useruids ON blockchain_matches(user_uids);
`);

db.exec(`
	INSERT INTO users (id, username, email, password, role)
	VALUES (1, 'server', 'server@server.sv', 'password', 'server')
	ON CONFLICT(id) DO NOTHING
`);
db.exec(`
	INSERT INTO users (id, username, email, password, role, uid)
	VALUES (9999, 'AI_BOT', 'ai@pong.local', NULL, 'server', '00000000-0000-0000-0000-000000000000')
	ON CONFLICT(id) DO NOTHING;
`);

export default db;
