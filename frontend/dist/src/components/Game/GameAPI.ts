import { MatchInfos } from "../../types/game";

export class GameAPI {
	private consructor() {}

	static async sendDirectInvite(userId: number): Promise<void | Error> {
		const response = await fetch("/api/game/direct/request", {
			method: 'POST',
			headers: {"Content-Type": "application/json"},
			credentials: 'include',
			body: JSON.stringify({opponentId: userId}),
		});
		const responseData = await response.json();
		if (!response.ok) {
			return (new Error(responseData.error));
		}
		return (responseData.message);
	}

	/**
	 * un utilisateur ne devrait avoir qu'une seule direct invite
	 * a la fois, donc pas de parameteres ici.
	 */
	static async acceptDirectInvite(): Promise<void | Error> {
		const response = await fetch("/api/game/direct/accept", {
			method: 'POST',
			credentials: 'include'
		});
		const responseData = await response.json();
		if (!response.ok) {
			return (new Error(responseData.error));
		}
	}

	/**
	 * un utilisateur ne devrait avoir qu'une seule direct invite
	 * a la fois, donc pas de parameteres ici.
	 */
	static async declineDirectInvite(): Promise<void | Error> {
		const response = await fetch("/api/game/direct/decline", {
			method: 'POST',
			credentials: 'include'
		});
		const responseData = await response.json();
		if (!response.ok) {
			return (new Error(responseData.error));
		}
	}

	static async getGameInfos(): Promise<MatchInfos | Error> {
		const response = await fetch("/api/game/infos", {
			method: 'GET',
			credentials: 'include'
		});
		const responseData = await response.json();
		if (!response.ok || !responseData) {
			return (new Error("lol"));
		}
		return (responseData);
	}

	static async forfeitGame(): Promise<void | Error> {
		const match = (window as any).currentMatch;
		if (match && (match.player1Id === 9999 || match.player2Id === 9999)) {
			console.log("[AI_GAME] Forfeit ignoré pour match IA");
			return;
		}

		
		const response = await fetch("/api/game/forfeit", {
			method: 'POST',
			credentials: 'include'
		});
		const responseData = await response.json();
		if (!response.ok) {
			return (new Error(responseData.error));
		}
	}
}
