type Listener = {
	type: string,
	callback: EventListenerOrEventListenerObject,
	options?: boolean | AddEventListenerOptions
};

export class TrackedEventTarget extends EventTarget {
	private _listeners: Listener[] = [];

	addEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean): void {
		super.addEventListener(type, callback, options);
		this._listeners.push({ type, callback, options });
	}

	removeTrackedListeners() {
		for (const { type, callback, options } of this._listeners) {
			super.removeEventListener(type, callback, options);
		}
		this._listeners = [];
	}
};
