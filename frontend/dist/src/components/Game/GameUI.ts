import { PublicUser, User } from "../../types/user.js";
import { UserStore } from "../../store.js";
import { MatchInfos } from "../../types/game.js";
import { ProfileCardAPI } from "../ProfileCard/ProfileCardAPI.js";
import { GameAPI } from "./GameAPI.js";

const AI_USER_ID = 9999;

export class GameUI {
	private user: User | null;
	private player1Img: HTMLImageElement;
	private player1Name: HTMLElement;
	private player2Img: HTMLImageElement;
	private player2Name: HTMLElement;
	private scorePlayerOne: HTMLElement | null;
	private scorePlayerTwo: HTMLElement | null;
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private quiteGameButton: HTMLElement;
	private defaultProfileSrc: string | null;
	private pongBotProfileSrc: string | null;
	private matchInfos: MatchInfos | null;
	private currentSide: "left" | "right" | null;
	private lastPlayersSignature: string | null;
	private playerCache: Map<number, PublicUser>;
	private handlePlayersEvent: (event: Event) => void;

	constructor() {
		this.user = UserStore.getInstance().getUser();
		this.player1Img = document.getElementById("gamePlayerOneImg")! as HTMLImageElement;
		this.player2Name = document.getElementById("gamePlayerTwoName")!;
		this.player2Img = document.getElementById("gamePlayerTwoImg")! as HTMLImageElement;
		this.player1Name = document.getElementById("gamePlayerOneName")!;
		this.scorePlayerOne = document.getElementById("gameScorePlayerOne");
		this.scorePlayerTwo = document.getElementById("gameScorePlayertwo");
		this.canvas = document.getElementById('pongCanvas') as HTMLCanvasElement;
		this.quiteGameButton = document.getElementById("quitGameBtn")!;
		this.defaultProfileSrc = null;
		this.pongBotProfileSrc = null;
		this.matchInfos = null;
		this.currentSide = null;
		this.lastPlayersSignature = null;
		this.playerCache = new Map();
		this.handlePlayersEvent = (event: Event) => {
			const custom = event as CustomEvent<{ players?: { left?: { userId?: number | null; score?: number }; right?: { userId?: number | null; score?: number } } }>;
			const players = custom.detail?.players;
			if (!players) return;
			void this.onPlayersUpdate(players);
		};
		window.addEventListener("pong:players", this.handlePlayersEvent as EventListener);

		if (!this.canvas) {
			return ;
		}
		this.ctx = this.canvas.getContext('2d')!;
	}

	setMatchInfos(matchInfos: MatchInfos) {
		this.matchInfos = matchInfos;
	}

	private async ensureUser(): Promise<User | null> {
		if (this.user) return this.user;
		try {
			await UserStore.getInstance().setUser();
		} catch (err) {
			console.error("Unable to refresh user before rendering profiles:", err);
		}
		this.user = UserStore.getInstance().getUser();
		return this.user;
	}

	private async getDefaultProfileSrc(): Promise<string> {
		if (this.defaultProfileSrc) return this.defaultProfileSrc;
		const DEFAULT_PP_ENDPOINT = "/api/images/defaultPp";
		try {
			const resp = await fetch(DEFAULT_PP_ENDPOINT, { credentials: "include" });
			if (!resp.ok) throw new Error(`defaultPp status ${resp.status}`);
			const blob = await resp.blob();
			this.defaultProfileSrc = URL.createObjectURL(blob);
		} catch (err) {
			this.defaultProfileSrc = DEFAULT_PP_ENDPOINT;
			console.error("default profile picture fallback error:", err);
		}
		return this.defaultProfileSrc;
	}

	private async getPongBotProfileSrc(): Promise<string> {
		if (this.pongBotProfileSrc) return this.pongBotProfileSrc;
		const PONGBOT_PP_ENDPOINT = "/api/images/pongbot";
		try {
			const resp = await fetch(PONGBOT_PP_ENDPOINT, { credentials: "include" });
			if (!resp.ok) throw new Error(`pongbot status ${resp.status}`);
			const blob = await resp.blob();
			this.pongBotProfileSrc = URL.createObjectURL(blob);
		} catch (err) {
			console.warn("PongBot profile picture fallback error, using default:", err);
			this.pongBotProfileSrc = await this.getDefaultProfileSrc();
		}
		return this.pongBotProfileSrc;
	}

