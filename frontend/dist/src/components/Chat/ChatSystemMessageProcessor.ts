import { Message } from "../../types/chat.js";

export class ChatSystemMessageProcessor {
	/**
	* takes a system Message in and outputs a HTMLElement corresponding to the message contents
	*/
	static process(msg: Message): HTMLDivElement | null {
		// faire toute la logique d'affichage des messages.
		// il faut que le messsage puisse etre:
		// - en cours
		//   - afficher 2 boutons accept / decline pour le receiver
		//   - afficher un bouton cancel pour le sender
		//   - trouver le moment exact ou il doit timeout et le setup
		//   - le backend aura le dernier mot la dessus, c'est juste de l'ui
		//   - pas obligatoir de faire le timeout
		// - validay
		// - declinay

		switch (msg.content) {
			case "game_direct_invite_sent":
				return this.handleGameInviteSent(msg);
			case "game_direct_invite_request":
				return this.handleGameInviteReceived(msg);
			default:
				console.warn("penser a wipe la bdd");
				break;
		}
		return (null);
	}

	private static handleGameInviteSent(msg: Message): HTMLDivElement {
		const e = document.createElement("div");
		e.className = `p-2 max-w-[50%] rounded-lg text-sm break-all relative bg-neutral-800 text-red-200 self-center`;
		e.innerHTML = `
			<span>invite sent</span>
			<div class="text-xs text-right opacity-70 mt-1">${msg.timestamp}</div>
		`;
		return (e);
	}

	private static handleGameInviteReceived(msg: Message): HTMLDivElement {
		const e = document.createElement("div");
		e.className = `p-2 max-w-[50%] rounded-lg text-sm break-all relative bg-neutral-800 text-red-200 self-center`;
		e.innerHTML = `
			<span>invite received</span>
			<div class="text-xs text-right opacity-70 mt-1">${msg.timestamp}</div>
		`;
		return (e);
	}
}
