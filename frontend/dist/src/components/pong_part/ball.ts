// ball.ts – Balle, rebonds, collisions, score, animation de but
// import { canvasElement } from "./canvas.js";
// import { gameOver } from "./server/pong_logic.js";

//logique
export type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  moving: boolean;
  type: "ball";
};

// //logique
export let countdown = { value: 0 };

// moduleA.js
export const gameState = {
  gameOver: false,
  paused: false,
};

// ball.ts – à la place de "export let"
export let score = {scoreLeft: 0, scoreRight: 0};

export function getScore() {
  return { scoreLeft: score.scoreLeft, scoreRight: score.scoreRight };
}

//logique
export function resetScore() {
  gameState.gameOver = false;
  score.scoreLeft = 0;
  score.scoreRight = 0;
}

const CANVAS_W = 1200;
const CANVAS_H = 800;
const BASE_SPEED = 6;
const SPEED_INCREMENT = 1.06;
const MAX_SPEED = 14;
export const LOCAL_TARGET_SCORE = 3;

export const ball: Ball = {
  x: CANVAS_W / 2,
  y: CANVAS_H / 2,
  vx: 0,
  vy: 0,
  r: 10,
  moving: false,
  type: "ball",
};

// Animation flash après but
function animateReset() {
  const canvasElement = document.querySelector("canvas")!;
  const ctx = canvasElement.getContext("2d")!;
  let opacity = 1;
  function flash() {
    ctx.fillStyle = `rgba(255,255,255,${opacity})`;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r * 2, 0, Math.PI * 2);
    ctx.fill();
    opacity -= 0.05;
    if (opacity > 0) requestAnimationFrame(flash);
  }
  flash();
}

// Dessine la balle
export function drawBall(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
}

export function centerBall(): void {
  ball.x = CANVAS_W / 2;
  ball.y = CANVAS_H / 2;
  ball.vx = 0;
  ball.vy = 0;
  ball.moving = false;
}

/**
 * Replace la balle au centre et lui donne une nouvelle vitesse.
 * @param towardSide côté de terrain visé (la balle part dans ce sens)
 */
export function resetBall(towardSide: "left" | "right" = Math.random() < 0.5 ? "left" : "right") {
  ball.x = CANVAS_W / 2;
  ball.y = CANVAS_H / 2;

  const dir = towardSide === "left" ? -1 : 1;
  const angle = (Math.random() * Math.PI) / 4 - Math.PI / 8; // +/- 22.5°
  const speed = BASE_SPEED;

  ball.vx = dir * speed * Math.cos(angle);
  ball.vy = speed * Math.sin(angle);
  ball.moving = true;
}

/**
 * Accélère la balle (utilisé sur collision paddle) avec cap.
 */
export function boostBallSpeed(): void {
  const speed = Math.min(MAX_SPEED, Math.hypot(ball.vx, ball.vy) * SPEED_INCREMENT);
  const angle = Math.atan2(ball.vy, ball.vx);
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
}

/**
 * Attribue un point à un côté et signale la fin si objectif atteint.
 */
export function awardPoint(side: "left" | "right"): void {
  if (side === "left") score.scoreLeft += 1;
  else score.scoreRight += 1;

  ball.moving = false;
  ball.vx = 0;
  ball.vy = 0;

  if (score.scoreLeft >= LOCAL_TARGET_SCORE || score.scoreRight >= LOCAL_TARGET_SCORE) {
    gameState.gameOver = true;
  } else {
    animateReset();
  }
}
