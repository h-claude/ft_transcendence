import { Component } from "../Component.js";
import { mountComponent } from "../Component.js";
import { Header } from "../components/Header.js";
import { Footer } from "../components/Footer.js";

// Interface pour typer les données utilisateur que nous allons récupérer
interface UserProfile {
	id: number;
	username: string;
	wins: number;
	losses: number;
}

export class Profile extends Component {
	private lastHistorySignature: string | null = null;
	private refreshInterval: number | null = null;
	private ws: WebSocket | null = null;
	private currentUser: UserProfile | null = null; // Pour stocker les données de l'utilisateur connecté

	render(): string {
		// Structure HTML améliorée avec une sidebar pour les stats
		return `
			<div class="min-h-screen flex flex-col font-mono home-main-div">
				<div id="headerComp" class="neutral"></div>
				<main class="flex flex-1 flex-col md:flex-row items-start justify-center p-4 md:p-8 gap-8">
					
					<!-- Colonne principale pour l'historique -->
					<div class="w-full md:w-2/3 lg:w-1/2 order-2 md:order-1">
						<h1 class="text-3xl font-bold mb-4 text-center">Historique des Parties</h1>
						<div id="loadingStatus" class="text-purple-300 animate-pulse text-center">
							Chargement des scores blockchain...
						</div>
						<div id="matchHistory" class="w-full space-y-4"></div>
					</div>

					<!-- Sidebar pour les informations du profil -->
					<aside id="profileSidebar" class="w-full md:w-1/3 lg:w-1/4 order-1 md:order-2 p-4 bg-black/30 rounded-lg border border-purple-400/20">
						<!-- Le contenu de la sidebar sera injecté ici -->
					</aside>

				</main>
				<div id="footerComp" class="neutral"></div>
			</div>
		`;
	}

	// Fonction pour rendre la sidebar avec les stats
	private renderSidebar() {
		const sidebarContainer = document.getElementById("profileSidebar");
		if (!sidebarContainer || !this.currentUser) return;

		const totalGames = this.currentUser.wins + this.currentUser.losses;
		const ratio = totalGames > 0 ? ((this.currentUser.wins / totalGames) * 100).toFixed(1) : "N/A";

		sidebarContainer.innerHTML = `
			<h2 class="text-2xl font-bold text-purple-300 mb-4">${this.currentUser.username}</h2>
			<div class="space-y-3 text-white">
				<div>
					<span class="font-semibold">Victoires:</span>
					<span class="float-right text-green-400">${this.currentUser.wins}</span>
				</div>
				<div>
					<span class="font-semibold">Défaites:</span>
					<span class="float-right text-red-400">${this.currentUser.losses}</span>
				</div>
				<div>
					<span class="font-semibold">Parties Jouées:</span>
					<span class="float-right">${totalGames}</span>
				</div>
				<hr class="border-purple-400/20 my-3" />
				<div>
					<span class="font-semibold">Ratio V/D:</span>
					<span class="float-right font-bold text-purple-300">${ratio}${ratio !== "N/A" ? '%' : ''}</span>
				</div>
			</div>
		`;
	}

