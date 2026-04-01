import "./globalInterval.js"
import * as Pages from "./pages/index.js"
import { Component } from "./Component.js"
import { WebSocketManager } from "./WebSocketManager.js";
import { UserStore } from "./store.js";
import { GlobalSocket } from "./GlobalSocket.js";
import { GlobalEmitter } from "./GlobalEmitter.js";
import { ChatUIEmitter } from "./components/Chat/ChatUIEmitter.js";
import { ChatSocket } from "./components/Chat/ChatSocket.js";

type NavigateOptions = {
	skipGameRedirectOverlay?: boolean;
	dontPushState?: boolean;
};

const routes: Record<string, { new(): Component }> = {
	'/': Pages.Home,
	'/login': Pages.Login,
	'/register': Pages.Register,
	'/accountRecovery': Pages.AccountRecovery,
	'/settings': Pages.Settings,
	'/profile': Pages.Profile,
	'/game': Pages.GamePage,
	'/gamehome': Pages.GameHome,
	'/tournamentLobby': Pages.TournamentLobby,
	'/tournamentPage': Pages.TournamentPage,
	'/leaderboard': Pages.Leaderboard
};

const root = document.getElementById('app')!;

let currentComponent: Component | null = null;

type MatchStatusPayload = {
	matchId: number;
	matchStatus: "pending" | "ongoing" | "finished" | "canceled";
	matchType: string;
	initiator: boolean;
	opponentId: number;
};

type GameInfosApiResponse = {
	success?: boolean;
	message?: unknown;
};

function parseMatchStatusPayload(raw: unknown): MatchStatusPayload | null {
	if (typeof raw !== "string") return null;
	try {
		return JSON.parse(raw) as MatchStatusPayload;
	} catch {
		return null;
	}
}

let matchRedirectOverlay: HTMLDivElement | null = null;
let matchRedirectOverlayTimeoutId: number | undefined;
let matchRedirectOverlayIntervalId: number | undefined;
let matchRedirectOverlayFinish: (() => void) | null = null;

function cleanupMatchRedirectOverlay(): void {
	if (matchRedirectOverlayTimeoutId !== undefined) {
		window.clearTimeout(matchRedirectOverlayTimeoutId);
		matchRedirectOverlayTimeoutId = undefined;
	}
	if (matchRedirectOverlayIntervalId !== undefined) {
		window.clearInterval(matchRedirectOverlayIntervalId);
		matchRedirectOverlayIntervalId = undefined;
	}
	if (matchRedirectOverlay && matchRedirectOverlay.parentElement) {
		matchRedirectOverlay.parentElement.removeChild(matchRedirectOverlay);
	}
	matchRedirectOverlay = null;
	matchRedirectOverlayFinish = null;
}

function cancelMatchRedirectOverlay(): void {
	if (matchRedirectOverlayFinish) {
		const finish = matchRedirectOverlayFinish;
		matchRedirectOverlayFinish = null;
		finish();
	} else {
		cleanupMatchRedirectOverlay();
	}
}

async function showMatchRedirectOverlay(opts: {
	title: string;
	message: string;
	seconds?: number;
	actionLabel?: string;
}): Promise<void> {
	const seconds = Math.max(1, opts.seconds ?? 5);
	cancelMatchRedirectOverlay();

	return new Promise((resolve) => {
		let remaining = seconds;
		let resolved = false;

		const finish = () => {
			if (resolved) return;
			resolved = true;
			matchRedirectOverlayFinish = null;
			cleanupMatchRedirectOverlay();
			resolve();
		};
		matchRedirectOverlayFinish = finish;

		const overlay = document.createElement("div");
		overlay.id = "match-redirect-overlay";
		overlay.className =
			"fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 backdrop-blur-sm";

		const frame = document.createElement("div");
		frame.className =
			"w-[90%] max-w-md rounded-3xl border border-purple-500/40 bg-[#101018] p-8 text-center text-white shadow-2xl shadow-purple-900/40";

		const titleEl = document.createElement("h2");
		titleEl.className = "mb-3 text-2xl font-bold tracking-tight text-purple-200";
		titleEl.textContent = opts.title;

		const messageEl = document.createElement("p");
		messageEl.className = "mb-5 text-sm font-medium text-white/80";
		messageEl.textContent = opts.message;

		const countdownEl = document.createElement("p");
		countdownEl.className = "mb-6 text-lg font-semibold text-white";
		const countdownValue = document.createElement("span");
		countdownValue.className = "mx-1 text-2xl";
		countdownValue.textContent = String(remaining);
		countdownEl.append("Redirection dans ", countdownValue, " s...");

		frame.appendChild(titleEl);
		frame.appendChild(messageEl);
		frame.appendChild(countdownEl);
		overlay.appendChild(frame);
		document.body.appendChild(overlay);
		matchRedirectOverlay = overlay;

		matchRedirectOverlayIntervalId = window.setInterval(() => {
			remaining -= 1;
			if (remaining <= 0) {
				countdownValue.textContent = "0";
				finish();
				return;
			}
			countdownValue.textContent = String(remaining);
		}, 1000) as unknown as number;

		matchRedirectOverlayTimeoutId = window.setTimeout(finish, seconds * 1000) as unknown as number;
	});
}

