export class FriendsListUIEmitter extends EventTarget {
	private static instance: FriendsListUIEmitter | null = null;

	private constructor() {
		super();
	}

	static getInstance(): FriendsListUIEmitter {
		if (!FriendsListUIEmitter.instance) {
			FriendsListUIEmitter.instance = new FriendsListUIEmitter();
		}
		return FriendsListUIEmitter.instance;
	}

	dispatchSimpleEvent(event: string) {
		this.dispatchEvent(new Event(event));
	}
}
