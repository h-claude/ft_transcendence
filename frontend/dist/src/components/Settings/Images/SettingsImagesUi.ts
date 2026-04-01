import { UserStore } from "../../../store.js";
import { SettingsImagesAPI } from "./SettingsImagesAPI.js";
import { SettingsImagesEmitter } from "./SettingsImagesEmitter.js";

export class SettingsImagesUi {
		private settingsProfileImg: HTMLImageElement;
		private settingsProfileImgSyncDefault: HTMLElement;
		private settingsProfileImgUpload: HTMLInputElement;
		private settingsCardImg: HTMLImageElement;
		private settingsCardImgUpload: HTMLInputElement;
		private settingsCardImgSyncDefault: HTMLElement;
		private settingsBgImg: HTMLImageElement;
		private settingsBgImgSyncDefault: HTMLElement;
		private settingsBgImgUpload: HTMLInputElement;

	constructor() {
		this.settingsProfileImg = document.getElementById("settingsProfileImg")! as HTMLImageElement;
		this.settingsProfileImgSyncDefault = document.getElementById("settingsProfileImgSyncDefault")!;
		this.settingsProfileImgUpload = document.getElementById("settingsProfileImgUpload")! as HTMLInputElement;
		this.settingsCardImg = document.getElementById("settingsCardImg")! as HTMLImageElement;
		this.settingsCardImgUpload = document.getElementById("settingsCardImgUpload")! as HTMLInputElement;
		this.settingsCardImgSyncDefault = document.getElementById("settingsCardImgSyncDefault")!;
		this.settingsBgImg = document.getElementById("settingsBgImg")! as HTMLImageElement;
		this.settingsBgImgSyncDefault = document.getElementById("settingsBgImgSyncDefault")!;
		this.settingsBgImgUpload = document.getElementById("settingsGbImgUpload")! as HTMLInputElement;
	}

	async renderProfileImage() {
		// TODO a remplacer par une fonction specifique pour update une des images
		await UserStore.getInstance().setUser();
		const u = UserStore.getInstance().getUser();
		if (!u) return ;
		if (u.userImageInfos.hasProfilePicture && u.userImageInfos.profilePicture) {
			this.settingsProfileImg.src = u.userImageInfos.profilePicture;
		} else {
			this.settingsProfileImg.removeAttribute("src");
			this.settingsProfileImg.src = await SettingsImagesAPI.getDefaultProfilePicture();
		}
	}
	async renderCardImage() {
		// TODO a remplacer par une fonction specifique pour update une des images
		await UserStore.getInstance().setUser();
		const u = UserStore.getInstance().getUser();
		if (!u) return ;
		if (u.userImageInfos.hasProfileCardPicture && u.userImageInfos.profileCardPicture) {
			this.settingsCardImg.src = u.userImageInfos.profileCardPicture;
		} else {
			this.settingsCardImg.removeAttribute("src");
			this.settingsCardImg.style.backgroundColor = "black";
		}
	}
	async renderBackgroundImage() {
		// TODO a remplacer par une fonction specifique pour update une des images
		await UserStore.getInstance().setUser();
		const u = UserStore.getInstance().getUser();
		if (!u) return ;
		if (u.userImageInfos.hasProfileBackgroundPicture && u.userImageInfos.profileBackgroundPicture) {
			this.settingsBgImg.src = u.userImageInfos.profileBackgroundPicture;
		} else {
			this.settingsBgImg.removeAttribute("src");
			this.settingsBgImg.style.backgroundColor = "black";
		}
	}

	async setupListeners() {
		this.settingsProfileImgSyncDefault.onclick = async (e) => {
			e.preventDefault;
			await SettingsImagesAPI.profileImageChangeToDefault();
			await this.renderProfileImage();
			SettingsImagesEmitter.getInstance().profilePictureChanged();
		}
		this.settingsBgImgSyncDefault.onclick = async (e) => {
			e.preventDefault;
			await SettingsImagesAPI.bgImageChangeToDefault();
			await this.renderBackgroundImage();
			SettingsImagesEmitter.getInstance().bgPictureChanged();
		}
		this.settingsCardImgSyncDefault.onclick = async (e) => {
			e.preventDefault;
			await SettingsImagesAPI.cardImageChangeToDefault();
			await this.renderCardImage();
			SettingsImagesEmitter.getInstance().cardPictureChanged();
		}

		this.settingsProfileImgUpload.addEventListener("change", async (e) => {
			e.preventDefault();
			const file = this.settingsProfileImgUpload.files?.[0];
			if (file) {
				await SettingsImagesAPI.uploadProfileImage(file);
				await this.renderProfileImage();
				SettingsImagesEmitter.getInstance().profilePictureChanged();
			}
		});
		this.settingsCardImgUpload.addEventListener("change", async (e) => {
			e.preventDefault();
			const file = this.settingsCardImgUpload.files?.[0];
			if (file) {
				await SettingsImagesAPI.uploadCardImage(file);
				await this.renderCardImage();
				SettingsImagesEmitter.getInstance().cardPictureChanged();
			}
		});
		this.settingsBgImgUpload.addEventListener("change", async (e) => {
			e.preventDefault();
			const file = this.settingsBgImgUpload.files?.[0];
			if (file) {
				await SettingsImagesAPI.uploadBgImage(file);
				await this.renderBackgroundImage();
				SettingsImagesEmitter.getInstance().bgPictureChanged();
			}
		});
	}
}