const directGameAcceptedHandler = async () => {
	ChatUIEmitter.getInstance().removeTrackedListeners();
	const t = await ChatSocket.getInstance();
	t.destroyListeners();
	t.destroyInstance();
	if (window.location.pathname !== "/game") {
		await showMatchRedirectOverlay({
			title: "Match accepte",
			message: "Tu vas etre redirige vers la partie dans 5 secondes.",
			seconds: 5,
		});
	}
	await navigate("/game", { skipGameRedirectOverlay: true, dontPushState: false });
}

const gameForfeitedHandler = async () => {
	ChatUIEmitter.getInstance().removeTrackedListeners();
	const t = await ChatSocket.getInstance();
	t.destroyListeners();
	t.destroyInstance();
	navigate("/");
}

const mmGameFoundHandler = async () => {
	if (window.location.pathname !== "/game") {
		await showMatchRedirectOverlay({
			title: "Match trouve",
			message: "Tu vas etre redirige vers la partie dans 5 secondes.",
			seconds: 5,
		});
	}
	await navigate("/game", { skipGameRedirectOverlay: true, dontPushState: false });
}

const aiGameStartedHandler = async () => {
	if (window.location.pathname === "/game") {
		return;
	}
	await navigate("/game", { skipGameRedirectOverlay: true, dontPushState: false });
}

