import { Component, mountComponent } from "../Component.js";
import { Header } from "../components/Header.js";
import { Footer } from "../components/Footer.js";

interface LeaderboardPlayer {
	user_id: number;
	username: string;
	wins: number;
	losses: number;
	total_games: number;
	win_ratio: number;
}

export class Leaderboard extends Component {
	private players: LeaderboardPlayer[] = [];

	render(): string {
		return `
			<div class="min-h-screen flex flex-col font-mono home-main-div">
				<div id="headerComp" class="neutral"></div>

				<div class="flex flex-1">
					<main class="flex-1 p-8 flex flex-col items-center">
						<h1 class="text-4xl font-bold text-purple-400 mb-8 neon-text">🏆 Leaderboard</h1>

						<div class="w-full max-w-4xl">
							<!-- Top 3 Podium -->
							<div class="grid grid-cols-3 gap-4 mb-8" id="podium">
								${this.renderPodium()}
							</div>

							<!-- Leaderboard Table -->
							<div class="neon-border-main-div p-6 bg-black/40">
								<table class="w-full text-white">
									<thead>
										<tr class="border-b border-purple-500 text-purple-400">
											<th class="text-left py-3 px-4">Rank</th>
											<th class="text-left py-3 px-4">Player</th>
											<th class="text-center py-3 px-4">Wins</th>
											<th class="text-center py-3 px-4">Losses</th>
											<th class="text-center py-3 px-4">Games</th>
											<th class="text-center py-3 px-4">Win Rate</th>
										</tr>
									</thead>
									<tbody id="leaderboardBody">
										${this.renderTableRows()}
									</tbody>
								</table>
							</div>
						</div>
					</main>
				</div>

				<div id="footerComp" class="neutral"></div>
			</div>
		`;
	}

	private renderPodium(): string {
		if (this.players.length === 0) {
			return '<div class="col-span-3 text-center text-gray-500">Loading...</div>';
		}

		const medals = ['🥈', '🥇', '🥉'];
		const heights = ['h-40', 'h-48', 'h-32'];
		const orders = [1, 0, 2];

		return orders.map((index, displayIndex) => {
			const player = this.players[index];
			if (!player) return '';

			return `
				<div class="flex flex-col items-center ${displayIndex === 1 ? 'mt-0' : 'mt-8'}">
					<div class="text-6xl mb-2">${medals[displayIndex]}</div>
					<div class="neon-border-main-div bg-gradient-to-b from-purple-900/50 to-black/50 ${heights[displayIndex]} w-full flex flex-col items-center justify-center p-4 rounded-lg">
						<div class="text-2xl font-bold text-purple-300">${player.username}</div>
						<div class="text-xl text-yellow-400 mt-2">${player.wins} wins</div>
						<div class="text-sm text-gray-400 mt-1">${player.win_ratio}% WR</div>
					</div>
				</div>
			`;
		}).join('');
	}

	private renderTableRows(): string {
		if (this.players.length === 0) {
			return '<tr><td colspan="6" class="text-center py-8 text-gray-500">No data available</td></tr>';
		}

		return this.players.map((player, index) => {
			const rankClass = index < 3 ? 'text-yellow-400 font-bold' : 'text-gray-400';
			const rowClass = index % 2 === 0 ? 'bg-black/20' : 'bg-black/10';

			return `
				<tr class="${rowClass} hover:bg-purple-900/20 transition">
					<td class="py-3 px-4 ${rankClass}">#${index + 1}</td>
					<td class="py-3 px-4 font-semibold">${player.username}</td>
					<td class="py-3 px-4 text-center text-green-400">${player.wins}</td>
					<td class="py-3 px-4 text-center text-red-400">${player.losses}</td>
					<td class="py-3 px-4 text-center text-gray-300">${player.total_games}</td>
					<td class="py-3 px-4 text-center">
						<span class="px-3 py-1 rounded-full ${this.getWinRateColor(player.win_ratio)}">
							${player.win_ratio}%
						</span>
					</td>
				</tr>
			`;
		}).join('');
	}

	private getWinRateColor(winRate: number): string {
		if (winRate >= 80) return 'bg-green-500/30 text-green-400';
		if (winRate >= 60) return 'bg-blue-500/30 text-blue-400';
		if (winRate >= 40) return 'bg-yellow-500/30 text-yellow-400';
		return 'bg-red-500/30 text-red-400';
	}

	async afterRender() {
		mountComponent(Header, "headerComp", "Leaderboard");
		mountComponent(Footer, "footerComp");

		await this.loadLeaderboard();
	}

	private async loadLeaderboard() {
		try {
			const response = await fetch('/api/game/stats/leaderboard', {
				method: 'GET',
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error('Failed to fetch leaderboard');
			}

			const data = await response.json();
			if (data.message && typeof data.message === 'string') {
				this.players = JSON.parse(data.message);
			} else if (Array.isArray(data.message)) {
				this.players = data.message;
			} else {
				this.players = [];
			}

			const podium = document.getElementById('podium');
			const leaderboardBody = document.getElementById('leaderboardBody');

			if (podium) podium.innerHTML = this.renderPodium();
			if (leaderboardBody) leaderboardBody.innerHTML = this.renderTableRows();

		} catch (error) {
			console.error('Error loading leaderboard:', error);
			const leaderboardBody = document.getElementById('leaderboardBody');
			if (leaderboardBody) {
				leaderboardBody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-red-500">Failed to load leaderboard</td></tr>';
			}
		}
	}
}
