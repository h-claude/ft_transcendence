import { leftPaddle, rightPaddle } from "./paddles.js";
import {
  ball,
  gameState,
  resetScore,
  resetBall,
  awardPoint,
  boostBallSpeed,
  countdown,
  centerBall,
} from "./ball.js";
import {
  initLocalInputs,
  destroyLocalInputs,
  ControlsState,
} from "./localInput.js";
import { setLocalFrameHandler } from "./main.js";

const COURT_W = 1200;
const COURT_H = 800;

let readControls: (() => ControlsState) | null = null;
let serveDirection: "left" | "right" = Math.random() < 0.5 ? "left" : "right";
let countdownTimer: number | null = null;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function resetPaddles(): void {
  leftPaddle.y = COURT_H / 2 - leftPaddle.h / 2;
  rightPaddle.y = COURT_H / 2 - rightPaddle.h / 2;
}

function clearCountdown(): void {
  if (countdownTimer !== null) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  countdown.value = 0;
}

function startServe(direction: "left" | "right" = Math.random() < 0.5 ? "left" : "right"): void {
  serveDirection = direction;
  clearCountdown();
  countdown.value = 3;
  centerBall();
  resetPaddles();

  countdownTimer = window.setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) {
      clearCountdown();
      resetBall(serveDirection);
    }
  }, 1000);
}

function movePaddle(
  paddle: typeof leftPaddle,
  moveUp: boolean,
  moveDown: boolean
): void {
  if (moveUp === moveDown) return;
  const delta = paddle.speed;
  if (moveUp) paddle.y = Math.max(0, paddle.y - delta);
  if (moveDown) paddle.y = Math.min(COURT_H - paddle.h, paddle.y + delta);
}

function handlePaddleBounce(
  paddle: typeof leftPaddle,
  side: "left" | "right"
): void {
  const paddleCenter = paddle.y + paddle.h / 2;
  const offset = clamp((ball.y - paddleCenter) / (paddle.h / 2), -1, 1);
  const angle = offset * (Math.PI / 3);
  const direction = side === "left" ? 1 : -1;

  ball.x =
    side === "left"
      ? paddle.x + paddle.w + ball.r
      : paddle.x - ball.r;

  const speed = Math.max(6, Math.hypot(ball.vx, ball.vy));
  ball.vx = Math.cos(angle) * speed * direction;
  ball.vy = Math.sin(angle) * speed;
  ball.moving = true;

  boostBallSpeed();
}

function updateBall(): void {
  if (gameState.gameOver) return;
  if (!readControls) return;

  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.y - ball.r <= 0) {
    ball.y = ball.r;
    ball.vy = Math.abs(ball.vy);
  } else if (ball.y + ball.r >= COURT_H) {
    ball.y = COURT_H - ball.r;
    ball.vy = -Math.abs(ball.vy);
  }

  if (
    ball.vx < 0 &&
    ball.x - ball.r <= leftPaddle.x + leftPaddle.w &&
    ball.x >= leftPaddle.x &&
    ball.y + ball.r >= leftPaddle.y &&
    ball.y - ball.r <= leftPaddle.y + leftPaddle.h
  ) {
    handlePaddleBounce(leftPaddle, "left");
  }

  if (
    ball.vx > 0 &&
    ball.x + ball.r >= rightPaddle.x &&
    ball.x <= rightPaddle.x + rightPaddle.w &&
    ball.y + ball.r >= rightPaddle.y &&
    ball.y - ball.r <= rightPaddle.y + rightPaddle.h
  ) {
    handlePaddleBounce(rightPaddle, "right");
  }

  if (ball.x + ball.r < 0) {
    awardPoint("right");
    if (!gameState.gameOver) {
      startServe("left");
    }
    return;
  }

  if (ball.x - ball.r > COURT_W) {
    awardPoint("left");
    if (!gameState.gameOver) {
      startServe("right");
    }
  }
}

function localFrame(): void {
  if (!readControls) return;
  const countdownActive =
    typeof countdown.value === "number" && countdown.value > 0;
  if (countdownActive) {
    resetPaddles();
    return;
  }
  const controls = readControls();
  movePaddle(leftPaddle, controls.leftUp, controls.leftDown);
  movePaddle(rightPaddle, controls.rightUp, controls.rightDown);
  updateBall();
}

export function startLocalSession(): void {
  resetScore();
  startServe();
  readControls = initLocalInputs();
  setLocalFrameHandler(localFrame);
}

export function stopLocalSession(): void {
  setLocalFrameHandler(null);
  destroyLocalInputs();
  readControls = null;
  resetScore();
  clearCountdown();
  centerBall();
  resetPaddles();
}
