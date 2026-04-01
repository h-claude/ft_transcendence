import { wsGameReceived, type Side } from "../pong_part/gameClient.js";
import {
  startGameLocalAnimation,
  stopGameLoop,
  stopLocalCountdown,
} from "../pong_part/main.js";
import { navigate } from "../../navigation.js";
import { GameAPI } from "../Game/GameAPI.js";
import { startLocalSession, stopLocalSession } from "../pong_part/localGame.js";

export class GameInit {
  private client?: ReturnType<typeof wsGameReceived>;
  private intervalId?: number;
  private exiting = false;
  private gameId?: string | number;
private opponentId?: string | number;
  private matchType: string | null = null;
  private tournamentId: number | null = null;
  private pendingRedirectPath: string | null = null;
  private localMode = false;
  private localQuitBtn?: HTMLElement;
  private sidePromise?: Promise<Side>;

  // timers overlay/redirect
  private redirectTimeoutId?: number;
  private overlayCountdownIntervalId?: number;
  private overlaySecondsLeft = 0;

  private onAutoExit = async () => { await this.quit(); };
  private onQuitClick = async () => { await this.quit(); };

  // NEW: écoute la fin locale si le serveur tarde
  private onLocalGameOver = (e: Event) => {
    const detail = (e as CustomEvent)?.detail ?? {};
    const score: { left: number; right: number } | undefined =
      detail?.score &&
      typeof detail.score.left === "number" &&
      typeof detail.score.right === "number"
        ? detail.score
        : undefined;

    const youWon = this.decideYouWonFromScore(this.getCurrentSide(), score);

    this.showWinLoseOverlay({
      youWon,
      score,
    });

    this.scheduleAutoQuit();
  };


