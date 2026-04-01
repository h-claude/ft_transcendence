import { UserStore } from "../../store.js";
import { Message, Conversation, ConvOneOnOne } from "../../types/chat";
import { PublicUser } from "../../types/user.js";
import { FriendsListAPI } from "../FriendsList/FriendsListAPI.js";
import { ProfileCardAPI } from "../ProfileCard/ProfileCardAPI.js";

export class ChatAPI {
	private constructor() { }

	static async getConversations(): Promise<any> {
		const response = await fetch("/api/conv/private", {
			method: "GET",
			credentials: "include"
		});
		const data = await response.json();
		const user = UserStore.getInstance().getUser();

		if (data.success) {
			const convMap = new Map<number, ConvOneOnOne>(
				Object.entries(data.message).map(([key, value]) => [Number(key), value as ConvOneOnOne])
			);
			for (const [_, conv] of convMap) {
				if (conv.type === "private") {
					for (const msg of conv.messages) {
						if (msg.senderId !== user?.id) {
							conv.correspondentId = msg.senderId;
							break;
						}
						if (msg.receiverId !== user?.id) {
							conv.correspondentId = msg.receiverId;
							break;
						}
					}
				}
			}
			return (convMap);
		} else {
			console.error("Failed to fetch conversations");
			return new Map();
		}
	};

	/**
	 * @param {string | number} user - either an username of a userId
	 * @returns {Promise<number | Error>}
	 * - either the id of the new conversation if successfull,
	 *   or an Error object if not.
	 */
	static async createNewConversation(user: string | number): Promise<any | Error> {
		var cid;
		if (typeof user === "string") {
			cid = await ChatAPI.getUserInfosByUsername(user);
			if (cid instanceof Error) {
				return (new Error(cid.message));
			}
			cid = cid.id;
		} else {
			cid = user;
		}

		const data = await fetch(`/api/conv/private/id/${cid}`, {
			method: "POST",
			credentials: "include"
		});
		const r = await data.json();
		if (!data.ok) {
			return (new Error(r.error));
		} else {
			return { convId: r.message, userId: cid };
		}
	}

	/**
	 * fetches the id of the conversation between user and the current user.
	 * @param {string | number} user - either an username or a userId
	 * @returns {Promise<number | Error>} - either the id of the conv
	 * or an Error object.
	 */
	static async getConvId(user: string | number): Promise<number | Error> {
		var cid;
		if (typeof user === "string") {
			cid = await ChatAPI.getUserInfosByUsername(user);
			if (cid instanceof Error) {
				return (new Error(cid.message));
			}
			cid = cid.id;
		} else {
			cid = user;
		}

		const data = await fetch(`/api/conv/private/getid/userid/${cid}`, {
			method: "GET",
			credentials: "include"
		});
		const r = await data.json();
		if (!data.ok) {
			return (new Error(r.error));
		} else {
			console.log(typeof r.message);
			return (r.message);
		}
	}

	static async sendMessageToConv(convId: number, recId: number, msg: string): Promise<any> {
		try {
			const response = await fetch(`/api/messages/private/${convId}`, {
				method: 'POST',
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ receiverId: recId, message: msg })
			});
			const responseData = response.json();
			if (response.ok) {
			} else {
				console.log("error while message :(");
			}
		} catch (e) {
			console.error("sendMessage", e);
		}
	}

	static async sendServerMessageToConv(convId: number, recId: number, msg: string): Promise<any> {
		try {
			const response = await fetch(`/api/messages/private/${convId}`, {
				method: 'POST',
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ receiverId: recId, message: msg })
			});
			const responseData = response.json();
			if (response.ok) {
			} else {
				console.log("error while message :(");
			}
		} catch (e) {
			console.error("sendMessage", e);
		}
	}

	static async getUserInfosByUsername(username: string): Promise<PublicUser | Error> {
		const response = await fetch(`/api/users/public/username/${username}`, {
			method: 'GET',
			credentials: "include"
		});
		const data = await response.json();
		if (!response.ok) {
			return (new Error(data.error));
		}
		return data.message;
	}

	static async hasActivePendingDirectGame(): Promise<any> {
		const u = UserStore.getInstance().getUser();
		if (!u) return;
		const response = await fetch("/api/users/game/infos", {
			method: 'GET',
			credentials: "include"
		});
		const data = await response.json();
		if (data.message === "not in a match") {
			return data.message;
		}
		const infos = JSON.parse(data.message);
		return (infos);
	}

	static async cancelDirectGameInvite() {
		const response = await fetch("/api/game/direct/cancel", {
			method: 'POST',
			credentials: 'include'
		});
		if (!response.ok) {
			console.log("could not cancel direct game invite");
		}
	}

	static async declineDirectGameInvite() {
		const response = await fetch("/api/game/direct/decline", {
			method: 'POST',
			credentials: 'include'
		});
		if (!response.ok) {
			console.log("could not decline direct game invite");
		}
	}

	static async acceptDirectGameInvite() {
		const response = await fetch("/api/game/direct/accept", {
			method: 'POST',
			credentials: 'include'
		});
		if (!response.ok) {
			console.log("could not decline direct game invite");
		}
	}
}
