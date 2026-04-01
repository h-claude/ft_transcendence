// Import de modèles et utilitaires (si utilisés ailleurs dans l’app)
import { GameModel, AI_USER_ID } from '../models/GameModel.js';
import { TournamentModel } from '../models/TournamentModel.js';
import { createPongBotController, updatePongBot } from '../game/ai/PongBotController.js';

/* -------------------------------------------------------
 * Réglages généraux
 * ----------------------------------------------------- */

// Score cible pour gagner
const TARGET_SCORE = 3;

// Délai maximum avant d'annuler/gagner une partie matchmaking si l'adversaire ne rejoint pas
const MATCHMAKING_JOIN_TIMEOUT_MS = 7000;

// Délai de grâce pour la reconnexion (évite de perdre la game sur simple refresh)
const RECONNECT_GRACE_MS = 7000;

// Dictionnaire des parties en cours (clé = matchId)
const matches = new Map();

const SERVER_TICK_HZ = 60;
const BASE_TICK_MS = 1000 / SERVER_TICK_HZ;

function createDummyAiSocket() {
  const noop = () => {};
  return {
    readyState: 1,
    send: noop,
    close: noop,
    ping: noop
  };
}

function debugLogAllMatchUsers() {
  const snapshot = [];
  for (const match of matches.values()) {
    snapshot.push({
      matchId: match.id,
      users: [...match.connections].map((conn) => ({
        userId: conn.userId ?? null,
        side: conn.side ?? null
      }))
    });
  }
  console.log("[WS] Debug matches users:", snapshot);
}

/* -------------------------------------------------------
 * Normalisation (0..1) & utilitaires de conversion
 * ----------------------------------------------------- */

// Références pixel (conservent le comportement historique)
const REF_W = 1200;
const REF_H = 800;
const REF_DIAG = Math.hypot(REF_W, REF_H);

// Vitesses normalisées (0..1) relatives à la largeur / hauteur / diagonale
const N_BASE_BALL_SPEED_X = 6 / REF_W;         // 0.005
const N_BASE_BALL_SPEED_Y = 3.5 / REF_H;       // 0.004375
const N_BALL_MAX_SPEED = 18 / REF_DIAG;     // ~0.01247

const N_PADDLE_BASE_SPEED = 8 / REF_H;         // 0.01
const N_PADDLE_MAX_SPEED = 12 / REF_H;        // 0.015

// Facteurs sans dimension (déjà 0..1+)
const BALL_HIT_FACTOR = 1.06;   // ↑ vitesse balle à chaque collision avec un paddle
const BALL_TIME_FACTOR = 1.02;   // ↑ vitesse balle par palier de temps
const PADDLE_TIME_FACTOR = 1.02;   // ↑ vitesse paddles par palier de temps
const PADDLE_HIT_FACTOR = 1.015;  // ↑ vitesse paddles à chaque collision
const PADDLE_SOFT_GAIN_ON_RESET = 0.9;

const DIFFICULTY_STEP_MS = 10000;

// Dimensions / positions normalisées (0..1)
const N_PADDLE_W = 10 / REF_W;      // ≈ 0.008333
const N_PADDLE_H = 0.2;             // déjà normalisé
const N_LEFT_X = 20 / REF_W;      // ≈ 0.016667
const N_RIGHT_X_GAP = 20 / REF_W;      // même marge à droite
const N_BALL_R = 10 / REF_W;      // rayon relatif à la largeur

// Conversions normées ↔ pixels (sur les refs historiques)
const pxW = (n) => n * REF_W;
const pxH = (n) => n * REF_H;
const pxD = (n) => n * REF_DIAG;

function makeInitialInputs() {
  return {
    left: { up: false, down: false },
    right: { up: false, down: false }
  };
}

// Bornage
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/**
 * Cap dynamique pour les paddles en fonction de la vitesse de balle.
 * Permet de ne pas rendre les paddles trop rapides quand la balle accélère.
 */
function dynamicPaddleCap(ball) {
  const bSpeed = Math.hypot(ball.vx, ball.vy);
  return clamp(0.4 * bSpeed + pxH(0.00625), pxH(N_PADDLE_BASE_SPEED), pxH(N_PADDLE_MAX_SPEED));
}

function clearInputsForSide(match, side) {
  if (!match?.inputs) return;
  const target = match.inputs[side];
  if (!target) return;
  target.up = false;
  target.down = false;
}

function applyPaddleInputs(match, dtMs) {
  if (!match?.inputs || !match?.state) return;
  if (match.state.gameOver || match.state.countdown > 0 || match.paused) return;

  const dtFactor = clamp(dtMs / BASE_TICK_MS || 0, 0, 2);

  const movePaddle = (paddle, input) => {
    if (!paddle || !input) return;
    const speed = clamp(paddle.speed, pxH(0.0025), pxH(N_PADDLE_MAX_SPEED));
    const delta = speed * dtFactor;
    if (input.up && !input.down) {
      paddle.y = Math.max(0, paddle.y - delta);
    } else if (input.down && !input.up) {
      paddle.y = Math.min(REF_H - paddle.h, paddle.y + delta);
    }
  };

  movePaddle(match.state.leftPaddle, match.inputs.left);
  movePaddle(match.state.rightPaddle, match.inputs.right);
}

/* -------------------------------------------------------
 * Aides jeu & initialisation
 * ----------------------------------------------------- */

/**
 * Démarre un compte à rebours si :
 * - la partie n’est pas finie,
 * - il y a au moins 2 connexions,
 * - la balle est à l’arrêt,
 * - pas de compte à rebours en cours,
 * - pas de gameOver.
 */
function maybeStart(match) {
  const playersConnected = match.connections.size;
  if (
    !match.ended &&
    playersConnected >= 2 &&
    !match.state.ball.moving &&
    match.state.countdown === 0 &&
    !match.state.gameOver
  ) {
    startCountdown(match, 3);
    startCountdown(match, 3);
  }
}

/**
 * Supprime les timers liés au no-show matchmaking.
 */
