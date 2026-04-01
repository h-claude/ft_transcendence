import { Component } from "../Component.js";
import { mountComponent } from "../Component.js";
import { Header } from "../components/Header.js";
import { Footer } from "../components/Footer.js";
import { FriendsList } from "../components/FriendsList.js";
import { Chat } from "../components/Chat.js";
import { navigate } from "../navigation.js";

export class Home extends Component {
	render(): string {
		return `
			<div class="min-h-screen flex flex-col font-mono home-main-div">
				<div id="headerComp" class="neutral home-main-div-hover-glow"></div>

				<div class="flex flex-1">
					<aside class="w-1/6 p-4 neon-border-main-div home-main-div-hover-glow flex flex-col justify-between my-4 gap-2">Sidebar
					<div class="ad-space-right flex-1">
						<img src="/assets/pub1.gif" class="w-full h-full object-fill"/>
					</div>
					<div class="ad-space-right flex-1">
						<img src="/assets/pub2.gif" class="w-full h-full object-fill"/>
					</div>
					<div class="flex flex-col gap-2">
						<input type="button" class="cursor-pointer" id="gameHome" value="Play game"/>
						<input type="button" class="cursor-pointer neon-text " id="leaderboardBtn" value="Leaderboard"/>
					</div>
					</aside>

					<main class="flex-1 p-4 flex flex-col">
						<!-- Top 2/3 -->
						<div class="flex-[2] grid grid-cols-2 gap-4 floatdiv1-bg">
							<div class="p-2 gap-2 neon-border-main-div h-full home-main-div-hover-glow flex">
								<div class="ad-space-right flex-1">
									<!--<img src="/assets/pub.gif" class="w-full h-full object-fill"/>-->
								</div>
								<div id="friendsComp" class="neutral flex-1"></div>
								<div class="ad-space-right flex-1">
									<!--<img src="/assets/pub.gif" class="w-full h-full object-fill"/>-->
								</div>
							</div>
							<div class="p-2 gap-2 neon-border-main-div h-full home-main-div-hover-glow flex">
								<div class="ad-space-right flex-1">
									<!--<img src="/assets/pub.gif" class="w-full h-full object-fill"/>-->
								</div>
								<div id="chatComp" class="neutral flex-1"></div>
								<div class="ad-space-right flex-1 w-32">
									<!--<img src="/assets/pub.gif" class="w-full h-full object-fill"/>-->
								</div>
							</div>
						</div>

						<!-- Bottom 1/3 -->
						<div class="flex-[1] mt-4 floatdiv2-bg">
							<div class="grid grid-cols-2 gap-4">

								<div class="grid place-items-center neon-border-main-div home-main-div-hover-glow p-6 rounded-lg shadow-lg text-center">
									<p class="text-lg mb-4">Players in queue: <span id="NumberPlayers" class="font-bold text-blue-400">0</span></p>
									<button id="MatchmakingButton" class="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
										Search a game
									</button>
									<p id="mm-status" class="mt-4 text-sm text-gray-300">💤 Not searching</p>
								</div>
								<div class="grid place-items-center neon-border-main-div home-main-div-hover-glow p-6 rounded-lg shadow-lg text-center">
									<button id="LocalGame" class="px-6 py-3 bg-[#6acf3c] text-white font-semibold rounded-lg hover:bg-[#307a33] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
										Play a local game
									</button>
									<p id="local-status" class="mt-4 text-sm text-gray-300"></p>
								</div>

								<div class="grid place-items-center neon-border-main-div home-main-div-hover-glow p-6 rounded-lg shadow-lg text-center">
									<p class="text-lg mb-4">Number of tournaments: <span id="NumberTournaments" class="font-bold text-blue-400">0</span></p>
									<button id="TournamentButton" class="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
										Search a tournament
									</button>
								</div>

								<div class="grid place-items-center neon-border-main-div home-main-div-hover-glow p-6 rounded-lg shadow-lg text-center">
									<button id="AiGameButton" class="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
										Play vs AI
									</button>
									<p id="ai-status" class="mt-4 text-sm text-gray-300"></p>
								</div>
							</div>
						</div>
					</main>
					<aside class="w-1/6 p-4 neon-border-main-div home-main-div-hover-glow flex flex-col justify-between my-4 gap-2">ADS
						<div class="ad-space-right flex-1">
							<img src="/assets/pub3.gif" class="w-full h-full object-fill"/>
						</div>
						<div class="ad-space-right flex-1">
							<img src="/assets/pub4.gif" class="w-full h-full object-fill"/>
						</div>
					</aside>

				</div>

				<div id="footerComp" class="neutral home-main-div-hover-glow"></div>
			</div>
		`;
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

	afterRender() {
		mountComponent(Header, "headerComp", "Home");
		mountComponent(Footer, "footerComp");
		mountComponent(FriendsList, "friendsComp");
		mountComponent(Chat, "chatComp");

		const gameButton = document.getElementById("gameHome");
		if (gameButton) {
			gameButton.addEventListener("click", () => {
				navigate("/gamehome");
			});
		}

		const leaderboardButton = document.getElementById("leaderboardBtn");
		if (leaderboardButton) {
			leaderboardButton.addEventListener("click", () => {
				navigate("/leaderboard");
			});
		}
		this.startMatchmakingCheck();
		this.checkInitialStatus();
		this.countPlayersMM();
		this.countTournament();
		document.getElementById("LocalGame")?.addEventListener("click", async () => {
			const localStatus = document.getElementById("local-status");
			if (localStatus) {
				localStatus.textContent = "";
				localStatus.className = "mt-4 text-sm text-gray-300";
			}

			const UserStatus = await fetch('/api/users/freetogame', {
				method: "GET",
				credentials: "include"
			});
			if (!UserStatus.ok) {
				console.log("Could not verify user status for local game");
				if (localStatus) {
					localStatus.textContent = "❌ Could not verify status";
					localStatus.className = "mt-4 text-sm text-red-400";
				}
				return;
			}
			const statusData = await UserStatus.json();

			if (statusData.success && statusData.message) {
				const parsedData = JSON.parse(statusData.message);
				if (parsedData.inTournament) {
					console.log("You are in a tournament and cannot start a local game!");
					if (localStatus) {
						localStatus.textContent = "❌ You are in a tournament";
						localStatus.className = "mt-4 text-sm text-red-400";
					}
					return;
				}
				if (parsedData.freeToGame) {
					console.log("Starting local game");
					sessionStorage.setItem("pongMode", "local");
					navigate("/game");
				}
				else {
					console.log("User is not free to play a game");
					if (localStatus) {
						localStatus.textContent = "❌ You are busy right now";
						localStatus.className = "mt-4 text-sm text-red-400";
					}
				}
			}
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
			}
			if (aiStatus) {
				aiStatus.className = "mt-4 text-sm text-gray-300";
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
					aiStatus.className = "mt-4 text-sm text-green-400";
				}
				if (window.location.pathname !== "/game") {
					navigate("/game");
				}
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : "Unexpected error";
				console.error("AI game start error:", error);
				if (aiStatus) {
					aiStatus.textContent = `❌ ${message}`;
					aiStatus.className = "mt-4 text-sm text-red-400";
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
