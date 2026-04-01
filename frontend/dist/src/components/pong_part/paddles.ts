// paddles.ts – Définition et gestion des raquettes

// import { canvasElement } from "./canvas.js";

  // const canvasElement = document.querySelector("canvas")!;
  // const ctx = canvasElement.getContext("2d")!;

export type Paddle = {
  type: "paddleLeft" | "paddleRight";
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
};

// const paddleHeight = canvasElement.height * 0.2;
const canvasHeight = 800;
const canvasWidth = 1200;
const paddleHeight = canvasHeight * 0.2;
const paddleWidth = 10;

// // Raquette gauche (joueur Z/S)
export const leftPaddle: Paddle = {
  type: "paddleLeft",
  x: 20,
  y: canvasHeight / 2 - paddleHeight / 2,
  w: paddleWidth,
  h: paddleHeight,
  speed: 8,
};

// Raquette droite (joueur flèches)
export const rightPaddle: Paddle = {
  type: "paddleRight",
  x: canvasWidth - 20 - paddleWidth,
  y: canvasHeight / 2 - paddleHeight / 2,
  w: paddleWidth,
  h: paddleHeight,
  speed: 8,
};

const keysPressed: { [key: string]: boolean } = {};

// Dessine une raquette
export function drawPaddle(ctx: CanvasRenderingContext2D, paddle: Paddle) {
  ctx.fillStyle = "white";
  // console.log(`Paddle y: ${paddle.y}`)
  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
}
