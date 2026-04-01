export class SettingsImagesAPI {
	static async profileImageChangeToDefault() {
		await fetch("/api/images/user/pp/default", {
			method: "PATCH",
			credentials: "include"
		});
	}

	static async cardImageChangeToDefault() {
		await fetch("/api/images/user/card/default", {
			method: "PATCH",
			credentials: "include"
		});
	}

	static async bgImageChangeToDefault() {
		await fetch("/api/images/user/bg/default", {
			method: "PATCH",
			credentials: "include"
		});
	}

	static async uploadProfileImage(file: File) {
		const formData = new FormData();
		formData.append("image", file);
		const r = await fetch("/api/images/user/pp", {
			method: "PATCH",
			credentials: "include",
			// headers: {"content-type": "multipart/form-data"},
			body: formData
		});
		if (r.ok) {
			console.log("image sent");
		} else {
			console.log("nope upload");
		}
	}

	static async uploadCardImage(file: File) {
		const formData = new FormData();
		formData.append("image", file);
		const r = await fetch("/api/images/user/card", {
			method: "PATCH",
			credentials: "include",
			// headers: {"content-type": "multipart/form-data"},
			body: formData
		});
		if (r.ok) {
			console.log("image sent");
		} else {
			console.log("nope upload");
		}
	}

	static async uploadBgImage(file: File) {
		const formData = new FormData();
		formData.append("image", file);
		const r = await fetch("/api/images/user/bg", {
			method: "PATCH",
			credentials: "include",
			// headers: {"content-type": "multipart/form-data"},
			body: formData
		});
		if (r.ok) {
			console.log("image sent");
		} else {
			console.log("nope upload");
		}
	}

	static async getDefaultProfilePicture(): Promise<string> {
		var dfp: string;
		const r = await fetch('/api/images/defaultPp', {
			method: "GET",
			credentials: "include"
		})
		const blob = await r.blob();
		dfp = URL.createObjectURL(blob);
		return (dfp);
	}
}
