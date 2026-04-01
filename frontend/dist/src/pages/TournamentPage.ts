import { Component } from "../Component.js";
import { mountComponent } from "../Component.js";
import { Header } from "../components/Header.js";
import { Footer } from "../components/Footer.js";
import { navigate } from "../navigation.js";
import { UserStore } from "../store.js";

type TournamentParticipant = {
	id: number;
	username: string;
	active: boolean;
};

type TournamentMatchParticipant = {
	id: number;
	username: string;
	score: number | null;
};

type TournamentMatch = {
	id: number;
	stage: string | null;
	status: string | null;
	winnerId: number | null;
	participants: TournamentMatchParticipant[];
};

type TournamentDetails = {
	id: number;
	status: string;
	number_of_participants: number;
	participants: TournamentParticipant[];
	initiator: { id: number | null; username: string };
	matches: TournamentMatch[];
	winner: { id: number; username: string } | null;
};

export class TournamentPage extends Component {
	private tournamentId: string | null = null;
	private isLoading = false;
	private currentUserId: number | null = null;
	private currentDetails: TournamentDetails | null = null;
	private joinButton: HTMLButtonElement | null = null;
	private leaveButton: HTMLButtonElement | null = null;
	private startButton: HTMLButtonElement | null = null;
	private deleteButton: HTMLButtonElement | null = null;
	private actionsContainer: HTMLElement | null = null;

	render(): string {
		return `
			<div class="min-h-screen flex flex-col font-mono home-main-div">
				<div id="headerComp" class="neutral"></div>
				<div class="flex flex-1">
					<main class="flex-1 flex justify-center items-start py-12 px-4 md:px-8">
						<section class="tournament-card w-full max-w-6xl">
							<header class="tournament-card__header">
								<button id="tournamentBackBtn" class="tournament-pill tournament-pill--button">
									<span class="tournament-pill__icon">🏠</span>
									<span>Home</span>
								</button>
								<div class="tournament-card__headline">
									<h1 id="tournamentTitle" class="tournament-card__title">Tournament</h1>
									<p id="tournamentSubtitle" class="tournament-card__subtitle">Chargement du tournoi…</p>
								</div>
								<div class="tournament-card__actions">
									<div id="tournamentInitiator" class="tournament-pill">Initiateur : –</div>
									<button id="tournamentRefreshBtn" class="tournament-pill tournament-pill--button">
										<span class="tournament-pill__icon">🔄</span>
										<span>Actualiser</span>
									</button>
								</div>
							</header>
						<div id="tournamentActions" class="tournament-actions">
							<button id="tournamentJoinBtn" class="tournament-action-btn tournament-action-btn--join hidden">Rejoindre</button>
							<button id="tournamentLeaveBtn" class="tournament-action-btn tournament-action-btn--leave hidden">Quitter</button>
							<button id="tournamentStartBtn" class="tournament-action-btn tournament-action-btn--start hidden">Démarrer le tournoi</button>
							<button id="tournamentDeleteBtn" class="tournament-action-btn tournament-action-btn--delete hidden">Supprimer</button>
						</div>
							<div id="tournamentError" class="tournament-alert hidden"></div>
							<div class="tournament-card__body">
								<aside class="tournament-panel">
									<h2 class="tournament-panel__title">Player List</h2>
									<ul id="tournamentPlayerList" class="tournament-panel__list">
										<li class="tournament-panel__item tournament-panel__item--placeholder">Chargement…</li>
									</ul>
								</aside>
								<section class="tournament-bracket" aria-live="polite">
									<div class="tournament-bracket__header">
										<h2 class="tournament-panel__title">Bracket</h2>
										<div id="tournamentStatusBadge" class="tournament-status">Status : –</div>
									</div>
									<div id="tournamentBracket" class="tournament-bracket__grid">
										<div class="tournament-loader">Chargement du bracket…</div>
									</div>
								</section>
							</div>
							<footer class="tournament-card__footer">
								<div id="tournamentWinner" class="tournament-winner">👑 Vainqueur : –</div>
							</footer>
						</section>
					</main>
				</div>
				<div id="footerComp" class="neutral"></div>
			</div>
		`;
	}

	afterRender(): void {
		mountComponent(Header, "headerComp", "Tournament");
		mountComponent(Footer, "footerComp");

		this.tournamentId = this.extractTournamentId();
		this.cacheActionButtons();
		this.updateActionButtons();
		this.attachEventListeners();
		Promise.resolve().then(() => this.initialize());
	}

	private extractTournamentId(): string | null {
		const params = new URLSearchParams(window.location.search);
		return params.get("id");
	}