function clearMatchmakingTimeouts(match) {
  if (!match) return;
  if (match.joinTimeout) {
    clearTimeout(match.joinTimeout);
    match.joinTimeout = null;
  }
  if (match.emptyTimeout) {
    clearTimeout(match.emptyTimeout);
    match.emptyTimeout = null;
  }
  if (match.pendingWinTimeout) {
    clearTimeout(match.pendingWinTimeout);
    match.pendingWinTimeout = null;
  }
}

function clearCreationTimers(match) {
  if (!match) return;
  if (match.creationTimeout) {
    clearTimeout(match.creationTimeout);
    match.creationTimeout = null;
  }
  if (match.creationCountdownInterval) {
    clearInterval(match.creationCountdownInterval);
    match.creationCountdownInterval = null;
  }
  match.creationCountdown = null;
}

function getHumanConnections(match) {
  return [...match.connections].filter(
    (conn) => typeof conn.userId === "number" && conn.userId !== AI_USER_ID && !conn.isAi
  );
}

function scheduleInitialJoinTimeout(match) {
  if (!match || match.isAi || match.creationTimeout) return;
  const humans = getHumanConnections(match);
  if (humans.length >= 2) return;
  match.creationCountdown = Math.floor(MATCHMAKING_JOIN_TIMEOUT_MS / 1000);
  console.log(`[WS] Match ${match.id}: attente d'un adversaire (${match.creationCountdown}s)`);
  if (match.creationCountdownInterval) {
    clearInterval(match.creationCountdownInterval);
    match.creationCountdownInterval = null;
  }
  match.creationCountdownInterval = setInterval(() => {
    if (match.ended) {
      clearCreationTimers(match);
      return;
    }
    if (typeof match.creationCountdown !== "number") return;
    const currentHumans = getHumanConnections(match);
    if (currentHumans.length >= 2) {
      clearCreationTimers(match);
      return;
    }
    match.creationCountdown -= 1;
    if (match.creationCountdown > 0) {
      console.log(`[WS] Match ${match.id}: ${match.creationCountdown}s avant annulation`);
    } else if (match.creationCountdown === 0) {
      console.log(`[WS] Match ${match.id}: timer expiré (annulation imminente)`);
      if (match.creationCountdownInterval) {
        clearInterval(match.creationCountdownInterval);
        match.creationCountdownInterval = null;
      }
    }
  }, 1000);
  match.creationTimeout = setTimeout(() => {
    if (!match || match.ended) return;
    clearMatchmakingTimeouts(match);
    clearCreationTimers(match);
    const humans = getHumanConnections(match);
    if (humans.length === 1) {
      const solo = humans[0];
      console.log(`[WS] Solo player in match ${match.id} after timeout — granting win`);
      if (solo.side === "left") setScoreForSide(match, "left", TARGET_SCORE);
      else if (solo.side === "right") setScoreForSide(match, "right", TARGET_SCORE);
      const winner = solo.side === "left" ? "left" : "right";
      finalizeMatch(match, winner, "no_opponent");
    } else if (humans.length === 0) {
      console.log(`[WS] No players joined match ${match.id} after timeout — cancelling`);
      cancelMatchForNoPlayers(match);
    }
  }, MATCHMAKING_JOIN_TIMEOUT_MS);
}

/**
 * Annule complètement une partie matchmaking sans joueurs connectés.
 */
function cancelMatchForNoPlayers(match) {
  if (!match || match.ended) return;
  match.ended = true;
  clearMatchmakingTimeouts(match);
  try {
    GameModel.sanitizeGameState(match.fastify, match.id);
  } catch (error) {
    console.error("Error sanitizing matchmaking game without players:", error);
  }
  stopAndDeleteMatch(match.id);
}

/**
 * Met à jour les timers d'attente de joueurs pour le matchmaking.
 */
function updateMatchmakingJoinState(match) {
  if (!match || match.type !== "mm") return;
  if (match.ended) {
    clearMatchmakingTimeouts(match);
    return;
  }

  if (match.initialPlayersReady) {
    clearMatchmakingTimeouts(match);
    return;
  }

  const connectionsCount = match.connections.size;

  if (connectionsCount >= 2) {
    match.initialPlayersReady = true;
    clearMatchmakingTimeouts(match);
    return;
  }

  if (connectionsCount === 0) {
    if (match.joinTimeout) {
      clearTimeout(match.joinTimeout);
      match.joinTimeout = null;
    }
    if (!match.emptyTimeout) {
      match.emptyTimeout = setTimeout(() => {
        match.emptyTimeout = null;
        if (match.ended || match.initialPlayersReady) return;
        if (match.connections.size === 0) {
          cancelMatchForNoPlayers(match);
        }
      }, MATCHMAKING_JOIN_TIMEOUT_MS);
    }
    return;
  }

  // Il reste exactement un joueur en attente de l'adversaire
  if (match.emptyTimeout) {
    clearTimeout(match.emptyTimeout);
    match.emptyTimeout = null;
  }
  if (!match.joinTimeout) {
    match.joinTimeout = setTimeout(() => {
      match.joinTimeout = null;
      if (match.ended || match.initialPlayersReady) return;
      if (match.connections.size === 1) {
        const [soloConn] = [...match.connections];
        const winnerSide = soloConn?.side;

        if (winnerSide === "left") setScoreForSide(match, "left", TARGET_SCORE);
        else if (winnerSide === "right") setScoreForSide(match, "right", TARGET_SCORE);

        if (winnerSide === "left" || winnerSide === "right") {
          finalizeMatch(match, winnerSide, "no_show");
        } else {
          cancelMatchForNoPlayers(match);
        }
      }
    }, MATCHMAKING_JOIN_TIMEOUT_MS);
  }
}

function ensureSideAssignments(match) {
  if (!match.sideAssignments) {
    match.sideAssignments = { left: null, right: null };
  }
  return match.sideAssignments;
}

function ensureScoreStore(match) {
  if (!match.scoreByUser) {
    match.scoreByUser = new Map();
  }
  return match.scoreByUser;
}

