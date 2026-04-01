// gameClient.ts
import { leftPaddle, rightPaddle } from "./paddles.js";
import { ball, countdown, score, gameState } from "./ball.js";
import { startGameLocalAnimation } from "./main.js";

export type Side = "left" | "right";

interface GameClient {
  socket: WebSocket;
  initInterval: () => number;
  waitForSide: () => Promise<Side>;
  getSide: () => Side | null;
}

let lastPlayersSignature = "";

type ServerMsg =
  | { type: "paddleLeft"; x: number; y: number; w: number; h: number; speed: number }
  | { type: "paddleRight"; x: number; y: number; w: number; h: number; speed: number }
  | { type: "ball"; x: number; y: number; vx: number; vy: number; r: number; moving: boolean }
  | {
      type: "info_game";
      countdown: number;
      score: {
        scoreLeft: number;
        scoreRight: number;
        leftUserId?: number | null;
        rightUserId?: number | null;
      };
      gameOver: boolean;
      paused?: boolean;
      players?: {
        left?: { userId?: number | null; score?: number };
        right?: { userId?: number | null; score?: number };
      };
    }
  | {
      type: "match_end";
      gameOver: true;
      result: "win" | "lose";
      winner: "left" | "right";
      reason: "score" | "disconnect" | "surrender" | "no_show";
      score: { scoreLeft: number; scoreRight: number };
    }
  | { type: "role"; side: "left" | "right" }
  | { type: "ai_command"; side?: "left" | "right"; command: "up" | "down" | "stop" };

// ---------- overlays ----------
function ensureOverlay(id: string, html: string, baseStyles?: Partial<CSSStyleDeclaration>) {
  let el = document.getElementById(id) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    Object.assign(el.style, {
      position: "fixed", inset: "0", display: "none",
      alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.55)", zIndex: "9999",
      fontFamily: "system-ui, Arial, sans-serif",
      ...baseStyles,
    });
    el.innerHTML = html;
    document.body.appendChild(el);
  }
  return el;
}

// Overlay PRÉ-GAME (“Vous êtes prêts ??”)
function showPreGameOverlay(seconds: number) {
  const el = ensureOverlay(
    "game-pregame-overlay",
    `
    <div style="min-width:320px;max-width:520px;padding:24px 28px;border-radius:16px;background:rgba(15,15,25,0.95);backdrop-filter:blur(6px);text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.35);">
      <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:.5px;margin-bottom:8px;">Vous êtes prêts ??</div>
      <div id="pregame-timer" style="font-size:18px;color:#c4b5fd;">Départ dans ${seconds} s…</div>
    </div>`
  );
  const t = el.querySelector("#pregame-timer") as HTMLDivElement | null;
  if (t) t.textContent = `Départ dans ${seconds} s…`;
  el.style.display = "flex";
}
function updatePreGameOverlay(seconds: number) {
  const el = document.getElementById("game-pregame-overlay") as HTMLDivElement | null;
  if (!el) return;
  const t = el.querySelector("#pregame-timer") as HTMLDivElement | null;
  if (t) t.textContent = `Départ dans ${seconds} s…`;
}
function hidePreGameOverlay() {
  const el = document.getElementById("game-pregame-overlay") as HTMLDivElement | null;
  if (el) el.style.display = "none";
}
// ---------- overlays ----------

function ensureEndOverlay(): HTMLDivElement {
  return ensureOverlay(
    "game-end-overlay",
    `
    <div style="
      min-width:320px;max-width:520px;
      padding:32px 28px;
      border-radius:20px;
      background:linear-gradient(145deg, rgba(20,20,30,0.95), rgba(10,10,20,0.95));
      backdrop-filter:blur(10px);
      text-align:center;
      box-shadow:0 12px 40px rgba(0,0,0,0.45);
      border:1px solid rgba(180,150,255,0.25);
    ">
      <div id="overlay-title" style="font-size:32px;font-weight:900;color:#fff;letter-spacing:.5px;margin-bottom:12px;text-shadow:0 0 12px rgba(200,180,255,0.7);">
        Game Over
      </div>
      <div id="overlay-sub" style="font-size:20px;color:#c4b5fd;margin-bottom:10px;"></div>
      <div id="overlay-score" style="font-size:18px;color:#eee;opacity:.95;margin-bottom:18px;"></div>
      <div id="overlay-timer" style="font-size:15px;color:#aaa;margin-bottom:20px;">Retour dans 5 s…</div>
      <button id="end-quit" style="
        padding:10px 24px;
        font-size:15px;
        border-radius:10px;
        border:1px solid rgba(200,180,255,0.4);
        background:rgba(40,0,80,0.6);
        color:#e0d0ff;
        font-weight:600;
        cursor:pointer;
        transition:all .25s;
      ">
        Quitter maintenant
      </button>
    </div>`,
    { zIndex: "999" }
  );
}

function updateEndOverlayTimer(s: number) {
  const el = ensureEndOverlay();
  const t = el.querySelector("#overlay-timer") as HTMLDivElement | null;
  if (t) t.textContent = `Retour dans ${s} s…`;
}
function hideEndOverlay() {
  const el = document.getElementById("game-end-overlay") as HTMLDivElement | null;
  if (el) el.style.display = "none";
}

