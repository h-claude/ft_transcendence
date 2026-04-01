import { Component } from "../Component.js"
import { navigate } from "../navigation.js";
import { WebSocketManager } from "../WebSocketManager.js";

export class LogoutButton extends Component {
	render(): string {
	    return `
			<button id="logoutButton" class="px-4 py-2 bg-purple-600 text-white font-bold rounded-lg shadow-lg hover:bg-purple-700 text-sm md:text-base h-auto">
				Logout
			</button>
		`;
	}

	afterRender(): void {
		document.getElementById("logoutButton")?.addEventListener('click', async function () {
			const data = {lol: 'lol', haha: 'haha'};
			try {
				const response = await fetch ("/api/logout", {
					method: "POST",
					headers: {"Content-Type": "application/json"},
					credentials: "include",
					body: JSON.stringify(data)
				});
				if (response.ok) {
					// const ws = await WebSocketManager.getInstance();
					// await ws.close();
					navigate("/");
				} else {

				}
			} catch (err) {

			}
		})
	}
}