function ensureScoreEntryForUser(match, userId) {
  if (typeof userId !== "number") return;
  const store = ensureScoreStore(match);
  if (!store.has(userId)) {
    store.set(userId, 0);
  }
}

function getAssignedUserIdForSide(match, side) {
  const assignments = ensureSideAssignments(match);

  if (match.isAi && match.ai?.side === side) {
    assignments[side] = AI_USER_ID;
    ensureScoreEntryForUser(match, AI_USER_ID);
    return AI_USER_ID;
  }

  const assigned = assignments[side];
  if (typeof assigned === "number") {
    return assigned;
  }

  const conn = [...match.connections].find(c => c.side === side && typeof c.userId === "number");
  if (conn) {
    assignments[side] = conn.userId;
    ensureScoreEntryForUser(match, conn.userId);
    return conn.userId;
  }

  return null;
}

function getScoreForUser(match, userId) {
  if (typeof userId !== "number") return 0;
  const store = ensureScoreStore(match);
  return store.get(userId) ?? 0;
}

function setScoreForUser(match, userId, value) {
  if (typeof userId !== "number") return null;
  const store = ensureScoreStore(match);
  store.set(userId, value);
  syncScoreToState(match);
  return value;
}

function addScoreForUser(match, userId, delta = 1) {
  if (typeof userId !== "number") return null;
  const store = ensureScoreStore(match);
  const current = store.get(userId) ?? 0;
  const next = current + delta;
  store.set(userId, next);
  syncScoreToState(match);
  return next;
}

function setScoreForSide(match, side, value) {
  const userId = getAssignedUserIdForSide(match, side);
  if (typeof userId === "number") {
    return setScoreForUser(match, userId, value);
  }
  syncScoreToState(match);
  return null;
}

function addScoreForSide(match, side, delta = 1) {
  const userId = getAssignedUserIdForSide(match, side);
  if (typeof userId === "number") {
    return addScoreForUser(match, userId, delta);
  }
  syncScoreToState(match);
  return null;
}

function syncPlayerInfo(match) {
  if (!match?.state) return;

  if (!match.state.players) {
    match.state.players = {
      left: { userId: null, score: 0 },
      right: { userId: null, score: 0 }
    };
  }

  const leftId = getAssignedUserIdForSide(match, "left");
  const rightId = getAssignedUserIdForSide(match, "right");

  match.state.players.left.userId = typeof leftId === "number" ? leftId : null;
  match.state.players.right.userId = typeof rightId === "number" ? rightId : null;

  const leftScore = typeof leftId === "number" ? getScoreForUser(match, leftId) : 0;
  const rightScore = typeof rightId === "number" ? getScoreForUser(match, rightId) : 0;

  match.state.players.left.score = leftScore;
  match.state.players.right.score = rightScore;

  if (match.state.leftPaddle) {
    match.state.leftPaddle.userId = match.state.players.left.userId;
  }
  if (match.state.rightPaddle) {
    match.state.rightPaddle.userId = match.state.players.right.userId;
  }
}

function syncScoreToState(match) {
  if (!match?.state?.score) return;

  const leftId = getAssignedUserIdForSide(match, "left");
  const rightId = getAssignedUserIdForSide(match, "right");

  match.state.score.scoreLeft = typeof leftId === "number" ? getScoreForUser(match, leftId) : 0;
  match.state.score.scoreRight = typeof rightId === "number" ? getScoreForUser(match, rightId) : 0;
  match.state.score.leftUserId = typeof leftId === "number" ? leftId : null;
  match.state.score.rightUserId = typeof rightId === "number" ? rightId : null;

  syncPlayerInfo(match);
}

function refreshSideAssignments(match) {
  const assignments = ensureSideAssignments(match);
  assignments.left = null;
  assignments.right = null;

  const changed = new Set();

  if (!match) return changed;

  if (match.isAi) {
    if (match.ai?.side) {
      if (match.aiConnection) {
        match.aiConnection.side = match.ai.side;
      }
      assignments[match.ai.side] = AI_USER_ID;
      ensureScoreEntryForUser(match, AI_USER_ID);
    }
    const humanSide = match.ai?.side === "left" ? "right" : "left";
    const humans = [...match.connections].filter(c => typeof c.userId === "number" && c.userId !== AI_USER_ID);
    if (humans[0]) {
      const conn = humans[0];
      if (conn.side !== humanSide) {
        conn.side = humanSide;
        changed.add(conn);
      }
      assignments[humanSide] = conn.userId;
      ensureScoreEntryForUser(match, conn.userId);
    }
    syncScoreToState(match);
    return changed;
  }

  const players = [...match.connections].filter(c => typeof c.userId === "number");

  if (players.length === 0) {
    syncScoreToState(match);
    return changed;
  }

  if (players.length === 1) {
    const conn = players[0];
    if (conn.side !== "left") {
      conn.side = "left";
      changed.add(conn);
    }
    assignments.left = conn.userId;
    ensureScoreEntryForUser(match, conn.userId);
    syncScoreToState(match);
    return changed;
  }

  players.sort((a, b) => (b.userId ?? 0) - (a.userId ?? 0));
  const leftConn = players[0];
  const rightConn = players[1];

  if (leftConn.side !== "left") {
    leftConn.side = "left";
    changed.add(leftConn);
  }
  if (rightConn.side !== "right") {
    rightConn.side = "right";
    changed.add(rightConn);
  }

  assignments.left = leftConn.userId;
  assignments.right = rightConn.userId;
  ensureScoreEntryForUser(match, leftConn.userId);
  ensureScoreEntryForUser(match, rightConn.userId);

  syncScoreToState(match);
  return changed;
}

/**
  * Récupère le score du joueur dans la partie
  * @param {object} match
  * @param {number} userId
  * @returns {number | null} score ou null si non trouvé
 */
function getScoreOfUser(match, userId) {
  if (typeof userId !== "number") return null;
  return getScoreForUser(match, userId);
}

