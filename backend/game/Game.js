import { UserManager } from "../User.js";

export class Game {
	constructor() {};

	delay(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	async lol(player1Id, player2Id) {

		// Bypass IA : si un des deux joueurs est le bot, on évite tout forfeit / conflit
		if (player1Id === 9999 || player2Id === 9999) {
			console.log("[AI_GAME] Match IA détecté — bypass du forfeit/conflict");
		}

		const player1ws = UserManager.getSocket(player1Id);
		const player2ws = UserManager.getSocket(player2Id);
		await delay(3000);

		const rn1 = Math.floor(Math.random() * 101);
		const rn2 = Math.floor(Math.random() * 101);
		if (rn1 >= rn2) {
			player1ws.send(JSON.stringify({
				type: "game_won",
				score: rn1.toString(),
				opponentScore: rn2.toString()
			}));
			player2ws.send(JSON.stringify({
				type: "game_won",
				score: rn2.toString(),
				opponentScore: rn1.toString()
			}));
			return (player1Id);
		} else {
			player2ws.send(JSON.stringify({
				type: "game_won",
				score: rn2.toString(),
				opponentScore: rn1.toString()
			}));
			player2ws.send(JSON.stringify({
				type: "game_won",
				score: rn1.toString(),
				opponentScore: rn2.toString()
			}));
			return (player2Id);
		}
	}
}
