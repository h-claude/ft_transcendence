import { Friend, SmallUser } from "../../types/friends";
import { FriendsListAPI } from "./FriendsListAPI.js";
import { BaseState } from "../../BaseState.js";

export class FriendsListState extends BaseState {
	private friends: Friend[] = [];
	private receivedRequests: Friend[] = [];
	private sentRequests: Friend[] = [];
	private blocked: Friend[] = [];

	public constructor(){
		super();
	}

	protected async init(): Promise<void> {
		const rq = await FriendsListAPI.getFriendsList();
		if (rq instanceof Error) {
			console.log(rq.message);
			return ;
		}
		this.friends = rq;
		this.receivedRequests = await FriendsListAPI.getReceivedFriendRequests();
		this.sentRequests = await FriendsListAPI.getSentFriendRequests();
		this.blocked = await FriendsListAPI.getBlockedUsers(); // Ajout
	}

	clear(): void {
		this.friends.length = 0;
		this.receivedRequests.length = 0;
		this.sentRequests.length = 0;
		this.blocked.length = 0;
	}

	forEachFriend(callback: (friend: Friend) => void) {
		this.friends.forEach(callback);
	}

	forEachSent(callback: (friend: Friend) => void) {
		this.sentRequests.forEach(callback);
	}

	forEachReceivedRequest(callback: (friend: Friend) => void) {
		this.receivedRequests.forEach(callback);
	}

	addFriend(newFriend: Friend) {
		this.friends.push(newFriend);
		this.emit("friendAdded", newFriend.id);
		this.emit("stateChanged", [...this.friends]);
	}

	acceptFriend(newFriend: Friend) {
		this.friends.push(newFriend);
		this.emit("friendAccepted", newFriend.id);
		this.emit("stateChanged", [...this.friends]);
	}

	removeFriend(friendIdToRemove: number) {
		const index = this.friends.findIndex((f) => f.id === friendIdToRemove);
		if (index !== -1) {
			this.friends.splice(index, 1);
		}
		this.emit("friendRemoved", friendIdToRemove);
		this.emit("stateChanged", [...this.friends]);
	}

	removeSentRequest(friendIdToRemove: number) {
		const index = this.sentRequests.findIndex((f) => f.id === friendIdToRemove);
		if (index !== -1) {
			this.sentRequests.splice(index, 1);
		}
		this.emit("sentRequestRemoved");
		this.emit("stateChanged");
	}

	changeStatus(friendId: number, newStatus: "online" | "offline") {
		const index = this.friends.findIndex((f) => f.id === friendId);
		if (index !== -1) {
			if (this.friends[index].status === newStatus) {
				return ;
			}
			this.friends[index].status = newStatus;
		}
		this.emit("statusChanged", [...this.friends]);
		this.emit("stateChanged", [...this.friends]);
	}

	changeUsername(friendId: number, newUsername: string) {
		const index = this.friends.findIndex((f) => f.id === friendId);
		if (index !== -1) {
			this.friends[index].username = newUsername;
		}
		this.emit("usernameChanged", [...this.friends]);
		this.emit("stateChanged", [...this.friends]);
	}

	addReceivedRequest(newFriend: Friend) {
		this.receivedRequests.push(newFriend);
		this.emit("newFriendRequest", [...this.receivedRequests]);
		this.emit("requestStateChanged", [...this.receivedRequests]);
		this.emit("stateChanged", [...this.receivedRequests]);
	}

	addSentRequest(newFriend: Friend) {
		this.sentRequests.push(newFriend);
		this.emit("newSentRequest", [...this.receivedRequests]);
		this.emit("requestStateChanged", [...this.receivedRequests]);
		this.emit("stateChanged", [...this.receivedRequests]);
	}

	removeRequest(userId: number) {
		const index = this.receivedRequests.findIndex((rq) => rq.id === userId);
		if (index !== -1) {
			this.receivedRequests.splice(index, 1);
		}
		if (this.receivedRequests.length === 0) {
			this.emit("friendRequestEmpty", [...this.receivedRequests]);
		}
		this.emit("friendRequestRemoved", [...this.receivedRequests]);
		this.emit("requestStateChanged", [...this.receivedRequests]);
		this.emit("stateChanged", [...this.receivedRequests]);
	}

	cancelRequest(userId: number) {
		const index = this.sentRequests.findIndex((rq) => rq.id === userId);
		if (index !== -1) {
			this.sentRequests.splice(index, 1);
		}
		this.emit("friendInviteCanceled", [...this.sentRequests]);
		this.emit("requestsStateChanged", [...this.sentRequests])
		this.emit("stateChanged", [...this.sentRequests]);
	}

	isFriend(friendId: number): boolean {
		for (const f of this.friends) {
			if (f.id === friendId) {
				return (true);
			}
		}
		return (false);
	}

	isInSentRequests(userId: number): boolean {
		for (const f of this.sentRequests) {
			if (f.id === userId) {
				return (true);
			}
		}
		return (false);
	}

	isInReceivedRequests(userId: number): boolean {
		for (const f of this.receivedRequests) {
			if (f.id === userId) {
				return (true);
			}
		}
		return (false);
	}

	getRequests(): readonly SmallUser[] {
		return (this.receivedRequests);
	}

	getRequestNb(): Number {
		return (this.receivedRequests.length);
	}

	getFriends(): Friend[] {
		return (this.friends);
	}

	forEachBlocked(callback: (friend: Friend) => void) {
		this.blocked.forEach(callback);
	}

	isBlocked(userId: number): boolean {
		return this.blocked.some(f => f.id === userId);
	}

	async blockUser(user: Friend | PublicUser) {
		const res = await FriendsListAPI.blockUser(user.id);
		if (res instanceof Error) {
			console.error(res.message);
			return;
		}

		// Retirer des autres listes (sans appeler l'API)
		let index = this.friends.findIndex((f) => f.id === user.id);
		if (index !== -1) this.friends.splice(index, 1);
		
		index = this.sentRequests.findIndex((f) => f.id === user.id);
		if (index !== -1) this.sentRequests.splice(index, 1);

		index = this.receivedRequests.findIndex((f) => f.id === user.id);
		if (index !== -1) this.receivedRequests.splice(index, 1);

		// Ajouter à la liste des bloqués
		if (!this.isBlocked(user.id)) {
			// Convertir PublicUser en Friend si nécessaire
			const friendUser: Friend = (user as Friend).status !== undefined
				? (user as Friend)
				: { ...user, status: (user as PublicUser).status as "online" | "offline", last_seen: (user as PublicUser).lastSeen };
			
			this.blocked.push(friendUser);
		}
		
		this.emit("stateChanged"); // Déclenche une mise à jour globale de l'UI
	}

	async unblockUser(userId: number) {
		const res = await FriendsListAPI.unblockUser(userId);
		if (res instanceof Error) {
			console.error(res.message);
			return;
		}

		const index = this.blocked.findIndex((f) => f.id === userId);
		if (index !== -1) {
			this.blocked.splice(index, 1);
		}
		this.emit("stateChanged");
	}
}