/**
 * Récupère le côté (left/right) du joueur dans la partie
 * @param {object} match
 * @param {number} userId
 * @returns {string | null} "left" ou "right" ou null si non trouvé
 */
function getSideOfUser(match, userId) {
  const assignments = ensureSideAssignments(match);

  if (assignments.left === userId) return "left";
  if (assignments.right === userId) return "right";

  if (match.isAi && userId === AI_USER_ID) {
    return match.ai?.side ?? "right";
  }

  const conn = [...match.connections].find(c => c.userId === userId);
  if (!conn) return null;

  if (conn.side === "left") return "left";
  if (conn.side === "right") return "right";
  return null;
}

/**
 * Récupère l’ID du joueur d’un côté donné dans la partie
 * @param {object} match
 * @param {string} side "left" ou "right"
 * @returns {number | null} userId ou null si non trouvé
 */
function getUserIdOfSide(match, side) {
  const userId = getAssignedUserIdForSide(match, side);
  return typeof userId === "number" ? userId : null;
}

/**
 * État initial d’une partie
 */
function makeInitialState() {
  const CANVAS_W = REF_W;
  const CANVAS_H = REF_H;

  const PADDLE_H = pxH(N_PADDLE_H);
  const PADDLE_W = pxW(N_PADDLE_W);

  const LEFT_X = pxW(N_LEFT_X);
  const RIGHT_X = CANVAS_W - pxW(N_RIGHT_X_GAP) - PADDLE_W;
  const LEFT_Y = CANVAS_H / 2 - PADDLE_H / 2;

  return {
    leftPaddle: {
      type: "paddleLeft",
      x: LEFT_X,
      y: LEFT_Y,
      w: PADDLE_W,
      h: PADDLE_H,
      speed: pxH(N_PADDLE_BASE_SPEED),
      userId: null
    },
    rightPaddle: {
      type: "paddleRight",
      x: RIGHT_X,
      y: LEFT_Y,
      w: PADDLE_W,
      h: PADDLE_H,
      speed: pxH(N_PADDLE_BASE_SPEED),
      userId: null
    },
    ball: {
      type: "ball",
      x: CANVAS_W / 2,
      y: CANVAS_H / 2,
      vx: 0,
      vy: 0,
      r: pxW(N_BALL_R),
      moving: false,
    },
    score: { scoreLeft: 0, scoreRight: 0, leftUserId: null, rightUserId: null },
    players: {
      left: { userId: null, score: 0 },
      right: { userId: null, score: 0 }
    },
    countdown: 0,
    gameOver: false,
    rallyHits: 0,
    lastDifficultyTs: 0,
  };
}

function broadcast(match, payload) {
  const msg = JSON.stringify(payload);
  for (const { ws } of match.connections) {
    try { ws.send(msg); } catch { }
  }
}

/**
 * Lance un compte à rebours (affiché côté clients).
 */
function startCountdown(match, seconds = 3) {
  clearInterval(match.countdownTimer);
  match.state.countdown = seconds;
  syncScoreToState(match);

  match.countdownTimer = setInterval(() => {
    match.state.countdown -= 1;
    broadcast(match, {
      type: "info_game",
      countdown: match.state.countdown,
      score: match.state.score,
      gameOver: match.state.gameOver,
      players: match.state.players
    });

    if (match.state.countdown <= 0) {
      clearInterval(match.countdownTimer);
      launchBall(match);
    }
  }, 1000);
}

/**
 * Mise en mouvement initiale de la balle avec une direction aléatoire.
 */
function launchBall(match) {
  const b = match.state.ball;
  if (b.moving) return;
  b.moving = true;

  b.vx = (Math.random() < 0.5 ? -1 : 1) * pxW(N_BASE_BALL_SPEED_X);
  b.vy = (Math.random() * pxH(N_BASE_BALL_SPEED_Y) + pxH(N_BASE_BALL_SPEED_Y) / 2) * (Math.random() < 0.5 ? -1 : 1);

  match.state.lastDifficultyTs = Date.now();
}

/**
 * Réinitialise verticalement les paddles, et gère leur vitesse (hard/soft reset).
 */
function resetPaddle(match, { hard = false } = {}) {
  const s = match.state;
  if (!s?.leftPaddle || !s?.rightPaddle) return;

  // Recentrage vertical (canvas 800 de haut)
  s.leftPaddle.y = (REF_H - s.leftPaddle.h) / 2;
  s.rightPaddle.y = (REF_H - s.rightPaddle.h) / 2;

  if (hard) {
    // Remise “dure” : vitesse de base
    s.leftPaddle.speed = pxH(N_PADDLE_BASE_SPEED);
    s.rightPaddle.speed = pxH(N_PADDLE_BASE_SPEED);
  } else {
    // Remise “douce” : on relâche sans casser totalement la progression
    s.leftPaddle.speed = Math.max(pxH(N_PADDLE_BASE_SPEED), s.leftPaddle.speed * PADDLE_SOFT_GAIN_ON_RESET);
    s.rightPaddle.speed = Math.max(pxH(N_PADDLE_BASE_SPEED), s.rightPaddle.speed * PADDLE_SOFT_GAIN_ON_RESET);
  }
}

/**
 * Réinitialise la balle au centre + relâchement doux des paddles.
 */
function resetBall(match) {
  const b = match.state.ball;
  b.x = REF_W / 2; b.y = REF_H / 2; b.vx = 0; b.vy = 0; b.moving = false;
  match.state.rallyHits = 0;

  match.state.leftPaddle.speed = Math.max(pxH(N_PADDLE_BASE_SPEED), match.state.leftPaddle.speed * PADDLE_SOFT_GAIN_ON_RESET);
  match.state.rightPaddle.speed = Math.max(pxH(N_PADDLE_BASE_SPEED), match.state.rightPaddle.speed * PADDLE_SOFT_GAIN_ON_RESET);

  if (match.isAi && match.ai) {
    const paddle = match.ai.side === "left" ? match.state.leftPaddle : match.state.rightPaddle;
    const centerY = REF_H / 2 - paddle.h / 2;
    match.ai.targetY = clamp(centerY, 0, REF_H - paddle.h);
    match.ai.lastDecisionTs = Date.now();
  }
}

