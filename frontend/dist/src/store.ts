import { User } from "./types/user";

export class UserStore extends EventTarget {
	private static instance: UserStore;
	private user: User | null = null;

	private constructor() {
		super();
	}

	static getInstance(): UserStore {
		if (!UserStore.instance) {
			UserStore.instance = new UserStore();
		}
		return (UserStore.instance);
	}

	async setUser() {
		const r = await fetch("/api/users", {
			method: "GET",
			credentials: "include"
		});
		const j = await r.json();
		if (!j.success || !j.message) {
			console.log("cannot fetch user");
			this.clearUser();
			throw new Error("Failed to load user profile");
		}
		j.message.userImageInfos = JSON.parse(j.message.UserImageInfos);
		this.clearUser();
		this.user = j.message;
		if (!this.user) {
			console.log("cannot fetch user");
			return;
		}
		this.user.twoFactorEnabled = !!this.user.twoFactorEnabled;
		if (typeof this.user.twoFactorRecoveryCodesRemaining !== "number") {
			this.user.twoFactorRecoveryCodesRemaining =
				this.user.twoFactorRecoveryCodesRemaining == null
					? null
					: Number(this.user.twoFactorRecoveryCodesRemaining) || 0;
		}

		if (this.user.userImageInfos.hasProfilePicture) {
			await fetch(`/api/images/user/${this.user.id}/pp`, {
				method: 'GET',
				credentials: 'include'
			}).then(response => response.blob())
				.then(blob => {
					const url = URL.createObjectURL(blob);
					const u = UserStore.getInstance().getUser();
					if (!u) return;
					u.userImageInfos.profilePicture = url;
				})
		}
		if (this.user.userImageInfos.hasProfileBackgroundPicture) {
			await fetch(`/api/images/user/${this.user.id}/bg`, {
				method: 'GET',
				credentials: 'include'
			}).then(response => response.blob())
				.then(blob => {
					const url = URL.createObjectURL(blob);
					const u = UserStore.getInstance().getUser();
					if (!u) return;
					u.userImageInfos.profileBackgroundPicture = url;
				})
		}
		if (this.user.userImageInfos.hasProfileCardPicture) {
			await fetch(`/api/images/user/${this.user.id}/card`, {
				method: 'GET',
				credentials: 'include'
			}).then(response => response.blob())
				.then(blob => {
					const url = URL.createObjectURL(blob);
					const u = UserStore.getInstance().getUser();
					if (!u) return;
					u.userImageInfos.profileCardPicture = url;
				})
		}
		localStorage.setItem("user", JSON.stringify(this.user));
	}

	getUser(): User | null {
		if (!this.user) {
			const storedUser = localStorage.getItem("user");
			if (storedUser) {
				this.user = JSON.parse(storedUser);
			}
		}
		return (this.user);
	}

	clearUser() {
		this.user = null;
		localStorage.removeItem("user");
	}

	async resetUser() {
		this.clearUser();
		await this.setUser();
	}
}