export async function navigate(path: string, options: NavigateOptions = {}): Promise<void> {
	cancelMatchRedirectOverlay();

	if (currentComponent instanceof Pages.GameHome) {
		(currentComponent as Pages.GameHome).destroy();
	}

	const normalizePath = (value: string): string => {
		const [base] = value.split("?");
		return base && base.length > 0 ? base : "/";
	};

	let targetPath = path;
	let normalizedPath = normalizePath(targetPath);
	let ComponentClass = routes[normalizedPath];

	if (!ComponentClass) {
		if (normalizedPath.startsWith("/api/")) {
			window.location.href = targetPath;
			return;
		}
		root.innerHTML = `<h1 class="text-center text-red-500">404 - Page not found</h1>
						<div class="text-center"><a href="/">go back to the main page</a></div>`;
		window.history.pushState({ path: targetPath }, '', targetPath);
		return;
	}

	const setTargetPath = (nextPath: string) => {
		targetPath = nextPath;
		normalizedPath = normalizePath(targetPath);
		ComponentClass = routes[normalizedPath];
	};

	const jwtValidation = await fetch("/api/me", { credentials: "include" });
	const localMode = sessionStorage.getItem("pongMode") === "local";
	if (normalizedPath !== "/login" && normalizedPath !== "/register" && normalizedPath !== "/accountRecovery") {
		if (!jwtValidation.ok) {
			setTargetPath("/login");
			navigate(targetPath, options);
			return;
		} else {

			const globalEmitter = GlobalEmitter.getInstance();
			const globalSocket = await GlobalSocket.getInstance();
			await globalSocket.setupListeners();

			globalEmitter.removeEventListener("directGameAccepted", directGameAcceptedHandler);
			globalEmitter.removeEventListener("gameForfeited", gameForfeitedHandler);
			globalEmitter.removeEventListener("mmGameFound", mmGameFoundHandler);
			globalEmitter.removeEventListener("aiGameStarted", aiGameStartedHandler);
			globalEmitter.addEventListener("directGameAccepted", directGameAcceptedHandler);
			globalEmitter.addEventListener("gameForfeited", gameForfeitedHandler);
			globalEmitter.addEventListener("mmGameFound", mmGameFoundHandler);
			globalEmitter.addEventListener("aiGameStarted", aiGameStartedHandler);

			const ws = await WebSocketManager.getInstance();
			const s = await ws.getSocket();
			const u = UserStore.getInstance();
			if (!u.getUser()) {
				try {
					await u.setUser();
				} catch {
					await fetch("/api/logout", { method: "POST", credentials: "include" });
					u.clearUser();
					setTargetPath("/login");
					navigate(targetPath, options);
					return;
				}
			}
			const r = await fetch("/api/users/game/infos", { method: 'GET', credentials: "include" });
			const gameInfos = await r.json();
			const gameInfosTyped = gameInfos as GameInfosApiResponse;
			const rawMessage = gameInfosTyped?.message;
			const parsedMessage = parseMatchStatusPayload(rawMessage);
			const isNotInMatch = typeof rawMessage === "string" && rawMessage === "not in a match";
			const matchStatus = parsedMessage?.matchStatus;

			if (normalizedPath === "/game") {
				if (!localMode && (isNotInMatch || matchStatus === "pending")) {
					setTargetPath("/");
				}
			} else {
				if (!isNotInMatch && matchStatus === "ongoing") {
					if (
						normalizedPath !== "/game" &&
						window.location.pathname !== "/game" &&
						!options.skipGameRedirectOverlay
					) {
						await showMatchRedirectOverlay({
							title: "Match trouve",
							message: "Tu vas etre redirige vers la partie dans 5 secondes.",
							seconds: 5,
						});
					}
					setTargetPath("/game");
				}
			}
		}
	} else {
		if (jwtValidation.ok) {
			const ws = await WebSocketManager.getInstance();
			const s = await ws.getSocket();
			const u = UserStore.getInstance();
			if (!u.getUser()) {
				try {
					await u.setUser();
				} catch {
					await fetch("/api/logout", { method: "POST", credentials: "include" });
					u.clearUser();
					setTargetPath("/login");
					navigate(targetPath, options);
					return;
				}

			}

			const r = await fetch("/api/users/game/infos", { method: 'GET', credentials: "include" });
			const gameInfos = await r.json();
			const gameInfosTyped = gameInfos as GameInfosApiResponse;
			const rawMessage = gameInfosTyped?.message;
			const parsedMessage = parseMatchStatusPayload(rawMessage);
			const isNotInMatch = typeof rawMessage === "string" && rawMessage === "not in a match";
			const matchStatus = parsedMessage?.matchStatus;

			if (!isNotInMatch && matchStatus === "ongoing") {
				if (
					window.location.pathname !== "/game" &&
					!options.skipGameRedirectOverlay
				) {
					await showMatchRedirectOverlay({
						title: "Match trouve",
						message: "Tu vas etre redirige vers la partie dans 5 secondes.",
						seconds: 5,
					});
				}
				setTargetPath("/game");
			} else {
				setTargetPath("/");
			}
		}
	}

	(window as any).clearAllIntervals();
	currentComponent = new ComponentClass();
	currentComponent.setElement(root);
	if (!options.dontPushState) {
		window.history.pushState({ path: targetPath }, '', targetPath);
	}
	currentComponent.mount();
};

document.addEventListener('click', (e) => {
	const target = e.target as HTMLAnchorElement;
	if (target.tagName === 'A' && target.getAttribute('href')) {
		e.preventDefault();
		navigate(target.getAttribute('href')!);
	}
});

window.onpopstate = (event) => {
	if (event.state && event.state.path) {
		navigate(event.state.path, { dontPushState: true });
	} else {
		navigate(window.location.pathname + window.location.search, { dontPushState: true });
	}
};

navigate(window.location.pathname + window.location.search);
