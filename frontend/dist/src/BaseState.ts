type Listener<T = any> = (data: T) => void;

/**
 * Abstract class implementing the core utilities and logic of the
 * State classes. Uses singleton pattern without a private constructor,
 * So make sure to NEVER EVER call a new on a State class. getInstance instead.
 * If at any point a better solution with a private constructor is found,
 * we should make sure to consider switching to it.
 * The resetInstance() method for every class extending this one should
 * be called on exit.
 */
export abstract class BaseState {
	private static instances: Record<string, BaseState> = {};
	private eventListeners: Record<string, ((...args: any[]) => void)[]> = {};

	public constructor() {
		if (new.target === BaseState) {
			console.error("unable to instantiate BaseState directly")
		}
	}

	static async getInstance<T extends BaseState>(this: { new(): T }): Promise<T> {
		const className = this.name;
		if (!BaseState.instances[className]) {
			const instance = new this();
			BaseState.instances[className] = instance;
			await instance.init();
		}
		return BaseState.instances[className] as T;
	}

	protected abstract init(): Promise<void>;

	public abstract clear(): void;

	static resetInstance<T extends BaseState>(this: { new(): T }): void {
		const className = this.name;
		if (BaseState.instances[className]) {
			BaseState.instances[className].clear();
			delete BaseState.instances[className];
		}
	}

	on(event: string, callback: Listener): void {
		if (!this.eventListeners[event]) {
			this.eventListeners[event] = [];
		}
		this.eventListeners[event].push(callback);
	}

	emit(event: string, data?: any): void {
		if (this.eventListeners[event]) {
			this.eventListeners[event].forEach(callback => callback(data));
		}
	}
}
