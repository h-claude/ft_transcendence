export class GlobalEmitter extends EventTarget {
	private static instance: GlobalEmitter | null = null;

	private constructor() {
		super();
	}

	static getInstance(): GlobalEmitter {
		if (!GlobalEmitter.instance) {
			GlobalEmitter.instance = new GlobalEmitter();
		}
		return (GlobalEmitter.instance)
	}

	directGameAccepted() {
		this.dispatchEvent(new Event('directGameAccepted'));
	}
	gameForfeited() {
		this.dispatchEvent(new Event("gameForfeited"));
	}
	mmGameFound() {
		this.dispatchEvent(new Event("mmGameFound"));
	}
	aiGameStarted() {
		this.dispatchEvent(new Event("aiGameStarted"));
	}

}
