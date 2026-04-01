export class SettingsImagesEmitter extends EventTarget {
	private static instance: SettingsImagesEmitter | null = null;

	private constructor() {
		super();
	}

	static getInstance(): SettingsImagesEmitter {
		if (!SettingsImagesEmitter.instance) {
			SettingsImagesEmitter.instance = new SettingsImagesEmitter();
		}
		return (SettingsImagesEmitter.instance);
	}

	/** dispatchs profilePictureChanged */
	profilePictureChanged() {
		this.dispatchEvent(new Event("profilePictureChanged"));
	}
	/** dispatchs bgPictureChanged */
	bgPictureChanged() {
		this.dispatchEvent(new Event("bgPictureChanged"));
	}
	/** dispatchs cardPictureChanged */
	cardPictureChanged() {
		this.dispatchEvent(new Event("cardPictureChanged"));
	}
}