/**
 * Remise à zéro du score.
 */
function resetScore(match) {
  const store = ensureScoreStore(match);
  for (const userId of store.keys()) {
    store.set(userId, 0);
  }
  syncScoreToState(match);
}

/**
 * Augmente progressivement la difficulté au fil du temps (balle + paddles).
 */
function boostOverTime(match) {
  const s = match.state;
  if (!s.ball.moving) return;

  const now = Date.now();
  if (now - s.lastDifficultyTs >= DIFFICULTY_STEP_MS) {
    s.lastDifficultyTs = now;

    // Accélère la balle
    const b = s.ball;
    b.vx *= BALL_TIME_FACTOR;
    b.vy *= BALL_TIME_FACTOR;

    // Clamp vitesse balle
    const speed = Math.hypot(b.vx, b.vy);
    const MAX_SPEED = pxD(N_BALL_MAX_SPEED);
    if (speed > MAX_SPEED) {
      const k = MAX_SPEED / speed;
      b.vx *= k; b.vy *= k;
    }

    // Accélère légèrement les paddles, avec cap dynamique
    const cap = dynamicPaddleCap(s.ball);
    s.leftPaddle.speed = clamp(s.leftPaddle.speed * PADDLE_TIME_FACTOR, pxH(N_PADDLE_BASE_SPEED), cap);
    s.rightPaddle.speed = clamp(s.rightPaddle.speed * PADDLE_TIME_FACTOR, pxH(N_PADDLE_BASE_SPEED), cap);
  }
}

/**
 * Fin officielle d’une partie :
 * - notifie les clients,
 * - envoie le résultat (win/lose),
 * - ferme la room au bout de 15s.
 */
/**
 * Fin officielle d’une partie :
 * - notifie les clients,
 * - envoie le résultat (win/lose),
 * - ferme la room au bout de 15s.
 */
function finalizeMatch(match, winnerSide, reason = "score") {
  try {
    if (match.ended) return;
    match.ended = true;
    clearMatchmakingTimeouts(match);
    match.state.gameOver = true;
    syncScoreToState(match);

    const players = GameModel.getAllParticipants(match.fastify, match.id);
    const scores = {};

    for (const player of players) {
      const userId = player.user_id;
      const score = getScoreOfUser(match, userId);
      scores[userId] = score;
      if (score != null) scores[userId] = score;
    }
    if (GameModel.matchIsInTournament(match.fastify, match.id)) {
      try {
        GameModel.finishMatch(match.fastify, match.id, scores);
        TournamentModel.autoUpdateTournament(match.fastify, GameModel.getTournamentIdFromOldMatchId(match.fastify, match.id));
      }
      catch (e) {
        const tournamentId = GameModel.getTournamentIdFromMatchId(match.fastify, match.id);
        if (!tournamentId)
          console.error("Error updating tournament after match:", e);
        TournamentModel.sanitizeTournamentState(match.fastify, tournamentId);
        console.error("Error updating tournament after match:", e);
      }
    }
    else {
      try {
        console.log("Finalizing non-tournament match", match.id, "with scores:", scores);
        console.log("Scores:", scores);
        console.log("User IDs in match:", Object.keys(scores));
        GameModel.finishMatch(match.fastify, match.id, scores);
      } catch (e) {
        GameModel.sanitizeGameState(match.fastify, match.id);
        console.error("Error finishing match:", e);
      }
    }

    broadcast(match, {
      type: "info_game",
      countdown: match.state.countdown,
      score: match.state.score,
      gameOver: true,
      players: match.state.players
    });

    const matchIdForBlockchain = match.id;

    /* ===========================================================
     * 🔗 Sauvegarde asynchrone des scores sur la blockchain
     *    puis en DB (table blockchain_matches)
     * =========================================================== */
    (async () => {
      try {
        // On importe la Queue au lieu du Service direct
        const { BlockchainQueue } = await import("../services/blockchainQueue.js");

        const userUids = players.map(p => p.uid);
        const userScores = userUids.map(uid => {
          const playerObj = players.find(p => p.uid === uid);
          return getScoreOfUser(match, playerObj.user_id) ?? 0;
        });
        const timestamp = Math.floor(Date.now() / 1000);
        const isAiMatch = players.some(p => p.user_id === AI_USER_ID);
         const idForQueue = isAiMatch ? null : matchIdForBlockchain;

        // On ajoute la tâche à la file d'attente au lieu de l'exécuter directement
        BlockchainQueue.enqueue(idForQueue, userUids, userScores, timestamp);

        // On notifie immédiatement le frontend qu'un nouveau match est terminé
        broadcast(match, { type: "new_match" });

      } catch (err) {
        console.error("[BLOCKCHAIN_ENQUEUE_ERROR]", err);
      }
    })();

    // Envoi des résultats aux clients + nettoyage
    for (const { ws, side } of match.connections) {
      const result = side === winnerSide ? "win" : "lose";
      try {
        ws.send(JSON.stringify({
          type: "match_end",
          gameOver: true,
          result,
          winner: winnerSide,
          reason,
          score: match.state.score
        }));
      } catch {}
    }

    stopAndDeleteMatch(match.id);

  } catch (error) {
    console.error("Error in finalizeMatch:", error);
  }
}


/**
 * Boucle physique 60Hz : déplacement, collisions, buts, difficulté.
 */