function startAutoExit(seconds = 5) {
  if ((gameState as any)._autoExitStarted) return;
  (gameState as any)._autoExitStarted = true;

  // s’assure que l’overlay est présent pour afficher le timer
  ensureEndOverlay();

  let rest = seconds;
  updateEndOverlayTimer(rest);
  const timer = setInterval(() => {
    rest -= 1;
    updateEndOverlayTimer(rest);
    if (rest <= 0) {
      clearInterval(timer);
      window.dispatchEvent(new CustomEvent("pong:auto-exit"));
    }
  }, 1000);
}

export function wsGameReceived(wsUrl: string = "ws://localhost:3000/api/ws_game_logic"): GameClient {
  lastPlayersSignature = "";
  let mySide: Side | null = null;
  let resolveSide: ((s: Side) => void) | null = null;
  const sideReady = new Promise<Side>((resolve) => { resolveSide = resolve; });

  const socket = new WebSocket(wsUrl);

  socket.onmessage = (e: MessageEvent<string>) => {
    try {
      const data = JSON.parse(e.data) as ServerMsg;

      switch (data.type) {
        case "paddleLeft":
          Object.assign(leftPaddle, data);
          break;
        case "paddleRight":
          Object.assign(rightPaddle, data);
          break;
        case "ball":
          Object.assign(ball, data);
          break;
        case "info_game": {
          countdown.value = data.countdown;
          score.scoreRight = data.score.scoreRight;
          score.scoreLeft = data.score.scoreLeft;
          gameState.gameOver = data.gameOver;
          if (typeof data.paused === "boolean") {
            (gameState as any).paused = data.paused;
          }

          const leftUserId = data.players?.left?.userId ?? data.score.leftUserId ?? null;
          const rightUserId = data.players?.right?.userId ?? data.score.rightUserId ?? null;
          const leftScore = data.players?.left?.score ?? data.score.scoreLeft;
          const rightScore = data.players?.right?.score ?? data.score.scoreRight;
          const signature = JSON.stringify({ left: leftUserId, right: rightUserId, sL: leftScore, sR: rightScore });
          if (signature !== lastPlayersSignature) {
            lastPlayersSignature = signature;
            window.dispatchEvent(new CustomEvent("pong:players", {
              detail: {
                players: {
                  left: {
                    userId: leftUserId,
                    score: leftScore
                  },
                  right: {
                    userId: rightUserId,
                    score: rightScore
                  }
                }
              }
            }));
          }

          // PRÉ-GAME
          if (!data.gameOver && data.countdown > 0 && score.scoreLeft === 0 && score.scoreRight === 0) {
            const pre = document.getElementById("game-pregame-overlay") as HTMLDivElement | null;
            if (!pre || pre.style.display === "none") {
              showPreGameOverlay(data.countdown);
            } else {
              updatePreGameOverlay(data.countdown);
            }
          }
          // DÉPART
          if (!data.gameOver && data.countdown === 0) {
            hidePreGameOverlay();
          }
          break;
        }
        case "role":
          mySide = data.side;
          (gameState as any).side = data.side;
          console.log("Je suis :", mySide);
          if (resolveSide) { resolveSide(mySide); resolveSide = null; } // ← déverrouille l’attente
          break;
        case "ai_command":
          // Apply only if the AI command targets our side
          try {
            const sideTarget = (data as any).side;
            const cmd = (data as any).command;
            if (sideTarget && mySide && sideTarget === mySide) {
              if (cmd === "up") {
               keysPressed["ArrowUp"] = true;
               keysPressed["ArrowDown"] = false;
              } else if (cmd === "down") {
               keysPressed["ArrowUp"] = false;
               keysPressed["ArrowDown"] = true;
              } else {
               keysPressed["ArrowUp"] = false;
               keysPressed["ArrowDown"] = false;
              }
            } else if (sideTarget && mySide && sideTarget !== mySide) {
              // forward to server for it to apply controls to the target side
              try {
                //console.log('Forwarding ai_command as ai_controls to server', { side: sideTarget, command: cmd });
                socket.send(JSON.stringify({ type: 'ai_controls', side: sideTarget, command: cmd }));
              } catch (err) { console.error('forward ai_command failed', err); }
            }
          } catch (err) {
            console.error('ai_command handler error', err);
          }
          break;
        default:
          console.log(`Type received not found!!!!!`);
      }
    } catch (err) {
      console.error("Erreur en recevant les données du serveur :", err);
    }
  };

  socket.onclose = () => {
    console.log("Disconnected from server! too bad");
  };

  const keysPressed: Record<string, boolean> = {};
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    keysPressed[e.key] = true;
  });
  document.addEventListener("keyup", (e: KeyboardEvent) => {
    keysPressed[e.key] = false;
  });

    function updateGameState() {
    if (socket.readyState !== WebSocket.OPEN) return;
    if (!mySide) return;
    if (gameState.gameOver) return;

    const up = mySide === "left"
      ? !!keysPressed["w"] || !!keysPressed["W"] || !!keysPressed["ArrowUp"]
      : !!keysPressed["ArrowUp"];

    const down = mySide === "left"
      ? !!keysPressed["s"] || !!keysPressed["S"] || !!keysPressed["ArrowDown"]
      : !!keysPressed["ArrowDown"];

    const controls =
      mySide === "left"
        ? { left:  { up, down } }
        : { right: { up, down } };

    socket.send(JSON.stringify({ type: "controls", controls }));
    }

  function initInterval() {
    return setInterval(updateGameState, 1000 / 60);
  }

  return {
    socket,
    initInterval,
    waitForSide: () => sideReady,
    getSide: () => mySide
  };
}
