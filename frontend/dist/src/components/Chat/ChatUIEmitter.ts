import { TrackedEventTarget } from "../../TrackedEventTarget.js";
import { userStatusChange } from "../../types/chat.js";

export class ChatUIEmitter extends TrackedEventTarget {
	private static instance: ChatUIEmitter | null = null;

	private constructor() {
		super();
	}

	static getInstance(): ChatUIEmitter {
		if (!ChatUIEmitter.instance) {
			ChatUIEmitter.instance = new ChatUIEmitter();
		}
		return (ChatUIEmitter.instance);
	}

	dispatchSimpleEvent(event: string) {
		this.dispatchEvent(new Event(event));
	}

	sendWizz() {
		this.dispatchEvent(new Event('wizz'));
	}

	notifNewMessage(convId: number) {
		const event = new CustomEvent("newMessage", {detail: convId});
		this.dispatchEvent(event);
	}

	userStatusChanged(detail: userStatusChange) {
		const event = new CustomEvent("userStatusChanged", {detail: <userStatusChange>detail});
		this.dispatchEvent(event);
	}

	messageFromServerReceived(convId: number) {
		const event = new CustomEvent("messageFromServerReceived", {detail: convId});
		this.dispatchEvent(event);
	}
}
