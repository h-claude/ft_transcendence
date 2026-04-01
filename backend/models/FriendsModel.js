export const FriendsModel = {
	/**
	 * @param {string} username
	 * @returns {number | undefined} friendId
	 */
	getIdByUsername(fastify, username) {
		const data = fastify.db.prepare(
			`select u.id
			 from users u
			 where u.username = ?`
		).get(username);
		if (!data) {
			return (undefined);
		}
		return (data.id);
	},

	/**
	* @param {number} userid1
	* @param {number} userid2
	*/
	friendshipExists(fastify, userid1, userid2) {
		const data = fastify.db.prepare(
			`SELECT EXISTS (
				SELECT 1 FROM friends
				WHERE
					(user_id = ? AND friend_id = ?)
					or
					(user_id = ? AND friend_id = ?)
			) AS friendship_exists`
		).get(userid1, userid2, userid2, userid1);;
		return (data.friendship_exists);
	},

	/**
	* @param {number} userid1
	* @param {number} userid2
	*/
	createFriendship(fastify, userid1, userid2) {
		fastify.db.prepare(
			`INSERT INTO friends (user_id, friend_id, status)
			 VALUES (?, ?, 'pending')`
		).run(userid1, userid2);
	},

	/**
	* @param {number} userid1
	* @param {number} userid2
	*/
	acceptFriendship(fastify, userid1, userid2) {
		fastify.db.prepare(
			`update friends
			 set status = 'accepted'
			 where (user_id = ? and friend_id = ?) or (user_id = ? and friend_id = ?)`
		).run(userid2, userid1, userid1, userid2);
	},

	/**
	* @param {number} userid1
	* @param {number} userid2
	*/
	removeFriendRequest(fastify, userid1, userid2) {
		fastify.db.prepare(
			`delete from friends
			 where (user_id = ? and friend_id = ?) or (user_id = ? and friend_id = ?)`
		).run(userid2, userid1, userid1, userid2);
	},

	/**
	* @param {number} userid
	*/
	getAcceptedFriends(fastify, userid) {
		const friends = fastify.db.prepare(
			`select u.username, u.id, us.status, us.last_seen
			 from friends f
			 join users u on (f.friend_id = u.id or f.user_id = u.id)
			 join user_status us on (us.user_id = u.id)
			 where (f.user_id = ? or f.friend_id = ?)
			 and f.status = 'accepted'
			 and u.id != ?`,
		).all(userid, userid, userid);
		return (friends);
	},

	cancelFriendRequest(fastify, userid1, userid2) {
		fastify.db.prepare(
			`DELETE from friends
			 WHERE user_id = ? AND friend_id = ? AND status='pending'`
		).run(userid1, userid2);
	},

	/**
	* @param {number} userid
	*/
	getReceivedFriendRequests(fastify, userid) {
		const friends = fastify.db.prepare(
			`
			select u.username, u.id, us.status, us.last_seen AS lastSeen
			from friends f
			join users u on f.user_id = u.id
			join user_status us on f.user_id = us.user_id
			where f.status = 'pending'
			and f.friend_id = ?`
		).all(userid);
		return (friends)
	},

	/**
	* @param {number} userid
	*/
	getSentFriendsRequests(fastify, userid) {
		const friends = fastify.db.prepare(
			`
			select u.username, u.id, us.status, us.last_seen AS lastSeen
			from friends f
			join users u on f.friend_id = u.id
			join user_status us on f.friend_id = us.user_id
			where f.status = 'pending'
			and f.user_id = ?`
		).all(userid);
		return (friends);
	},

	/**
	* @param {number} userid
	* @param {number} toremove
	*/
	removeFriendship(fastify, userid1, userid2) {
		fastify.db.prepare(
			`delete from friends
			 where (user_id = ? and friend_id = ?) or (user_id = ? and friend_id = ?)`
		).run(userid2, userid1, userid1, userid2);
	},

	getFriendInfos(fastify, userid) {
		const user = fastify.db.prepare(
			`SELECT
				u.id,
				u.username,
				us.status,
				us.last_seen AS lastSeen
			FROM
				users u
			JOIN
				user_status us ON us.user_id = u.id
			WHERE
				u.id = ?`
		).get(userid);
		return (user);
	},

	/**
	* Bloque un utilisateur.
	* Cela supprime toute amitié ou demande existante et la remplace par un statut de blocage.
	* @param {import("fastify").FastifyInstance} fastify
	* @param {number} blockerId - L'ID de l'utilisateur qui bloque
	* @param {number} blockedId - L'ID de l'utilisateur à bloquer
	*/
	blockUser(fastify, blockerId, blockedId) {
		const db = fastify.db;
		// Utilise une transaction pour assurer l'atomicité
		db.transaction(() => {
			// 1. Supprime toute relation existante (pending, accepted) dans les deux sens
			db.prepare(
				`DELETE FROM friends
				 WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`
			).run(blockerId, blockedId, blockedId, blockerId);

			// 2. Insère l'enregistrement de blocage.
			// Nous stockons (blocker, blocked) pour savoir qui a émis le blocage.
			db.prepare(
				`INSERT INTO friends (user_id, friend_id, status, block_emitter_id)
				 VALUES (?, ?, 'blocked', ?)`
			).run(blockerId, blockedId, blockerId);
		})();
	},

	/**
	* Débloque un utilisateur.
	* Ne fonctionne que si le 'unblockerId' est bien celui qui a émis le blocage.
	* @param {import("fastify").FastifyInstance} fastify
	* @param {number} unblockerId - L'ID de l'utilisateur qui débloque
	* @param {number} blockedId - L'ID de l'utilisateur débloqué
	*/
	unblockUser(fastify, unblockerId, blockedId) {
		fastify.db.prepare(
			`DELETE FROM friends
			 WHERE user_id = ? AND friend_id = ?
			 AND status = 'blocked'
			 AND block_emitter_id = ?`
		).run(unblockerId, blockedId, unblockerId);
	},

	/**
	* Vérifie si une relation de blocage existe entre deux utilisateurs (dans n'importe quel sens).
	* @param {import("fastify").FastifyInstance} fastify
	* @param {number} userId1
	* @param {number} userId2
	* @returns {boolean}
	*/
	isBlocked(fastify, userId1, userId2) {
		const data = fastify.db.prepare(
			`SELECT 1
			 FROM friends
			 WHERE status = 'blocked'
			 AND (
				 (user_id = ? AND friend_id = ?) OR
				 (user_id = ? AND friend_id = ?)
			 )`
		).get(userId1, userId2, userId2, userId1);
		return !!data; // Renvoie true si un enregistrement est trouvé, sinon false
	},

	/**
	* Récupère la liste des utilisateurs bloqués par un utilisateur.
	* @param {import("fastify").FastifyInstance} fastify
	* @param {number} userId - L'ID de l'utilisateur qui a bloqué
	*/
	getBlockedUsers(fastify, userId) {
		const blockedUsers = fastify.db.prepare(
			`SELECT
				u.username, u.id, us.status, us.last_seen AS lastSeen
			 FROM
				friends f
			 JOIN
				users u ON f.friend_id = u.id
			 JOIN
				user_status us ON us.user_id = u.id
			 WHERE
				f.user_id = ?
				AND f.status = 'blocked'
				AND f.block_emitter_id = ?`
		).all(userId, userId);
		return blockedUsers;
	},
}
