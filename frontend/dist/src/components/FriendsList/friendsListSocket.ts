import { Message } from "../../types/chat.js";
import { Friend } from "../../types/friends.js";
import { WebSocketManager } from "../../WebSocketManager.js";
import { FriendsListAPI } from "./FriendsListAPI.js";
import { FriendsListState } from "./FriendsListState.js";
import { FriendsListUIEmitter } from "./FriendsListUIEmitter.js";

export class FriendsListSocket {
	private socket: WebSocket | null = null;
	private static handler: (event: MessageEvent) => void;
	private static instance: FriendsListSocket | null = null;

	private constructor(){}

	async init() {
		const wsInstance = await WebSocketManager.getInstance();
		this.socket = await wsInstance.getSocket();
	}

	private async createHandler(friendsListState: FriendsListState) {
		return async function (event: MessageEvent) {
			const data = JSON.parse(event.data);
			if (data.type === "friend_request_update") {
				const id = data.from;
				const newFriend: Friend = await FriendsListAPI.getFriendById(id);
				friendsListState.addReceivedRequest(newFriend);
			} else if (data.type === "friend_request_accepted") {
				const id = data.from;
				const newFriend: Friend = await FriendsListAPI.getFriendById(id);
				friendsListState.removeSentRequest(id);
				friendsListState.addFriend(newFriend);
			} else if (data.type === "removed_by_friend") {
				const id = data.from;
				friendsListState.removeFriend(id);
			} else if (data.type === "user_connected") {
				const id = data.from;
				friendsListState.changeStatus(id, "online");
			} else if (data.type === "user_disconnected") {
				const id = data.from;
				friendsListState.changeStatus(id, "offline");
			} else if (data.type === "friend_request_declined") {
				const id = data.from;
				friendsListState.removeSentRequest(id)
			} else if (data.type === "friend_request_canceled") {
				const id = data.from;
				friendsListState.removeRequest(id);
			}
		}
	}

	static async getInstance(): Promise<FriendsListSocket> {
		if (!FriendsListSocket.instance) {
			FriendsListSocket.instance = new FriendsListSocket();
			await FriendsListSocket.instance.init();
		}
		return (FriendsListSocket.instance);
	}

	async setupListeners(friendsListState: FriendsListState) {
		FriendsListSocket.handler = await this.createHandler(friendsListState);
		this.socket?.addEventListener("message", FriendsListSocket.handler);
	}

	destroylisteners() {
		this.socket?.removeEventListener("message", FriendsListSocket.handler);
	}
}
