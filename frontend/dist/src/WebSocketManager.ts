import { ChatState } from "./components/Chat/ChatState.js";
import { FriendsListState } from "./components/FriendsList/FriendsListState.js";
import { UserStore } from "./store.js";

export class WebSocketManager {
	private static instance: WebSocketManager | null = null;;
	private socket: WebSocket | null = null;
	private url: string;

	private constructor(url: string) {
		this.url = url;
		this.connect();
	}

	private connect(): Promise<void> {
		this.socket = new WebSocket(this.url);
		this.socket.onopen = async () => {
			console.log("websocket connected")
			// const res = await fetch('/api/users/status', {
			// 	method: 'PATCH',
			// 	headers: {"Content-Type": "application/json"},
			// 	credentials: "include",
			// 	body: JSON.stringify("online")
			// })
		};
		this.socket.onclose = async (event) => {
			console.log("websocket disconnected");
			console.log(`code: ${event.code}, Reason: ${event.reason}`);
			this.socket = null;
			WebSocketManager.instance = null as any;
			const us = UserStore.getInstance();
			us.clearUser();
			FriendsListState.resetInstance();
			ChatState.resetInstance();
		}
		this.socket.onerror = (err) => console.error("websocket error", err);
		return Promise.resolve();
	}

	public static getInstance(url: string = `wss://${window.location.host}/api/ws`): Promise<WebSocketManager> {
		if (!WebSocketManager.instance) {
			WebSocketManager.instance = new WebSocketManager(url);
		}
		return Promise.resolve(WebSocketManager.instance);
	}

	public getSocket(): Promise<WebSocket> {
		if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
			this.connect();
		}
		return (Promise.resolve(this.socket!));
	}

	public close(): Promise<void> {
		if (this.socket) {
			this.socket.close(1000, "client closes connection");
			this.socket = null;
			WebSocketManager.instance = null as any;
		} else {
			console.warn("websocket already closed");
		}
		return Promise.resolve();
	}

	destroyInstance() {
		WebSocketManager.instance = null;
	}
}