  async wsGameConnect(gameId: any, opponent_id: any)
  {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${location.host}/api/ws_game_logic/${encodeURIComponent(
      String(gameId)
    )}?opponentId=${encodeURIComponent(String(opponent_id))}`;
  }

  private startLocalGame(): void {
    this.localMode = true;
    startLocalSession();
    startGameLocalAnimation();

    window.addEventListener("pong:auto-exit", this.onAutoExit);
    window.addEventListener("pong:game-over-local", this.onLocalGameOver as EventListener);

    const quitBtn = document.getElementById("quitGameBtn");
    if (quitBtn) {
      quitBtn.addEventListener("click", this.onQuitClick);
      this.localQuitBtn = quitBtn;
    }
  }

  async start(gameId: string | number, opponent_id: string | number, matchType?: string | null, tournamentId?: number | null) {
    console.log("game just started!");

    const isLocal = sessionStorage.getItem("pongMode") === "local";
    if (isLocal) {
      sessionStorage.removeItem("pongMode");
      this.startLocalGame();
      return;
    }

    this.gameId = gameId;
    this.opponentId = opponent_id;
    this.matchType = matchType ?? null;
    this.tournamentId = tournamentId ?? null;
    this.pendingRedirectPath =
      this.matchType && this.matchType.toLowerCase() === "tournament" && this.tournamentId != null
        ? `/tournamentPage?id=${this.tournamentId}`
        : null;

    startGameLocalAnimation();
    const wsUrl = await this.wsGameConnect(gameId, opponent_id);
    this.client = wsGameReceived(wsUrl);
    this.sidePromise = this.client.waitForSide();
    this.intervalId = this.client.initInterval();


    // Si le serveur indique que la partie continue/reprend, on s'assure que l'overlay disparaisse
    this.client.socket.addEventListener("message", (ev: MessageEvent) => {
      try {
        const data: any = JSON.parse(ev.data);

        // FIN DE PARTIE (serveur) — synchro pour les 2 joueurs
       const isServerGameOver = (data?.type === "info_game" && data.gameOver === true);

      // …dans this.client.socket.addEventListener("message", …)
      if (isServerGameOver) {
        console.log(`GAME IS OVERR!!`);
        const left  = data?.score?.scoreLeft  ?? undefined;
        const right = data?.score?.scoreRight ?? undefined;

        // Score struct standardisé pour le helper
        const score = (typeof left === "number" && typeof right === "number")
          ? { left, right }
          : undefined;

        // 1) on détermine via le côté + score
        let youWon = this.decideYouWonFromScore(this.getCurrentSide(), score);

        if (!this.pendingRedirectPath && this.matchType && this.matchType.toLowerCase() === "tournament" && this.tournamentId != null) {
          this.pendingRedirectPath = `/tournamentPage?id=${this.tournamentId}`;
        }

        // 2) (optionnel) si le backend t’envoie winnerId et que tu as youId, tu peux l’écraser :
        const youId = (window as any).__CURRENT_USER_ID__;
        if (youWon === undefined && youId != null && data.winnerId != null) {
          youWon = String(data.winnerId) === String(youId);
        }

        this.showWinLoseOverlay({
          youWon,
          score,
          message: data.message
        });

        this.scheduleAutoQuit();
      }


      } catch {}
    });

    window.addEventListener("pong:auto-exit", this.onAutoExit);
    window.addEventListener("pong:game-over-local", this.onLocalGameOver as EventListener);

    const quitBtn = document.getElementById("quitGameBtn");
    // if (quitBtn) quitBtn.addEventListener("click", this.onQuitClick);
     if (quitBtn) quitBtn.addEventListener("click", () => {
        console.log("trying to quit the game?")
        this.client?.socket.send(JSON.stringify({type: "surrend"}))
     });


  }

  /** Overlay Win/Lose — premium, opaque, texte blanc + résultat explicite */
private showWinLoseOverlay(opts: {
  youWon?: boolean | undefined;
  score?: { left: number; right: number } | undefined;
  seconds?: number;
  message?: string | undefined;
}) {
  console.log("Overlay appelé avec opts =", opts); // 👈 Affiche tout l'objet dans la console
  const seconds = typeof opts.seconds === "number" ? Math.max(1, opts.seconds) : 4;

  stopLocalCountdown();
  stopGameLoop();
  this.clearWinLoseOverlay();

  // Backdrop opaque — z-index relevé pour passer au-dessus du canvas
  const overlay = document.createElement("div");
  overlay.id = "game-end-overlay";
  overlay.className = "fixed inset-0 z-[1001] flex items-center justify-center bg-[#0B0B10] text-white";

  // Cadre gradient ultra-fin (effet premium)
  const frame = document.createElement("div");
  frame.className = "relative w-[92%] max-w-lg rounded-3xl p-[1px] bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-500";

  // Carte opaque
  const card = document.createElement("div");
  card.className = "relative rounded-3xl bg-[#101018] p-10 ring-1 ring-white/10 shadow-[0_20px_80px_-20px_rgba(0,0,0,0.6)]";

  // Glow discret, coloré selon le résultat (ne change pas la lisibilité)
  const glow = document.createElement("div");
  glow.className = "pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full blur-3xl opacity-20";
  glow.style.background =
    opts.youWon === true
      ? "radial-gradient(closest-side, rgba(34,197,94,0.9), rgba(34,197,94,0) 70%)"     // vert doux
      : opts.youWon === false
      ? "radial-gradient(closest-side, rgba(239,68,68,0.9), rgba(239,68,68,0) 70%)"     // rouge doux
      : "radial-gradient(closest-side, rgba(168,85,247,0.9), rgba(168,85,247,0) 70%)";  // violet
  card.appendChild(glow);

  // Badge résultat (accent couleur), le texte reste blanc
  const badge = document.createElement("div");
  badge.className = "mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.35)]";
  badge.style.background =
    opts.youWon === true
      ? "linear-gradient(135deg, #22c55e, #16a34a)"     // win
      : opts.youWon === false
      ? "linear-gradient(135deg, #ef4444, #dc2626)"     // lose
      : "linear-gradient(135deg, #a855f7, #6366f1)";    // neutral
  badge.textContent = opts.youWon === false ? "✖" : "🏆";
  badge.style.fontSize = "28px";
  badge.style.fontWeight = "900";

  // Titre principal
  const title = document.createElement("h2");
  title.className = "text-3xl md:text-4xl font-extrabold tracking-tight mb-1";
  if (opts.youWon === true)      title.textContent = "Victoire";
  else if (opts.youWon === false) title.textContent = "Défaite";
  else                            title.textContent = "Game Over";

  // Sous-titre explicite — QUI a gagné/perdu pour toi
  const resultLine = document.createElement("p");
  resultLine.className = "text-base md:text-lg font-semibold mb-4";
  resultLine.textContent =
    opts.youWon === true  ? "Tu as gagné !" :
    opts.youWon === false ? "Tu as perdu." :
                             "Partie terminée.";

  // Message facultatif
  if (opts.message) {
    const msg = document.createElement("p");
    msg.className = "text-sm md:text-base text-white/80 mb-2";
    msg.textContent = opts.message;
    card.appendChild(msg);
  }

  // Score final (si fourni)
  if (opts.score) {
    const sc = document.createElement("p");
    sc.className = "text-lg md:text-xl font-semibold mb-4";
    sc.textContent = `Score final : ${opts.score.left} — ${opts.score.right}`;
    card.appendChild(sc);
  }

  // Compte à rebours retour
  const countdownP = document.createElement("p");
  this.overlaySecondsLeft = seconds;
  countdownP.className = "text-xs md:text-sm text-white/70 mb-8";
  countdownP.textContent = `Retour à l'accueil dans ${this.overlaySecondsLeft}s…`;

  // Bouton CTA premium
  const quitNow = document.createElement("button");
  quitNow.className = [
    "relative inline-flex items-center justify-center px-7 py-3",
    "rounded-xl font-semibold",
    "bg-gradient-to-r from-fuchsia-600 to-indigo-600",
    "shadow-[0_8px_30px_rgba(99,102,241,0.35)]",
    "transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
  ].join(" ");
  quitNow.textContent = "Quitter maintenant";

  const shine = document.createElement("span");
  shine.className = "pointer-events-none absolute inset-0 rounded-xl";
  shine.style.background = "linear-gradient(180deg, rgba(255,255,255,0.25), rgba(255,255,255,0) 35%)";
  shine.style.mixBlendMode = "soft-light";
  quitNow.appendChild(shine);

  quitNow.addEventListener("click", () => this.quit());

  // Assemble
  card.appendChild(badge);
  card.appendChild(title);
  card.appendChild(resultLine);
  card.appendChild(countdownP);
  card.appendChild(quitNow);
  frame.appendChild(card);
  overlay.appendChild(frame);
  document.body.appendChild(overlay);

  // Tick du countdown
  this.overlayCountdownIntervalId = window.setInterval(() => {
    this.overlaySecondsLeft -= 1;
    if (this.overlaySecondsLeft <= 0) {
      if (this.overlayCountdownIntervalId !== undefined) {
        clearInterval(this.overlayCountdownIntervalId);
        this.overlayCountdownIntervalId = undefined;
      }
    }
    if (document.body.contains(countdownP)) {
      countdownP.textContent =
        this.overlaySecondsLeft > 0
          ? `Retour à l'accueil dans ${this.overlaySecondsLeft}s…`
          : "Retour…";
    }
  }, 1000) as unknown as number;
}