	private cacheActionButtons(): void {
		this.joinButton = document.getElementById("tournamentJoinBtn") as HTMLButtonElement | null;
		this.leaveButton = document.getElementById("tournamentLeaveBtn") as HTMLButtonElement | null;
		this.startButton = document.getElementById("tournamentStartBtn") as HTMLButtonElement | null;
		this.deleteButton = document.getElementById("tournamentDeleteBtn") as HTMLButtonElement | null;
		this.actionsContainer = document.getElementById("tournamentActions");

		[this.joinButton, this.leaveButton, this.startButton, this.deleteButton].forEach((button) => {
			if (button && !button.dataset.defaultLabel) {
				button.dataset.defaultLabel = button.textContent?.trim() ?? "";
			}
		});
	}

	private async initialize(): Promise<void> {
		if (!this.tournamentId) {
			this.showAlert("Aucun tournoi sélectionné. Merci de revenir depuis le lobby.", "error");
			this.updateActionButtons();
			return;
		}

		try {
			const store = UserStore.getInstance();
			let user = store.getUser();
			if (!user) {
				await store.resetUser();
				user = store.getUser();
			}
			this.currentUserId = user?.id ?? null;
		} catch (error) {
			console.error("Error loading current user:", error);
			this.currentUserId = null;
		}

		await this.fetchTournamentDetails();
	}

	private attachEventListeners(): void {
		const homeBtn = document.getElementById("tournamentBackBtn");
		homeBtn?.addEventListener("click", () => navigate("/tournamentLobby"));

		const refreshBtn = document.getElementById("tournamentRefreshBtn");
		refreshBtn?.addEventListener("click", () => {
			void this.fetchTournamentDetails(true);
		});

		this.joinButton?.addEventListener("click", () => {
			void this.handleJoin();
		});

		this.leaveButton?.addEventListener("click", () => {
			void this.handleLeave();
		});

		this.startButton?.addEventListener("click", () => {
			void this.handleStart();
		});

		this.deleteButton?.addEventListener("click", () => {
			void this.handleDelete();
		});
	}

	private async fetchTournamentDetails(force = false): Promise<void> {
		if (!this.tournamentId || (this.isLoading && !force))
			return;

		this.setLoadingState(true);
		this.clearAlert();

		try {
			const response = await fetch(`/api/tournament/${this.tournamentId}/details`, {
				method: "GET",
				headers: { "Content-Type": "application/json" }
			});

			if (!response.ok) {
				if (response.status === 404)
					throw new Error("Ce tournoi n'existe pas ou a été supprimé.");
				throw new Error("Impossible de récupérer les informations du tournoi.");
			}

			const payload = await response.json() as { success: boolean; tournament?: TournamentDetails; error?: string };
			if (!payload.success || !payload.tournament)
				throw new Error(payload.error ?? "Erreur lors de la récupération des données du tournoi.");

			this.renderTournament(payload.tournament);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Erreur inattendue.";
			this.showAlert(message, "error");
			this.currentDetails = null;
			this.resetContent();
		} finally {
			this.setLoadingState(false);
		}
	}

	private renderTournament(tournament: TournamentDetails): void {
		this.currentDetails = tournament;
		const activeParticipants = tournament.participants.filter((player) => player.active);
		const activeCount = activeParticipants.length;

		const title = document.getElementById("tournamentTitle");
		if (title)
			title.textContent = `Tournament #${tournament.id}`;

		const subtitle = document.getElementById("tournamentSubtitle");
		if (subtitle)
			subtitle.textContent = `${activeCount}/4 joueurs • ${this.formatStatus(tournament.status)}`;

		const initiator = document.getElementById("tournamentInitiator");
		if (initiator)
			initiator.textContent = `Initiateur : ${tournament.initiator.username ?? "Serveur"}`;

		const statusBadge = document.getElementById("tournamentStatusBadge");
		if (statusBadge)
			statusBadge.textContent = `Status : ${this.formatStatus(tournament.status)}`;

		const winner = document.getElementById("tournamentWinner");
		if (winner) {
			if (tournament.winner) {
				winner.innerHTML = `👑 Vainqueur : <span class="tournament-winner__name">${tournament.winner.username}</span>`;
				winner.classList.remove("tournament-winner--pending");
			} else {
				winner.textContent = "👑 Vainqueur : À déterminer";
				winner.classList.add("tournament-winner--pending");
			}
		}

		this.renderPlayerList(tournament.participants);
		this.renderBracket(tournament.matches);
		this.updateActionButtons();
	}