	// GameUI.ts (ou fichier où se trouve la méthode)
	async renderProfilePictures(matchInfos: MatchInfos, mySide: "left" | "right" | null) {
	  this.matchInfos = matchInfos;
	  if (!mySide) return;

	  try {
	    const me = await this.ensureUser();
	    const isAiOpponent = matchInfos.type === "ai" || matchInfos.opponent_id === AI_USER_ID;

	    let opp: PublicUser | null = null;
	    try {
	      opp = await ProfileCardAPI.getUserById(matchInfos.opponent_id);
	      if (opp) this.playerCache.set(opp.id, opp);
	    } catch (err) {
	      if (!isAiOpponent) throw err;
	      console.warn("Failed to fetch opponent profile, using AI fallback:", err);
	    }

	    const mePp  = me?.userImageInfos?.profilePicture ?? null;
	    let oppPp = opp?.userImageInfos?.hasProfilePicture ? (opp.userImageInfos.profilePicture ?? null) : null;

	    if (!oppPp && isAiOpponent) {
	      oppPp = await this.getPongBotProfileSrc();
	    }

	    const resolveSrc = async (src?: string | null, preferPongBot = false) => {
	      if (src) return src;
	      if (preferPongBot) return await this.getPongBotProfileSrc();
	      return await this.getDefaultProfileSrc();
	    };

			if (mySide === "left") {
				// moi à gauche, adversaire à droite
				this.player1Img.src = await resolveSrc(mePp);
				this.player2Img.src = await resolveSrc(oppPp, isAiOpponent);
			} else {
				// moi à droite, adversaire à gauche
				this.player1Img.src = await resolveSrc(oppPp, isAiOpponent);
				this.player2Img.src = await resolveSrc(mePp);
			}
		} catch (e) {
			const fallback = await this.getDefaultProfileSrc();
			this.player1Img.src = fallback;
			this.player2Img.src = fallback;
			console.error("renderProfilePictures error:", e);
		}
	}

	private async onPlayersUpdate(players: { left?: { userId?: number | null; score?: number }; right?: { userId?: number | null; score?: number } }) {
		const signature = JSON.stringify({
			left: players?.left?.userId ?? null,
			right: players?.right?.userId ?? null
		});
		if (signature === this.lastPlayersSignature) {
			return;
		}
		this.lastPlayersSignature = signature;
		await this.applyPlayersUpdate(players);
	}

	private async applyPlayersUpdate(players: { left?: { userId?: number | null; score?: number }; right?: { userId?: number | null; score?: number } }) {
		const me = await this.ensureUser();
		const myId = me?.id ?? null;

		const leftUserId = players?.left?.userId ?? null;
		const rightUserId = players?.right?.userId ?? null;

		const [leftDisplay, rightDisplay] = await Promise.all([
			this.buildDisplayData(leftUserId, me),
			this.buildDisplayData(rightUserId, me)
		]);

		this.player1Name.textContent = leftDisplay.name;
		this.player1Img.src = leftDisplay.img;
		this.player2Name.textContent = rightDisplay.name;
		this.player2Img.src = rightDisplay.img;
		if (this.scorePlayerOne) {
			if (typeof players?.left?.score === "number") {
				this.scorePlayerOne.textContent = String(players.left.score);
			} else {
				this.scorePlayerOne.textContent = "0";
			}
		}
		if (this.scorePlayerTwo) {
			if (typeof players?.right?.score === "number") {
				this.scorePlayerTwo.textContent = String(players.right.score);
			} else {
				this.scorePlayerTwo.textContent = "0";
			}
		}

		if (leftUserId === myId) this.currentSide = "left";
		else if (rightUserId === myId) this.currentSide = "right";
		else this.currentSide = null;
	}

