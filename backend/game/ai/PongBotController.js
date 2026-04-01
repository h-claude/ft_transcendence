// backend/game/ai/PongBotController.js
// Contrôleur de bot IA indépendant pour le mode Pong

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Crée un contrôleur d'IA simple pour Pong.
 * Le contrôleur stocke uniquement des informations nécessaires
 * pour lisser les mouvements et introduire un délai de réaction réaliste.
 */
export function createPongBotController({
	side = "right",
	canvasHeight,
	paddleHeight,
	reactionDelayMs = 1000,
	errorMarginPx = 50,
	speedFactor = 5
}) {
	return {
		side,
		canvasHeight,
		paddleHeight,
		reactionDelayMs,
		errorMarginPx,
		speedFactor,
		lastDecisionTs: 0,
		targetY: canvasHeight / 2,
		lastBall: null,
	};
}

function predictImpactY(ball, paddleX, canvasHeight) {
	let {x, y, vx, vy, radius } = ball;
	let impactX = paddleX;
	let maxSteps = 100;
	let steps = 0;

	while ((vx > 0 && x < impactX) || (vx < 0 && x > impactX)) {
		if (steps++ > maxSteps)
			break;
		x += vx;
		y += vy;

		if (y - radius <= 0 || y + radius >= canvasHeight) {
			vy *= -1;
		}

	}
	const error = (Math.random() - 0.5) * 50;
	return y + error;
}

function sendAICommand(match, side, command) {
	//console.log(`Envoi commande IA: side=${side}, command=${command}`);
	for (const conn of match.connections) {
		try {
			const rs = conn.ws && conn.ws.readyState;
			//console.log(`  connexion: side=${conn.side}, readyState=${rs}`);
					// Broadcast ai_command to all real clients (skip server-side ai connection if any)
					if (!conn.isAi) {
						try {
							conn.ws.send(JSON.stringify({ type: "ai_command", side, command }));
							//console.log(`  Envoi message to client (side=${conn.side})... OK`);
						} catch (err) {
							console.log("  Envoi message... ERREUR:", err && err.message ? err.message : err);
						}
					}
		} catch (err) {
			console.log("  Skipping connexion due to error:", err && err.message ? err.message : err);
		}
	}
}

export function updatePongBot(match) {
	const s = match.state;
	const bot = match.ai;
	//console.log("UpdatePongBot appelé:", bot.side, bot.targetY);
	if (!bot || !s || !s.ball)
		return;


	const paddle = s.rightPaddle;
	const { ball } = s;

	if (!paddle || !ball || s.gameOver || !ball.moving) {
		return;
	}

	const now = Date.now();

	let ballVector = (
		(bot.side === "right" && ball.vx > 0) || (bot.side === "left" && ball.vx < 0)
	);

	if (ballVector) {
		if (now - bot.lastDecisionTs >= bot.reactionDelayMs || !bot.lastBall) {
			bot.lastDecisionTs = now;

			bot.lastBall = { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy };

			const impactY = predictImpactY(bot.lastBall, (bot.side === "left" ? s.leftPaddle.x : s.rightPaddle.x) + s.leftPaddle.w, bot.canvasHeight);

			// const errorOffset = (Math.random() - 0.5) * bot.errorMarginPx;
			let targetY = impactY - bot.paddleHeight / 2;

			targetY = clamp(targetY, 0, bot.canvasHeight - bot.paddleHeight);

			bot.targetY = bot.targetY ? bot.targetY + (targetY - bot.targetY) * 0.8: targetY;
		}
	} else {
		const centerY = (bot.canvasHeight - bot.paddleHeight) / 2;
		bot.targetY = centerY;
	}

	const deltaY = bot.targetY - paddle.y;
	const threshold = 6;

	// if (deltaY > threshold) {
	// 	sendAICommand(match, bot.side, "down");
	// } else if ( deltaY < -threshold) {
	// 	sendAICommand(match, bot.side, "up");
	// } else {
	// 	sendAICommand(match, bot.side, "stop");
	// }
	const moveY = clamp(deltaY, -bot.speedFactor, bot.speedFactor);
	paddle.y = clamp(paddle.y + moveY, 0, bot.canvasHeight - paddle.h);

}

// /**
//  * Met à jour le paddle contrôlé par l'IA pour se rapprocher de la balle.
//  * @param {ReturnType<typeof createPongBotController>} botState
//  * @param {object} matchState - état complet du match (paddles, balle, score…)
//  */
// export function updatePongBot(match) {

// 	const botState = match.ai;
// 	const matchState = match.state;
// 	if (!botState) return;
// 	const paddle = botState.side === "left" ? matchState.leftPaddle : matchState.rightPaddle;
// 	const { ball } = matchState;

// 	if (!paddle || !ball || matchState.gameOver || !ball.moving) {
// 		return;
// 	}

// 	const now = Date.now();

// 	// Le bot ne prend une nouvelle décision qu'après un délai défini,
// 	// et se décale de quelques pixels aléatoires pour rester battable.
// 	if (now - botState.lastDecisionTs >= botState.reactionDelayMs) {
// 		botState.lastDecisionTs = now;
// 		const randomOffset = (Math.random() - 0.5) * botState.errorMarginPx;
// 		const desired = ball.y - paddle.h / 2 + randomOffset;
// 		const clamped = clamp(desired, 0, botState.canvasHeight - paddle.h);

// 		// Filtrage pour adoucir la cible, l’IA “anticipe” moins brutalement
// 		botState.targetY = botState.targetY + (clamped - botState.targetY) * 0.35;
// 	}

// 	const diff = botState.targetY - paddle.y;
// 	if (Math.abs(diff) < 0.5) {
// 		return;
// 	}

// 	const maxStep = paddle.speed * (botState.speedFactor ?? 0.75);
// 	const step = clamp(diff, -maxStep, maxStep);
// 	paddle.y = clamp(paddle.y + step, 0, botState.canvasHeight - paddle.h);
// }