	private renderPlayerList(participants: TournamentParticipant[]): void {
		const list = document.getElementById("tournamentPlayerList");
		if (!list)
			return;

		if (participants.length === 0) {
			list.innerHTML = `<li class="tournament-panel__item tournament-panel__item--placeholder">Aucun joueur pour le moment.</li>`;
			return;
		}

		const winnerId = this.currentDetails?.winner?.id ?? null;
		const isFinished = this.currentDetails?.status === "finished";
		const items = participants
			.map((player, index) => {
				const isWinner = isFinished && winnerId === player.id;
				const isActive = player.active || isWinner;
				const inactiveClass = isActive ? "" : " tournament-panel__item--inactive";
				let statusSuffix = "";
				if (isWinner) {
					statusSuffix = " 👑";
				} else if (!isActive) {
					statusSuffix = " (éliminé)";
				}
				return `
					<li class="tournament-panel__item${inactiveClass}">
						<span class="tournament-panel__bullet">•</span>
						<span class="tournament-panel__name">${index + 1}. ${player.username}${statusSuffix}</span>
					</li>
				`;
			})
			.join("");

		const remainingSlots = Math.max(0, 4 - participants.length);
		const placeholders = Array.from({ length: remainingSlots })
			.map((_, idx) => `
				<li class="tournament-panel__item tournament-panel__item--placeholder">
					<span class="tournament-panel__bullet">•</span>
					<span class="tournament-panel__name">Slot libre ${participants.length + idx + 1}</span>
				</li>
			`)
			.join("");

		list.innerHTML = items + placeholders;
	}

	private renderBracket(matches: TournamentMatch[]): void {
		const bracket = document.getElementById("tournamentBracket");
		if (!bracket)
			return;

		const semiFinals = matches.filter((match) => match.stage === "demi-final");
		const finalMatch = matches.find((match) => match.stage === "final") ?? null;

		const semiCards = Array.from({ length: 2 }, (_, index) => {
			const match = semiFinals[index] ?? null;
			return this.renderMatchCard(match, `Demi-finale ${index + 1}`);
		}).join("");
		const finalMarkup = this.renderMatchCard(finalMatch, "Finale");

		bracket.innerHTML = `
			<div class="tournament-bracket__column tournament-bracket__column--semi">
				${semiCards}
			</div>
			<div class="tournament-bracket__column tournament-bracket__column--final">
				${finalMarkup}
			</div>
		`;
	}

	private renderMatchCard(match: TournamentMatch | null, title: string): string {
		if (!match) {
			return `
				<div class="tournament-match tournament-match--empty">
					<div class="tournament-match__title">${title}</div>
					<div class="tournament-match__placeholder">À venir</div>
				</div>
			`;
		}

		const players = match.participants.map((participant) => {
			const isWinner = match.winnerId === participant.id;
			const scoreDisplay = typeof participant.score === "number" ? participant.score.toString() : "-";
			return `
				<div class="tournament-match__player ${isWinner ? "tournament-match__player--winner" : ""}">
					<span class="tournament-match__player-name">${participant.username}</span>
					<span class="tournament-match__player-score">${scoreDisplay}</span>
				</div>
			`;
		}).join("");

		const status = this.formatMatchStatus(match);

		return `
			<div class="tournament-match ${match.status === "finished" ? "tournament-match--finished" : ""}">
				<div class="tournament-match__title">${title}</div>
				<div class="tournament-match__players">
					${players || `<div class="tournament-match__placeholder">Joueurs à déterminer</div>`}
				</div>
				<div class="tournament-match__status">${status}</div>
			</div>
		`;
	}

	private formatStatus(status: string | null): string {
		switch (status) {
			case "pending":
				return "En attente";
			case "ongoing":
				return "En cours";
			case "finished":
				return "Terminé";
			case "canceled":
				return "Annulé";
			default:
				return "Inconnu";
		}
	}

	private formatMatchStatus(match: TournamentMatch): string {
		if (match.status === "finished") {
			const winner = match.participants.find((player) => player.id === match.winnerId);
			return winner ? `Vainqueur : ${winner.username}` : "Match terminé";
		}
		if (match.status === "ongoing")
			return "Match en cours";
		return "Match en attente";
	}

	private toggleButtonVisibility(button: HTMLButtonElement | null, visible: boolean): void {
		if (!button)
			return;
		button.classList.toggle("hidden", !visible);
	}

