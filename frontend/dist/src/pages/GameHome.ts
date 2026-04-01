import { Component } from "../Component.js";
import { mountComponent } from "../Component.js";
import { Header } from "../components/Header.js";
import { Footer } from "../components/Footer.js";
import { navigate } from "../navigation.js";

export class GameHome extends Component {
	render(): string {
		return `
			<div class="min-h-screen flex flex-col font-mono home-main-div">
				<div id="headerComp" class="neutral"></div>
				</header>

				<main class="flex-1 p-4 flex flex-col items-center justify-center space-y-6">
				<div class="text-2xl font-bold text-white">🎮 Matchmaking</div>

				<div class="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
					<p class="text-lg mb-4">Players in queue: <span id="NumberPlayers" class="font-bold text-blue-400">0</span></p>
					<button id="MatchmakingButton" class="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
						Search a game
					</button>
					<p id="mm-status" class="mt-4 text-sm text-gray-300">💤 Not searching</p>
				</div>
				<div class="text-2xl font-bold text-white">⚾⚾ Local Game</div>
				<div class="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
					<button id="LocalGame" class="px-6 py-3 bg-[#6acf3c] text-white font-semibold rounded-lg hover:bg-[#307a33] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
						Play a local game
					</button>
				</div>
				<div class="text-2xl font-bold text-white">🗿🗿🗿 Tournaments</div>

				<div class="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
					<p class="text-lg mb-4">Number of tournaments: <span id="NumberTournaments" class="font-bold text-blue-400">0</span></p>
					<button id="TournamentButton" class="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
						Search a tournament
					</button>
				</div>
				<div class="text-2xl font-bold text-white">🤖 Duel IA</div>

				<div class="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
					<p class="text-lg mb-4">Play instantly against PongBot — no queue required.</p>
					<button id="AiGameButton" class="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
						Play vs AI
					</button>
					<p id="ai-status" class="mt-4 text-sm text-gray-300">🤖 Ready when you are</p>
				</div>
				</main>


				<div id="footerComp" class="neutral"></div>
			</div>
		`
	}

	private isInQueue = false;
	private matchmakingInterval: number | undefined;

	async countPlayersMM() {
		const res = await fetch('/api/game/mm/count');
		const data = await res.json();

		const numberPlayersElem = document.getElementById("NumberPlayers");
		if (numberPlayersElem) {
			numberPlayersElem.innerText = data.count;
		}
	}

	async countTournament() {
		try {
			const res = await fetch('/api/tournament/list');
			const data = await res.json();

			const numberTournamentsElem = document.getElementById("NumberTournaments");

			if (numberTournamentsElem && data.success) {
				const tournamentCount = data.tournaments ? data.tournaments.length : 0;
				numberTournamentsElem.innerText = tournamentCount.toString();
			}
			else {
				if (numberTournamentsElem)
					numberTournamentsElem.innerText = "0";
			}
		} catch {
			const numberTournamentsElem = document.getElementById("NumberTournaments");
			if (numberTournamentsElem)
				numberTournamentsElem.innerText = "0";
		}
	}

	updateMatchmakingUI() {
		const button = document.getElementById("MatchmakingButton") as HTMLButtonElement;
		const statusElem = document.getElementById("mm-status");

		if (button) {
			if (this.isInQueue) {
				button.innerText = "Leave queue";
				button.style.backgroundColor = "#ef4444";
			} else {
				button.innerText = "Search a game";
				button.style.backgroundColor = "#3b82f6";
			}
		}

		if (statusElem) {
			statusElem.innerText = this.isInQueue ? "🎮 In matchmaking queue" : "💤 Not searching";
		}
	}

	async checkInitialStatus() {
		try {
			const res = await fetch("/api/game/mm/status", {
				method: "GET",
				credentials: "include"
			});
			const data = await res.json();
			if (data.success) {
				this.isInQueue = data.searching;
				this.updateMatchmakingUI();
			}
		} catch (error) {
			console.error("Error checking initial status:", error);
		}
	}

	afterRender(...args: any[]): void {
		mountComponent(Header, "headerComp", "Time To Play");
		mountComponent(Footer, "footerComp");

		this.startMatchmakingCheck();
		this.checkInitialStatus();
		this.countPlayersMM();
		this.countTournament();

		document.getElementById("LocalGame")?.addEventListener("click", () => {
			sessionStorage.setItem("pongMode", "local");
			navigate("/game");
		});

		document.getElementById("MatchmakingButton")?.addEventListener("click", async () => {
			const button = document.getElementById("MatchmakingButton") as HTMLButtonElement;
			const statusElem = document.getElementById("mm-status");

			if (button) {
				button.disabled = true;
				button.innerText = "Loading...";
			}

			try {
				let url, method;
				if (this.isInQueue) {
					url = "/api/game/mm/unsubscribe";
					method = "DELETE";
				} else {
					url = "/api/game/mm/subscribe";
					method = "POST";
				}

				const res = await fetch(url, {
					method: method,
					credentials: "include",
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({})
				});

				const responseText = await res.text();
				let data;
				try {
					data = JSON.parse(responseText);
				} catch (parseError) {
					console.error("JSON parse error:", parseError);
					throw new Error("Invalid server response");
				}

				if (data.success) {
					this.isInQueue = !this.isInQueue;
					this.updateMatchmakingUI();
					console.log(this.isInQueue ? "Joined queue" : "Left queue");
				} else {
					if (statusElem) {
						statusElem.innerText = "❌ Error: " + data.error;
					}
				}
			} catch (error) {
				console.error("Fetch error:", error);
				if (statusElem) {
					statusElem.innerText = "❌ Connection error";
				}
			} finally {
				if (button) {
					button.disabled = false;
					this.updateMatchmakingUI();
				}
			}
		});
		document.getElementById("TournamentButton")?.addEventListener("click", async () => {
			const button = document.getElementById("TournamentButton") as HTMLButtonElement;
			if (button)
				navigate("/tournamentLobby");
		});

		document.getElementById("AiGameButton")?.addEventListener("click", async () => {
			const aiButton = document.getElementById("AiGameButton") as HTMLButtonElement | null;
			const aiStatus = document.getElementById("ai-status");

			if (aiButton) {
				aiButton.disabled = true;
				aiButton.innerText = "Contacting PongBot...";
			}
			if (aiStatus) {
				aiStatus.textContent = "⌛ Trying to start an AI match...";
			}

			try {
				const res = await fetch("/api/game/ai/start", {
					method: "POST",
					credentials: "include",
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({})
				});
				const data = await res.json();
				if (!res.ok || !data.success) {
					throw new Error(data.error || "Could not start AI game");
				}

				if (aiStatus) {
					aiStatus.textContent = "✅ Match created! Loading arena...";
				}
				if (window.location.pathname !== "/game") {
					navigate("/game");
				}
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : "Unexpected error";
				console.error("AI game start error:", error);
				if (aiStatus) {
					aiStatus.textContent = `❌ ${message}`;
				}
			} finally {
				if (aiButton) {
					aiButton.disabled = false;
					aiButton.innerText = "Play vs AI";
				}
			}
		});
	}

	startMatchmakingCheck() {
		this.matchmakingInterval = window.setInterval(() => {
			this.countPlayersMM();
			this.countTournament();
			this.checkInitialStatus();
		}, 1000);
	}

	stopMatchmakingCheck() {
		if (this.matchmakingInterval !== undefined) {
			clearInterval(this.matchmakingInterval);
			this.matchmakingInterval = undefined;
		}
	}

	destroy(): void {
		this.stopMatchmakingCheck();
	}
}
