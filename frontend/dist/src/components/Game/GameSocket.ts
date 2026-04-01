import { WebSocketManager } from "../../WebSocketManager.js";

export class GameSocket {
	private socket: WebSocket | null = null;
	private static instance: GameSocket | null = null;
	private static handler: (event: MessageEvent) => void;

	private constructor(){}

	static async getInstance(): Promise<GameSocket> {
		if (!GameSocket.instance) {
			GameSocket.instance = new GameSocket();
			await GameSocket.instance.init();
		}
		return (GameSocket.instance);
	}

	private async init() {
		const wsInstance = await WebSocketManager.getInstance();
		this.socket = await wsInstance.getSocket();
	}

	private async createHandler(...args: any[]) {
		return (async function(event: MessageEvent) {
			const data = JSON.parse(event.data);
			switch (data.type) {
				case "game_state_update" :
				break ;
			}
		})
	}

	async setupListeners() {
		GameSocket.handler = await this.createHandler("666");
		this.socket?.addEventListener("message", GameSocket.handler);
	}

	destroyListeners() {
		this.socket?.removeEventListener("message", GameSocket.handler);
	}
}