	private setButtonLoading(button: HTMLButtonElement | null, isLoading: boolean, loadingLabel = "Chargement…"): void {
		if (!button)
			return;
		if (isLoading) {
			if (!button.dataset.defaultLabel)
				button.dataset.defaultLabel = button.textContent?.trim() ?? "";
			button.disabled = true;
			button.classList.add("tournament-action-btn--loading");
			button.textContent = loadingLabel;
		} else {
			const defaultLabel = button.dataset.defaultLabel ?? button.textContent ?? "";
			button.disabled = false;
			button.classList.remove("tournament-action-btn--loading");
			button.textContent = defaultLabel;
		}
	}

	private updateActionButtons(): void {
		const details = this.currentDetails;

		if (!details) {
			this.toggleButtonVisibility(this.joinButton, false);
			this.toggleButtonVisibility(this.leaveButton, false);
			this.toggleButtonVisibility(this.startButton, false);
			this.toggleButtonVisibility(this.deleteButton, false);
			if (this.actionsContainer)
				this.actionsContainer.classList.add("hidden");
			return;
		}

		const status = details?.status ?? null;
		const activeParticipants = details ? details.participants.filter((p) => p.active) : [];
		const activeCount = activeParticipants.length;
		const userId = this.currentUserId;
		const isActiveParticipant = userId != null && activeParticipants.some((p) => p.id === userId);
		const initiatorId = details?.initiator?.id != null ? Number(details.initiator.id) : null;
		const isInitiator = initiatorId != null && userId != null && initiatorId === userId;
		const isFinishedOrCanceled = status === "finished" || status === "canceled";

		if (this.joinButton) {
			const visible = !!details && status === "pending" && !isActiveParticipant;
			this.toggleButtonVisibility(this.joinButton, visible);
			if (visible) {
				const canJoin = activeCount < 4;
				this.joinButton.disabled = this.isLoading || !canJoin;
				this.joinButton.title = canJoin ? "" : "Le tournoi est complet.";
			} else {
				this.joinButton.title = "";
			}
		}

		if (this.leaveButton) {
			const visible = !!details && isActiveParticipant && status === "pending";
			this.toggleButtonVisibility(this.leaveButton, visible);
			if (visible)
				this.leaveButton.disabled = this.isLoading;
		}

		if (this.startButton) {
			const visible = !!details && isInitiator && status === "pending";
			this.toggleButtonVisibility(this.startButton, visible);
			if (visible) {
				const canStart = activeCount === 4;
				this.startButton.disabled = this.isLoading || !canStart;
				this.startButton.title = canStart ? "" : "Le tournoi nécessite 4 joueurs pour démarrer.";
			} else {
				this.startButton.title = "";
			}
		}

		if (this.deleteButton) {
			const visible = !!details && isInitiator && status === "pending";
			this.toggleButtonVisibility(this.deleteButton, visible);
			if (visible)
				this.deleteButton.disabled = this.isLoading;
		}

		if (this.actionsContainer) {
			const visibleButtons = [this.joinButton, this.leaveButton, this.startButton, this.deleteButton].some(
				(button) => button && !button.classList.contains("hidden")
			);
			this.actionsContainer.classList.toggle("hidden", !visibleButtons);
		}
	}