	private async buildDisplayData(userId: number | null, me: User | null): Promise<{ name: string; img: string }> {
		if (typeof userId !== "number") {
			return { name: "Waiting...", img: await this.getDefaultProfileSrc() };
		}
		if (userId === AI_USER_ID) {
			return { name: "PongBot", img: await this.getPongBotProfileSrc() };
		}

		const myId = me?.id ?? null;
		if (myId && userId === myId) {
			const img = me?.userImageInfos?.hasProfilePicture && me.userImageInfos.profilePicture
				? me.userImageInfos.profilePicture
				: await this.getDefaultProfileSrc();
			return { name: me?.username ?? "Moi", img };
		}

		let cached = this.playerCache.get(userId);
		if (!cached) {
			try {
				cached = await ProfileCardAPI.getUserById(userId);
				this.playerCache.set(userId, cached);
			} catch (err) {
				console.warn(`Failed to fetch profile for user ${userId}:`, err);
				return { name: "Player", img: await this.getDefaultProfileSrc() };
			}
		}

		const username = cached?.username ?? "Player";
		const info = cached?.userImageInfos;
		let img = await this.getDefaultProfileSrc();
		if (info?.hasProfilePicture && info.profilePicture) {
			img = info.profilePicture;
		}
		return { name: username, img };
	}

async renderMapDim() {
  const pong = document.getElementById("pong") as HTMLCanvasElement;
  if (!pong) return;

  const BASE_W = 1200;
  const BASE_H = 800;

  const applyResize = () => {
    const maxWidth = window.innerWidth * 0.7;
    const maxHeight = window.innerHeight * 0.7;
    const aspect = BASE_W / BASE_H;

    let displayWidth = maxWidth;
    let displayHeight = displayWidth / aspect;

    if (displayHeight > maxHeight) {
      displayHeight = maxHeight;
      displayWidth = displayHeight * aspect;
    }

    if (pong.width !== BASE_W) pong.width = BASE_W;
    if (pong.height !== BASE_H) pong.height = BASE_H;

    pong.style.width = `${displayWidth}px`;
    pong.style.height = `${displayHeight}px`;
  };

  applyResize();
  window.addEventListener("resize", applyResize);
}

async renderLocalSetup() {
  const me = await this.ensureUser();
  const displayName = me?.username ?? "Player";
  let ppSrc: string;
  if (me?.userImageInfos?.hasProfilePicture && me.userImageInfos.profilePicture) {
    ppSrc = me.userImageInfos.profilePicture;
  } else {
    ppSrc = await this.getDefaultProfileSrc();
  }

  this.player1Img.src = ppSrc;
  this.player2Img.src = ppSrc;
  this.player1Name.textContent = displayName;
  this.player2Name.textContent = displayName;
}


async renderUsernames(
  matchInfos: MatchInfos,
  mySide: "left" | "right" | null
) {
	  if (!mySide) return;

	  try {
	    await this.ensureUser();
	    if (!this.user) {
	      console.warn("Cannot render usernames, user is still null");
	      return;
	    }
	    const isAiOpponent = matchInfos.type === "ai" || matchInfos.opponent_id === AI_USER_ID;
	    let opp: PublicUser | null = null;
	    try {
	      opp = await ProfileCardAPI.getUserById(matchInfos.opponent_id);
	      if (opp) this.playerCache.set(opp.id, opp);
	    } catch (err) {
	      if (!isAiOpponent) throw err;
	      console.warn("Failed to fetch opponent username, using AI fallback:", err);
	    }

	    const meName  = this.user?.username ?? "Moi";
	    const oppName = opp?.username ?? (isAiOpponent ? "PongBot" : "Adversaire");

	    if (mySide === "left") {
	      // moi à gauche, adversaire à droite
	      this.player1Name.textContent = meName;
	      this.player2Name.textContent = oppName;
	    } else {
	      // moi à droite, adversaire à gauche
	      this.player1Name.textContent = oppName;
	      this.player2Name.textContent = meName;
	    }
	  } catch (e) {
	    console.error("renderUsernames error:", e);
	  }
	}


	renderBackground() {
		function drawBackground() {
			let canvas = document.getElementById('pongCanvas') as HTMLCanvasElement;
			if (!canvas) {
				return ;
			}
			let ctx = canvas.getContext('2d')!;
			ctx.fillStyle = '#0f0f1b';
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.setLineDash([10, 10]);
			ctx.strokeStyle = '#8e2de2';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(canvas.width / 2, 0);
			ctx.lineTo(canvas.width / 2, canvas.height);
			ctx.stroke();
		}
		function animate() {
			drawBackground();
			requestAnimationFrame(animate);
		}
		animate();
	}

	renderTruc() {
		const canvas = document.getElementById('pongCanvas') as HTMLCanvasElement;
		if (!canvas) {
			return ;
		}
		const ctx = canvas.getContext('2d')!;
		let x = 0;
		let y = 100;
		let dx = 2;
		function dessiner() {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.beginPath();
			ctx.arc(x, y, 20, 0, Math.PI * 2);
			ctx.fillStyle = "blue";
			ctx.fill();
			ctx.closePath();
			x += dx;
			if (x > canvas.width || x < 0) {
				dx = -dx;
			}
			requestAnimationFrame(dessiner);
		}
		dessiner();
	}

	setupListeners() {
		this.quiteGameButton.addEventListener("click", async () => {
			await GameAPI.forfeitGame();
		});
	}
}
