import { Component } from "../Component.js";
import { mountComponent } from "../Component.js";
import { Header } from "../components/Header.js";
import { Footer } from "../components/Footer.js";
import { navigate } from "../navigation.js";

export class TournamentLobby extends Component {
	tournaments: any[] = [];

	render(): string {
		return `
		<div class="min-h-screen flex flex-col font-mono home-main-div">
			<div id="headerComp" class="neutral"></div>
			<main class="flex-1 p-6 flex flex-col items-center space-y-6">
				<div class="text-2xl font-bold text-white">🏆 Tournament Lobby</div>
				<p class="text-lg text-gray-400 text-center">Welcome to the tournament lobby!</p>
				<div class="flex flex-wrap gap-3 justify-center">
					<button id="createTournamentBtn" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition">Create Tournament</button>
					<button id="refreshTournamentsBtn" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition">Refresh Tournaments</button>
				</div>
				<div id="tournamentStatus" class="text-lg text-gray-300 min-h-[1.5rem]"></div>
				<ul class="tournament-list w-full max-w-4xl space-y-4">
					${this.renderTournamentListHtml()}
				</ul>
			</main>
			<div id="footerComp" class="neutral"></div>
		</div>
		`;
	}

	private renderTournamentListHtml(tournaments = this.tournaments): string {
		if (!tournaments || tournaments.length === 0) {
			return `
				<li class="tournament-item p-4 bg-gray-700/60 rounded-lg text-center text-gray-300">
					No tournaments available
				</li>
			`;
		}

		return tournaments
			.map(
				(tournament) => `
					<li class="tournament-item p-5 bg-gray-800/70 rounded-2xl border border-white/10 shadow-lg" data-id="${tournament.tournament_id}">
						<div class="flex flex-col gap-2">
							<p><strong>Initiator:</strong> ${tournament.initiator}</p>
							<p><strong>Participants:</strong> ${tournament.number_of_participants}/4</p>
							<p><strong>Status:</strong> ${this.formatStatus(tournament.status)}</p>
						</div>
						<div class="flex flex-wrap gap-2 mt-4">
							<button class="preview-btn px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition" data-id="${tournament.tournament_id}">Preview</button>
							<button class="join-btn px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition" data-id="${tournament.tournament_id}">Join</button>
							<button class="leave-btn px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition" data-id="${tournament.tournament_id}">Leave</button>
							<button class="start-btn px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition" data-id="${tournament.tournament_id}">Start Tournament</button>
							<button class="delete-btn px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition" data-id="${tournament.tournament_id}">Delete</button>
						</div>
					</li>
				`
			)
			.join('');
	}

	private formatStatus(status?: string): string {
		switch (status) {
			case "pending":
				return "Waiting";
			case "ongoing":
				return "In progress";
			case "finished":
				return "Finished";
			case "canceled":
				return "Canceled";
			default:
				return "Unknown";
		}
	}

	afterRender(...args: any[]): void {
		mountComponent(Header, "headerComp", "Tournament Lobby");
		mountComponent(Footer, "footerComp");

		const createTournamentBtn = document.getElementById("createTournamentBtn");
		createTournamentBtn?.addEventListener("click", async () => {
			await this.handleCreateTournament();
		});

		const refreshBtn = document.getElementById("refreshTournamentsBtn");
		refreshBtn?.addEventListener("click", async () => {
			await this.fetchTournaments();
		});

		this.attachListEventHandlers();
		this.fetchTournaments();
	}

	private attachListEventHandlers() {
		const tournamentList = document.querySelector('.tournament-list');
		if (!tournamentList) return;

		const getId = (event: Event): string | null => {
			const target = event.currentTarget as HTMLElement | null;
			return target?.getAttribute('data-id') ?? null;
		};

		tournamentList.querySelectorAll<HTMLButtonElement>('.preview-btn').forEach((btn) => {
			btn.addEventListener('click', async (event) => {
				event.stopPropagation();
				const tournamentId = getId(event);
				if (tournamentId) {
					await navigate(`/tournamentPage?id=${tournamentId}`);
				}
			});
		});

		tournamentList.querySelectorAll<HTMLButtonElement>('.join-btn').forEach((btn) => {
			btn.addEventListener('click', async (event) => {
				event.stopPropagation();
				const tournamentId = getId(event);
				if (tournamentId) {
					await this.joinTournament(tournamentId);
				}
			});
		});

		tournamentList.querySelectorAll<HTMLButtonElement>('.leave-btn').forEach((btn) => {
			btn.addEventListener('click', async (event) => {
				event.stopPropagation();
				const tournamentId = getId(event);
				if (tournamentId) {
					await this.leaveTournament(tournamentId);
				}
			});
		});

		tournamentList.querySelectorAll<HTMLButtonElement>('.delete-btn').forEach((btn) => {
			btn.addEventListener('click', async (event) => {
				event.stopPropagation();
				const tournamentId = getId(event);
				if (tournamentId) {
					await this.deleteTournament(tournamentId);
				}
			});
		});

		tournamentList.querySelectorAll<HTMLButtonElement>('.start-btn').forEach((btn) => {
			btn.addEventListener('click', async (event) => {
				event.stopPropagation();
				const tournamentId = getId(event);
				if (tournamentId) {
					await this.startTournament(tournamentId);
				}
			});
		});
	}

	private async handleCreateTournament() {
		try {
			const response = await fetch('/api/tournament/create', { method: 'POST' });
			const data = await response.json();
			console.log(data);
			if (data.success) {
				this.setStatusMessage("Tournament created successfully!", 'success');
				await this.updateTournamentStatus(data.tournamentId);
				await this.fetchTournaments();
			} else {
				this.setStatusMessage(data.error || "Failed to create tournament.", 'error');
			}
		} catch (error) {
			console.error("Error creating tournament:", error);
			this.setStatusMessage("Error creating tournament.", 'error');
		}
	}