	private async handleJoin(): Promise<void> {
		if (!this.tournamentId)
			return;
		this.setButtonLoading(this.joinButton, true, "Rejoindre…");
		try {
			const response = await fetch('/api/tournament/join', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tournamentId: this.tournamentId })
			});
			const data = await response.json();
			if (!response.ok || !data.success)
				throw new Error(data.error || "Impossible de rejoindre le tournoi.");
			await this.fetchTournamentDetails(true);
			this.showAlert('Tu as rejoint le tournoi !', 'success');
		} catch (error) {
			const message = error instanceof Error ? error.message : "Erreur inattendue lors de la tentative de rejoindre.";
			this.showAlert(message, 'error');
		} finally {
			this.setButtonLoading(this.joinButton, false);
			this.updateActionButtons();
		}
	}

	private async handleLeave(): Promise<void> {
		if (!this.tournamentId)
			return;
		this.setButtonLoading(this.leaveButton, true, "Sortie…");
		try {
			const response = await fetch(`/api/tournament/leave/${this.tournamentId}`, {
				method: 'POST'
			});
			const data = await response.json();
			if (!response.ok || !data.success)
				throw new Error(data.error || "Impossible de quitter le tournoi.");
			await this.fetchTournamentDetails(true);
			this.showAlert('Tu as quitté le tournoi.', 'success');
		} catch (error) {
			const message = error instanceof Error ? error.message : "Erreur inattendue lors de la tentative de quitter.";
			this.showAlert(message, 'error');
		} finally {
			this.setButtonLoading(this.leaveButton, false);
			this.updateActionButtons();
		}
	}

	private async handleStart(): Promise<void> {
		if (!this.tournamentId)
			return;
		this.setButtonLoading(this.startButton, true, "Démarrage…");
		try {
			const response = await fetch(`/api/tournament/start/${this.tournamentId}`, {
				method: 'POST'
			});
			const data = await response.json();
			if (!response.ok || !data.success)
				throw new Error(data.error || "Impossible de démarrer le tournoi.");
			await this.fetchTournamentDetails(true);
			this.showAlert('Le tournoi a démarré !', 'success');
		} catch (error) {
			const message = error instanceof Error ? error.message : "Erreur inattendue lors du démarrage.";
			this.showAlert(message, 'error');
		} finally {
			this.setButtonLoading(this.startButton, false);
			this.updateActionButtons();
		}
	}

	private async handleDelete(): Promise<void> {
		if (!this.tournamentId)
			return;
		this.setButtonLoading(this.deleteButton, true, "Suppression…");
		try {
			const response = await fetch('/api/tournament/cancel', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tournamentId: Number(this.tournamentId) })
			});
			const data = await response.json();
			if (!response.ok || !data.success)
				throw new Error(data.error || "Impossible de supprimer le tournoi.");
			this.showAlert('Tournoi supprimé.', 'success');
			await navigate('/tournamentLobby');
		} catch (error) {
			const message = error instanceof Error ? error.message : "Erreur inattendue lors de la suppression.";
			this.showAlert(message, 'error');
		} finally {
			this.setButtonLoading(this.deleteButton, false);
			this.updateActionButtons();
		}
	}

	private setLoadingState(isLoading: boolean): void {
		this.isLoading = isLoading;

		const refreshBtn = document.getElementById("tournamentRefreshBtn") as HTMLButtonElement | null;
		if (refreshBtn) {
			refreshBtn.disabled = isLoading;
			refreshBtn.classList.toggle("tournament-pill--loading", isLoading);
			refreshBtn.innerHTML = isLoading
				? `<span class="tournament-pill__icon tournament-spinner"></span><span>Chargement…</span>`
				: `<span class="tournament-pill__icon">🔄</span><span>Actualiser</span>`;
		}

		if (isLoading) {
			const playerList = document.getElementById("tournamentPlayerList");
			if (playerList)
				playerList.innerHTML = `<li class="tournament-panel__item tournament-panel__item--placeholder">Chargement…</li>`;

			const bracket = document.getElementById("tournamentBracket");
			if (bracket)
				bracket.innerHTML = `<div class="tournament-loader">Chargement du bracket…</div>`;
		}

		this.updateActionButtons();
	}

	private showAlert(message: string, type: "success" | "error" | "info" = "info"): void {
		const alert = document.getElementById("tournamentError");
		if (!alert)
			return;

		alert.textContent = message;
		alert.classList.remove("hidden", "tournament-alert--success", "tournament-alert--error", "tournament-alert--info");
		alert.classList.add(`tournament-alert--${type}`);
	}

	private clearAlert(): void {
		const alert = document.getElementById("tournamentError");
		if (!alert)
			return;
		alert.classList.add("hidden");
		alert.classList.remove("tournament-alert--success", "tournament-alert--error", "tournament-alert--info");
	}

	private resetContent(): void {
		this.currentDetails = null;
		const playerList = document.getElementById("tournamentPlayerList");
		if (playerList)
			playerList.innerHTML = `<li class="tournament-panel__item tournament-panel__item--placeholder">Aucune donnée à afficher.</li>`;

		const bracket = document.getElementById("tournamentBracket");
		if (bracket)
			bracket.innerHTML = `
				<div class="tournament-match tournament-match--empty">
					<div class="tournament-match__title">Bracket</div>
					<div class="tournament-match__placeholder">Aucune information disponible.</div>
				</div>
			`;

		const subtitle = document.getElementById("tournamentSubtitle");
		if (subtitle)
			subtitle.textContent = "Impossible de charger le tournoi.";

		const statusBadge = document.getElementById("tournamentStatusBadge");
		if (statusBadge)
			statusBadge.textContent = "Status : –";

		const winner = document.getElementById("tournamentWinner");
		if (winner) {
			winner.textContent = "👑 Vainqueur : –";
			winner.classList.add("tournament-winner--pending");
		}

		const initiator = document.getElementById("tournamentInitiator");
		if (initiator)
			initiator.textContent = "Initiateur : –";

		this.updateActionButtons();
	}
}
