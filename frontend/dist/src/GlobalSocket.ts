import { GlobalEmitter } from "./GlobalEmitter.js";
import { WebSocketManager } from "./WebSocketManager.js";

export class GlobalSocket {
	private socket: WebSocket | null = null;
	private static hasHandler: boolean = false;
	private static instance: GlobalSocket | null = null;
	private static handler: (event: MessageEvent) => void;

	private constructor() { }

	static async getInstance(): Promise<GlobalSocket> {
		if (!GlobalSocket.instance) {
			GlobalSocket.instance = new GlobalSocket();
			GlobalSocket.instance.init();
		}
		return (GlobalSocket.instance);
	}

	private async init() {
		if (!this.socket) {
			const wsInstance = await WebSocketManager.getInstance();
			this.socket = await wsInstance.getSocket();
		}
	}

	private async createHandler() {
		return async function (event: MessageEvent) {
			const globalEmitter = GlobalEmitter.getInstance();
			const data = JSON.parse(event.data);
			if (data.type === "game_direct_invite_accepted") {
				globalEmitter.directGameAccepted();
			}
			if (data.type === "game_forfeited") {
				globalEmitter.gameForfeited();
			}
			if (data.type === "game_mm_found") {
				globalEmitter.mmGameFound();
			}
			if (data.type === "game_ai_started") {
				globalEmitter.aiGameStarted();
			}
		}
	}

	async setupListeners() {
		if (!GlobalSocket.hasHandler) {
			GlobalSocket.handler = await this.createHandler();
			GlobalSocket.hasHandler = true;
		}
		this.socket?.addEventListener("message", GlobalSocket.handler);
	}

	destroyListeners() {
		GlobalSocket.hasHandler = false;
		this.socket?.removeEventListener("message", GlobalSocket.handler);
	}

	destroySocket() {
		this.socket?.close();
		this.socket = null;
	}

	destroyInstance() {
		GlobalSocket.instance = null;
		this.socket = null;
	}
}
