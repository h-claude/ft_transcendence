import { UserStore } from "../../store.js";
import { Message, userStatusChange } from "../../types/chat.js";
import { WebSocketManager } from "../../WebSocketManager.js";
import { ChatState } from "./ChatState.js";
import { ChatUIEmitter } from "./ChatUIEmitter.js";
import { ChatUi } from "./ChatUi.js";

export class ChatSocket {
	private socket: WebSocket | null = null;
	private static instance: ChatSocket | null = null;
	private static handler: (event: MessageEvent) => void;

	private constructor() { }

	static async getInstance(): Promise<ChatSocket> {
		if (!ChatSocket.instance) {
			ChatSocket.instance = new ChatSocket();
			await ChatSocket.instance.init();
		}
		return (ChatSocket.instance);
	}

	private async init() {
		const wsInstance = await WebSocketManager.getInstance();
		this.socket = await wsInstance.getSocket();
	}

	private async createHandler(chatState: ChatState, chatUi: ChatUi, chatUiEmitter: ChatUIEmitter, uid: number) {
		return async function (event: MessageEvent) {
			const data = JSON.parse(event.data);
			const convId = Number.parseInt(data.conversationId, 10);
			const user = UserStore.getInstance().getUser();
			if (!user) {
				console.warn("de la merde");
				return;
			}

			switch (data.type) {
				case "chat_message_update":
					if (!chatState.hasConv(convId)) {
						chatState.addConversation(convId, {
							conversationId: convId,
							createdAt: "0",
							messages: <Message[]>[],
							name: "a",
							type: 'private',
							correspondentId: data.from,
						});
					}
					chatState.addMessage(convId, {
						id: -1,
						conversationId: convId,
						senderId: data.from,
						receiverId: uid,
						content: data.body,
						timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
						type: "user"
					});
					chatUiEmitter.notifNewMessage(convId);
					break;

				case "user_connected":
					chatUiEmitter.userStatusChanged(<userStatusChange>{ fromId: data.from, newStatus: "online" });
					break;

				case "user_disconnected":
					chatUiEmitter.userStatusChanged(<userStatusChange>{ fromId: data.from, newStatus: "offline" });
					break;

				case "game_direct_invite_request":
					const convIdFetchedFromUserId = chatUi.getConvIdByUserId(data.from);
					if (!convIdFetchedFromUserId) {
						console.warn("c'est la merde");
						return;
					}
					chatState.addServerMessage(convIdFetchedFromUserId, {
						content: "game_direct_invite_request",
						conversationId: convIdFetchedFromUserId,
						id: -1,
						receiverId: user.id,
						senderId: 1,
						timestamp: "0",
						type: "system"
					});
					chatUiEmitter.dispatchEvent(new Event("gameDirectInviteRequest"));
					break;

				case "game_direct_invite_canceled":
					chatUiEmitter.dispatchEvent(new Event("gameDirectInviteCanceled"));
					break;

				case "game_direct_invite_declined":
					chatUiEmitter.dispatchEvent(new Event("gameDirectInviteDeclined"));
					break;

				case "chat_ui_wizz":
					await chatUi.wizz(data.from);
					break;

				default:
					break;
			}
		}
	}

	async setupListeners(chatState: ChatState, chatUi: ChatUi, chatUiEmitter: ChatUIEmitter) {
		const uid = UserStore.getInstance().getUser()?.id;
		if (!uid) {
			return;
		}
		if (!this.socket) {
			const wsInstance = await WebSocketManager.getInstance();
			this.socket = await wsInstance.getSocket();
		}

		ChatSocket.handler = await this.createHandler(chatState, chatUi, chatUiEmitter, uid);
		this.socket.addEventListener("message", ChatSocket.handler);
	}

	destroyListeners() {
		this.socket?.removeEventListener("message", ChatSocket.handler);
	}

	destroyInstance() {
		this.socket = null;
		ChatSocket.instance = null;
	}

	async sendWizz(toUserId: number) {
		if (!this.socket) {
			const wsInstance = await WebSocketManager.getInstance();
			this.socket = await wsInstance.getSocket();
		}

		this.socket.send(JSON.stringify({ type: "wizz", to: toUserId }));
	}
}