	async afterRender(): Promise<void> {
		mountComponent(Header, "headerComp", "Profile");
		mountComponent(Footer, "footerComp");

		const historyContainer = document.getElementById("matchHistory") as HTMLElement | null;
		const loadingStatus = document.getElementById("loadingStatus") as HTMLElement | null;
		if (!historyContainer || !loadingStatus) return;

		// 1. Récupérer les informations de l'utilisateur connecté via la nouvelle route
		try {
			const userResp = await fetch("/api/users/profile/me", { credentials: "include" });
			if (userResp.ok) {
				const userData = await userResp.json();
				if (userData.success) {
					this.currentUser = userData.user;
					this.renderSidebar(); // Affiche les stats dans la sidebar
				}
			}
		} catch (err) {
			console.error("Erreur de récupération du profil utilisateur", err);
		}

		const fetchAndRenderHistory = async () => {
			try {
				const resp = await fetch("/api/blockchain/matches/me", { credentials: "include" });
				if (!resp.ok) throw new Error("Réponse HTTP invalide");
				const data = await resp.json();

				if (!data.success) throw new Error("Échec de récupération des données");

				// Affichage inversé : les plus récents en haut
				const historyData = data.history;

				if (historyData.length === 0) {
					historyContainer.innerHTML = `<p class="text-gray-400 text-center">Aucun match enregistré.</p>`;
					loadingStatus.style.display = 'none';
					return;
				}

				const newSignature = JSON.stringify(historyData.map((item: any) => item.id || item.gameId));
				if (this.lastHistorySignature === newSignature) return;

				this.lastHistorySignature = newSignature;
				loadingStatus.style.display = 'none';

				historyContainer.innerHTML = historyData
					.map((item: any) => {
						const currentUserIsInMatch = (participants: any[]): boolean => {
							return this.currentUser ? participants.some(p => p.username === this.currentUser!.username) : false;
						};

						const highlightName = (name: string): string => {
							return this.currentUser && name === this.currentUser.username ? `<span class="font-bold text-purple-300">${name}</span>` : name;
						};

						if (item.type === 'simple') {
							const date = new Date(item.time * 1000).toLocaleString();
							const pairs = item.usernames
								.map((n: string, i: number) => `${highlightName(n)}: ${item.scores[i]}`)
								.join("  •  ");
							return `
								<div class="p-3 border border-purple-400/30 rounded-lg bg-black/40 hover:bg-black/60 transition">
									<h3 class="text-lg font-semibold text-white mb-2">Match Simple</h3>
									<div class="text-purple-300 text-sm">${date}</div>
									<div class="text-white">${pairs}</div>
									<span onclick="window.open('https://testnet.snowtrace.io/tx/${item.txHash}', '_blank', 'noopener,noreferrer')" class="text-xs text-gray-400 mt-1 hover:text-purple-300 transition-colors cursor-pointer">
										Tx: ${item.txHash.slice(0, 12)}...
									</span>
								</div>
							`;
						} else if (item.type === 'tournament') {
							const tournament = item.details;
							const winner = tournament.winner ? `🏆 Vainqueur: ${highlightName(tournament.winner.username)}` : 'Tournoi en cours';
							
							const matchesHtml = tournament.matches.map((match: any) => {
								const userPlayedThisMatch = currentUserIsInMatch(match.participants);
								const participantsHtml = match.participants
								.map((p: any) => `${highlightName(p.username)}: ${p.score ?? '?'}`)
								.join(' vs ');

							const txLink = match.txHash 
								? `<span onclick="window.open('https://testnet.snowtrace.io/tx/${match.txHash}', '_blank', 'noopener,noreferrer')" class="text-xs text-gray-500 hover:text-green-400 transition-colors cursor-pointer">Tx: ${match.txHash.slice(0, 10)}...</span>`
								: `<span class="text-xs text-gray-600">En attente</span>`;

							const matchClass = userPlayedThisMatch ? '' : 'opacity-60';

								return `
									<div class="pl-4 pt-2 border-l-2 border-green-500/30 ${matchClass}">
										<p class="text-sm font-bold text-gray-300">${match.stage === 'demi-final' ? 'Demi-finale' : 'Finale'}</p>
										<p class="text-sm text-white">${participantsHtml}</p>
										${txLink}
									</div>
								`;
							}).join('');

							return `
								<div class="p-3 border border-green-400/30 rounded-lg bg-black/40 hover:bg-black/60 transition">
									<h3 class="text-lg font-semibold text-green-300 mb-2">Tournoi #${tournament.id}</h3>
									<p class="text-white font-bold mb-2">${winner}</p>
									<div class="space-y-3">
										${matchesHtml}
									</div>
								</div>
							`;
						}
						return '';
					})
					.join("");
			} catch (err) {
				console.error("[PROFILE_REFRESH_ERR]", err);
				historyContainer.innerHTML = `<p class="text-red-400 text-sm">Erreur de chargement blockchain.</p>`;
			}
		};

		await fetchAndRenderHistory();
		this.refreshInterval = window.setInterval(fetchAndRenderHistory, 15000);

		try {
			this.ws = new WebSocket(`wss://${location.host}/api/ws_game_logic/profile-updates`);
			this.ws.onopen = () => console.log("[PROFILE_WS] Connecté au flux blockchain");
			this.ws.onmessage = (event) => {
				try {
					const msg = JSON.parse(event.data);
					if (msg.type === "new_match") {
						fetchAndRenderHistory();
					}
				} catch (err) {
					console.error("[PROFILE_WS_PARSE_ERR]", err);
				}
			};
			this.ws.onerror = (err) => console.error("[PROFILE_WS_ERR]", err);
			this.ws.onclose = () => console.log("[PROFILE_WS] Déconnecté du flux");
		} catch (wsErr) {
			console.error("[PROFILE_WS_INIT_ERR]", wsErr);
		}
	}

	destroy(): void {
		if (this.refreshInterval) {
			window.clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}
		if (this.ws) {
			this.ws.close(1000, "Profile closed");
			this.ws = null;
		}
	}
}