	private async updateTournamentStatus(tournamentId?: string) {
		const tournamentStatus = document.getElementById("tournamentStatus");
		if (!tournamentStatus) return;

		try {
			if (!tournamentId) {
				const response = await fetch('/api/tournament/exists', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ tournamentId }),
				});
				const data = await response.json();
				console.log(data);
				if (data.success) {
					tournamentId = data.tournamentId;
				} else {
					tournamentStatus.textContent = "No active tournament.";
					return;
				}
			}

			const userResponse = await fetch(`/api/tournament/listUser`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tournamentId }),
			});
			const userData = await userResponse.json();
			console.log(userData);
			if (userData.success) {
				tournamentStatus.textContent = `Tournament exists with ${userData.users.length} participants.`;
			} else {
				tournamentStatus.textContent = "Error fetching user list.";
			}
		} catch (error) {
			console.error("Error fetching tournament status:", error);
			tournamentStatus.textContent = "Error fetching tournament status.";
		}
	}

	async fetchTournaments() {
		try {
			const response = await fetch('/api/tournament/list', {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
			});

			const data = await response.json();
			if (data.success) {
				this.tournaments = data.tournaments;

				const tournamentList = document.querySelector('.tournament-list');
				if (tournamentList) {
					tournamentList.innerHTML = this.renderTournamentListHtml(this.tournaments);
					this.attachListEventHandlers();
				}
			} else {
				console.error('Failed to fetch tournaments:', data.error);
			}
		} catch (error) {
			console.error('Error fetching tournaments:', error);
		}
	}

	async joinTournament(tournamentId: string) {
		try {
			const response = await fetch('/api/tournament/join', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ tournamentId }),
			});

			const data = await response.json();
			if (data.success) {
				this.setStatusMessage('Successfully joined the tournament!', 'success');
				await navigate(`/tournamentPage?id=${tournamentId}`);
			} else {
				console.error('Failed to join tournament:', data.error);
				this.setStatusMessage(data.error || 'Failed to join tournament.', 'error');
			}
		} catch (error) {
			console.error('Error joining tournament:', error);
			this.setStatusMessage('Error joining tournament.', 'error');
		}
	}

	async leaveTournament(tournamentId?: string) {
		try {
			if (!tournamentId) {
				console.log("ID tournament for leaving not here");
				return;
			}
			console.log("leave tournament " + tournamentId);
			const response = await fetch(`/api/tournament/leave/${tournamentId}`, {
				method: 'POST',
			});

			const data = await response.json();
			console.log(data);
			if (data.success) {
				this.setStatusMessage('Successfully left the tournament!', 'success');
				this.fetchTournaments();
			} else {
				console.error('Failed to leave tournament:', data.error);
				this.setStatusMessage(data.error || 'Failed to leave tournament.', 'error');
			}
		} catch (error) {
			console.error('Error leaving tournament:', error);
			this.setStatusMessage('Error leaving tournament.', 'error');
		}
	}

	async deleteTournament(tournamentId: string) {
		try {
			console.log("Tournament : " + tournamentId);

			const response = await fetch('/api/tournament/cancel', {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ tournamentId: Number(tournamentId) }),
			});

			const data = await response.json();
			if (data.success) {
				this.setStatusMessage('Tournament deleted successfully!', 'success');
				this.fetchTournaments();
			} else {
				console.error('Failed to delete tournament:', data.error);
				this.setStatusMessage('Failed to delete tournament: ' + (data.error || ''), 'error');
			}
		} catch (error) {
			console.error('Error deleting tournament:', error);
			this.setStatusMessage('Error deleting tournament.', 'error');
		}
	}

	async startTournament(tournamentId: string) {
		try {
			console.log("Starting tournament: " + tournamentId);

			const response = await fetch(`/api/tournament/start/${tournamentId}`, {
				method: 'POST'
			});
			const data = await response.json();
			if (data.success) {
				this.setStatusMessage('Tournament started successfully!', 'success');
				this.fetchTournaments(); // Refresh the tournament list
			} else {
				console.error('Failed to start tournament:', data.error);
				this.setStatusMessage('Failed to start tournament: ' + (data.error || ''), 'error');
			}
		} catch (error) {
			console.error('Error starting tournament:', error);
			this.setStatusMessage('Error starting tournament. Please try again.', 'error');
		}
	}

	async startFinal(tournamentId: string) {
		try {
			console.log("Starting final for tournament: " + tournamentId);

			const response = await fetch(`/api/tournament/start_final/${tournamentId}`, {
				method: 'POST'
			});
			const data = await response.json();
			if (data.success) {
				this.setStatusMessage('Final started successfully!', 'success');
				this.fetchTournaments();
			} else {
				console.error('Failed to start final:', data.error);
				this.setStatusMessage('Failed to start final: ' + (data.error || ''), 'error');
			}
		} catch (error) {
			console.error('Error starting final:', error);
			this.setStatusMessage('Error starting final. Please try again.', 'error');
		}
	}

	private setStatusMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
		const tournamentStatus = document.getElementById('tournamentStatus');
		if (!tournamentStatus) return;

		const colorClasses = ['text-green-400', 'text-red-400', 'text-gray-400'];
		colorClasses.forEach((cls) => tournamentStatus.classList.remove(cls));

		const colorMap = {
			success: 'text-green-400',
			error: 'text-red-400',
			info: 'text-gray-400'
		};

		tournamentStatus.classList.add(colorMap[type]);
		tournamentStatus.textContent = message;
	}
}
