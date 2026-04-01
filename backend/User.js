/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} name
 * @property {WebSocket} socket
 * @property {string} status
 * @property {boolean} freeToGame
 * @property {boolean} freeToChat
 * @property {boolean} pendingGameInvite
 * @property {string} logintime
 */
export class User {

	/**
	 * @param {number} id
	 * @param {string} name
	 * @param {WebSocket} socket
	 */
	constructor(id, name, socket) {
		/** @type {number} */
		this.id = id;
		/** @type {string} */
		this.name = name;
		/** @type {WebSocket} */
		this.socket = socket;
		/** @type {string} */
		this.status = "online";
		/** @type {boolean} */
		this.freeToGame = true;
		/** @type {boolean} */
		this.freeToChat = true;
		/** @type {boolean} */
		this.pendingGameInvite = false;
		/** @type {string} */
		this.loginTime = Date.now();
		/** @type {bool} */
		this.inGame = false;
	}
}

export const UserManager = {
	/**@type{Map<number, User>}
	 * userId - User object
	 */
	users: new Map(),
	/**@type{Map<number, number>}
	 * receiverId - initiatorId
	 */
	drctInvites: new Map(),
	/**
	 * Adds a new user the the map tracking online users
	 * @param {number} userId - The id of the user to add
	 * @param {string} username - the username
	 * @param {WebSocket} socket - the active socket of the user
	 * @returns nothing
	 */
	add(userId, username, socket) {
		if (this.users.has(userId)) {
			console.warn(`User ${userId} already exists`);
			return;
		}
		this.users.set(userId, new User(
			userId,
			username,
			socket
		))
	},
	/**
	 * Removes a user from the map
	 * @param {number} userId - The id of the user to remove
	 * @returns nothing
	 */
	remove(userId) {
		this.users.delete(userId);
	},
	/**
	 * Sends data through the user websocket.
	 * Fails silently if the user is not in the map.
	 * @param {number} userId - the id of the user
	 * @param {Object} data - an object containing the data
	 * to send. Will be JSON stringified.
	 * @returns {boolean} true if the message has been sent,
	 * false if the user could not be found.
	 */
	sendThroughSocket(userId, data) { ///ICIIIII pour send les infos objects LUDO
		if (this.users.has(userId)) {
			this.users.get(userId).socket.send(JSON.stringify(data));
			return (true);
		}
		return (false);
	},
	/**
	 * fetch a user from the map
	 * @param {number} userId - The id of the user to get
	 * @returns {User | null} the User object for that id
	 * or null if the user is not found
	 */
	getUser(userId) {
		return (this.users.get(userId)) || null;
	},
	/**
	 * fetches the socket of the userId
	 * @param {number} userId - The id of the user to get
	 * @returns {WebSocket} the socket for that id
	 */
	getSocket(userId) {
		if (!this.users.has(userId)) {
			return;
		}
		return (this.users.get(userId).socket);
	},
	/**
	 * fetches the name for the userId
	 * @param {number} userId - The id of the user to get
	 * @returns {string} the username of the user
	 */
	getName(userId) {
		return (this.users.get(userId).name);
	},
	/**
	 * fetches the status for the userId
	 * @param {number} userId - The id of the user to get
	 * @returns {string} the status of the user
	 */
	getStatus(userId) {
		return (this.users.get(userId).status);
	},
	/**
	 * sets a new status for the user
	 * @param {number} userId - The id of the user to set
	 * @param {string} newStatus - the new status to set
	 * @returns nothing
	 */
	setStatus(userId, newStatus) {
		this.users.get(userId).status = newStatus;
	},
	/**
	 * fetches the status for the userId
	 * Pas du tout implemente pour le moment
	 * @param {number} userId - The id of the user to get
	 * @returns {boolean} the free to chat status of the user
	 */
	isFreeToChat(userId) {
		return (this.users.get(userId).freeToChat);
	},
	/**
	 * fetches the status for the userId
	 * @param {number} userId - The id of the user to get
	 * @returns {boolean} the free to game status of the user
	 */
	isFreeToGame(userId) {
		if (!this.users.has(userId)) {
			return false; // L'utilisateur n'existe pas, donc pas libre pour jouer
		}
		return (this.users.get(userId).freeToGame);
	},
	/**
	 * fetches the inGame status of the userId
	 * @param {number} userId
	 * @returns {boolean}
	 */
	isInGame(userId) {
		if (!this.users.has(userId)) {
			return false; // L'utilisateur n'existe pas, donc pas en jeu
		}
		return (this.users.get(userId).inGame);
	},
	/**
	 * Sets the freeToChat value of the user
	 * @param {number} userId - The id of the user to set
	 * @param {boolean} newValue - a bool for the freeToChat status.
	 * @returns nothing
	 */
	setFreeToChat(userId, newValue) {
		if (!this.users.has(userId)) {
			return;
		}
		this.users.get(userId).freeToChat = newValue;
	},
	/**
	 * Sets the freeToGame value of the user
	 * @param {number} userId - The id of the user to set
	 * @param {boolean} newValue - a bool for the freeToGame status.
	 * @returns nothing
	 */
	setFreeToGame(userId, newValue) {
		if (!this.users.has(userId)) {
			return;
		}
		this.users.get(userId).freeToGame = newValue;
	},

	/**
	 * Broadcasts a message to all connected friends of userId.
	 * will JSON.stringify the message.
	 * @param {number} userId
	 * @param {Object} message
	 */
	broadcastToFriendsWs(fastify, userId, message) {
		const friends = fastify.db.prepare(
			`select u.id
			 from friends f
			 join users u on (f.friend_id = u.id or f.user_id = u.id)
			 where (f.user_id = ? or f.friend_id = ?)
			 and f.status = 'accepted'
			 and u.id != ?`,
		).all(userId, userId, userId);
		for (let f of friends) {
			if (!this.has(f.id)) {
				continue;
			}
			const ws = this.getSocket(f.id);
			if (ws) {
				ws.send(JSON.stringify(message));
			}
		}
	},

	/**
	 * Check if the user is in the user map
	 * @param {number} userId - The id of the user to set
	 * @returns {boolean} whether the map contains the user or not
	 */
	has(userId) {
		return (this.users.has(userId));
	},

	/**
	 * debug method for printing the whole map
	 * @returns nothing
	 */
	print() {
		console.log("\nUserManager:");
		this.users.forEach((user, uid) => {
			console.log(`UserID: ${uid} | Name: ${user.name} | Status: ${user.status} | socket: ${user.socket}`);
		});
	}
}
