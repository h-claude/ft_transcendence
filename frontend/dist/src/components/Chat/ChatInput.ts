import { ChatAPI } from "./ChatAPI.js";
import { ChatUIEmitter } from "./ChatUIEmitter.js";
import { UserStore } from "../../store.js";
import { ChatUi } from "./ChatUi.js";
import { ChatState } from "./ChatState.js";

export class ChatInput {
	private chatInput: HTMLTextAreaElement;
	private chatUiEmitter: ChatUIEmitter;

	constructor() {
		this.chatInput = <HTMLTextAreaElement>document.getElementById("chat-input")!;
		this.chatUiEmitter = ChatUIEmitter.getInstance();
	}

	async sendMessage(chatState: ChatState, chatUi: ChatUi) {
		if (chatUi.getCurrentConvId() === -1) {
			this.chatInput.value = "";
			this.chatInput.style.height = "auto";
			return;
		}
		const text = this.chatInput.value.trim();
		if (text === "") return;
		if (text === "/wizz") {
			this.chatUiEmitter.sendWizz();
			this.chatInput.value = "";
			this.chatInput.style.height = "auto";
			return;
		}
		const uid = UserStore.getInstance().getUser()?.id;
		if (!uid) {
			return;
		}
		chatState.addMessage(chatUi.getCurrentConvId(), {
			content: text,
			conversationId: chatUi.getCurrentConvId(),
			receiverId: chatUi.getCurrentCid(),
			senderId: uid,
			timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
			id: -1,
			type: "user"
		});
		this.chatInput.value = "";
		this.chatInput.style.height = "auto";
		ChatAPI.sendMessageToConv(chatUi.getCurrentConvId(), chatUi.getCurrentCid(), text);
	}
}
