import { leftPaddle, rightPaddle, drawPaddle } from "./paddles.js";
import { ball, drawBall, getScore, countdown, gameState } from "./ball.js";

// --- RAF management ---
let rafId: number | null = null;

// --- Countdown local contrôlé (uniquement quand on le déclenche) ---
let localCountdownMs: number | null = null;
let lastTs: number | null = null;

// NEW: pour détecter la transition vers gameOver et prévenir GameInit
let prevGameOver = false;

let localFrameHandler: (() => void) | null = null;

// Helpers publics pour piloter le compte à rebours depuis ailleurs
// export function startLocalCountdown(seconds = 3) {
//   localCountdownMs = Math.max(0, seconds * 1000);
//   lastTs = null;
//   try { (countdown as any).value = Math.max(0, Math.ceil(localCountdownMs / 1000)); } catch {}
// }

export function stopLocalCountdown() {
  localCountdownMs = null;
  lastTs = null;
  try { (countdown as any).value = 0; } catch {}
}

function drawScore() {
  const canvasElement = document.querySelector("canvas")!;
  const ctx = canvasElement.getContext("2d")!;
  const { scoreLeft, scoreRight } = getScore();
  canvasElement.style.position = "absolute";
  canvasElement.style.zIndex = "999";
  ctx.fillStyle = "white";
  ctx.font = "32px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`${scoreLeft} : ${scoreRight}`, canvasElement.width / 2, 10);
}

function drawCountdown() {
  if ((countdown as any)?.value > 0) {
    const canvasElement = document.querySelector("canvas")!;
    const ctx = canvasElement.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.font = "48px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${(countdown as any).value}`, canvasElement.width / 2, canvasElement.height / 2 - 100);
  }
}

// function maybeTickLocalCountdown(ts: number) {
//   if (localCountdownMs === null) return;

//   if (lastTs === null) {
//     lastTs = ts;
//     return;
//   }
//   const dt = ts - lastTs;
//   lastTs = ts;

//   localCountdownMs = Math.max(0, localCountdownMs - dt);
//   const newVal = Math.ceil(localCountdownMs / 1000);
//   const curVal = (countdown as any)?.value ?? 0;

//   if (newVal !== curVal) {
//     try { (countdown as any).value = Math.max(0, newVal); } catch {}
//   }

//   if (localCountdownMs <= 0) {
//     stopLocalCountdown();
//   }
// }

export function setLocalFrameHandler(handler: (() => void) | null): void {
  localFrameHandler = handler;
}

function frame(ts: number) {
  const canvasElement = document.querySelector("canvas")!;
  const ctx = canvasElement.getContext("2d");
  if (!ctx) return;

  // Tick countdown (si actif)
  // maybeTickLocalCountdown(ts);

  // Si la balle repart, on coupe le countdown
  // try {
  //   if (localCountdownMs !== null && (ball as any) && ((((ball as any).vx ?? 0) !== 0) || (((ball as any).vy ?? 0) !== 0))) {
  //     stopLocalCountdown();
  //   }
  // } catch {}

  if (localFrameHandler) {
    localFrameHandler();
  }

  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  drawPaddle(ctx, leftPaddle);
  drawPaddle(ctx, rightPaddle);
  drawBall(ctx);
  drawScore();
  drawCountdown();

  // NEW: détection transition → true : on émet un event local et on s'arrête
  if ((gameState as any).gameOver === true) {
    if (!prevGameOver) {
      prevGameOver = true;

      // Récupère le score courant et l’envoie dans le détail de l’événement
      let detail: any = {};
      try {
        const { scoreLeft, scoreRight } = getScore();
        if (typeof scoreLeft === "number" && typeof scoreRight === "number") {
          detail.score = { left: scoreLeft, right: scoreRight };
        }
      } catch {}

      // Informe GameInit (si le serveur n’a pas encore broadcast le game over)
      window.dispatchEvent(new CustomEvent("pong:game-over-local", { detail }));
    }
    return; // stop propre
  } else {
    prevGameOver = false;
  }

  rafId = requestAnimationFrame(frame);
}

export function startGameLocalAnimation() {
    try { (gameState as any).gameOver = false; } catch {}
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(frame);
  console.log(`rafId: ${rafId}!`);
}

export function stopGameLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  stopLocalCountdown();
}
