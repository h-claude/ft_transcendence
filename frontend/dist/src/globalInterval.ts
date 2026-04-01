declare global {
	interface Window {
		clearAllIntervals: () => void;
	}
}

const intervalIds: number[] = [];

const originalSetInterval = window.setInterval;

window.setInterval = function (callback: TimerHandler, delay?: number, ...args: any[]): number {
	const id = originalSetInterval(callback, delay, ...args);
	intervalIds.push(id);
	return id;
}

window.clearAllIntervals = function (): void {
	intervalIds.forEach(id => clearInterval(id));
	intervalIds.length = 0;
}

export { intervalIds };
