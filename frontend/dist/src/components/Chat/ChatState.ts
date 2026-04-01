import { BaseState } from "../../BaseState.js";
import { Message, Conversation, ConvOneOnOne, ServerMessage } from "../../types/chat.js";
import { PublicUser } from "../../types/user.js";
import { ChatAPI } from "./ChatAPI.js";

export class ChatState extends BaseState {
	private convs: Map<number, ConvOneOnOne> = new Map();

	constructor() {
		super();
	}

	async init() {
		this.convs = await ChatAPI.getConversations();
	}

	addConversation(convId: number, conv: ConvOneOnOne) {
		this.convs.set(convId, conv);
		this.emit("newConversation", [...this.convs]);
		this.emit("stateChanged", [...this.convs]);
	}

	addMessage(convId: number, msg: Message) {
		this.convs.get(convId)?.messages.push(msg);
		this.emit("newMessage", [...this.convs]);
		this.emit("stateChanged", [...this.convs]);
	}

	addServerMessage(convId: number, msg: Message) {
		if (!this.convs.has(convId)) return;
		this.convs.get(convId)?.messages.push(msg);
		this.emit("newServerMessage", msg);
		this.emit("stateChanged", [...this.convs]);
	}

	forEachConv(callback: (conv: ConvOneOnOne) => void) {
		this.convs.forEach(callback);
	}

	forEachMessage(convId: number, callback: (msg: Message) => void) {
		this.convs.get(convId)?.messages.forEach(callback);
	}

	hasConv(convId: number): boolean {
		return (this.convs.has(convId));
	}

	getConv(convId: number): ConvOneOnOne | undefined {
		return (this.convs.get(convId));
	}

	clear(): void {
		this.convs.clear();
	}

	getConvs() {
		return (this.convs);
	}
}