  // GameInit class…
  private decideYouWonFromScore(
    ms: "left" | "right" | null | undefined,
    score?: { left: number; right: number }
  ): boolean | undefined {
    if (!ms || !score) return undefined;               // si rôle inconnu ou score manquant
    if (score.left === score.right) return undefined;  // égalité => neutre

    const leftWon = score.left > score.right;
    return ms === "left" ? leftWon : !leftWon;
  }

  /** Programme l’auto-quit (forfeit + cleanup + navigate) pour tous les clients */
  private scheduleAutoQuit(ms = 4000) {
    if (this.redirectTimeoutId !== undefined) {
      clearTimeout(this.redirectTimeoutId);
    }
    this.redirectTimeoutId = window.setTimeout(() => {
      this.quit();
    }, ms) as unknown as number;
  }

  /** Cache/supprime l’overlay de fin si présent */
  private clearWinLoseOverlay() {
    if (this.overlayCountdownIntervalId !== undefined) {
      clearInterval(this.overlayCountdownIntervalId);
      this.overlayCountdownIntervalId = undefined;
    }
    if (this.redirectTimeoutId !== undefined) {
      clearTimeout(this.redirectTimeoutId);
      this.redirectTimeoutId = undefined;
    }
    const el = document.getElementById("game-end-overlay");
    if (el && el.parentElement) el.parentElement.removeChild(el);
  }

async quit() {
  if (this.exiting) return;
  this.exiting = true;

  if (this.localMode) {
    this.clearWinLoseOverlay();
    this.stop();
    navigate("/");
    return;
  }

  //try {
  //  await GameAPI.forfeitGame();
  //} catch (e) {
  //  console.warn("forfeitGame a échoué (on continue le cleanup)", e);
  //} finally {
    const isTournamentMatch =
      typeof this.matchType === "string" &&
      this.matchType.toLowerCase() === "tournament" &&
      this.tournamentId != null;
    const targetPath = isTournamentMatch
      ? `/tournamentPage?id=${this.tournamentId}`
      : this.pendingRedirectPath ?? "/";
    this.clearWinLoseOverlay();
    this.stop();
    await navigate(targetPath, { skipGameRedirectOverlay: true }); // Redirection adaptée
  //}
}


  stop() {
    window.removeEventListener("pong:auto-exit", this.onAutoExit);
    window.removeEventListener("pong:game-over-local", this.onLocalGameOver as EventListener);

    if (this.localMode) {
      if (this.localQuitBtn) {
        this.localQuitBtn.removeEventListener("click", this.onQuitClick);
        this.localQuitBtn = undefined;
      }
      stopLocalSession();
      this.localMode = false;
    }

    // const quitBtn = document.getElementById("quitGameBtn");
    // if (quitBtn) quitBtn.removeEventListener("click", this.onQuitClick);
    // const quitBtn = document.getElementById("quitGameBtn");
    // if (quitBtn) quitBtn.addEventListener("click", this.onQuitClick);
    // if (quitBtn) quitBtn.addEventListener("click", this.quit);

    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    if (this.client) {
      try { this.client.socket.close(1000, "GameInit stop"); } catch {}
      this.client = undefined;
    }

    // stopLocalCountdown();
    stopGameLoop();
    this.clearWinLoseOverlay();
    this.matchType = null;
    this.tournamentId = null;
    this.pendingRedirectPath = null;
    this.sidePromise = undefined;
    this.exiting = false;
  }

  waitForSide(): Promise<Side> {
    if (!this.sidePromise) {
      return Promise.reject(new Error("Game not initialized"));
    }
    return this.sidePromise;
  }

  private getCurrentSide(): Side | null {
    return this.client?.getSide() ?? null;
  }
}