function updatePhysics(match) {
  const now = Date.now();
  const lastTick = typeof match.lastTickTs === "number" ? match.lastTickTs : now;
  const rawDt = now - lastTick;
  const dtMs = clamp(rawDt, 0, BASE_TICK_MS * 5);
  match.lastTickTs = now;

  applyPaddleInputs(match, dtMs);

  const s = match.state;
  if (!s) return;
  if (match.isAi) {
    updatePongBot(match);
  }
  if (!s.ball.moving) return;

  boostOverTime(match);

  const b = s.ball;

  // Déplacement
  b.x += b.vx; b.y += b.vy;

  // Collisions haut/bas
  if (b.y - b.r < 0) { b.y = b.r; b.vy *= -1; }
  if (b.y + b.r > REF_H) { b.y = REF_H - b.r; b.vy *= -1; }

  // Collisions paddles
  const L = s.leftPaddle, R = s.rightPaddle;
  const collides = (px, py, pw, ph) =>
    b.x + b.r > px && b.x - b.r < px + pw && b.y + b.r > py && b.y - b.r < py + ph;

  function addBounceSpin(paddleY, paddleH) {
    // Variation verticale selon le point d’impact
    const rel = ((b.y - (paddleY + paddleH / 2)) / (paddleH / 2));
    b.vy += rel * pxH(0.0015); // spin relatif à la hauteur

    // ↑ vitesse balle à chaque collision
    b.vx *= BALL_HIT_FACTOR;
    b.vy *= BALL_HIT_FACTOR;

    // ↑ vitesse paddles (léger) + cap dynamique
    const cap = dynamicPaddleCap(s.ball);
    s.leftPaddle.speed = clamp(s.leftPaddle.speed * PADDLE_HIT_FACTOR, pxH(N_PADDLE_BASE_SPEED), cap);
    s.rightPaddle.speed = clamp(s.rightPaddle.speed * PADDLE_HIT_FACTOR, pxH(N_PADDLE_BASE_SPEED), cap);

    // Clamp vitesse balle
    const sp = Math.hypot(b.vx, b.vy);
    const MAX_SPEED = pxD(N_BALL_MAX_SPEED);
    if (sp > MAX_SPEED) {
      const k = MAX_SPEED / sp;
      b.vx *= k; b.vy *= k;
    }

    s.rallyHits += 1;
  }

  if (b.vx < 0 && collides(L.x, L.y, L.w, L.h)) {
    b.x = L.x + L.w + b.r + 0.5;
    b.vx = Math.abs(b.vx);
    addBounceSpin(L.y, L.h);
  }
  if (b.vx > 0 && collides(R.x, R.y, R.w, R.h)) {
    b.x = R.x - b.r - 0.5;
    b.vx = -Math.abs(b.vx);
    addBounceSpin(R.y, R.h);
  }

  // Buts : on incrémente le score et on vérifie la fin de match
  if (b.x < 0) {
    const newScore = addScoreForSide(match, "right", 1);
    if (typeof newScore === "number" && newScore >= TARGET_SCORE) {
      finalizeMatch(match, "right", "score");
      return;
    }
    resetBall(match);
    resetPaddle(match);
    startCountdown(match);
  } else if (b.x > REF_W) {
    const newScore = addScoreForSide(match, "left", 1);
    if (typeof newScore === "number" && newScore >= TARGET_SCORE) {
      finalizeMatch(match, "left", "score");
      return;
    }
    resetBall(match);
    resetPaddle(match);
    startCountdown(match);
  }
}

/**
 * Arrête proprement une partie et ferme toutes les websockets.
 */
function stopAndDeleteMatch(matchId) {
  const match = matches.get(matchId);
  if (!match) return;

  clearMatchmakingTimeouts(match);
  clearCreationTimers(match);
  clearInterval(match.tickTimer);
  clearInterval(match.countdownTimer);

  for (const { ws } of match.connections) {
    try { ws.close(1000, "Match ended"); } catch { }
  }
  console.log(`DELETEEEEEEEEEEEEEEEE`);
  matches.delete(matchId);
}

/**
 * Crée / récupère une partie, et démarre la boucle physique + broadcast.
 */
function ensureMatch(matchId, fastify) {
  const type = GameModel.getMatchType(fastify, matchId);
  if (!type) {
    return null;
  }

  let m = matches.get(matchId);
  const isAi = type === "ai";

  if (!m) {
    console.log("[WS] Création d’un match", matchId);
    m = {
      id: matchId,
      type,
      connections: new Set(),        // { side: 'left' | 'right', ws }
      state: makeInitialState(),
      inputs: makeInitialInputs(),
      tickTimer: null,
      countdownTimer: null,
      createdAt: Date.now(),
      ended: false,
      reconnectTimers: new Map(),    // Map<'left'|'right', Timeout>
      paused: false,
      fastify,
      isAi,
      joinTimeout: null,
      emptyTimeout: null,
      initialPlayersReady: false,
      scoreByUser: new Map(),
      sideAssignments: { left: null, right: null },
      aiConnection: null,
      creationTimeout: null,
      creationCountdownInterval: null,
      creationCountdown: null,
      pendingWinTimeout: null,
      lastTickTs: Date.now()
    };

    if (isAi) {
      const paddleHeight = m.state.rightPaddle?.h ?? pxH(N_PADDLE_H);
      m.ai = createPongBotController({
        side: "right",
        canvasHeight: REF_H,
        paddleHeight
      });
      m.ai.userId = AI_USER_ID;
      ensureScoreEntryForUser(m, AI_USER_ID);
      const assignments = ensureSideAssignments(m);
      assignments[m.ai.side ?? "right"] = AI_USER_ID;
      m.aiConnection = {
        side: m.ai.side ?? "right",
        ws: createDummyAiSocket(),
        userId: AI_USER_ID,
        isAi: true
      };
      m.connections.add(m.aiConnection);
    }

    // Boucle 60Hz + broadcast de l’état
    m.tickTimer = setInterval(() => {
      updatePhysics(m);
      if (m.ended) return;
      syncScoreToState(m);

      broadcast(m, m.state.leftPaddle);
      broadcast(m, m.state.rightPaddle);
      broadcast(m, m.state.ball);
    broadcast(m, {
      type: "info_game",
      countdown: m.state.countdown,
      score: m.state.score,
      gameOver: m.state.gameOver,
      paused: m.paused,
      players: m.state.players
    });
    }, 1000 / SERVER_TICK_HZ);

    matches.set(matchId, m);
    updateMatchmakingJoinState(m);
  } else {
    m.fastify = fastify;
    m.isAi = isAi;
    m.type = type;
    if (!m.inputs) m.inputs = makeInitialInputs();
    if (typeof m.lastTickTs !== "number") m.lastTickTs = Date.now();
    if (m.joinTimeout === undefined) m.joinTimeout = null;
    if (m.emptyTimeout === undefined) m.emptyTimeout = null;
    if (m.initialPlayersReady === undefined) m.initialPlayersReady = false;
    if (!m.scoreByUser) m.scoreByUser = new Map();
    if (!m.sideAssignments) m.sideAssignments = { left: null, right: null };
    if (isAi && !m.ai) {
      const paddleHeight = m.state.rightPaddle?.h ?? pxH(N_PADDLE_H);
      m.ai = createPongBotController({
        side: "right",
        canvasHeight: REF_H,
        paddleHeight
      });
      m.ai.userId = AI_USER_ID;
      ensureScoreEntryForUser(m, AI_USER_ID);
      const assignments = ensureSideAssignments(m);
      assignments[m.ai.side ?? "right"] = AI_USER_ID;
    }
    if (isAi) {
      if (!m.aiConnection) {
        m.aiConnection = {
          side: m.ai?.side ?? "right",
          ws: createDummyAiSocket(),
          userId: AI_USER_ID,
          isAi: true
        };
        m.connections.add(m.aiConnection);
      } else {
        m.aiConnection.side = m.ai?.side ?? m.aiConnection.side;
      }
    } else if (!isAi && m.aiConnection) {
      m.connections.delete(m.aiConnection);
      m.aiConnection = null;
    }
    if (m.creationTimeout === undefined) m.creationTimeout = null;
    if (m.creationCountdownInterval === undefined) m.creationCountdownInterval = null;
    if (m.creationCountdown === undefined) m.creationCountdown = null;
    updateMatchmakingJoinState(m);
  }
  scheduleInitialJoinTimeout(m);
  refreshSideAssignments(m);
  syncScoreToState(m);
  return m;
}

/* -------------------------------------------------------
 * Entrée WS Fastify
 * ----------------------------------------------------- */
export async function wsGameLogic(fastify, options) {
  fastify.get("/api/ws_game_logic/:matchId", { websocket: true, preValidation: [fastify.authenticate] }, (connection, request) => {
    const { matchId } = request.params || {};
    const url = new URL(request.url, "http://localhost");
    const sideQuery = url.searchParams.get("side");
    const userId = request.token?.id;

    // Récupère ou crée la partie
    const match = ensureMatch(matchId, fastify);

    if (!match) {
      try { connection.send(JSON.stringify({ type: "error", message: "Match not found" })); } catch { }
      try { connection.close(1008, "Match not found"); } catch { }
      return;
    }

    if (match.connections.size >= 2) {
      try { connection.send(JSON.stringify({ type: "error", message: "Room full" })); } catch { }
      try { connection.close(1008, "Room full"); } catch { }
      return;
    }

    const occupied = new Set([...match.connections].map(c => c.side));
    if (match.isAi && match.ai?.side) {
      occupied.add(match.ai.side);
    }
    const reservedSides = new Set([...match.reconnectTimers.keys()]); // 'left'/'right'
    let side;

    // 1) Si le client demande explicitement un côté (?side=left|right)
    if (sideQuery === "left" || sideQuery === "right") {
      side = sideQuery;

      // Autoriser la reconnection sur un slot réservé.
      // Refuser uniquement si le côté est déjà occupé activement.
      if (occupied.has(side)) {
        try { connection.send(JSON.stringify({ type: "error", message: "Side already taken" })); } catch { }
        try { connection.close(1008, "Side already taken"); } catch { }
        return;
      }
    } else {
      // 2) Choix auto: privilégier un côté libre non réservé (pour éviter de voler un slot réservé)
      const candidateLeft = !occupied.has("left") && !reservedSides.has("left");
      const candidateRight = !occupied.has("right") && !reservedSides.has("right");

      if (candidateLeft) side = "left";
      else if (candidateRight) side = "right";
      else {
        // Si aucun côté non réservé n'est dispo, prendre un côté libre même réservé (cas limite)
        const fallbackLeft = !occupied.has("left");
        const fallbackRight = !occupied.has("right");
        if (fallbackLeft) side = "left";
        else if (fallbackRight) side = "right";
        else {
          try { connection.send(JSON.stringify({ type: "error", message: "Room full" })); } catch { }
          try { connection.close(1008, "Room full"); } catch { }
          return;
        }
      }
    }

    // Enregistre la connexion
    const conn = { side, ws: connection, userId };
    match.connections.add(conn);
    if (!conn.isAi) {
      const humans = getHumanConnections(match);
      if (humans.length >= 2 || match.isAi) {
        clearCreationTimers(match);
      } else {
        scheduleInitialJoinTimeout(match);
      }
    }
    debugLogAllMatchUsers();

    ensureScoreEntryForUser(match, userId);
    updateMatchmakingJoinState(match);

    const changedConns = refreshSideAssignments(match);
    const effectiveSide = conn.side;
    clearInputsForSide(match, effectiveSide);

    const roleRecipients = new Set(changedConns);
    roleRecipients.add(conn);
    for (const recipient of roleRecipients) {
      try {
        recipient.ws.send(JSON.stringify({ type: "role", side: recipient.side }));
      } catch {}
    }

    // Si ce côté était en attente de reconnexion → on annule le timer et on relance le jeu
    const pending = match.reconnectTimers.get(effectiveSide);
    if (pending) {
      clearTimeout(pending);
      match.reconnectTimers.delete(effectiveSide);
      match.paused = false;
      resetBall(match);
      startCountdown(match, 2);
      broadcast(match, {
        type: "info_game",
        countdown: match.state.countdown,
        score: match.state.score,
        gameOver: match.state.gameOver,
        paused: false,
        players: match.state.players
      });
    }

    // Envoie l’état initial au nouveau client
    try {
      connection.send(JSON.stringify(match.state.leftPaddle));
      connection.send(JSON.stringify(match.state.rightPaddle));
      connection.send(JSON.stringify(match.state.ball));
      connection.send(JSON.stringify({
        type: "info_game",
        countdown: match.state.countdown,
        score: match.state.score,
        gameOver: match.state.gameOver,
        paused: match.paused,
        players: match.state.players
      }));
    } catch { }

    // Démarre si les conditions sont réunies
    maybeStart(match);

    // Ping de keep-alive
    const ping = setInterval(() => {
      try { connection.ping(); } catch { }
    }, 15000);

    /* ---------------------------------------------
     * Messages entrants (contrôles, surrender, etc.)
     * ------------------------------------------- */
    connection.on("message", (raw) => {
      let parsed;
      try {
        parsed = JSON.parse(raw);

        if (!parsed || typeof parsed !== 'object') {
          console.warn("WS: Invalid message format");
          return;
        }

        const { type, controls } = parsed;

        if (type && typeof type !== 'string') {
          console.warn("WS: Invalid type field");
          return;
        }

        // Bouton "Start" (au repos)
        if (controls?.start === true && match.state.gameOver === false && (!match.state.ball.moving && match.state.countdown === 0)) {
          startCountdown(match);
        }
        // "Start" après fin de partie → reset complet et nouveau départ
        else if (controls?.start === true && match.state.gameOver === true && !match.ended) {
          match.state.gameOver = false;
          resetBall(match);
          resetScore(match);
          startCountdown(match);
        }

        // Mise à jour des entrées paddles (état des touches)
        if (type === "controls" && controls && !match.ended) {
          const side = conn.side;
          const sideControls = side ? (controls[side] ?? controls) : null;
          const target = side ? match.inputs?.[side] : null;
          if (sideControls && target) {
            target.up = !!sideControls.up;
            target.down = !!sideControls.down;
          }
        }

        // Contrôles fournis par l'IA via un client qui relaie la commande
        // Format attendu: { type: 'ai_controls', side: 'left'|'right', command: 'up'|'down'|'stop' }
        if (type === 'ai_controls' && !match.ended && parsed) {
          const sideTarget = parsed.side;
          const cmd = parsed.command;
          const target = sideTarget ? match.inputs?.[sideTarget] : null;
          if (target) {
            if (cmd === 'up') {
              target.up = true;
              target.down = false;
            } else if (cmd === 'down') {
              target.up = false;
              target.down = true;
            } else {
              target.up = false;
              target.down = false;
            }
          }
        }

        // Reddition volontaire (événement "surrend" conservé)
        if (type === "surrend") {
          if (match.ended) return;

          const winner = conn.side === "left" ? "right" : "left";
          // Met le score du vainqueur directement au score cible (3)
          if (winner === "left") setScoreForSide(match, "left", TARGET_SCORE);
          else setScoreForSide(match, "right", TARGET_SCORE);

          finalizeMatch(match, winner, "surrender");
          return;
        }

        if (type === "surrend") {
          const winner = conn.side === "left" ? "right" : "left";
          finalizeMatch(match, winner, "disconnect");
        }
      } catch (err) {
        console.log("WS parse error:", err);
      }
    });

    /* ---------------------------------------------
     * Fermeture de la socket (quit / refresh)
     * → Démarre la fenêtre de reconnexion.
     * Si le joueur ne revient pas à temps → victoire adverse à 3.
     * ------------------------------------------- */
    connection.on("close", (code, reason) => {
      clearInterval(ping);
      match.connections.delete(conn);
      clearInputsForSide(match, conn.side);
      const changedAfterLeave = refreshSideAssignments(match);
      for (const recipient of changedAfterLeave) {
        try { recipient.ws.send(JSON.stringify({ type: "role", side: recipient.side })); } catch {}
      }

      const isPreGamePhase = match.type === "mm" && !match.initialPlayersReady;
      if (match.type === "mm") {
        updateMatchmakingJoinState(match);
      }

      if (match.ended) return;

      if (isPreGamePhase) {
        return;
      }

      // Met la partie en pause visible côté clients
      match.paused = true;
      broadcast(match, {
        type: "info_game",
        countdown: match.state.countdown,
        score: match.state.score,
        gameOver: match.state.gameOver,
        paused: true,
        players: match.state.players
      });

      // Annule un éventuel timer existant pour ce côté
      const prev = match.reconnectTimers.get(conn.side);
      if (prev) clearTimeout(prev);

      // Démarre la fenêtre de reconnexion
      const t = setTimeout(() => {
        if (match.ended) return;

        // Vérifie si le joueur manquant est revenu entre-temps
        const stillMissing = ![...match.connections].some(c => c.side === conn.side);

        if (stillMissing) {
          // Victoire de l’adversaire
          const winner = conn.side === "left" ? "right" : "left";

          // Score du vainqueur mis à 3 (TARGET_SCORE)
          if (winner === "left") setScoreForSide(match, "left", TARGET_SCORE);
          else setScoreForSide(match, "right", TARGET_SCORE);

          finalizeMatch(match, winner, "disconnect");
        } else {
          // Le joueur s'est reconnecté pendant la fenêtre : reprise
          match.paused = false;
          broadcast(match, {
            type: "info_game",
            countdown: match.state.countdown,
            score: match.state.score,
            gameOver: match.state.gameOver,
            paused: false,
            players: match.state.players
          });
        }

        // Nettoie l’entrée côté reconnect
        match.reconnectTimers.delete(conn.side);
      }, RECONNECT_GRACE_MS);

      // Réserve le "slot" de ce côté pendant la fenêtre (empêche le vol de place)
      match.reconnectTimers.set(conn.side, t);
    });

  });
}


// Quand tu joins une partie avec l'invite direct et que tu fais le bug magique ca casse les conversations
// quitter la partie en changeant de path fout tout en l'air a cause probablement de l'overlay des 5 secondes ou du websocket
// quand tu forfais apres avoir fait le bug magique la partie a l'air de continuer en arriere plan ce qui fait qu'apres l'overlay de fin on a un score qui change
